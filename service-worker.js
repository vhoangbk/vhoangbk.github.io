// self.addEventListener('install', (event) => {
//   console.log('Service Worker installing');
//   self.skipWaiting();
// });

// self.addEventListener('activate', (event) => {
//   console.log('Service Worker activating');
//   event.waitUntil(self.clients.claim());
// });

// self.addEventListener('fetch', (event) => {
//   // Example: cache-first strategy
//   console.log('Fetching:', event.request.url);
//   // event.respondWith(
//   //   caches.match(event.request).then(response => {
//   //     return response || fetch(event.request);
//   //   })
//   // );
// });

// self.addEventListener('message', (event) => {
//   console.log('[SW] Received message:', event.data);

//   // Ví dụ: phản hồi lại
//   event.source.postMessage({
//     reply: `Service Worker đã nhận: ${event.data}`
//   });
// });