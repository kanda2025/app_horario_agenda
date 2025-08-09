// backend/db.js - VERSIÓN PARA PRODUCCIÓN

const { Pool } = require('pg');
require('dotenv').config();

// Esta variable de entorno (NODE_ENV) la establecerá Render automáticamente.
const isProduction = process.env.NODE_ENV === 'production';

// Creamos un objeto de configuración que cambia según el entorno.
const connectionConfig = {
    // Si estamos en producción (en Render)...
    connectionString: process.env.DATABASE_URL, // Render nos dará esta URL
    // La mayoría de las bases de datos en la nube requieren una conexión segura (SSL).
    // Esta configuración es necesaria para Render.
    ssl: isProduction ? { rejectUnauthorized: false } : false,
};

// Si NO estamos en producción (estamos en tu PC)...
if (!isProduction) {
    connectionConfig.user = process.env.DB_USER;
    connectionConfig.host = process.env.DB_HOST;
    connectionConfig.database = process.env.DB_DATABASE;
    connectionConfig.password = process.env.DB_PASSWORD;
    connectionConfig.port = process.env.DB_PORT;
}

const pool = new Pool(connectionConfig);

module.exports = {
  query: (text, params) => pool.query(text, params),
};