// api/admin/clients.js
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const verifyToken = require('../utils/verifyToken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async (req, res) => {
    const user = verifyToken(req, res);
    if (!user) return; // Si no hay token válido, la función verifyToken ya respondió con error
    if (user.role !== 'superadmin') return res.status(403).json({ error: 'No tienes permisos de SuperAdmin' });

    const { method } = req;

    try {
        if (method === 'GET') {
            // Obtener todas las tiendas con su usuario principal
            const result = await pool.query(`
                SELECT s.id, s.name, s.status, s.next_payment_date, u.username 
                FROM stores s
                LEFT JOIN users u ON s.id = u.store_id
                ORDER BY s.id ASC
            `);
            return res.status(200).json(result.rows);
        }

        if (method === 'POST') {
            // Crear nueva tienda y su usuario administrador
            const { storeName, username, password, nextPaymentDate } = req.body;
            const passwordHash = await bcrypt.hash(password, 10);

            // Usamos transacciones para asegurar que se crean ambas cosas o ninguna
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const storeResult = await client.query(
                    'INSERT INTO stores (name, next_payment_date) VALUES ($1, $2) RETURNING id',
                    [storeName, nextPaymentDate]
                );
                const storeId = storeResult.rows[0].id;
                
                await client.query(
                    'INSERT INTO users (store_id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
                    [storeId, username, passwordHash, 'cliente']
                );
                await client.query('COMMIT');
                return res.status(201).json({ message: 'Cliente creado exitosamente' });
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        }

        if (method === 'PUT') {
            // Actualizar estado (congelar/activar) o fecha de pago
            const { id, status, nextPaymentDate } = req.body;
            await pool.query(
                'UPDATE stores SET status = COALESCE($1, status), next_payment_date = COALESCE($2, next_payment_date) WHERE id = $3',
                [status, nextPaymentDate, id]
            );
            return res.status(200).json({ message: 'Cliente actualizado' });
        }

        if (method === 'DELETE') {
            // Borrar tienda (borrará en cascada usuarios y productos por el esquema SQL)
            const { id } = req.body;
            await pool.query('DELETE FROM stores WHERE id = $1', [id]);
            return res.status(200).json({ message: 'Cliente eliminado' });
        }

        res.status(405).json({ error: 'Método no permitido' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor', details: error.message });
    }
};