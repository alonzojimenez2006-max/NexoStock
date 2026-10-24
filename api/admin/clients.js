// api/admin/clients.js
const { Pool } = require('pg');
const verifyToken = require('../utils/verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return;
    if (user.role !== 'superadmin') return res.status(403).json({ error: 'No tienes permisos de SuperAdmin' });

    const { method } = req;

    try {
        if (method === 'GET') {
            const result = await pool.query(`
                SELECT s.id, s.name, s.status, s.next_payment_date, u.username 
                FROM stores s
                LEFT JOIN users u ON s.id = u.store_id
                WHERE u.role = 'cliente'
                ORDER BY s.id ASC
            `);
            return res.status(200).json(result.rows);
        }

        if (method === 'POST') {
            const { storeName, username, password, nextPaymentDate } = req.body;
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                const storeResult = await client.query(
                    'INSERT INTO stores (name, next_payment_date) VALUES ($1, $2) RETURNING id',
                    [storeName, nextPaymentDate]
                );
                const storeId = storeResult.rows[0].id;
                
                await client.query(
                    `INSERT INTO users (store_id, username, password_hash, role) 
                     VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), 'cliente')`,
                    [storeId, username, password]
                );
                
                await client.query('COMMIT');
                return res.status(201).json({ message: 'Cliente creado exitosamente' });
            } catch (e) {
                await client.query('ROLLBACK');
                if (e.code === '23505') throw new Error('El nombre de usuario ya existe. Elige otro.');
                if (e.code === '22008' || e.code === '22007') throw new Error('Formato de fecha inválido. Usa el formato YYYY-MM-DD');
                throw e; 
            } finally {
                client.release();
            }
        }

        // ... (PUT y DELETE siguen igual)
        if (method === 'PUT') {
            const { id, status, nextPaymentDate } = req.body;
            await pool.query('UPDATE stores SET status = COALESCE($1, status), next_payment_date = COALESCE($2, next_payment_date) WHERE id = $3', [status, nextPaymentDate, id]);
            return res.status(200).json({ message: 'Cliente actualizado' });
        }

        if (method === 'DELETE') {
            const { id } = req.body;
            await pool.query('DELETE FROM stores WHERE id = $1', [id]);
            return res.status(200).json({ message: 'Cliente eliminado' });
        }

        res.status(405).json({ error: 'Método no permitido' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message || 'Error en el servidor al procesar la solicitud' });
    }
};