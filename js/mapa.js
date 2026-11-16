/* Tab 3 – Mapa: offline street map of Davao City (MapLibre + PMTiles), search, nearby help and the nearest places.
   Layout: filters (search + chips) → map → location info (where you are, offline map, nearest list, tips). */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;
  const MAP_URL = new URL('map/davao.pmtiles', location.href).href, MAP_CACHE = 'bd-map-v1', MAP_MB = 16;
  const CITY = [[125.2, 6.95], [125.72, 7.62]];
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  /* ---------- data: our places, OpenStreetMap help points, search index ---------- */
  let gaz = null, help = [];
  function loadGazetteer() {
    if (gaz) return Promise.resolve(gaz);
    return fetch('map/gazetteer.json').then(r => r.json()).then(rows => {
      gaz = rows;
      const byKind = {};
      Object.keys(BD.PLACE_TYPES).forEach(t => (BD.PLACE_TYPES[t].osm || []).forEach(k => { byKind[k] = t; }));
      help = rows.filter(r => byKind[r[1]]).map(r => ({ type: byKind[r[1]], name: r[0], lat: r[2], lng: r[3], osm: true }));
      return gaz;
    });
  }
  function here() {
    const d = BD.DISTRICTS.find(x => x.id === BD.state.district) || BD.DISTRICTS[0];
    return BD.ui.here || { lat: d.lat, lng: d.lng, name: d.name };
  }
  const floodDate = d => { const p = d.split('-'), m = BD.MONTHS[+p[1] - 1]; return (p[2] ? +p[2] + ' ' : '') + (m ? m + ' ' : '') + p[0]; };
  function places() {
    const s = BD.state, me = here();
    // The public app lists only verified and OpenStreetMap places; sample places are for the demo.
    return BD.PLACES[s.season].filter(p => p.real || BD.demo).concat(help)
      .filter(p => s.mapFilter === 'all' || p.type === s.mapFilter)
      .map(p => Object.assign({ km: BD.km(me, p) }, p))
      .sort((a, b) => a.km - b.km);
  }
  function bearing(a, b) {
    const r = Math.PI / 180, y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r),
      x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
    return DIRS[Math.round(((Math.atan2(y, x) / r + 360) % 360) / 45) % 8];
  }
  // Online: open Google Maps directions. Offline: straight-line distance and compass direction.
  function directions(p) {
    if (!navigator.onLine) return '<span class="dir-off">' + I('nav', 13) + bearing(here(), p) + '</span>';
    return '<a class="btn btn-soft sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng + '">' + I('nav', 14) + 'Directions</a>';
  }
  function search(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2 || !gaz) return [];
    const me = here(), seen = new Set(), out = [];
    const add = (name, kind, lat, lng, p) => {
      const k = name.toLowerCase() + kind; if (seen.has(k)) return; seen.add(k);
      out.push({ name, kind, lat, lng, p, km: BD.km(me, { lat, lng }) });
    };
    BD.PLACES[BD.state.season].forEach(p => { if (p.name.toLowerCase().includes(q)) add(p.name, BD.PLACE_TYPES[p.type].label, p.lat, p.lng, p); });
    for (const r of gaz) {
      const n = r[0].toLowerCase();
      if (n.startsWith(q) || n.includes(' ' + q) || (q.length > 3 && n.includes(q))) add(r[0], r[1].replace(/_/g, ' '), r[2], r[3]);
      if (out.length >= 40) break;
    }
    // Barangays and districts first, then names that start with the query, then nearest.
    const rank = r => (/^(neighbourhood|locality|macrohood|suburb|administrative)$/.test(r.kind) ? 0 : 2) + (r.name.toLowerCase().startsWith(q) ? 0 : 1);
    return out.sort((a, b) => rank(a) - rank(b) || a.km - b.km).slice(0, 8);
  }

  /* ---------- offline map file: saved whole in Cache Storage when the user asks ---------- */
  const save = { state: 'unknown', pct: 0 };
  function checkSaved() {
    if (BD.native) { save.state = 'bundled'; return Promise.resolve(false); }
    if (!('caches' in window)) { save.state = 'none'; return Promise.resolve(false); }
    return caches.open(MAP_CACHE).then(c => c.match(MAP_URL)).then(r => { save.state = r ? 'saved' : 'none'; return !!r; });
  }
  async function saveMap() {
    save.state = 'saving'; save.pct = 0; renderSave();
    try {
      const res = await fetch(MAP_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const total = +res.headers.get('Content-Length') || MAP_MB * 1048576, reader = res.body.getReader(), parts = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); got += value.length;
        save.pct = Math.min(99, Math.round(got / total * 100)); renderSave();
      }
      const blob = new Blob(parts, { type: 'application/octet-stream' });
      await (await caches.open(MAP_CACHE)).put(MAP_URL, new Response(blob, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size) } }));
      save.state = 'saved'; renderSave(); useSource(true);
      BD.toast(I('check', 16) + 'Map saved. It now works without internet.');
    } catch (e) {
      save.state = 'none'; renderSave();
      BD.toast(I('wifioff', 16) + 'Could not save the map. Check your connection and try again.');
    }
  }
  function saveCard() {
    if (save.state === 'bundled') return '';
    if (save.state === 'saving') return '<div class="save-card"><span class="q-ic c-gulf">' + I('download', 18) + '</span><div class="q-body"><span class="q-title">Saving map… ' + save.pct + '%</span>' +
      '<div class="bar"><i style="width:' + save.pct + '%"></i></div></div></div>';
    if (save.state === 'saved') return '<div class="save-card ok"><span class="q-ic c-teal">' + I('check', 18) + '</span><div class="q-body"><span class="q-title">Offline map ready</span>' +
      '<span class="q-meta">Davao City, street level · ' + MAP_MB + ' MB</span></div><button class="link-btn" data-action="mapRemove">Remove</button></div>';
    return '<div class="save-card"><span class="q-ic c-gulf">' + I('download', 18) + '</span><div class="q-body"><span class="q-title">Save map for offline use</span>' +
      '<span class="q-meta">Davao City, street level · ' + MAP_MB + ' MB. Best on Wi-Fi.</span></div>' +
      '<button class="btn btn-primary sm" data-action="mapSave"' + (navigator.onLine ? '' : ' disabled') + '>Save</button></div>';
  }
  function renderSave() { const el = document.getElementById('map-save'); if (el) el.innerHTML = saveCard(); }

  /* ---------- the map: one MapLibre instance, moved into each fresh render ---------- */
  let gl = null, map = null, glErr = '', flavor = '', srcSaved = null, markers = [], youMk = null, pickMk = null, loading = null;
  // MapLibre only understands hex/rgb/hsl, so resolve CSS variables and oklch() to rgb via a 1px canvas.
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const color = v => {
    const c = v.indexOf('var(') === 0 ? getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim() || '#16A34A' : v;
    cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#16A34A'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1);
    const d = cv.getImageData(0, 0, 1, 1).data;
    return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
  };
  const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  const script = src => new Promise((ok, no) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = no; document.head.appendChild(e); });

  function loadLibs() {
    if (loading) return loading;
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/maplibre/maplibre-gl.css'; document.head.appendChild(css);
    loading = Promise.all([script('vendor/pmtiles.js'), script('vendor/basemap/basemaps.js'), import(new URL('vendor/maplibre/maplibre-gl.mjs', location.href).href), loadGazetteer(), checkSaved()])
      .then(([, , ml]) => { gl = ml.default || ml; BD.mapProto = new pmtiles.Protocol(); gl.addProtocol('pmtiles', BD.mapProto.tile); });
    return loading;
  }
  async function sourceUrl(saved) {
    // In the app the map file is bundled; read it once as a blob so no HTTP Range support is needed.
    if (save.state === 'bundled') {
      if (!bundled) {
        bundled = new pmtiles.PMTiles(new pmtiles.FileSource(new File([await (await fetch(MAP_URL)).blob()], 'davao-app.pmtiles')));
        BD.mapProto.add(bundled);
      }
      return 'pmtiles://davao-app.pmtiles';
    }
    if (!saved) return 'pmtiles://' + MAP_URL;
    const blob = await (await (await caches.open(MAP_CACHE)).match(MAP_URL)).blob();
    BD.mapProto.add(new pmtiles.PMTiles(new pmtiles.FileSource(new File([blob], 'davao-offline.pmtiles'))));
    return 'pmtiles://davao-offline.pmtiles';
  }
  async function style(saved, fl) {
    fl = fl || flavor;
    const abs = p => new URL(p, location.href).href;
    return {
      version: 8, glyphs: abs('vendor/basemap/fonts/') + '{fontstack}/{range}.pbf', sprite: abs('vendor/basemap/sprites/' + fl),
      sources: { pm: { type: 'vector', url: await sourceUrl(saved), attribution: '© OpenStreetMap contributors · Protomaps' } },
      layers: basemaps.layers('pm', basemaps.namedFlavor(fl), { lang: 'en' })
    };
  }
  async function useSource(saved) {
    if (!map) return;
    srcSaved = saved;
    map.setStyle(await style(saved));
  }
  async function ensureMap() {
    await loadLibs();
    const slot = document.getElementById('map-slot');
    if (!slot) return;
    const saved = save.state === 'saved';
    if (!saved && !navigator.onLine && save.state !== 'bundled') { slot.innerHTML = notice('wifioff', 'Map not saved yet', 'Connect once and tap Save below to use the map offline. Search and the list still work.'); return; }
    if (!map) {
      gl_el = document.createElement('div'); gl_el.className = 'glmap';
      flavor = isDark() ? 'dark' : 'light'; srcSaved = saved;
      try {
        map = new gl.Map({ container: gl_el, style: await style(saved), bounds: CITY, maxBounds: [[124.9, 6.7], [126.0, 7.9]], attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
      } catch (e) { glErr = 'This phone cannot draw the map (WebGL is off).'; slot.innerHTML = notice('map', 'Map unavailable', glErr + ' Search and the list still work.'); return; }
      map.touchZoomRotate.disableRotation();
      map.on('style.load', addOverlays);
      map.on('click', 'bd-places', e => { const f = e.features[0]; pick(JSON.parse(f.properties.p)); });
      map.on('mouseenter', 'bd-places', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'bd-places', () => { map.getCanvas().style.cursor = ''; });
      needFrame = true;
      map.once('load', () => { addOverlays(); if (gl_el.isConnected) { map.resize(); frame(true, 0); needFrame = false; } });
    }
    slot.innerHTML = ''; slot.appendChild(gl_el); map.resize();
    if (needFrame && map.loaded()) { frame(true, 0); needFrame = false; }
    const want = isDark() ? 'dark' : 'light';
    if (want !== flavor || saved !== srcSaved) { flavor = want; useSource(saved); } else overlaysWhenReady();
  }
  let gl_el = null, needFrame = false, holding = 0, bundled = null;
  const PAGE = 5;
  const notice = (icon, title, text) => '<div class="map-notice">' + I(icon, 26) + '<b>' + title + '</b><span>' + text + '</span></div>';

  function circle(z) {
    const pts = [], k = z.km / 111;
    for (let i = 0; i <= 48; i++) { const a = i / 48 * 2 * Math.PI; pts.push([z.lng + k * Math.cos(a) / Math.cos(z.lat * Math.PI / 180), z.lat + k * Math.sin(a)]); }
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } };
  }
  function overlaysWhenReady() { if (map.isStyleLoaded()) addOverlays(); else map.once('idle', addOverlays); }
  function addOverlays() {
    if (!map || !map.isStyleLoaded()) return;
    const sorted = places(), near = sorted.slice(0, 3), me = here(), rain = BD.state.season === 'rain';
    const pts = { type: 'FeatureCollection', features: sorted.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { c: color(BD.PLACE_TYPES[p.type].color), p: JSON.stringify({ name: p.name, type: p.type, lat: p.lat, lng: p.lng, note: p.note || '' }) } })) };
    const routes = { type: 'FeatureCollection', features: near.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[me.lng, me.lat], [p.lng, p.lat]] } })) };
    const flood = { type: 'FeatureCollection', features: rain ? BD.FLOOD_ZONES.map(circle) : [] };
    const set = (id, data) => { if (map.getSource(id)) map.getSource(id).setData(data); else map.addSource(id, { type: 'geojson', data }); };
    set('bd-flood', flood); set('bd-routes', routes); set('bd-pts', pts);
    if (!map.getLayer('bd-flood')) {
      map.addLayer({ id: 'bd-flood', type: 'fill', source: 'bd-flood', paint: { 'fill-color': '#EF4444', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'bd-flood-l', type: 'line', source: 'bd-flood', paint: { 'line-color': '#EF4444', 'line-width': 1.5, 'line-dasharray': [2, 2] } });
      map.addLayer({ id: 'bd-routes', type: 'line', source: 'bd-routes', paint: { 'line-color': color('var(--route)'), 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
      map.addLayer({ id: 'bd-places', type: 'circle', source: 'bd-pts', paint: { 'circle-color': ['get', 'c'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 8], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    }
    markers.forEach(m => m.remove());
    markers = near.map((p, i) => {
      const el = document.createElement('div'); el.className = 'mk-pin'; el.style.setProperty('--c', color(BD.PLACE_TYPES[p.type].color)); el.style.setProperty('--d', i * 70 + 'ms'); if (holding) el.classList.add('hold'); el.innerHTML = '<i class="mk-grow"><span><b>' + (i + 1) + '</b></span></i>';
      el.addEventListener('click', ev => { ev.stopPropagation(); pick(p); });
      return new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
    });
    if (!youMk) { const el = document.createElement('div'); el.className = 'mk-you'; el.innerHTML = '<i></i>'; youMk = new gl.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map); }
    youMk.setLngLat([me.lng, me.lat]);
  }
  // Fit "you" and the 3 nearest, or the whole city.
  function frame(nearOnly, ms) {
    const duration = ms == null ? 600 : ms;
    if (!map) return;
    // Hold the pins (including ones rebuilt while the camera moves) until it stops, so they grow in place.
    if (duration) {
      const id = ++holding;
      markers.forEach(m => m.getElement().classList.add('hold'));
      const show = () => { if (holding !== id) return; holding = 0; markers.forEach(m => m.getElement().classList.remove('hold')); };
      map.once('moveend', show);
      setTimeout(show, duration + 150);
    }
    if (!nearOnly) { map.fitBounds(CITY, { padding: 10, duration }); return; }
    const me = here(), pts = [me].concat(places().slice(0, 3));
    const b = pts.reduce((a, p) => [[Math.min(a[0][0], p.lng), Math.min(a[0][1], p.lat)], [Math.max(a[1][0], p.lng), Math.max(a[1][1], p.lat)]], [[me.lng, me.lat], [me.lng, me.lat]]);
    map.fitBounds(b, { padding: { top: 50, bottom: 30, left: 30, right: 30 }, maxZoom: 15.5, duration });
  }
  function pick(p) {
    BD.ui.mapPick = { name: p.name, kind: p.kind || (p.type ? BD.PLACE_TYPES[p.type].label : ''), lat: p.lat, lng: p.lng, note: p.note || '' };
    if (map) {
      if (pickMk) pickMk.remove();
      const el = document.createElement('div'); el.className = 'mk-pick'; el.innerHTML = '<i class="mk-grow"><span></span></i>';
      pickMk = new gl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
      map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 15), duration: 700 });
    }
    const el = document.getElementById('map-pick'); if (el) el.innerHTML = pickCard();
  }
  function pickCard() {
    const p = BD.ui.mapPick; if (!p) return '';
    const km = BD.km(here(), p);
    return '<div class="card pick-card"><div class="pick-top"><span class="q-ic c-gulf">' + I('pin', 18) + '</span><div class="q-body"><span class="q-title" data-i18n-skip>' + esc(p.name) + '</span>' +
      '<span class="q-meta">' + esc(p.kind) + (p.note ? ' · ' + esc(p.note) : '') + '</span></div><button class="icon-btn" data-action="mapUnpick" aria-label="Close">' + I('x', 18) + '</button></div>' +
      '<div class="pick-row"><b class="num">' + km.toFixed(1) + ' km · ' + bearing(here(), p) + '</b><span class="pick-btns">' +
      '<button class="btn btn-ghost sm" data-action="mapSetHere">' + I('locate', 14) + 'I\'m here</button>' + directions(p) + '</span></div></div>';
  }

  /* ---------- evacuation drill ---------- */
  // Practice the walk to the nearest evacuation center (or barangay hall when no center is listed nearby),
  // with a timer. Finishing gives +30 XP once a day (BD.today().xpDrill) and the "Handa sa Baha" badge.
  const DRILL_XP = 30;
  function drillTarget() {
    const me = here(), all = BD.PLACES.rain.filter(p => p.real || BD.demo).concat(help);
    const pickType = t => all.filter(p => p.type === t).map(p => Object.assign({ km: BD.km(me, p) }, p)).sort((a, b) => a.km - b.km)[0];
    const p = pickType('evac') || pickType('brgy');
    return p ? { name: p.name, lat: p.lat, lng: p.lng, km: p.km, evac: p.type === 'evac' } : null;
  }
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function drillCard() {
    const d = BD.state.drill, done = BD.today().drill;
    if (d) {
      const walk = Math.max(1, Math.round(d.km / 4.5 * 60)), secs = (Date.now() - d.start) / 1000;
      return '<div class="card drill live" id="drill"><div class="card-head"><h3>' + I('house', 18) + 'Evacuation drill</h3><span class="tag now">Running</span></div>' +
        '<p class="drill-to"><span data-i18n-skip>' + esc(d.name) + '</span><span class="q-meta">' + (d.evac ? 'Evacuation center' : 'Barangay hall: ask where your barangay evacuates') + '</span></p>' +
        '<div class="drill-stats"><div><b class="num" id="drill-time">' + mmss(secs) + '</b><span>Time</span></div><div><b class="num">' + d.km.toFixed(1) + ' km</b><span>Distance</span></div><div><b class="num">~' + walk + ' min</b><span>Walking</span></div></div>' +
        '<div class="backup-btns">' + (navigator.onLine ? '<a class="btn btn-soft sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + d.lat + ',' + d.lng + '">' + I('nav', 16) + 'Walking directions</a>'
          : '<span class="dir-off">' + I('nav', 13) + bearing(here(), d) + '</span>') +
        '<button class="btn btn-primary sm" data-action="drillDone">' + I('check', 16) + 'I arrived</button></div>' +
        '<button class="link-btn" data-action="drillStop">' + I('x', 14) + 'Stop the drill</button></div>';
    }
    const t = drillTarget();
    return '<div class="card drill" id="drill"><div class="card-head"><h3>' + I('house', 18) + 'Evacuation drill</h3>' + (done ? '<span class="tag ok">Done today</span>' : '<span class="tag">+' + DRILL_XP + ' XP</span>') + '</div>' +
      (done ? '<p class="fine">' + I('check', 13) + '<span>You reached <b data-i18n-skip>' + esc(done.name) + '</b> in ' + mmss(done.secs) + '. Walk it with your family too.</span></p>'
        : '<p class="fine">' + I('info', 13) + 'Practice the walk to your nearest evacuation center, so you know the way before a flood.</p>') +
      (t ? '<button class="btn ' + (done ? 'btn-soft' : 'btn-primary') + ' btn-block" data-action="drillStart">' + I('house', 18) + (done ? 'Do it again' : 'Start drill') + '</button>'
        : '<p class="fine">' + I('info', 13) + 'No evacuation center is listed near you yet. Ask your barangay.</p>') + '</div>';
  }
  let drillTimer = null;
  function tickDrill() {
    clearInterval(drillTimer);
    if (!BD.state.drill) return;
    drillTimer = setInterval(() => {
      const el = document.getElementById('drill-time');
      if (!el || !BD.state.drill) { clearInterval(drillTimer); return; }
      el.textContent = mmss((Date.now() - BD.state.drill.start) / 1000);
    }, 1000);
  }

  /* ---------- render ---------- */
  BD.tabs = BD.tabs || {};
  // For other tabs (Pamilya) that need their own map with the same offline tiles.
  BD.mapKit = {
    CITY, color, isDark,
    async create(container, opts) {
      await loadLibs();
      const fl = isDark() ? 'dark' : 'light';
      return new gl.Map(Object.assign({ container, style: await style(save.state === 'saved', fl), bounds: CITY, maxBounds: [[124.9, 6.7], [126.0, 7.9]],
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false }, opts || {}));
    },
    marker(el, lngLat, anchor) { return new gl.Marker({ element: el, anchor: anchor || 'bottom' }).setLngLat(lngLat); },
    bounds() { return new gl.LngLatBounds(); }
  };
  BD.tabs.mapa = {
    render() {
      const s = BD.state, rain = s.season === 'rain', d = BD.DISTRICTS.find(x => x.id === s.district) || BD.DISTRICTS[0], me = here();
      // The nearest places, 5 per page, with page buttons under the list.
      const sorted = places(), pages = Math.max(1, Math.ceil(sorted.length / PAGE)), pg = Math.min(BD.ui.mapPage || 0, pages - 1), shown = sorted.slice(pg * PAGE, pg * PAGE + PAGE);
      const season = Object.keys(BD.PLACE_TYPES).filter(k => BD.PLACES[s.season].some(p => p.type === k && (p.real || BD.demo)));
      const helpTypes = Object.keys(BD.PLACE_TYPES).filter(k => BD.PLACE_TYPES[k].osm);
      const chip = k => '<button class="chip' + (s.mapFilter === k ? ' on' : '') + '" data-action="mapFilter" data-f="' + k + '">' +
        (k === 'all' ? 'All' : I(BD.PLACE_TYPES[k].icon, 14) + BD.PLACE_TYPES[k].label) + '</button>';
      const flood = rain && BD.floodNear(me), open = !!s.mapListOpen;
      const list = shown.map((p, j) => {
        const t = BD.PLACE_TYPES[p.type], i = pg * PAGE + j;
        return '<div class="place' + (i < 3 ? ' top' : '') + '">' +
          '<span class="place-n" style="background:' + t.color + '">' + (i < 3 ? i + 1 : I(t.icon, 14)) + '</span>' +
          '<div class="q-body" data-action="mapPick" data-i="' + i + '" role="button" tabindex="0"><span class="q-title" data-i18n-skip>' + esc(p.name) + '</span>' +
          '<span class="q-meta">' + t.label + (p.district ? ' · ' + esc(p.district) : '') + '</span>' +
          (p.note ? '<span class="place-note">' + (p.type === 'tanker' ? I('clock', 13) : '') + esc(p.note) + '</span>' : '') +
          '<span class="place-tags">' + (p.osm ? '<span class="tag real">OpenStreetMap</span>' : p.real ? '<span class="tag real">Verified location</span>' : '<span class="tag sample">Sample</span>') + '</span></div>' +
          '<div class="place-r"><b class="num">' + p.km.toFixed(1) + ' km</b>' + directions(p) + '</div></div>';
      }).join('') + (pages > 1 ? '<nav class="pager" aria-label="More places">' +
        '<button class="btn btn-soft sm" data-action="mapPage" data-p="' + (pg - 1) + '"' + (pg ? '' : ' disabled') + ' aria-label="Previous 5 places">' + I('back', 16) + 'Prev</button>' +
        '<span class="pager-n">' + (pg * PAGE + 1) + '–' + (pg * PAGE + shown.length) + ' of ' + sorted.length + '</span>' +
        '<button class="btn btn-soft sm" data-action="mapPage" data-p="' + (pg + 1) + '"' + (pg < pages - 1 ? '' : ' disabled') + ' aria-label="Next 5 places">Next' + I('chevron', 16) + '</button></nav>' : '');

      return '<div class="map-filters">' +
        '<label class="map-search">' + I('search', 18) + '<input id="mapQ" type="search" placeholder="Search barangay, street, hospital…" autocomplete="off" value="' + esc(BD.ui.mapQ || '') + '" aria-label="Search the map">' + '</label>' +
        '<div id="map-results" class="map-results">' + resultsHtml() + '</div>' +
        '<div class="chips" role="group" aria-label="Show on map">' + chip('all') + season.map(chip).join('') + '<span class="chip-sep"></span>' + helpTypes.map(chip).join('') + '</div></div>' +

        '<div class="card map-card"><div id="map-slot" class="map-slot">' + notice('map', 'Loading map…', '') + '</div>' +
        '<div class="map-ctl"><button class="map-btn" data-action="mapLocate" aria-label="Use my current location">' + I('locate', 18) + '</button>' +
        '<button class="map-btn" data-action="mapWide" aria-label="' + (BD.ui.mapWide ? 'Show nearest' : 'Show whole city') + '">' + I(BD.ui.mapWide ? 'target' : 'map', 18) + '</button></div>' +
        (navigator.onLine ? '' : '<span class="offline-pill">' + I('wifioff', 13) + 'Offline</span>') + '</div>' +

        '<div class="map-info">' +
        '<div id="map-pick">' + pickCard() + '</div>' +
        '<div class="map-top"><label class="sel"><span>' + I('pin', 16) + (BD.ui.here ? 'Near' : 'I\'m in') + '</span><select data-change="district" aria-label="Your district">' +
        (BD.ui.here ? '<option selected>' + esc(BD.ui.here.name) + '</option>' : '') +
        BD.DISTRICTS.map(x => '<option value="' + x.id + '"' + (!BD.ui.here && x.id === d.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>' + I('chevdown', 16) + '</label>' +
        '<span class="map-mode">' + (rain ? I('house', 15) + 'Safe places' : I('droplet', 15) + 'Water sources') + '</span></div>' +
        (flood ? '<div class="flood-alert">' + I('waves', 20) + '<div><b>Flood-prone area nearby</b><span>' + esc(flood.name) +
          (flood.events.length ? ' flooded ' + floodDate(flood.events[0]) + (flood.river ? ' (' + esc(flood.river) + ' River)' : '') : ' is listed by CDRRMO as flood-prone') +
          '. Know your route to higher ground.</span><span class="src">Source: ' + esc(flood.source) + '</span></div></div>' : '') +
        '<div id="map-save">' + (save.state === 'unknown' ? '' : saveCard()) + '</div>' + (BD.locked() ? '' : drillCard()) +
        // Collapsible to save space: closed it shows the count and the single nearest place; the choice is remembered.
        '<div class="sec-head sec-toggle"><h2><button data-action="mapList" aria-expanded="' + open + '" aria-controls="place-list">' +
        '<span class="st-txt"><span class="st-title">' + (s.mapFilter !== 'all' ? BD.PLACE_TYPES[s.mapFilter].label + ' near you' : rain ? 'Nearest safe places and help' : 'Nearest water and help') + '</span>' +
        '<span class="sum">' + sorted.length + ' places</span>' +
        (!open && sorted[0] ? '<span class="st-peek">' + I('pin', 13) + '<span data-i18n-skip>' + esc(sorted[0].name) + '</span><b class="num">' + sorted[0].km.toFixed(1) + ' km</b></span>' : '') +
        '</span>' + I('chevdown', 20, 'st-chev') + '</button></h2></div>' +
        (open ? '<div class="card places" id="place-list">' + (list || '<div class="dd-empty">' + (gaz ? 'No places of this type.' : 'Loading places…') + '</div>') + '</div>' : '') +
        '<div class="card tips"><div class="card-head"><h3>' + I('info', 18) + (rain ? 'Ingat sa baha' : 'Tipid tubig') + '</h3></div><ul>' +
        BD.MAP_TIPS[s.season].map(t => '<li>' + I('check', 15) + '<span>' + esc(t) + '</span></li>').join('') + '</ul></div>' +
        '<p class="fine center">Map data © OpenStreetMap contributors. Places marked Sample are placeholders.</p></div><div class="spacer"></div>';
    },
    after() {
      const first = !gaz;
      ensureMap().then(() => { if (first) BD.render(); }).catch(() => {
        const slot = document.getElementById('map-slot'); if (slot) slot.innerHTML = notice('map', 'Map unavailable', 'Search and the list still work.');
        if (first && gaz) BD.render();
      });
      if (save.state !== 'unknown') renderSave();
      tickDrill();
    }
  };
  let results = [];
  function resultsHtml() {
    if (!BD.ui.mapQ || BD.ui.mapQ.trim().length < 2) return '';
    results = search(BD.ui.mapQ);
    if (!results.length) return '<div class="dd-empty">' + I('search', 16) + (gaz ? 'No match in Davao City.' : 'Loading search…') + '</div>';
    return results.map((r, i) => '<button class="res" data-action="mapResult" data-i="' + i + '"><span class="q-body"><span class="q-title" data-i18n-skip>' + esc(r.name) + '</span>' +
      '<span class="q-meta">' + esc(r.kind) + '</span></span><b class="num">' + r.km.toFixed(1) + ' km</b></button>').join('');
  }
  document.addEventListener('input', e => {
    if (e.target.id !== 'mapQ') return;
    BD.ui.mapQ = e.target.value;
    const el = document.getElementById('map-results'); if (el) el.innerHTML = resultsHtml();
  });
  window.addEventListener('online', () => { if (BD.ui.tab === 'mapa') BD.render(); });
  window.addEventListener('offline', () => { if (BD.ui.tab === 'mapa') BD.render(); });

  Object.assign(BD.actions = BD.actions || {}, {
    drillStart() {
      const t = drillTarget(); if (!t) return;
      BD.state.drill = Object.assign({ start: Date.now() }, t); BD.save(); BD.render();
      pick({ name: t.name, kind: t.evac ? BD.PLACE_TYPES.evac.label : BD.PLACE_TYPES.brgy.label, lat: t.lat, lng: t.lng });
      BD.toast(I('house', 16) + 'Drill started. Walk safely, bantay!');
    },
    drillStop() { BD.state.drill = null; BD.save(); BD.render(); },
    drillDone(el) {
      const d = BD.state.drill; if (!d) return;
      const secs = Math.round((Date.now() - d.start) / 1000), first = !BD.today().xpDrill;
      BD.state.drill = null;
      BD.commit(() => { const t = BD.today(); t.drill = { name: d.name, secs }; if (first) t.xpDrill = DRILL_XP; }, el);
      BD.toast(I('check', 16) + 'Drill done in ' + mmss(secs) + '. Galing!');
    },
    district(el) { BD.state.district = el.dataset.id || el.value; BD.state.gpsOn = false; BD.ui.here = null; BD.ui.mapPage = 0; BD.save(); BD.render(); frame(true); },
    mapWide() { BD.ui.mapWide = !BD.ui.mapWide; BD.render(); frame(!BD.ui.mapWide); },
    mapList() { BD.state.mapListOpen = !BD.state.mapListOpen; BD.save(); BD.render(); },
    mapPage(el) {
      BD.ui.mapPage = Math.max(0, +el.dataset.p); BD.render();
      const l = document.getElementById('place-list'); if (l) l.scrollIntoView({ behavior: BD.calm() ? 'auto' : 'smooth', block: 'start' });
    },
    mapFilter(el) { BD.state.mapFilter = el.dataset.f; BD.ui.mapPage = 0; BD.save(); BD.render(); frame(true); },
    mapSave() { saveMap(); },
    mapRemove() { caches.open(MAP_CACHE).then(c => c.delete(MAP_URL)).then(() => { save.state = 'none'; BD.render(); useSource(false); }); },
    mapPick(el) { const p = places()[+el.dataset.i]; if (p) { pick(p); document.getElementById('map-slot').scrollIntoView({ behavior: BD.calm() ? 'auto' : 'smooth', block: 'center' }); } },
    mapResult(el) {
      const r = results[+el.dataset.i]; if (!r) return;
      BD.ui.mapQ = ''; const q = document.getElementById('mapQ'); if (q) { q.value = ''; q.blur(); }
      document.getElementById('map-results').innerHTML = '';
      pick(r);
    },
    mapUnpick() { BD.ui.mapPick = null; if (pickMk) { pickMk.remove(); pickMk = null; } document.getElementById('map-pick').innerHTML = ''; },
    mapSetHere() {
      const p = BD.ui.mapPick; if (!p) return;
      BD.ui.here = { lat: p.lat, lng: p.lng, name: p.name }; BD.ui.mapPage = 0; BD.render(); frame(true);
      BD.toast(I('pin', 16) + 'Distances now from ' + esc(p.name));
    },
    mapLocate() { BD.useGps(); }
  });

  // Current GPS location for every screen that depends on where you are: Mapa distances, the district in Settings
  // and Profile, and the nearby flood, landslide and water threats on Karon and Peligro. The phone asks for the
  // location permission the first time. quiet: no messages (used on start).
  BD.useGps = function (quiet) {
    if (!quiet) BD.toast(I('locate', 16) + 'Finding you…');
    return BD.locate().then(p => {
      if (p.lat < CITY[0][1] || p.lat > CITY[1][1] || p.lng < CITY[0][0] || p.lng > CITY[1][0]) {
        if (!quiet) BD.toast(I('pin', 16) + 'You seem to be outside Davao City. Pick your district instead.');
        return false;
      }
      let near = BD.DISTRICTS[0];
      BD.DISTRICTS.forEach(d => { if (BD.km(d, p) < BD.km(near, p)) near = d; });
      BD.ui.here = { lat: p.lat, lng: p.lng, name: 'My GPS location', gps: true }; BD.ui.mapPage = 0;
      BD.state.district = near.id; BD.state.gpsOn = true; BD.save();
      if (!quiet || (!BD.ui.center && !document.getElementById('modal').classList.contains('open'))) BD.render();
      if (BD.ui.tab === 'mapa') frame(true);
      if (!quiet) BD.toast(I('locate', 16) + 'Using your current location.');
      return true;
    }, e => {
      if (e.message === 'denied') { BD.state.gpsOn = false; BD.save(); }
      if (!quiet) BD.toast(I('locate', 16) + (e.message === 'denied' ? 'Location is off for BantayDavao. Turn it on in your phone settings, or pick your district.'
        : e.message === 'unavailable' ? 'GPS is not available on this device.' : 'Could not get your location. Pick your district instead.'));
      return false;
    });
  };
  // In the app: ask once on the first start, then refresh the position on every start while it stays allowed.
  BD.gpsBoot = function () {
    if (!BD.native) return;
    const first = !BD.state.gpsAsked;
    if (!first && !BD.state.gpsOn) return;
    BD.state.gpsAsked = 1; BD.save();
    setTimeout(() => BD.useGps(true), first ? 1500 : 300);
  };
})(window.BD);