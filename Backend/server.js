// backend/server.js - VERSIÓN FINAL CON CORRECCIÓN DE ZONA HORARIA EN GUARDADO

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const cron = require('node-cron');
require('dotenv').config();

const db = require('./db');
const authenticateToken = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// ... (El resto del código de configuración inicial no cambia) ...
const vapidKeys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
webpush.setVapidDetails(`mailto:${process.env.VAPID_SUBJECT}`, vapidKeys.publicKey, vapidKeys.privateKey);
app.use(cors());
app.use(express.json());

// --- RUTAS PÚBLICAS Y DE AUTENTICACIÓN ---
app.get('/', (req, res) => res.send('¡El servidor backend está funcionando!'));
app.post('/api/auth/register', async (req, res) => { /* ... (código existente sin cambios) ... */ });
app.post('/api/auth/login', async (req, res) => { /* ... (código existente sin cambios) ... */ });

// --- RUTAS DE EVENTOS (CON CORRECCIÓN) ---
app.post('/api/eventos', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { titulo, fecha_hora_inicio } = req.body;
        // CORRECCIÓN: Creamos un objeto Date para que la librería pg sepa manejar la zona horaria
        const newEvent = await db.query("INSERT INTO eventos (usuario_id, titulo, fecha_hora_inicio) VALUES ($1, $2, $3) RETURNING *", [userId, titulo, new Date(fecha_hora_inicio)]);
        res.status(201).json(newEvent.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al crear el evento" });
    }
});

app.put('/api/eventos/:id', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.user.id;
        const { titulo, fecha_hora_inicio } = req.body;
        // CORRECCIÓN: Creamos un objeto Date aquí también
        const result = await db.query("UPDATE eventos SET titulo = $1, fecha_hora_inicio = $2 WHERE id = $3 AND usuario_id = $4 RETURNING *", [titulo, new Date(fecha_hora_inicio), eventId, userId]);
        if (result.rows.length === 0) { return res.status(404).json({ message: "Evento no encontrado o sin permisos." }); }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al actualizar el evento" });
    }
});

// ... (El resto de rutas y funciones no cambian, pégalas aquí desde tu archivo) ...
// ... (GET /eventos, DELETE /eventos, todas las de /horario, y la sección de notificaciones) ...