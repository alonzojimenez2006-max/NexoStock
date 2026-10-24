// api/inventory/products.js
const { Pool } = require('pg');
const verifyToken = require('../utils/verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return; 

    // Solo los clientes (tiendas) pueden manejar inventario
    if (user.role !== 'cliente' || !user.store_id) {
        return res.status(403).json({ error: 'Acceso denegado. No perteneces a una tienda.' });
    }

    const { method } = req;
    const storeId = user.store_id;

    try {
        if (method === 'GET') {
            const result = await pool.query(
                'SELECT * FROM products WHERE store_id = $1 ORDER BY id DESC',
                [storeId]
            );
            return res.status(200).json(result.rows);
        }

        if (method === 'POST') {
            const { code, name, purchase_price, normal_price, cache_price, stock = 0 } = req.body;
            
            // Creamos el producto
            const productResult = await pool.query(
                `INSERT INTO products (store_id, code, name, entry_date, purchase_price, normal_price, cache_price, stock) 
                 VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7) RETURNING *`,
                [storeId, code, name, purchase_price, normal_price, cache_price, stock]
            );
            
            const newProduct = productResult.rows[0];

            // Si entra con stock inicial, lo registramos en el Kardex
            if (stock > 0) {
                await pool.query(
                    `INSERT INTO kardex (store_id, product_id, user_id, operation_type, quantity_changed, previous_stock, new_stock, description) 
                     VALUES ($1, $2, $3, 'INGRESO_INICIAL', $4, 0, $5, 'Creación de producto en sistema')`,
                    [storeId, newProduct.id, user.id, stock, stock]
                );
            }

            return res.status(201).json(newProduct);
        }

        res.status(405).json({ error: 'Método no permitido' });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') { // Código de error de Postgres para "Unique Violation"
            return res.status(400).json({ error: 'El código de producto ya existe en tu tienda.' });
        }
        res.status(500).json({ error: 'Error en el servidor' });
    }
};