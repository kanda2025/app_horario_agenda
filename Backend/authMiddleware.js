// backend/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

    if (token == null) {
        return res.sendStatus(401); // No autorizado (no hay token)
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error("Error al verificar el token:", err.message);
            return res.sendStatus(403); // Prohibido (el token es inválido)
        }
        req.user = user;
        next(); // El token es válido, puede continuar
    });
};

module.exports = authenticateToken; // Asegúrate que esta línea esté así