const jwt = require('jsonwebtoken');

module.exports = (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Acceso denegado' });
        return null;
    }
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        res.status(401).json({ error: 'Token inválido o expirado' });
        return null;
    }
};