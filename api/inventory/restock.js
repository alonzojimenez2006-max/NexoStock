// api/inventory/restock.js
const { Pool } = require('pg');
const verifyToken = require('../utils/verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return; 

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { productId, quantity, operationType, description } = req.body;
    const storeId = user.store_id;

    // Transacción SQL: Si falla el Kardex, falla el inventario. Todo o nada.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Bloquear y leer el producto actual
        const prodResult = await client.query(
            'SELECT stock FROM products WHERE id = $1 AND store_id = $2 FOR UPDATE',
            [productId, storeId]
        );

        if (prodResult.rows.length === 0) throw new Error('Producto no encontrado');
        
        const previousStock = prodResult.rows[0].stock;
        const newStock = previousStock + parseInt(quantity); // Puede ser negativo si es traslado/salida

        if (newStock < 0) throw new Error('Stock insuficiente para esta operación');

        // 2. Actualizar el producto
        await client.query(
            'UPDATE products SET stock = $1 WHERE id = $2',
            [newStock, productId]
        );

        // 3. Registrar en el Kardex
        await client.query(
            `INSERT INTO kardex (store_id, product_id, user_id, operation_type, quantity_changed, previous_stock, new_stock, description) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [storeId, productId, user.id, operationType, quantity, previousStock, newStock, description]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Inventario actualizado y registrado en Kardex', newStock });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally {
        client.release();
    }
};