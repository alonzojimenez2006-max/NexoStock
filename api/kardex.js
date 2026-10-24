const { Pool } = require('pg');
const verifyToken = require('./verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return;
    if (user.role !== 'cliente') return res.status(403).json({ error: 'Acceso denegado' });

    if (req.method === 'GET') {
        const result = await pool.query(`
            SELECT k.*, p.name as product_name, u.username 
            FROM kardex k 
            JOIN products p ON k.product_id = p.id 
            JOIN users u ON k.user_id = u.id 
            WHERE k.store_id = $1 
            ORDER BY k.operation_date DESC LIMIT 150
        `, [user.store_id]);
        return res.status(200).json(result.rows);
    }
};