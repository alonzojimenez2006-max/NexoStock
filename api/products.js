const { Pool } = require('pg');
const verifyToken = require('./verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return;
    if (user.role !== 'cliente') return res.status(403).json({ error: 'Acceso denegado' });

    if (req.method === 'GET') {
        const result = await pool.query('SELECT * FROM products WHERE store_id = $1 ORDER BY id DESC', [user.store_id]);
        return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
        const { code, name, category, buy, sell, cache, stock } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const pRes = await client.query(
                `INSERT INTO products (store_id, code, name, category, purchase_price, normal_price, cache_price, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, 
                [user.store_id, code, name, category || 'General', buy || 0, sell || 0, cache || 0, stock || 0]
            );
            await client.query(
                `INSERT INTO kardex (store_id, product_id, user_id, operation_type, quantity_changed, previous_stock, new_stock, description) VALUES ($1, $2, $3, 'Ingreso Inicial', $4, 0, $4, 'Creación del producto')`, 
                [user.store_id, pRes.rows[0].id, user.id, stock || 0]
            );
            await client.query('COMMIT');
            res.status(201).json({ message: 'Creado' });
        } catch(e) { 
            await client.query('ROLLBACK'); 
            res.status(400).json({ error: 'Error al crear producto (Posible código duplicado)' }); 
        } finally { client.release(); }
    }

    if (req.method === 'PUT') {
        const { id, action, qty, desc, sell, cache } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const prod = await client.query('SELECT stock FROM products WHERE id = $1 AND store_id = $2', [id, user.store_id]);
            if (prod.rows.length === 0) throw new Error('Producto no encontrado');
            const prevStock = prod.rows[0].stock;
            
            if (action === 'restock' || action === 'transfer') {
                const amount = action === 'restock' ? parseInt(qty) : -parseInt(qty);
                const newStock = prevStock + amount;
                if (newStock < 0) throw new Error('Stock insuficiente para el traslado');
                
                await client.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, id]);
                await client.query(
                    `INSERT INTO kardex (store_id, product_id, user_id, operation_type, quantity_changed, previous_stock, new_stock, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, 
                    [user.store_id, id, user.id, action === 'restock' ? 'Restock' : 'Traslado', amount, prevStock, newStock, desc || '']
                );
            } else if (action === 'price') {
                await client.query('UPDATE products SET normal_price = COALESCE($1, normal_price), cache_price = COALESCE($2, cache_price) WHERE id = $3', [sell, cache, id]);
                await client.query(
                    `INSERT INTO kardex (store_id, product_id, user_id, operation_type, quantity_changed, previous_stock, new_stock, description) VALUES ($1, $2, $3, 'Ajuste de Precios', 0, $4, $4, 'Actualización de montos')`, 
                    [user.store_id, id, user.id, prevStock]
                );
            }
            await client.query('COMMIT');
            res.status(200).json({ message: 'Operación exitosa' });
        } catch(e) { 
            await client.query('ROLLBACK'); 
            res.status(400).json({ error: e.message || 'Error en la operación' }); 
        } finally { client.release(); }
    }
};