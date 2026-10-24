// api/dashboard/metrics.js
const { Pool } = require('pg');
const verifyToken = require('../utils/verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return; 

    if (user.role !== 'cliente') return res.status(403).json({ error: 'Acceso denegado' });

    const storeId = user.store_id;

    try {
        // 1. KPIs Principales
        const kpisResult = await pool.query(`
            SELECT 
                COALESCE(SUM(stock * purchase_price), 0) AS capital_invertido,
                COALESCE(SUM(stock * cache_price), 0) AS valor_proyectado,
                COUNT(*) FILTER (WHERE stock <= 5) AS alertas_stock
            FROM products WHERE store_id = $1
        `, [storeId]);

        // 2. Salud del Inventario (Para Gráfico de Dona)
        const healthResult = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE stock > 5) AS optimo,
                COUNT(*) FILTER (WHERE stock > 0 AND stock <= 5) AS bajo,
                COUNT(*) FILTER (WHERE stock = 0) AS agotado
            FROM products WHERE store_id = $1
        `, [storeId]);

        // 3. Concentración de Capital (Top 5 Productos con más dinero invertido)
        const capitalResult = await pool.query(`
            SELECT name, (stock * purchase_price) as total_value 
            FROM products 
            WHERE store_id = $1 AND stock > 0
            ORDER BY total_value DESC LIMIT 5
        `, [storeId]);

        // 4. Flujo del Almacén (Últimos 7 días desde el Kardex)
        const flowResult = await pool.query(`
            SELECT 
                TO_CHAR(operation_date, 'YYYY-MM-DD') as date,
                SUM(CASE WHEN quantity_changed > 0 THEN quantity_changed ELSE 0 END) as entradas,
                SUM(CASE WHEN quantity_changed < 0 THEN ABS(quantity_changed) ELSE 0 END) as salidas
            FROM kardex 
            WHERE store_id = $1 AND operation_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY TO_CHAR(operation_date, 'YYYY-MM-DD')
            ORDER BY date ASC
        `, [storeId]);

        // 5. Top Volumen por Unidades (Para gráfico de Barras Superior)
        const topVolumeResult = await pool.query(`
            SELECT name, stock 
            FROM products 
            WHERE store_id = $1 
            ORDER BY stock DESC LIMIT 5
        `, [storeId]);

        res.status(200).json({
            kpis: kpisResult.rows[0],
            health: healthResult.rows[0],
            capital: capitalResult.rows,
            flow: flowResult.rows,
            topVolume: topVolumeResult.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error cargando métricas' });
    }
};