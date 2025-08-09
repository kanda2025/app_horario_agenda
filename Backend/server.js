// backend/server.js - VERSIÓN ESTABLE (CRUD Completo + Notificaciones v1)

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

const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};
webpush.setVapidDetails(`mailto:${process.env.VAPID_SUBJECT}`, vapidKeys.publicKey, vapidKeys.privateKey);

app.use(cors());
app.use(express.json());

// --- RUTAS PÚBLICAS Y DE AUTENTICACIÓN ---
app.get('/', (req, res) => res.send('¡El servidor backend está funcionando!'));

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email y contraseña son requeridos." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await db.query(
            "INSERT INTO usuarios (email, password_hash) VALUES ($1, $2) RETURNING id, email",
            [email, hashedPassword]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error("Error en /register:", error.message);
        res.status(500).json({ message: "Error al registrar el usuario. El email quizás ya exista." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await db.query("SELECT * FROM usuarios WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Email o contraseña incorrectos" });
        }
        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Email o contraseña incorrectos" });
        }
        const tokenPayload = { id: user.id, email: user.email };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) {
        console.error("Error en /login:", error.message);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// --- RUTAS DE EVENTOS ---
app.get('/api/eventos', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query( "SELECT * FROM eventos WHERE usuario_id = $1 ORDER BY fecha_hora_inicio ASC", [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al obtener los eventos" });
    }
});
app.post('/api/eventos', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { titulo, fecha_hora_inicio } = req.body;
        const newEvent = await db.query("INSERT INTO eventos (usuario_id, titulo, fecha_hora_inicio) VALUES ($1, $2, $3) RETURNING *", [userId, titulo, fecha_hora_inicio]);
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
        const result = await db.query("UPDATE eventos SET titulo = $1, fecha_hora_inicio = $2 WHERE id = $3 AND usuario_id = $4 RETURNING *", [titulo, fecha_hora_inicio, eventId, userId]);
        if (result.rows.length === 0) { return res.status(404).json({ message: "Evento no encontrado o sin permisos." }); }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al actualizar el evento" });
    }
});
app.delete('/api/eventos/:id', authenticateToken, async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.user.id;
        const result = await db.query("DELETE FROM eventos WHERE id = $1 AND usuario_id = $2", [eventId, userId]);
        if (result.rowCount === 0) { return res.status(404).json({ message: "Evento no encontrado o sin permisos." }); }
        res.status(204).send();
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al eliminar el evento" });
    }
});

// --- RUTAS DE HORARIO ---
app.get('/api/horario', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query("SELECT * FROM horario_clases WHERE usuario_id = $1 ORDER BY dia_semana, hora_inicio", [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al obtener el horario" });
    }
});
app.post('/api/horario', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { nombre_materia, dia_semana, hora_inicio, hora_fin, aula, profesor } = req.body;
        const newClass = await db.query("INSERT INTO horario_clases (usuario_id, nombre_materia, dia_semana, hora_inicio, hora_fin, aula, profesor) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *", [userId, nombre_materia, dia_semana, hora_inicio, hora_fin, aula, profesor]);
        res.status(201).json(newClass.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al añadir la clase" });
    }
});
app.put('/api/horario/:id', authenticateToken, async (req, res) => {
    try {
        const classId = req.params.id;
        const userId = req.user.id;
        const { nombre_materia, dia_semana, hora_inicio, hora_fin, aula, profesor } = req.body;
        const result = await db.query("UPDATE horario_clases SET nombre_materia = $1, dia_semana = $2, hora_inicio = $3, hora_fin = $4, aula = $5, profesor = $6 WHERE id = $7 AND usuario_id = $8 RETURNING *", [nombre_materia, dia_semana, hora_inicio, hora_fin, aula, profesor, classId, userId]);
        if (result.rows.length === 0) { return res.status(404).json({ message: "Clase no encontrada o sin permisos." }); }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al actualizar la clase" });
    }
});
app.delete('/api/horario/:id', authenticateToken, async (req, res) => {
    try {
        const classId = req.params.id;
        const userId = req.user.id;
        const result = await db.query("DELETE FROM horario_clases WHERE id = $1 AND usuario_id = $2", [classId, userId]);
        if (result.rowCount === 0) { return res.status(404).json({ message: "Clase no encontrada o sin permisos." }); }
        res.status(204).send();
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "Error al eliminar la clase" });
    }
});

// --- RUTA DE NOTIFICACIONES ---
app.post('/api/notifications/subscribe', authenticateToken, async (req, res) => {
    try {
        const subscription = req.body;
        const userId = req.user.id;
        await db.query("UPDATE usuarios SET push_subscription = $1 WHERE id = $2", [subscription, userId]);
        console.log(`Suscripción guardada para el usuario ${userId}`);
        res.status(201).json({ message: "Suscripción guardada con éxito." });
    } catch (error) {
        console.error("Error al guardar la suscripción:", error.message);
        res.status(500).json({ message: "No se pudo guardar la suscripción." });
    }
});

// --- INICIO DEL SERVIDOR Y CRON JOB ---
app.listen(PORT, () => {
    console.log(`¡ÉXITO! Servidor corriendo en el puerto ${PORT}`);
    cron.schedule('* * * * *', () => {
        console.log('CRON: Verificando eventos para notificar...');
        checkEventsForNotifications();
    });
});

async function checkEventsForNotifications() {
    try {
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

        const result = await db.query(
            `SELECT e.id, e.titulo, u.push_subscription FROM eventos e JOIN usuarios u ON e.usuario_id = u.id WHERE e.fecha_hora_inicio > $1 AND e.fecha_hora_inicio <= $2 AND u.push_subscription IS NOT NULL`,
            [now, fiveMinutesFromNow]
        );

        if (result.rows.length > 0) {
            console.log(`CRON: Encontrados ${result.rows.length} eventos para notificar.`);
            for (const event of result.rows) {
                const payload = JSON.stringify({ title: '¡Recordatorio de Evento!', body: `Tu evento "${event.titulo}" comienza en unos minutos.`, icon: 'https://i.imgur.com/qAN8mp4.png' });
                try {
                    await webpush.sendNotification(event.push_subscription, payload);
                    console.log(`Notificación enviada para el evento ${event.id}`);
                } catch (err) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`CRON: Suscripción para evento ${event.id} no válida. Eliminándola.`);
                        await db.query("UPDATE usuarios SET push_subscription = NULL WHERE push_subscription = $1", [event.push_subscription]);
                    } else {
                        console.error(`CRON: Error al enviar notificación para evento ${event.id}:`, err.message);
                    }
                }
            }
        } else {
            console.log('CRON: No hay eventos próximos para notificar.');
        }
    } catch (error) {
        console.error("CRON: Error al verificar eventos:", error.message);
    }
}