// backend/server.js - VERSIÓN FINAL CON CORRECCIÓN DEFINITIVA EN CRON JOB

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

// --- (El resto de tus rutas de login, registro, eventos y horario NO CAMBIAN) ---
// ... (pega aquí todo el código de tus rutas que ya funcionaban) ...

// --- INICIO DEL SERVIDOR Y CRON JOB ---
app.listen(PORT, () => {
    console.log(`¡ÉXITO! Servidor corriendo en el puerto ${PORT}`);
    cron.schedule('* * * * *', () => {
        console.log('CRON: Verificando eventos para notificar...');
        checkEventsForNotifications();
    });
});

// ===================================================
// FUNCIÓN DE NOTIFICACIONES CORREGIDA CON NOW() DE POSTGRESQL
// ===================================================
async function checkEventsForNotifications() {
    try {
        // Esta consulta ahora usa las funciones de tiempo de la propia base de datos
        // y no depende de la hora de Node.js.
        const result = await db.query(
            `SELECT e.id, e.titulo, u.push_subscription 
             FROM eventos e JOIN usuarios u ON e.usuario_id = u.id 
             WHERE e.fecha_hora_inicio >= NOW() 
               AND e.fecha_hora_inicio <= NOW() + interval '5 minutes' 
               AND u.push_subscription IS NOT NULL`
        ); // ¡No se pasan argumentos aquí!

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