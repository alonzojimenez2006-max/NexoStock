const { Pool } = require('pg');
const verifyToken = require('./verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return;
    if (user.role !== 'superadmin') return res.status(403).json({ error: 'Privilegios insuficientes' });

    if (req.method === 'GET') {
        const result = await pool.query(`
            SELECT s.id, s.name, s.status, s.next_payment_date, u.username 
            FROM stores s LEFT JOIN users u ON s.id = u.store_id 
            WHERE u.role = 'cliente' ORDER BY s.id ASC
        `);
        return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
        const { name, user: username, pass, date } = req.body;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const storeRes = await client.query('INSERT INTO stores (name, next_payment_date) VALUES ($1, $2) RETURNING id', [name, date]);
            await client.query(`INSERT INTO users (store_id, username, password_hash, role) VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), 'cliente')`, [storeRes.rows[0].id, username, pass]);
            await client.query('COMMIT');
            res.status(201).json({ message: 'Cliente creado' });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(400).json({ error: 'El usuario ya existe o la fecha es inválida.' });
        } finally {
            client.release();
        }
    }
};