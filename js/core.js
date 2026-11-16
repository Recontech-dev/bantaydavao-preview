/* BantayDavao core: saved state, clock, XP math, weather, threats, effects, notifications. */
window.BD = window.BD || {};
(function (BD) {
  const KEY = 'bantaydavao.v1';
  const pad = n => String(n).padStart(2, '0');
  const DAY_MS = 86400000;

  BD.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  BD.dateKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  BD.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  BD.hourLabel = h => { const hh = ((h + 11) % 12) + 1; return hh + (h < 12 || h === 24 ? ' AM' : ' PM'); };
  BD.shortHour = h => { const hh = ((h + 11) % 12) + 1; return hh + (h < 12 ? 'a' : 'p'); };
  BD.timeLabel = d => { let h = d.getHours(); const m = pad(d.getMinutes()); const ap = h < 12 ? 'AM' : 'PM'; h = ((h + 11) % 12) + 1; return h + ':' + m + ' ' + ap; };
  BD.DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  BD.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- state ---------- */
  function defaults() {
    return {
      v: 1, season: 'heat', name: 'Dabawenyo', days: {}, notifs: [], sent: {},
      settings: { weather: true, quests: true, water: true }, theme: 'auto', simHour: null,
      manualHI: null, rainLevel: 'yellow', district: 'poblacion', mapFilter: 'all',
      checklist: {}, seeded: false, sampleWeek: false, lastLevel: null, bonusWeeks: null
    };
  }
  // The released app (Android, or the web without ?demo) takes its season from PAGASA's ENSO status in the
  // bundled data: Heat in El Niño, Rain in La Niña. It cannot be changed by hand there. The demo keeps the switch.
  BD.seasonLocked = () => !BD.demo;
  BD.pagasaSeason = () => ({ el_nino: 'heat', la_nina: 'rain' })[BD.HAZARDS.outlook.status] || null;
  function followPagasa() {
    const k = BD.seasonLocked() && BD.pagasaSeason(), s = BD.state;
    if (!k || s.season === k) return;
    s.season = k; s.mapFilter = 'all';
    const d = new Date(), key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (s.days && s.days[key]) s.days[key].season = k;
  }
  // In the Android app every save is also written to a file in the app's own storage on the phone. The app reads it
  // back by itself when its usual storage comes up empty, so people never handle a backup file.
  const SAVE_FILE = 'bantaydavao-save.json';
  const phoneFiles = () => (BD.native && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) || null;
  let fileReady = false, fileT = null, fresh = false;
  function saveFile() {
    const fs = phoneFiles();
    if (!fs || !fileReady) return;   // not before the start-up check, or an empty state could replace a good file
    clearTimeout(fileT);
    fileT = setTimeout(() => { fs.writeFile({ path: SAVE_FILE, data: JSON.stringify(BD.state), directory: 'DATA', encoding: 'utf8' }).catch(() => { }); }, 600);
  }
  // On start: resolves true when progress was brought back from the phone's save file.
  BD.restoreLocal = async function () {
    const fs = phoneFiles();
    if (!fs) return false;
    let ok = false;
    if (fresh) {
      try {
        const s = JSON.parse((await fs.readFile({ path: SAVE_FILE, directory: 'DATA', encoding: 'utf8' })).data);
        if (s && typeof s.days === 'object') { fileReady = true; BD.replaceState(s); ok = true; }
      } catch (e) { /* no file yet: a first install */ }
    }
    fileReady = true; saveFile();
    return ok;
  };
  BD.load = function () {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    fresh = !s;
    BD.state = Object.assign(defaults(), s || {});
    BD.state.settings = Object.assign(defaults().settings, BD.state.settings || {});
    followPagasa();
  };
  // A guest's session is not kept. Only how the app looks (language, theme, text size, motion) is remembered,
  // written into whatever was saved before, so a signed-in person's progress on this phone is left alone.
  const LOOK = ['lang', 'theme', 'textSize', 'motion'];
  function saveLook() {
    try {
      const old = JSON.parse(localStorage.getItem(KEY) || 'null') || defaults();
      LOOK.forEach(k => { if (BD.state[k] === undefined) delete old[k]; else old[k] = BD.state[k]; });
      localStorage.setItem(KEY, JSON.stringify(old)); return true;
    } catch (e) { return false; }
  }
  BD.save = function () { if (BD.locked && BD.locked()) return saveLook(); saveFile(); try { localStorage.setItem(KEY, JSON.stringify(BD.state)); return true; } catch (e) { return false; /* private mode or storage full: keep in memory */ } };
  // Restore a backup file's state (Settings → Backup & restore). Missing fields fall back to defaults.
  BD.replaceState = function (s) {
    BD.state = Object.assign(defaults(), s);
    BD.state.settings = Object.assign(defaults().settings, s.settings || {});
    followPagasa();
    BD.save();
  };
  BD.resetAll = function () { try { localStorage.removeItem(KEY); } catch (e) { } BD.state = defaults(); BD.seedSample(); BD.save(); };

  /* ---------- clock (with demo override) ---------- */
  BD.now = function () {
    const d = new Date();
    if (BD.demo && BD.state && BD.state.simHour != null) d.setHours(BD.state.simHour);
    return d;
  };
  BD.todayKey = () => BD.dateKey(BD.now());
  BD.mondayOf = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); const dow = (x.getDay() + 6) % 7; return BD.addDays(x, -dow); };
  BD.weekKeys = d => { const m = BD.mondayOf(d); return [0, 1, 2, 3, 4, 5, 6].map(i => BD.dateKey(BD.addDays(m, i))); };

  /* ---------- quests & XP (all XP is derived, so undo is always safe) ---------- */
  BD.season = () => BD.SEASONS[BD.state.season];
  BD.quests = season => BD.QUESTS[season || BD.state.season];
  const QUEST_XP = {};
  Object.keys(BD.QUESTS).forEach(k => BD.QUESTS[k].forEach(q => { QUEST_XP[q.id] = q.xp; }));

  BD.day = function (key, create) {
    key = key || BD.todayKey();
    let d = BD.state.days[key];
    if (!d && create) { d = BD.state.days[key] = { season: BD.state.season, q: {}, glasses: 0, lastGlass: null }; }
    return d;
  };
  BD.today = () => BD.day(BD.todayKey(), true);

  BD.doneCount = function (d) {
    if (!d) return 0;
    let n = d.glasses >= 8 ? 1 : 0;
    BD.quests(d.season).forEach(q => { if (d.q[q.id]) n++; });
    return n;
  };
  BD.dayXP = function (d) {
    if (!d) return 0;
    let xp = d.glasses >= 8 ? BD.WATER_QUEST.xp : 0;
    Object.keys(d.q).forEach(id => { if (d.q[id]) xp += QUEST_XP[id] || 0; });
    if (BD.doneCount(d) >= 8) xp += 50;
    xp += (d.xpShare || 0) + (d.xpWarn || 0) + (d.xpFamily || 0) + (d.xpSafe || 0) + (d.xpQuiz || 0) + (d.xpDrill || 0); // sharing, a shared link, Marked Safe, quiz, drill
    return xp;
  };
  BD.isFull = d => BD.doneCount(d) >= 6;
  BD.weekFullDays = function (keys) { return keys.filter(k => BD.isFull(BD.state.days[k])).length; };

  BD.bonusWeeks = function () {
    const weeks = {};
    Object.keys(BD.state.days).forEach(k => {
      if (!BD.isFull(BD.state.days[k])) return;
      const mk = BD.dateKey(BD.mondayOf(new Date(k + 'T12:00:00')));
      weeks[mk] = (weeks[mk] || 0) + 1;
    });
    return Object.keys(weeks).filter(w => weeks[w] >= 5);
  };
  BD.totalXP = function () {
    let xp = 0;
    Object.keys(BD.state.days).forEach(k => { xp += BD.dayXP(BD.state.days[k]); });
    return xp + 150 * BD.bonusWeeks().length;
  };
  BD.levelOf = function (xp) {
    let lv = 1;
    for (let i = 0; i < BD.LEVELS.length; i++) if (xp >= BD.LEVELS[i]) lv = i + 1;
    const cur = BD.LEVELS[lv - 1], next = BD.LEVELS[lv];
    let rank = BD.RANKS[0].name;
    BD.RANKS.forEach(r => { if (lv >= r.from) rank = r.name; });
    return { level: lv, rank, cur, next: next == null ? null : next, pct: next == null ? 1 : (xp - cur) / (next - cur), toNext: next == null ? 0 : next - xp, max: next == null };
  };
  BD.streak = function () {
    let d = BD.now(); d.setHours(12, 0, 0, 0);
    if (!BD.isFull(BD.state.days[BD.dateKey(d)])) d = BD.addDays(d, -1);
    let n = 0;
    while (BD.isFull(BD.state.days[BD.dateKey(d)])) { n++; d = BD.addDays(d, -1); }
    return n;
  };
  BD.unlocked = q => BD.now().getHours() >= q.hour;

  /* Sample data for the earlier days of this week, clearly labeled in the UI. */
  BD.seedSample = function () {
    if (BD.state.seeded || !BD.demo) return;
    BD.state.seeded = true;
    const keys = BD.weekKeys(BD.now()), today = BD.todayKey();
    const patterns = [[0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 4, 5], [0, 1, 2, 3, 5, 6], [0, 1, 3, 4], [0, 1, 2, 3, 4, 6]];
    const glasses = [8, 8, 8, 6, 8, 5];
    let i = 0;
    for (const k of keys) {
      if (k >= today) break;
      const qs = BD.quests(BD.state.season), d = { season: BD.state.season, q: {}, glasses: glasses[i % 6], lastGlass: null, sample: true };
      patterns[i % 6].forEach(j => { d.q[qs[j].id] = true; });
      BD.state.days[k] = d; i++;
    }
    BD.state.sampleWeek = i > 0;
  };
  BD.clearSample = function () {
    Object.keys(BD.state.days).forEach(k => { if (BD.state.days[k].sample) delete BD.state.days[k]; });
    BD.state.sampleWeek = false;
  };

  /* ---------- weather ---------- */
  // NOAA heat index (Rothfusz regression with adjustments), input/output in °C.
  BD.heatIndex = function (tc, rh) {
    if (tc < 26.7) return tc; // PAGASA: below 26.7°C the heat index is the air temperature
    const T = tc * 9 / 5 + 32;
    let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
    if ((hi + T) / 2 >= 80) {
      hi = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 0.00683783 * T * T
        - 0.05481717 * rh * rh + 0.00122874 * T * T * rh + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
      if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
      else if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5);
    }
    return (hi - 32) * 5 / 9;
  };
  BD.heatLevel = function (hi) {
    let lv = BD.HEAT_LEVELS[0];
    BD.HEAT_LEVELS.forEach(l => { if (Math.round(hi) >= l.min) lv = l; });
    return lv;
  };
  // Daily curve: 0 at 6 AM, 1 at 2 PM, back to 0 by 2 AM.
  function dayCurve(h) {
    if (h < 6) h += 24;
    if (h <= 14) return (1 - Math.cos(Math.PI * (h - 6) / 8)) / 2;
    return h >= 26 ? 0 : (1 + Math.cos(Math.PI * (h - 14) / 12)) / 2;
  }
  // On days PAGASA publishes Davao City's heat index, today's hourly curve is scaled so its peak equals PAGASA's value.
  BD.hourly = function (hour, dayIndex) {
    const x = hourlyRaw(hour, dayIndex), p = !dayIndex && BD.pagasa ? BD.pagasa.today : null;
    if (!p || p.state !== 'ok') return x;
    let peak = 0;
    for (let h = 6; h <= 21; h++) peak = Math.max(peak, hourlyRaw(h, 0).hi);
    const hi = x.hi * p.hi / peak;
    return Object.assign({}, x, { hi, level: BD.heatLevel(hi), pagasa: true });
  };
  function hourlyRaw(hour, dayIndex) {
    // Live forecast when we have it; the embedded sample curve is only the last fallback.
    const w = BD.weather && BD.weather.at(hour, dayIndex);
    if (w) { const hi = BD.heatIndex(w.temp, w.rh); return { hour, temp: w.temp, rh: w.rh, hi, level: BD.heatLevel(hi), live: true }; }
    const f = BD.FORECAST.heat, i = dayIndex || 0, c = dayCurve(hour);
    const temp = f.low[i] + (f.high[i] - f.low[i]) * c;
    const rh = 88 - 28 * c;
    const hi = BD.heatIndex(temp, rh);
    return { hour, temp, rh, hi, level: BD.heatLevel(hi) };
  }
  BD.hoursToday = () => { const a = []; for (let h = 6; h <= 21; h++) a.push(BD.hourly(h)); return a; };
  BD.currentHeat = function () {
    const now = BD.now(), h = now.getHours() + now.getMinutes() / 60;
    const fc = BD.hourly(h);
    if (BD.state.manualHI != null) return Object.assign({}, fc, { hi: BD.state.manualHI, level: BD.heatLevel(BD.state.manualHI), manual: true });
    return fc;
  };
  BD.peakHeat = function () {
    return BD.hoursToday().reduce((a, b) => (b.hi > a.hi ? b : a));
  };
  BD.cautionWindow = function () {
    const hrs = BD.hoursToday().filter(x => Math.round(x.hi) >= 33);
    if (!hrs.length) return null;
    return { from: hrs[0].hour, to: hrs[hrs.length - 1].hour, level: BD.heatLevel(Math.max.apply(null, hrs.map(x => x.hi))) };
  };

  // Where the person is: their district, at the exact GPS position when they have shared it.
  BD.myPlace = function () {
    const d = BD.DISTRICTS.find(x => x.id === BD.state.district) || BD.DISTRICTS[0], h = BD.ui.here;
    return h && h.gps ? Object.assign({}, d, { lat: h.lat, lng: h.lng }) : d;
  };

  /* ---------- threats ---------- */
  BD.SEV = ['Low', 'Moderate', 'High', 'Extreme'];
  BD.threats = function () {
    const s = BD.state, t = BD.today(), now = BD.now(), h = now.getHours();
    const district = BD.myPlace();
    if (s.season === 'heat') {
      const peak = BD.peakHeat(), cur = BD.currentHeat();
      const worst = Math.max(peak.hi, cur.hi);
      const lk = BD.heatLevel(worst).key;
      const sev = { none: 0, caution: 1, xcaution: 2, danger: 3, xdanger: 3 }[lk];
      const expected = Math.max(0, Math.min(8, Math.round((h - 6) / 14 * 8)));
      const deficit = expected - t.glasses;
      let dsev = deficit <= 0 ? 0 : deficit <= 2 ? 1 : deficit <= 4 ? 2 : 3;
      if (sev >= 2 && dsev < 3 && deficit > 0) dsev++;
      return [
        { id: 'stroke', name: 'Heat stroke', sev, icon: 'thermometer', tab: 'tabang',
          line: 'Peaks at ' + Math.round(peak.hi) + '°C around ' + BD.hourLabel(peak.hour),
          detail: BD.heatLevel(worst).name + ' today. ' + BD.heatLevel(worst).advice },
        { id: 'dehydration', name: 'Dehydration', sev: dsev, icon: 'droplet', tab: 'quests',
          line: t.glasses + ' of 8 glasses so far',
          detail: deficit > 0 ? 'You are ' + deficit + ' glass' + (deficit > 1 ? 'es' : '') + ' behind for this time of day. Inom tubig!' : 'You are on track. Padayon!' },
        waterThreat(district)
      ];
    }
    const rl = { none: 0, yellow: 1, orange: 2, red: 3 }[s.rainLevel];
    const slide = nearest(BD.HAZARDS.landslide, district, 6);
    const near = BD.floodNear(district);
    return [
      { id: 'flood', name: 'Flooding', sev: Math.min(3, rl + (near && rl > 0 ? 1 : 0)), icon: 'waves', tab: 'mapa',
        line: (rl ? BD.RAIN_LEVELS[s.rainLevel].name + ' rainfall warning' : 'No rainfall warning') + (near ? ' · flood-prone area nearby' : ''),
        detail: BD.RAIN_LEVELS[s.rainLevel].act },
      { id: 'lepto', name: 'Leptospirosis', sev: rl >= 2 ? 2 : 1, icon: 'droplet', tab: 'tabang',
        line: 'From wading in floodwater', detail: 'Wash after wading. Visit a health center within 1–2 days.' },
      { id: 'dengue', name: 'Dengue', sev: 2, icon: 'bug', tab: 'quests',
        line: 'Mosquitoes breed in standing water', detail: 'Do the DOH 4S: search and destroy breeding places.' },
      { id: 'landslide', name: 'Landslide', sev: district.upland || slide ? Math.min(3, rl + 1) : 0, icon: 'mountain', tab: 'mapa',
        line: slide ? 'Landslide area nearby: ' + slide.name + ' (' + slide.events[0].slice(0, 4) + ')' : district.upland ? 'Your area is upland: ' + district.name : 'Uplands: Marilog, Paquibato, Calinan',
        detail: 'Watch for cracks, tilting trees and muddy streams. Leave slopes early.' }
    ];
  };
  function nearest(list, p, maxKm) {
    let best = null, d = maxKm;
    list.forEach(z => { const k = BD.km(z, p); if (k < d) { d = k; best = z; } });
    return best;
  }
  // DCWD's low-pressure risk areas (briefing 14 Oct 2026): higher risk when you are near one.
  function waterThreat(district) {
    const lp = BD.HAZARDS.lowPressure, near = nearest(lp.areas, district, 3);
    return { id: 'water', name: 'Water interruption', sev: near ? 2 : 1, icon: 'wrench', tab: 'mapa',
      line: near ? 'Low water pressure risk: ' + near.name : 'Low pressure possible in elevated areas',
      detail: (near ? near.reason + '. ' : 'DCWD lists ' + lp.areas.slice(0, 4).map(a => a.name.replace(' (parts)', '')).join(', ') + ' and others. ') +
        'Store water tonight and know your nearest refill station. (DCWD, 14 Oct 2026)' };
  }
  BD.topThreat = () => BD.threats().reduce((a, b) => (b.sev > a.sev ? b : a));
  // Great-circle distance in km between two {lat, lng} points.
  BD.km = function (a, b) {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  BD.floodNear = function (district) {
    // The nearest flood-prone barangay within about 3 km.
    let best = null, d = 3;
    BD.FLOOD_ZONES.forEach(z => { const k = BD.km(z, district); if (k < d) { d = k; best = z; } });
    return best;
  };

  /* ---------- effects ---------- */
  function appEl() { return document.getElementById('app'); }
  BD.scale = function () { const a = appEl(); return a.getBoundingClientRect().width / a.offsetWidth || 1; };
  BD.anchor = function (el) {
    if (!el) return null;
    const a = appEl().getBoundingClientRect(), r = el.getBoundingClientRect(), s = BD.scale();
    return { x: (r.left - a.left + r.width / 2) / s, y: (r.top - a.top + r.height / 2) / s };
  };
  BD.floatText = function (text, pos, cls, delay) {
    if (!pos) return;
    const fx = document.getElementById('fx'), el = document.createElement('div');
    el.className = 'float-xp ' + (cls || '');
    el.textContent = text;
    el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
    el.style.animationDelay = (delay || 0) + 'ms';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1600 + (delay || 0));
  };
  const BURST = ['var(--sun)', 'var(--ok)', '#FBBF24', 'var(--gulf-2)'];   // durian gold and Davao green
  BD.burst = function (pos, color) {
    if (!pos) return;
    const fx = document.getElementById('fx');
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('i');
      p.className = 'spark';
      const a = (Math.PI * 2 * i) / 10, d = 28 + Math.random() * 18;
      p.style.left = pos.x + 'px'; p.style.top = pos.y + 'px';
      p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      p.style.background = color || BURST[i % BURST.length];
      fx.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  };

  /* Run a change, save, re-render, then celebrate any XP / level / bonus change. */
  // XP orbs fly from where you tapped to your XP total (the Quests header, the level ring or the top-bar Quests
  // button, whichever is on screen), and the total bumps when they land.
  // Calm = the phone asks for reduced motion, or the user turned on Settings → Reduce motion.
  const calm = BD.calm = () => BD.state.motion === 'reduce' || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function onScreen(e) {
    const r = e.getBoundingClientRect(), a = appEl().getBoundingClientRect();
    return r.width > 0 && r.bottom > a.top + 8 && r.top < a.bottom - 60;
  }
  BD.flyXP = function (pos, amount) {
    if (!pos || calm() || !Element.prototype.animate) return;
    const target = ['#quests .sum', '.hero .hero-ring', '#appbar .ab-quests'].map(s => document.querySelector(s)).find(e => e && onScreen(e));
    if (!target) return;
    const to = BD.anchor(target), fx = document.getElementById('fx'), n = Math.min(6, 2 + Math.round(amount / 10));
    for (let i = 0; i < n; i++) {
      const o = document.createElement('i');
      o.className = 'xp-orb'; o.style.left = pos.x + 'px'; o.style.top = pos.y + 'px';
      fx.appendChild(o);
      const mx = (to.x - pos.x) / 2 + (Math.random() - 0.5) * 90, my = Math.min(0, to.y - pos.y) / 2 - 40 - Math.random() * 40;
      const at = (x, y, sc) => 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px)) scale(' + sc + ')';
      const a = o.animate([{ transform: at(0, 0, 0.3), opacity: 0 }, { transform: at(mx, my, 1), opacity: 1, offset: 0.45 }, { transform: at(to.x - pos.x, to.y - pos.y, 0.45), opacity: 0.9 }],
        { duration: 640 + i * 50, delay: 140 + i * 60, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'both' });
      a.onfinish = () => {
        o.remove();
        if (i === n - 1) { target.classList.remove('xp-bump'); void target.offsetWidth; target.classList.add('xp-bump'); BD.vibrate(10); }
      };
    }
  };
  BD.commit = function (fn, anchorEl) {
    // Guests make no game progress: no quests, XP, levels or challenges.
    if (BD.locked && BD.locked() && !(anchorEl === 'guest-ok')) return;
    const pos = BD.anchor(anchorEl === 'guest-ok' ? null : anchorEl);
    const before = BD.totalXP(), lvBefore = BD.levelOf(before).level, wkBefore = BD.bonusWeeks().length;
    const perfBefore = BD.doneCount(BD.today()) >= 8;
    fn(BD.state);
    BD.save();
    const after = BD.totalXP(), lv = BD.levelOf(after).level, wk = BD.bonusWeeks().length;
    const perf = BD.doneCount(BD.today()) >= 8;
    BD.render();
    const diff = after - before;
    if (diff > 0) { BD.floatText('+' + diff + ' XP', pos); BD.burst(pos); BD.flyXP(pos, diff); BD.vibrate([14, 50, 22]); }
    else if (diff < 0) BD.floatText('−' + Math.abs(diff) + ' XP', pos, 'neg');
    if (perf && !perfBefore) setTimeout(() => BD.celebrate({ icon: 'star', kicker: 'Perfect day!', title: 'All 8 quests done', body: 'Your family is well guarded today. +50 XP bonus.', cta: 'Padayon!' }), 650);
    if (wk > wkBefore) setTimeout(() => {
      BD.celebrate({ icon: 'trophy', kicker: 'Weekly challenge complete', title: BD.season().challenge, body: '5 full days this week. +150 XP!', cta: 'Salamat!', tone: 'purple' });
    }, perf && !perfBefore ? 2600 : 700);
    if (lv > lvBefore) BD.queueLevelUp(lv);
    BD.state.lastLevel = lv; BD.save();
    if (BD.checkBadges) BD.checkBadges();
  };

  let celebrateQueue = [], celebrating = false;
  BD.celebrate = function (c) { celebrateQueue.push(c); if (!celebrating) nextCelebration(); };
  function nextCelebration() {
    const m = document.getElementById('modal');
    // An urgent threat pop-up comes first: a badge or level-up waits until it is closed.
    if (celebrateQueue.length && m.classList.contains('alert-open')) { celebrating = true; setTimeout(nextCelebration, 800); return; }
    const c = celebrateQueue.shift();
    if (!c) { celebrating = false; m.innerHTML = ''; m.classList.remove('open'); return; }
    celebrating = true;
    let confetti = '';
    const colors = ['var(--sun)', 'var(--teal)', 'var(--purple)', 'var(--pg-yellow)', 'var(--ok)'];
    for (let i = 0; i < 26; i++) confetti += '<i style="left:' + (Math.random() * 100) + '%;background:' + colors[i % 5] + ';animation-delay:' + (Math.random() * 0.5) + 's;--r:' + (Math.random() * 720 - 360) + 'deg"></i>';
    m.innerHTML = '<div class="modal-back" data-action="closeModal"></div>' +
      '<div class="pop ' + (c.tone || '') + '" role="dialog" aria-modal="true"><div class="confetti">' + confetti + '</div>' +
      (c.badge ? '<div class="pop-badge"><span>LEVEL</span><b>' + c.badge + '</b></div>' : '<div class="pop-icon">' + BD.icon(c.icon || 'sparkle', 40) + '</div>') +
      '<div class="pop-kicker">' + BD.esc(c.kicker) + '</div><h3>' + BD.esc(c.title) + '</h3><p>' + BD.esc(c.body) + '</p>' +
      '<button class="btn btn-primary btn-block" data-action="closeModal">' + BD.esc(c.cta || 'Padayon!') + '</button></div>';
    m.classList.add('open');
    BD.vibrate([20, 40, 20]);
  }
  BD.closeModal = nextCelebration;
  BD.queueLevelUp = function (lv) {
    const L = BD.levelOf(BD.LEVELS[lv - 1]);
    setTimeout(() => {
      BD.celebrate({ badge: lv, kicker: 'Level up!', title: L.rank, body: lv >= 11 ? 'You reached the top. Alamat ka!' : 'You are now Level ' + lv + '. Keep guarding your family. Padayon!', cta: 'Padayon!' });
      BD.notify({ kind: 'level', icon: 'trophy', title: 'Level up! You are now Level ' + lv, body: L.rank + '. Padayon, bantay!', tab: 'karon' });
    }, 900);
  };
  // Browsers only allow vibration after the user has touched the page.
  BD.vibrate = p => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch (e) { } };

  /* ---------- notifications ---------- */
  let bannerQueue = [], bannerOn = false;
  // App-wide notices (welcome, level-ups, shield) show the BantayDavao logo; topic notices keep their topic icon.
  BD.noticeIsApp = n => !n.icon || n.icon === 'shieldcheck' || n.icon === 'bell';
  BD.noticeIcon = (n, size) => BD.noticeIsApp(n) ? BD.logo('mark') : BD.icon(n.icon, size);
  BD.notify = function (n, opts) {
    const s = BD.state, force = opts && opts.force;
    // Before sign-in only warnings are shown: quests, water and the rest belong to the locked part of the app.
    if (BD.locked && BD.locked() && n.kind !== 'threat') return;
    if (!force && n.kind === 'quest' && !s.settings.quests) return;
    if (!force && n.kind === 'water' && !s.settings.water) return;
    if (!force && n.kind === 'threat' && !s.settings.weather) return;
    n.id = Date.now() + '' + Math.random().toString(36).slice(2, 6);
    n.time = BD.timeLabel((opts && opts.at) || BD.now());
    n.date = BD.todayKey();
    n.read = false;
    s.notifs.unshift(n);
    s.notifs = s.notifs.filter(x => x.date === n.date).slice(0, 40);
    BD.save();
    if (!(opts && opts.silent)) { bannerQueue.push(n); if (!bannerOn) nextBanner(); }
    if (BD.renderAppbar) BD.renderAppbar();
  };
  function nextBanner() {
    const n = bannerQueue.shift(), host = document.getElementById('banners');
    if (!n) { bannerOn = false; return; }
    bannerOn = true;
    const el = document.createElement('button');
    el.className = 'banner k-' + n.kind;
    el.setAttribute('data-action', 'openNotif');
    el.setAttribute('data-id', n.id);
    el.innerHTML = '<span class="banner-app"><span class="app-dot">' + BD.logo('mark') + '</span>BantayDavao · now</span>' +
      '<span class="banner-row"><span class="banner-ic' + (BD.noticeIsApp(n) ? ' is-logo' : '') + '">' + BD.noticeIcon(n, 18) + '</span><span><b>' + BD.esc(n.title) + '</b><span>' + BD.esc(n.body) + '</span></span></span>';
    host.appendChild(el);
    BD.vibrate(30);
    requestAnimationFrame(() => el.classList.add('in'));
    const close = () => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => { el.remove(); nextBanner(); }, 380); };
    el._t = setTimeout(close, 4800);
    el._close = close;
    el._drop = () => { el.remove(); nextBanner(); };   // swiped away: no closing animation
  }
  BD.dismissBanners = function () {
    document.querySelectorAll('#banners .banner').forEach(b => { clearTimeout(b._t); b._close && b._close(); });
  };
  BD.unread = () => BD.state.notifs.filter(n => n.date === BD.todayKey() && !n.read).length;

  function once(key) { if (BD.state.sent[key]) return false; BD.state.sent[key] = 1; return true; }
  BD.checkTriggers = function () {
    const s = BD.state, now = BD.now(), h = now.getHours(), dk = BD.dateKey(now), t = BD.today();
    // New quests unlocking this hour
    BD.quests().forEach(q => {
      if (q.hour === h && once('q:' + dk + ':' + q.id) && !t.q[q.id])
        BD.notify({ kind: 'quest', icon: q.icon, title: 'New quest: ' + q.title, body: '+' + q.xp + ' XP · ' + q.desc, tab: 'quests', qid: q.id });
    });
    // Water reminders every 2 hours until 8 glasses
    const since = t.lastGlass ? (Date.now() - t.lastGlass) / 60000 : 999;
    if (t.glasses < 8 && h >= 8 && h <= 21 && since >= 90 && once('w:' + dk + ':' + Math.floor(h / 2)))
      BD.notify({ kind: 'water', icon: 'droplet', title: 'Inom tubig!', body: 'You have had ' + t.glasses + ' of 8 glasses today. Drink one now.', tab: 'quests' });
    // Threat alerts
    if (s.season === 'heat') {
      const c = BD.currentHeat();
      if (h >= 9 && h < 17 && Math.round(c.hi) >= 33 && once('th:' + dk + ':' + c.level.key))
        BD.notify({ kind: 'threat', icon: 'thermometer', title: 'Peligro: ' + c.level.name, body: 'Heat index is ' + Math.round(c.hi) + '°C in Davao City. ' + c.level.advice, tab: 'peligro' });
    } else if (s.rainLevel !== 'none' && once('rw:' + dk + ':' + s.rainLevel)) {
      const r = BD.RAIN_LEVELS[s.rainLevel];
      BD.notify({ kind: 'threat', icon: 'rain', title: 'PAGASA ' + r.name + ' rainfall warning · ' + r.tag, body: r.meaning + ' ' + r.act, tab: 'peligro' });
    }
    BD.save();
  };
  // What is still coming today (for the notification center)
  BD.upcoming = function () {
    const now = BD.now(), h = now.getHours(), t = BD.today(), out = [];
    BD.quests().forEach(q => { if (q.hour > h) out.push({ hour: q.hour, icon: q.icon, title: 'New quest: ' + q.title, body: '+' + q.xp + ' XP' }); });
    if (t.glasses < 8) {
      for (let x = Math.max(8, h + 1); x <= 21; x++) if (x % 2 === 0) { out.push({ hour: x, icon: 'droplet', title: 'Water reminder', body: 'If you are under 8 glasses' }); break; }
    }
    return out.sort((a, b) => a.hour - b.hour);
  };
  const SAMPLES = [
    () => { const q = BD.quests()[3]; return { kind: 'quest', icon: q.icon, title: 'New quest: ' + q.title, body: '+' + q.xp + ' XP · ' + q.desc, tab: 'quests', qid: q.id }; },
    () => ({ kind: 'water', icon: 'droplet', title: 'Inom tubig!', body: 'You have had ' + BD.today().glasses + ' of 8 glasses today. Drink one now.', tab: 'quests' }),
    () => BD.state.season === 'heat'
      ? { kind: 'threat', icon: 'thermometer', title: 'Peligro: Extreme Caution', body: 'Heat index is ' + Math.round(BD.peakHeat().hi) + '°C in Davao City. Limit time outside.', tab: 'peligro' }
      : { kind: 'threat', icon: 'rain', title: 'PAGASA Orange rainfall warning · Be prepared', body: 'Flooding is threatening in low-lying areas. Be ready to evacuate.', tab: 'peligro' },
    () => { const L = BD.levelOf(BD.totalXP()); return { kind: 'level', icon: 'trophy', title: 'Level up! You are now Level ' + L.level, body: L.rank + '. Padayon, bantay!', tab: 'karon' }; }
  ];
  let sampleIdx = 0;
  BD.sampleNotif = function () { BD.notify(SAMPLES[sampleIdx++ % SAMPLES.length](), { force: true }); };
})(window.BD);
