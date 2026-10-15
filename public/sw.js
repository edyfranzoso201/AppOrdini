// Service worker di OrderFlow: serve solo a rendere l'app installabile.
// NON mette niente in cache: ogni richiesta va in rete, quindi dopo un deploy
// l'app installata carica sempre la versione nuova (il banner "Nuova versione"
// in app.js avvisa chi ha l'app gia' aperta).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

// Handler presente (alcuni browser lo chiedono per l'installazione) ma
// trasparente: non chiama respondWith, la richiesta segue il percorso normale.
self.addEventListener('fetch', () => {});
