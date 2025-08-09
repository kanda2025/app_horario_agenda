// frontend/sw.js

self.addEventListener('push', event => {
    const data = event.data.json();
    
    console.log('¡Notificación Push recibida por el Service Worker!', data);

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.icon // Ícono para la barra de notificaciones en Android
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});