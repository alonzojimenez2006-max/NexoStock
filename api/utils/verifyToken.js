// api/utils/verifyToken.js
const jwt = require('jsonwebtoken');

module.exports = (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) throw new Error('No hay token de autorización');
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        return decoded;
    } catch (error) {
        res.status(401).json({ error: 'Acceso denegado o token expirado' });
        return null;
    }
};