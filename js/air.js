/* Air quality for Davao City: fine dust (PM2.5) rated with the DENR Philippine categories (DAO 2020-14),
   cached for offline use like the weather. It joins the threat radar, Karon's top threat and the alerts.
   Data: Open-Meteo Air Quality API (CAMS model estimate, CC BY 4.0), not DENR station readings; the card says so.
   PAGASA does not publish air quality; official readings come from DENR-EMB. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;
  const KEY = 'bantaydavao-air', MAX_AGE = 30 * 60 * 1000, STALE = 12 * 60 * 60 * 1000;
  const URL_ = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=7.0731&longitude=125.6128' +
    '&current=pm2_5,pm10&hourly=pm2_5&past_days=1&forecast_days=1&timezone=Asia%2FManila';

  // DAO 2020-14, PM2.5 in µg/m³. `sev` feeds the threat radar (0 none … 3 high).
  BD.AIR_LEVELS = [
    { key: 'good', max: 25, name: 'Good', color: 'var(--ok)', sev: 0, advice: 'The air is clean. Enjoy the outdoors.' },
    { key: 'fair', max: 35, name: 'Fair', color: 'var(--pg-yellow)', sev: 0, advice: 'The air is okay. Very sensitive people may feel it.' },
    { key: 'usg', max: 45, name: 'Unhealthy for sensitive groups', color: 'var(--pg-orange)', sev: 1,
      advice: 'People with asthma or lung problems: go easy on hard activity outside.' },
    { key: 'vu', max: 55, name: 'Very unhealthy', color: 'var(--danger)', sev: 2,
      advice: 'Avoid busy roads. People with heart or lung problems: stay indoors. Put off trips you don\'t need.' },
    { key: 'acute', max: 90, name: 'Acutely unhealthy', color: '#7E22CE', sev: 3,
      advice: 'Everyone: limit hard activity outside. People with heart or lung problems: stay indoors.' },
    { key: 'emergency', max: Infinity, name: 'Emergency', color: '#7F1D1D', sev: 3,
      advice: 'Stay indoors with windows and doors closed, unless it is very hot. Go out only for emergencies.' }
  ];
  BD.airLevel = pm => BD.AIR_LEVELS.find(l => pm <= l.max) || BD.AIR_LEVELS[BD.AIR_LEVELS.length - 1];

  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
  const usable = () => !!data && Date.now() - data.at < STALE;

  BD.air = {
    get live() { return usable(); },
    get updatedAt() { return data ? new Date(data.at) : null; },
    // Now: PM2.5 this hour, the 24-hour average (what the DENR categories use) and its level.
    now() {
      if (!usable()) return null;
      const H = data.hourly, nowKey = BD.dateKey(BD.now()) + 'T' + String(BD.now().getHours()).padStart(2, '0');
      let i = H.time.findIndex(t => t.slice(0, 13) === nowKey); if (i < 0) i = H.time.length - 1;
      const day = H.pm2_5.slice(Math.max(0, i - 23), i + 1).filter(v => v != null);
      if (!day.length) return null;
      const avg = day.reduce((a, b) => a + b, 0) / day.length;
      return { pm: H.pm2_5[i] != null ? H.pm2_5[i] : data.current.pm2_5, avg, pm10: data.current.pm10, level: BD.airLevel(avg) };
    },
    async refresh(force) {
      if (!navigator.onLine) return false;
      if (!force && data && Date.now() - data.at < MAX_AGE) return false;
      try {
        const r = await fetch(URL_, { cache: 'no-store' });
        if (!r.ok) return false;
        const j = await r.json();
        if (!j.hourly || !j.current) return false;
        data = { at: Date.now(), hourly: j.hourly, current: j.current };
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { }
        return true;
      } catch (e) { return false; }
    },
    // A threat-radar row when the air is worse than Fair.
    threat() {
      const a = this.now(); if (!a || a.level.sev === 0) return null;
      return { id: 'air', name: 'Polluted air', sev: a.level.sev, icon: 'wind', tab: 'hangin',
        line: a.level.name + ' · PM2.5 ' + Math.round(a.avg) + ' µg/m³', detail: a.level.advice };
    }
  };

  // Threat radar and Karon's top threat include the air.
  const baseThreats = BD.threats;
  BD.threats = function () { const list = baseThreats(), t = BD.air.threat(); if (t) list.push(t); return list; };

  // One alert a day when the air reaches Very unhealthy or worse (follows the Weather alerts switch).
  const baseTriggers = BD.checkTriggers;
  BD.checkTriggers = function () {
    baseTriggers();
    const a = BD.air.now(), s = BD.state;
    if (!a || a.level.sev < 2) return;
    const k = 'air:' + BD.todayKey() + ':' + a.level.key;
    if (s.sent[k]) return;
    s.sent[k] = 1;
    BD.notify({ kind: 'threat', icon: 'wind', title: 'Air quality: ' + a.level.name, body: a.level.advice, tab: 'hangin' });
    BD.save();
  };

  // Peligro card: level in words (never color alone), the 6-step DENR scale, advice and where the data comes from.
  BD.airCard = function () {
    const a = BD.air.now();
    const head = '<div class="card-head"><h3>' + I('wind', 18) + 'Air quality</h3>' +
      (a ? '<span class="tag sample">Estimate</span>' : '') + '</div>';
    if (!a) return '<div class="card air-card">' + head + '<p class="fine">' + I('wifioff', 13) + 'No air data yet. Connect to the internet once and it will show here, even offline after.</p></div>';
    const L = a.level, idx = BD.AIR_LEVELS.indexOf(L), pos = Math.min(100, a.avg / 110 * 100);
    const t = BD.air.updatedAt;
    return '<div class="card air-card">' + head +
      '<div class="air-main"><span class="air-dot" style="background:' + L.color + '" aria-hidden="true"></span>' +
      '<div class="air-txt"><b class="air-level">' + esc(L.name) + '</b>' +
      '<span class="air-sub"><span data-i18n-skip>PM2.5</span> <b class="num">' + Math.round(a.avg) + '</b> <span data-i18n-skip>µg/m³</span> · 24-hour average</span></div></div>' +
      '<div class="air-scale" aria-hidden="true">' +   // the level is already written out above
      BD.AIR_LEVELS.map((l, i) => '<i style="background:' + l.color + '"' + (i === idx ? ' class="on"' : '') + '></i>').join('') +
      '<b style="left:' + pos.toFixed(1) + '%"></b></div>' +
      '<p class="air-advice">' + I(L.sev ? 'alert' : 'check', 16) + '<span>' + esc(L.advice) + '</span></p>' +
      '<p class="fine">' + I('info', 13) + 'DENR air quality levels. Estimate from a forecast model, updated ' + BD.timeLabel(t) + '. Official readings: DENR-EMB Region XI.</p></div>';
  };

  // Today's PM2.5 hour by hour (0–23), from the cached data; null when there is none.
  BD.air.today = function () {
    if (!usable()) return null;
    const H = data.hourly, day = BD.todayKey(), out = [];
    H.time.forEach((t, i) => { if (t.slice(0, 10) === day && H.pm2_5[i] != null) out.push({ h: +t.slice(11, 13), pm: H.pm2_5[i] }); });
    return out.length ? out : null;
  };

  function hourChart() {
    const hrs = BD.air.today(); if (!hrs) return '';
    const max = Math.max(60, ...hrs.map(x => x.pm)), now = BD.now().getHours();
    const worst = hrs.reduce((a, b) => (b.pm > a.pm ? b : a));
    return '<div class="card"><div class="card-head"><h3>Today, hour by hour</h3><span class="fine">PM2.5</span></div>' +
      '<div class="air-bars" aria-hidden="true">' + hrs.map(x => '<i class="' + (x.h === now ? 'now' : '') + '" style="height:' + Math.max(6, x.pm / max * 100).toFixed(0) + '%;background:' + BD.airLevel(x.pm).color + '"></i>').join('') + '</div>' +
      '<div class="air-axis" aria-hidden="true"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>' +
      '<p class="air-advice">' + I('clock', 16) + '<span><span>Dirtiest air today: around ' + BD.hourLabel(worst.h) + '.</span> <b>' + esc(BD.airLevel(worst.pm).name) + '</b></span></p></div>';
  }

  // Practical steps (DOH / DENR advice in plain words).
  const TIPS = ['On bad air days, close windows and doors and stay indoors if you can.',
    'Outdoors on bad days, wear a well-fitting N95 or KN95 mask. Cloth masks do little against smoke and dust.',
    'Don\'t burn garbage or leaves. It is against the law (RA 9003) and it poisons the air for your neighbors.',
    'Walk or exercise away from busy roads, and early in the morning when the air is cleaner.',
    'Check on children, lolo and lola, and anyone with asthma or heart problems.'];

  function levelTable() {
    const a = BD.air.now(), cur = a && a.level;
    // Folds to save space: closed it shows the title and the level you are in now; the choice is remembered.
    const open = !!BD.state.airLevelsOpen;
    return '<div class="card fold"><h3 class="fold-h"><button data-action="airLevels" aria-expanded="' + open + '" aria-controls="air-levels">' +
      '<span class="st-txt"><span class="fold-title">DENR air quality levels</span>' +
      (a ? '<span class="st-peek air-peek"><i class="lv-dot" style="background:' + cur.color + '"></i><span>' + esc(cur.name) + '</span></span>' +
        '<span class="sum"><span data-i18n-skip>PM2.5</span> <b class="num">' + Math.round(a.avg) + '</b> <span data-i18n-skip>µg/m³</span> · {#}-hour average · now <b class="num">'.replace('{#}', '24') +
        Math.round(a.pm) + '</b></span>' : '<span class="sum">No air data yet</span>') + '</span>' +
      I('chevdown', 20, 'st-chev') + '</button></h3>' +
      (open ? '<div class="lv-table" id="air-levels"><p class="fine">PM2.5, µg/m³</p>' +
        BD.AIR_LEVELS.map((l, i) => '<div class="lv-row' + (l === cur ? ' cur' : '') + '"><i style="background:' + l.color + '"></i><div><b>' + esc(l.name) + ' <span class="num" data-i18n-skip>' +
          (i === 0 ? '0–25' : (BD.AIR_LEVELS[i - 1].max + 0.1) + (l.max === Infinity ? '+' : '–' + l.max)) + '</span></b><span>' + esc(l.advice) + '</span></div></div>').join('') + '</div>' : '') +
      '</div>';
  }
  Object.assign(BD.actions = BD.actions || {}, {
    airLevels() { BD.state.airLevelsOpen = !BD.state.airLevelsOpen; BD.save(); BD.render(); }
  });

  // The Air view of Peligro (the "Hangin · Air" button beside Init and Ulan).
  BD.airView = function () {
    return BD.airCard() + hourChart() +
      '<div class="card tips"><div class="card-head"><h3>' + I('shieldcheck', 18) + 'Protect yourself</h3></div><ul>' +
      TIPS.map(t => '<li>' + I('check', 15) + '<span>' + esc(t) + '</span></li>').join('') + '</ul></div>' + levelTable();
  };
})(window.BD);
