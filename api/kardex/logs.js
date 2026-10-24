// api/kardex/logs.js
const { Pool } = require('pg');
const verifyToken = require('../utils/verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return; 

    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    try {
        const result = await pool.query(`
            SELECT k.*, p.name as product_name, p.code 
            FROM kardex k
            JOIN products p ON k.product_id = p.id
            WHERE k.store_id = $1
            ORDER BY k.operation_date DESC
            LIMIT 100
        `, [user.store_id]);
        
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error leyendo el Kardex' });
    }
};