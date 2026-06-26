/**
 * Got One Spare? — Service Worker
 * Handles background push notifications.
 */

self.addEventListener('push', (event) => {
  let data = { title: 'Got One Spare?', body: 'You have a new notification', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'gotonespare',
        data: { url: data.url },
        vibrate: [200, 100, 200],
      }),
      // Set badge count on app icon
      navigator.setAppBadge ? navigator.setAppBadge(1) : Promise.resolve(),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Clear the badge when user taps the notification
  if (navigator.clearAppBadge) navigator.clearAppBadge();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
