// frontend/app.js - VERSIÓN CON AUTO-REGISTRO Y CORRECCIÓN DE HORA

const API_URL = 'https://app-horario-agenda.onrender.com/api';
let currentlyEditingEventId = null; 
let currentlyEditingClassId = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (document.body.id === 'dashboard') {
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        loadDashboard();
    }
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorP = document.getElementById('loginError');
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!response.ok) throw new Error('Email o contraseña incorrectos.');
        const data = await response.json();
        localStorage.setItem('token', data.token);
        window.location.href = 'dashboard.html';
    } catch (error) {
        errorP.textContent = error.message;
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageP = document.getElementById('registerMessage');
    const errorP = document.getElementById('registerError');

    messageP.textContent = '';
    errorP.textContent = '';

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'No se pudo completar el registro.');
        }

        document.getElementById('registerForm').reset();
        messageP.textContent = '¡Cuenta creada con éxito! Serás redirigido para iniciar sesión en 3 segundos...';
        messageP.style.color = 'green';
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);

    } catch (error) {
        errorP.textContent = error.message;
    }
}

function loadDashboard() {
    document.getElementById('logoutButton').addEventListener('click', handleLogout);
    document.getElementById('eventForm').addEventListener('submit', handleEventFormSubmit);
    document.getElementById('classForm').addEventListener('submit', handleClassFormSubmit); 
    document.getElementById('eventList').addEventListener('click', handleListClick);
    document.getElementById('scheduleGrid').addEventListener('click', handleScheduleClick);
    loadUserEvents();
    loadUserSchedule();
    setupNotifications();
}

function handleLogout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

// --- LÓGICA DE EVENTOS (Agenda) ---
async function loadUserEvents() {
    const token = localStorage.getItem('token');
    const eventListDiv = document.getElementById('eventList');
    eventListDiv.innerHTML = 'Cargando eventos...';
    try {
        const response = await fetch(`${API_URL}/eventos`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 401) return handleLogout();
        const events = await response.json();
        window.userEvents = events;
        eventListDiv.innerHTML = '';
        if (events.length === 0) {
            eventListDiv.innerHTML = '<p>No tienes eventos programados.</p>';
        } else {
            events.forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = 'event-item';
                const eventDate = new Date(event.fecha_hora_inicio);
                eventEl.innerHTML = `
                    <div class="event-info"><h3>${event.titulo}</h3><p>${eventDate.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}</p></div>
                    <div class="event-actions"><button class="edit-btn" data-id="${event.id}">Editar</button><button class="delete-btn" data-id="${event.id}">Eliminar</button></div>`;
                eventListDiv.appendChild(eventEl);
            });
        }
    } catch (error) { eventListDiv.innerHTML = '<p>No se pudieron cargar los eventos.</p>'; }
}
async function handleEventFormSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('token');
    const eventData = { titulo: document.getElementById('eventTitle').value, fecha_hora_inicio: document.getElementById('eventDateTime').value };
    let url = `${API_URL}/eventos`;
    let method = 'POST';
    if (currentlyEditingEventId) {
        url = `${API_URL}/eventos/${currentlyEditingEventId}`;
        method = 'PUT';
    }
    try {
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(eventData) });
        if (!response.ok) throw new Error('Error al guardar el evento');
        resetEventForm();
        loadUserEvents();
    } catch (error) { alert(error.message); }
}
function handleListClick(event) {
    const target = event.target.closest('button');
    if(!target) return;
    const eventId = target.dataset.id;
    if (target.classList.contains('delete-btn')) if (confirm('¿Seguro que quieres eliminar este evento?')) handleDeleteEvent(eventId);
    if (target.classList.contains('edit-btn')) handleEditEvent(eventId);
}
async function handleDeleteEvent(eventId) {
    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_URL}/eventos/${eventId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        loadUserEvents();
    } catch (error) { alert('No se pudo eliminar el evento.'); }
}

// ===================================================
// FUNCIÓN ACTUALIZADA CON CORRECCIÓN DE ZONA HORARIA
// ===================================================
function handleEditEvent(eventId) {
    const eventToEdit = window.userEvents.find(e => e.id == eventId);
    if (!eventToEdit) return;

    document.getElementById('eventTitle').value = eventToEdit.titulo;

    // --- CÓDIGO CORREGIDO PARA LA ZONA HORARIA ---
    const eventDate = new Date(eventToEdit.fecha_hora_inicio);
    // Creamos una nueva fecha restándole la diferencia de minutos de la zona horaria.
    // Esto "engaña" al toISOString() para que use la hora local.
    const localDate = new Date(eventDate.getTime() - (eventDate.getTimezoneOffset() * 60000));
    // Ahora sí, convertimos esta fecha ajustada a un formato que el input entiende.
    document.getElementById('eventDateTime').value = localDate.toISOString().slice(0, 16);
    // --- FIN DEL CÓDIGO CORREGIDO ---

    document.querySelector('#eventForm button').textContent = 'Actualizar Evento';
    currentlyEditingEventId = eventId;
    document.ge