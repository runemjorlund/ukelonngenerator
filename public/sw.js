const HURTIGBUFFER = 'oppdragsklubben-v1'
const GRUNNFILER = ['/', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (hendelse) => {
  hendelse.waitUntil(caches.open(HURTIGBUFFER).then((lager) => lager.addAll(GRUNNFILER)))
  self.skipWaiting()
})

self.addEventListener('activate', (hendelse) => {
  hendelse.waitUntil(
    caches
      .keys()
      .then((nokler) =>
        Promise.all(
          nokler
            .filter((nokkel) => nokkel !== HURTIGBUFFER)
            .map((nokkel) => caches.delete(nokkel)),
        ),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (hendelse) => {
  if (hendelse.request.method !== 'GET') return

  hendelse.respondWith(
    fetch(hendelse.request)
      .then((svar) => {
        const kopi = svar.clone()
        caches.open(HURTIGBUFFER).then((lager) => lager.put(hendelse.request, kopi))
        return svar
      })
      .catch(() => caches.match(hendelse.request).then((svar) => svar || caches.match('/'))),
  )
})
