/* BantayDavao service worker: keeps the whole app working offline.
   Network first (so updates show right away when online), cache fallback when offline.
   The 16 MB street map is not precached; Mapa saves it to its own cache when the user taps Save. */
const SHELL = 'bd-shell-v79', MAP = 'bd-map-v1';
const FILES = [
  './', 'index.html', 'privacy.html', 'terms.html', 'manifest.webmanifest', 'img/davao-bg.jpg', 'img/hero-day.jpg', 'img/hero-night.jpg', 'img/threat-water.jpg', 'img/threat-heat.jpg', 'img/threat-tap.jpg', 'img/threat-flood.jpg', 'img/threat-air.jpg', 'css/app.css', 'css/fonts.css',
  'js/native.js', 'js/i18n.js', 'js/i18n-tl.js', 'js/i18n-ceb.js', 'js/icons.js', 'js/hazards.js', 'js/data.js', 'js/core.js', 'js/weather.js', 'js/air.js', 'js/pagasa.js', 'js/karon.js', 'js/peligro.js', 'js/mapa.js', 'js/tabang.js', 'js/profile.js', 'js/share.js', 'js/quiz.js', 'js/photocheck.js', 'js/badges.js', 'js/config.js', 'js/account.js', 'js/family.js', 'js/reminders.js', 'vendor/supabase/supabase.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/mark-light.png', 'icons/mark-dark.png', 'icons/logo-light.png', 'icons/logo-dark.png', 'icons/favicon-light.png', 'icons/favicon-dark.png',
  'fonts/inter.woff2',
  'map/gazetteer.json', 'vendor/pmtiles.js', 'vendor/basemap/basemaps.js',
  'vendor/maplibre/maplibre-gl.mjs', 'vendor/maplibre/maplibre-gl-shared.mjs', 'vendor/maplibre/maplibre-gl-worker.mjs', 'vendor/maplibre/maplibre-gl.css'
];
['light', 'dark'].forEach(t => ['', '@2x'].forEach(r => ['json', 'png'].forEach(e => FILES.push('vendor/basemap/sprites/' + t + r + '.' + e))));
['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'].forEach(f => ['0-255', '256-511', '8192-8447'].forEach(r => FILES.push(encodeURI('vendor/basemap/fonts/' + f + '/' + r + '.pbf'))));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== MAP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // Map tiles stream with Range requests (or come from the saved copy in the page); never cache those here.
  if (req.method !== 'GET' || url.origin !== location.origin || req.headers.has('range') || url.pathname.endsWith('.pmtiles')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
