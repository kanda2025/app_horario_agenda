// frontend/app.js - VERSIÓN ESTABLE (CRUD Completo + Notificaciones v1)

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
function handleEditEvent(eventId) {
    const eventToEdit = window.userEvents.find(e => e.id == eventId);
    if (!eventToEdit) return;
    document.getElementById('eventTitle').value = eventToEdit.titulo;
    document.getElementById('eventDateTime').value = new Date(eventToEdit.fecha_hora_inicio).toISOString().slice(0, 16);
    document.querySelector('#eventForm button').textContent = 'Actualizar Evento';
    currentlyEditingEventId = eventId;
    document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth' });
}
function resetEventForm() {
    document.getElementById('eventForm').reset();
    document.querySelector('#eventForm button').textContent = 'Guardar Evento';
    currentlyEditingEventId = null;
}

// --- LÓGICA DE HORARIO ---
async function loadUserSchedule() {
    const token = localStorage.getItem('token');
    const scheduleGrid = document.getElementById('scheduleGrid');
    scheduleGrid.innerHTML = 'Cargando horario...';
    try {
        const response = await fetch(`${API_URL}/horario`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.status === 401) return handleLogout();
        const classes = await response.json();
        window.userClasses = classes;
        scheduleGrid.innerHTML = '';
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        days.forEach((day, index) => {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.innerHTML = `<h4>${day}</h4>`;
            const classesForDay = classes.filter(c => c.dia_semana === (index + 1));
            if (classesForDay.length === 0) {
                dayColumn.innerHTML += '<p class="no-classes">Sin clases</p>';
            } else {
                classesForDay.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)).forEach(c => {
                    const classEl = document.createElement('div');
                    classEl.className = 'class-item';
                    classEl.innerHTML = `
                        <div class="class-info"><strong>${c.nombre_materia}</strong><span>${c.hora_inicio.slice(0, 5)} - ${c.hora_fin.slice(0, 5)}</span></div>
                        <div class="class-actions"><button class="edit-class-btn" data-id="${c.id}" title="Editar clase">✎</button><button class="delete-class-btn" data-id="${c.id}" title="Eliminar clase">&times;</button></div>`;
                    dayColumn.appendChild(classEl);
                });
            }
            scheduleGrid.appendChild(dayColumn);
        });
    } catch (error) { scheduleGrid.innerHTML = '<p>No se pudo cargar el horario.</p>'; }
}
async function handleClassFormSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('token');
    const classData = { nombre_materia: document.getElementById('className').value, dia_semana: document.getElementById('classDay').value, hora_inicio: document.getElementById('classStartTime').value, hora_fin: document.getElementById('classEndTime').value, aula: null, profesor: null };
    let url = `${API_URL}/horario`;
    let method = 'POST';
    if (currentlyEditingClassId) {
        url = `${API_URL}/horario/${currentlyEditingClassId}`;
        method = 'PUT';
    }
    try {
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(classData) });
        if (!response.ok) throw new Error('No se pudo guardar la clase.');
        resetClassForm();
        loadUserSchedule();
    } catch (error) { alert(error.message); }
}
function handleScheduleClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    const classId = target.dataset.id;
    if (target.classList.contains('delete-class-btn')) {
        if (confirm('¿Seguro que quieres eliminar esta clase del horario?')) handleDeleteClass(classId);
    }
    if (target.classList.contains('edit-class-btn')) {
        handleEditClass(classId);
    }
}
async function handleDeleteClass(classId) {
    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_URL}/horario/${classId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        loadUserSchedule();
    } catch (error) { alert('No se pudo eliminar la clase.'); }
}
function handleEditClass(classId) {
    const classToEdit = window.userClasses.find(c => c.id == classId);
    if (!classToEdit) return;
    document.getElementById('className').value = classToEdit.nombre_materia;
    document.getElementById('classDay').value = classToEdit.dia_semana;
    document.getElementById('classStartTime').value = classToEdit.hora_inicio;
    document.getElementById('classEndTime').value = classToEdit.hora_fin;
    document.querySelector('#classForm button').textContent = 'Actualizar Clase';
    currentlyEditingClassId = classId;
    document.getElementById('classForm').scrollIntoView({ behavior: 'smooth' });
}
function resetClassForm() {
    document.getElementById('classForm').reset();
    document.querySelector('#classForm button').textContent = 'Añadir Clase';
    currentlyEditingClassId = null;
}

// --- LÓGICA DE NOTIFICACIONES PUSH (Versión Sencilla) ---

function setupNotifications() {
    const enableNotificationsButton = document.getElementById('enableNotifications');
    enableNotificationsButton.addEventListener('click', askForNotificationPermission);

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker registrado con éxito.'))
            .catch(error => console.error('Error al registrar el Service Worker:', error));
    }
}

async function askForNotificationPermission() {
    try {
        const permissionResult = await Notification.requestPermission();
        if (permissionResult !== 'granted') {
            alert('Has denegado los permisos de notificación.');
            return;
        }
        const swRegistration = await navigator.serviceWorker.ready;
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        await sendSubscriptionToBackend(subscription);
        alert('¡Notificaciones activadas con éxito!');
        const btn = document.getElementById('enableNotifications');
        btn.textContent = 'Notificaciones Activadas';
        btn.disabled = true;
    } catch (error) {
        console.error('Error al suscribirse a las notificaciones:', error);
        alert('Hubo un error al activar las notificaciones.');
    }
}

async function sendSubscriptionToBackend(subscription) {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(subscription)
    });
}

// ¡¡¡ACCIÓN REQUERIDA!!! - Pega tu clave pública aquí
const VAPID_PUBLIC_KEY = "BFUPPUWy929Q6kh2zeEBj5n77tutwozx3cuXm03XzhbjwLpTywhyVmuaCZ9HoOU7Gpglf24DKfQblfSOLLkfoKE";

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
}