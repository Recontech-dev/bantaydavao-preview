/* Tab 2 – Peligro (Threats): season switch, heat index / rainfall warning, forecast, threat radar. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;
  const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Released app: the season follows PAGASA and the buttons cannot change it.
  function lockedNote() {
    return BD.state.season === 'heat' ? 'Follows PAGASA: El Niño is active, so the app is in Heat mode.' : 'Follows PAGASA: La Niña is active, so the app is in Rain mode.';
  }
  // Why the number is an estimate, and where to see PAGASA's own bulletin.
  function pagasaNote() {
    const p = BD.pagasa.today.state, link = '<a href="' + BD.PAGASA_PAGE + '" target="_blank" rel="noopener">PAGASA heat index</a>';
    if (p === 'suspended') return 'Estimate. PAGASA pauses its daily heat index in the rainy season and resumes on ' + BD.PAGASA_RESUMES + '. ' + link;
    if (p === 'unreadable') return 'Estimate. Today\'s PAGASA bulletin could not be read here. See the ' + link + '.';
    return 'Estimate from the forecast, using PAGASA heat index levels. ' + link;
  }
  // Where the forecast numbers come from: the live forecast (with its update time) or the embedded sample.
  function srcTag(live) {
    return live ? '<span class="tag real" title="Forecast data: Open-Meteo (CC BY 4.0)">Live · ' + BD.timeLabel(BD.weather.updatedAt) + '</span>' : '<span class="tag sample">Sample forecast</span>';
  }
  function seasonSwitch() {
    const s = BD.state.season, lock = BD.seasonLocked();
    // Locked: the other season is disabled; the active one still brings you back from the Hangin view.
    const b = k => '<button class="' + (s === k && BD.ui.peligroView !== 'air' ? 'on' : '') + (s === k ? ' cur' : '') + '" data-action="season" data-s="' + k + '"' + (lock && s !== k ? ' disabled' : '') + ' aria-pressed="' + (s === k && BD.ui.peligroView !== 'air') + '">' +
      // "Active" marks the city's season only in the season views; in the Hangin (air) view it would sit on an unselected button.
      I(BD.SEASONS[k].icon, 18) + BD.SEASONS[k].short + (s === k && BD.ui.peligroView !== 'air' ? '<span class="active-tag">Active</span>' : '') + '</button>';
    // Hangin · Air sits beside the two seasons; it is a view of Peligro, not a season.
    const air = BD.ui.peligroView === 'air', a = BD.air.now();
    // "Active" follows the selected button: the season in the season views, Hangin in the air view.
    const airBtn = '<button class="' + (air ? 'on' : '') + '" data-action="peligroAir" aria-pressed="' + air + '">' + I('wind', 18) + 'Hangin · Air' + (air ? '<span class="active-tag">Active</span>' : '') +
      (a && a.level.sev ? '<span class="air-flag" style="background:' + a.level.color + '" title="' + esc(a.level.name) + '"></span>' : '') + '</button>';
    return '<div class="season"><div class="seg seg3 seg-' + (air ? 'air' : s) + '">' + b('heat') + b('rain') + airBtn + '</div>' +
      '<p class="fine">' + I('info', 13) + (lock ? lockedNote() : 'For testing, you can switch the season here. In the released app it follows PAGASA on its own: Heat in El Niño, Rain in La Niña.') + '</p></div>';
  }

  function heatCard() {
    const c = BD.currentHeat(), lv = c.level, hi = Math.round(c.hi), now = BD.now();
    const pos = Math.max(0, Math.min(1, (c.hi - 20) / 40));
    return '<div class="hi-card lv-' + lv.key + '" style="--lv:' + lv.color + '">' +
      '<div class="hi-top"><span>' + I('pin', 14) + 'Davao City · outdoor heat index</span><span class="num">' + BD.timeLabel(now) + '</span></div>' +
      '<div class="hi-main"><div class="hi-num num">' + hi + '<sup>°C</sup></div>' +
      '<div class="hi-side"><span class="lv-pill">' + lv.name + '</span>' +
      '<span class="hi-src">' + (c.manual ? I('pin', 13) + 'Your own reading' : c.pagasa ? I('shieldcheck', 13) + 'PAGASA · Davao City today' : c.live ? I('rain', 13) + 'Estimate from live forecast' : I('info', 13) + 'Sample forecast') + '</span></div></div>' +
      '<div class="hi-meta"><span>' + I('thermometer', 16) + 'Air <b class="num">' + c.temp.toFixed(1) + '°C</b></span><span>' + I('droplet', 16) + 'Humidity <b class="num">' + Math.round(c.rh) + '%</b></span></div>' +
      '<div class="hi-scale"><i style="left:' + (pos * 100) + '%"></i></div>' +
      '<div class="hi-scale-l"><span>27</span><span>33</span><span>42</span><span>52</span></div>' +
      '<p class="hi-advice">' + I('alert', 16) + '<span>' + (lv.effect ? '<b>' + lv.effect + '</b> ' : '') + lv.advice + '</span></p>' +
      (c.pagasa || c.manual ? '' : '<p class="hi-note">' + I('info', 14) + '<span>' + pagasaNote() + '</span></p>') +
      '<div class="hi-own">' + (c.manual
        ? '<span>Using your reading of <b>' + hi + '°C</b>.</span><button class="btn btn-ghost-light sm" data-action="clearHI">' + I('refresh', 15) + 'Use forecast</button>'
        : '<label for="hiInput">Hotter where you are?</label><div class="hi-input"><input id="hiInput" type="number" inputmode="decimal" min="20" max="70" placeholder="°C" aria-label="Your heat index reading in °C"><button class="btn btn-ghost-light sm" data-action="setHI">Use mine</button></div>') +
      '</div></div>';
  }

  // Hour by hour: drag a finger across the bars (or use the arrow keys) to read the heat index at any hour.
  let chart = null, drag = null;
  function readout(x, now) {
    return '<span class="h-time">' + (x.hour === now ? 'Now · ' : '') + BD.hourLabel(x.hour) + '</span>' +
      '<b class="h-val num">' + Math.round(x.hi) + '°C</b><span class="h-lv" style="--lv:' + x.level.color + '">' + x.level.name + '</span>' +
      '<span class="h-adv">' + x.level.advice + '</span>';
  }
  function pick(wrap, i, buzz) {
    const c = chart;
    if (!c || !wrap) return;
    i = Math.max(0, Math.min(c.hrs.length - 1, i));
    if (i === c.sel && wrap.querySelector('.hbar.sel')) return;
    c.sel = i;
    wrap.querySelectorAll('.hbar').forEach((r, k) => r.classList.toggle('sel', k === i));
    const g = wrap.querySelector('.h-guide'), gx = c.L + i * c.bw + c.bw / 2 - 0.5;
    g.setAttribute('x1', gx); g.setAttribute('x2', gx);
    wrap.querySelector('.h-read').innerHTML = readout(c.hrs[i], c.now);
    wrap.setAttribute('aria-valuenow', c.hrs[i].hour);
    wrap.setAttribute('aria-valuetext', BD.tr(BD.hourLabel(c.hrs[i].hour)) + ', ' + Math.round(c.hrs[i].hi) + '°C, ' + BD.tr(c.hrs[i].level.name));
    if (buzz) BD.vibrate(6);
  }
  function indexAt(wrap, clientX) {
    const r = wrap.querySelector('svg').getBoundingClientRect();
    return Math.floor(((clientX - r.left) / r.width * chart.W - chart.L) / chart.bw);
  }
  document.addEventListener('pointerdown', e => {
    const w = e.target.closest && e.target.closest('.hchart-wrap');
    if (!w || !chart) return;
    drag = w; try { w.setPointerCapture(e.pointerId); } catch (x) { }
    pick(w, indexAt(w, e.clientX), true);
  });
  document.addEventListener('pointermove', e => { if (drag) pick(drag, indexAt(drag, e.clientX), true); });
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { drag = null; }));
  document.addEventListener('keydown', e => {
    const w = e.target.closest && e.target.closest('.hchart-wrap');
    if (!w || !chart) return;
    const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    if (k) { e.preventDefault(); pick(w, chart.sel + k); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); pick(w, e.key === 'Home' ? 0 : chart.hrs.length - 1); }
  });

  function hourlyChart() {
    const hrs = BD.hoursToday(), now = BD.now().getHours(), peak = BD.peakHeat(), win = BD.cautionWindow();
    const W = 340, H = 176, L = 26, B = 24, T = 26, bw = (W - L - 4) / hrs.length;
    const ni = Math.max(0, hrs.findIndex(x => x.hour === now)), sel = chart && chart.day === BD.todayKey() && chart.sel != null ? chart.sel : ni;
    chart = { hrs, now, W, L, bw, sel, day: BD.todayKey() };
    const y = v => H - B - (Math.max(20, Math.min(52, v)) - 20) / 32 * (H - B - T);
    let bars = '', labels = '';
    hrs.forEach((x, i) => {
      const bx = L + i * bw + 2.5, by = y(x.hi), isNow = x.hour === now, isPeak = x.hour === peak.hour;
      bars += '<rect class="hbar' + (isNow ? ' now' : '') + (i === sel ? ' sel' : '') + '" x="' + bx + '" y="' + by + '" width="' + (bw - 5) + '" height="' + (H - B - by) + '" rx="4" style="fill:' + x.level.color + ';animation-delay:' + i * 25 + 'ms"><title>' + BD.hourLabel(x.hour) + ': ' + Math.round(x.hi) + '°C</title></rect>';
      if (isNow) bars += '<rect class="now-ring" x="' + (bx - 2) + '" y="' + (by - 2) + '" width="' + (bw - 1) + '" height="' + (H - B - by + 2) + '" rx="5"/><text class="now-l" x="' + (bx + (bw - 5) / 2) + '" y="' + (by - 7) + '">Now</text>';
      else if (isPeak) bars += '<text class="peak-l" x="' + (bx + (bw - 5) / 2) + '" y="' + (by - 7) + '">' + Math.round(x.hi) + '°</text>';
      if (x.hour % 3 === 0) labels += '<text class="ax" x="' + (bx + (bw - 5) / 2) + '" y="' + (H - 7) + '">' + BD.shortHour(x.hour) + '</text>';
    });
    const grid = [27, 33, 42].map(v => '<line class="grid" x1="' + L + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ax ay" x="' + (L - 5) + '" y="' + (y(v) + 3) + '">' + v + '</text>').join('');
    const advice = win ? win.level.name + ' from ' + BD.hourLabel(win.from) + ' to ' + BD.hourLabel(win.to) + '.' : 'No dangerous heat expected today.';
    const gx = L + sel * bw + bw / 2 - 0.5, x = hrs[sel];
    return '<div class="card"><div class="card-head"><h3>Hour by hour</h3><span class="fine">Heat index, 6 AM–9 PM</span></div>' +
      '<div class="hchart-wrap" tabindex="0" role="slider" aria-label="Heat index by hour. Drag or use the arrow keys." aria-valuemin="' + hrs[0].hour + '" aria-valuemax="' + hrs[hrs.length - 1].hour + '" aria-valuenow="' + x.hour + '" aria-valuetext="' + BD.hourLabel(x.hour) + ', ' + Math.round(x.hi) + '°C, ' + x.level.name + '">' +
      '<div class="h-read" aria-hidden="true">' + readout(x, now) + '</div>' +
      '<svg class="hchart" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + grid + '<line class="h-guide" x1="' + gx + '" x2="' + gx + '" y1="' + T + '" y2="' + (H - B) + '"/>' + bars + labels + '</svg>' +
      '<p class="h-hint">' + I('swipe', 14) + 'Drag across the hours</p></div>' +
      '<p class="chart-note">' + I('clock', 16) + '<span><b>' + advice + '</b> Peak of ' + Math.round(peak.hi) + '°C around ' + BD.hourLabel(peak.hour) + '.</span></p></div>';
  }

  function weekStrip() {
    const f = BD.forecastDays('heat'), now = BD.now();
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const lv = BD.heatLevel(BD.hourly(14, i).hi), d = BD.addDays(now, i);
      cells += '<div class="fday' + (i === 0 ? ' today' : '') + '"><span class="fd-n">' + (i === 0 ? 'Today' : SHORT_DAYS[d.getDay()]) + '</span>' +
        '<b class="num">' + f.high[i] + '°</b><span class="fd-lo num">' + f.low[i] + '°</span>' +
        '<i class="dot" style="background:' + lv.color + '" title="' + lv.name + '"></i>' +
        '<span class="fd-r">' + I('droplet', 11) + f.rain[i] + '%</span></div>';
    }
    return '<div class="card"><div class="card-head"><h3>Next 7 days</h3>' + srcTag(f.live) + '</div><div class="fweek">' + cells + '</div>' +
      '<p class="fine">High and low air temperature, heat level at the 2 PM peak, and rain chance.</p></div>';
  }

  function levelTable() {
    const cur = BD.currentHeat().level.key;
    return '<div class="card"><div class="card-head"><h3>PAGASA heat index levels</h3></div><div class="lv-table">' +
      BD.HEAT_LEVELS.slice(1).map(l => '<div class="lv-row' + (l.key === cur ? ' cur' : '') + '"><i style="background:' + l.color + '"></i><div><b>' + l.name + ' <span class="num">' + l.range + '</span></b><span>' + l.effect + '</span></div>' + (l.key === cur ? '<span class="tag now">Now</span>' : '') + '</div>').join('') +
      '</div></div>';
  }

  function rainCard() {
    const r = BD.RAIN_LEVELS[BD.state.rainLevel];
    const btn = k => '<button class="rl-btn rl-' + k + (BD.state.rainLevel === k ? ' on' : '') + '" data-action="rainLevel" data-l="' + k + '">' + (k === 'none' ? 'None' : BD.RAIN_LEVELS[k].name) + '</button>';
    return '<div class="rain-card rl-' + r.key + '" style="--lv:' + r.color + '">' +
      '<div class="hi-top"><span>' + I('rain', 14) + 'PAGASA rainfall warning · Davao City</span><span class="num">' + BD.timeLabel(BD.now()) + '</span></div>' +
      '<div class="rain-main"><span class="rain-ic">' + I(r.key === 'none' ? 'shieldcheck' : 'alert', 34) + '</span><div><b>' + (r.key === 'none' ? 'No warning' : r.name + ' warning') + '</b><span class="lv-pill">' + r.tag + '</span></div></div>' +
      '<div class="hi-meta"><span>' + I('rain', 16) + '<b>' + r.mm + '</b></span></div>' +
      '<p class="hi-advice">' + I('info', 16) + '<span><b>' + r.meaning + '</b> ' + r.act + '</span></p>' +
      (BD.demo ? '<div class="demo-row"><span class="demo-tag">Demo</span>' : '<p class="rl-k">Set from the latest <a href="' + BD.PAGASA_RAIN + '" target="_blank" rel="noopener">PAGASA rainfall advisory</a></p><div class="demo-row">') +
      ['none', 'yellow', 'orange', 'red'].map(btn).join('') + '</div></div>';
  }

  function rainLegend() {
    return '<div class="card"><div class="card-head"><h3>PAGASA rainfall warnings</h3></div><div class="lv-table">' +
      ['yellow', 'orange', 'red'].map(k => { const l = BD.RAIN_LEVELS[k]; return '<div class="lv-row' + (BD.state.rainLevel === k ? ' cur' : '') + '"><i style="background:' + l.color + '"></i><div><b>' + l.name + ' · ' + l.tag + ' <span class="num">' + l.mm + '</span></b><span>' + l.meaning + '</span></div>' + (BD.state.rainLevel === k ? '<span class="tag now">Now</span>' : '') + '</div>'; }).join('') +
      '</div></div>';
  }

  function rainChart() {
    const f = BD.forecastDays('rain'), now = BD.now(), max = Math.max.apply(null, f.rain), wi = f.rain.indexOf(max);
    let bars = '';
    f.rain.forEach((v, i) => {
      const d = BD.addDays(now, i);
      bars += '<div class="rbar' + (i === wi ? ' wet' : '') + '">' + (i === wi ? '<span class="wet-l">Wettest</span>' : '') +
        '<span class="rb-v num">' + v + '%</span><div class="rb-track"><i style="height:' + v + '%;animation-delay:' + i * 50 + 'ms"></i></div>' +
        '<span class="rb-d">' + (i === 0 ? 'Today' : SHORT_DAYS[d.getDay()]) + '</span><span class="rb-t num">' + f.high[i] + '°</span></div>';
    });
    return '<div class="card"><div class="card-head"><h3>Rain chance · 7 days</h3>' + srcTag(f.live) + '</div><div class="rchart">' + bars + '</div>' +
      '<p class="chart-note">' + I('calendar', 16) + '<span><b>Wettest: ' + (wi === 0 ? 'today' : BD.DAYS[BD.addDays(now, wi).getDay()]) + ' (' + max + '%).</b> Plan errands for drier days.</span></p></div>';
  }

  // Verified context from docs/data/davao_city_data.json (via js/hazards.js), with its sources.
  function outlook() {
    const H = BD.HAZARDS;
    if (BD.state.season === 'heat') {
      const dr = H.outlook.drought;
      return '<div class="card outlook fold">' + foldHead('outlookFold', I('sun', 18) + 'Season outlook', esc(H.outlook.enso)) + (!BD.state.outlookOpen ? '</div>' :
        '<div id="fold-outlook"><p>' + esc(H.outlook.enso) + '.</p>' +
        '<p>Drought in ' + esc(dr.drought.join(' and ')) + ' this November; dry conditions in ' + esc(dr.dry_condition.join(', ')) + '.</p>' +
        '<p class="src">' + esc(H.outlook.source) + ' · ' + esc(dr.source) + '</p></div></div>');
    }
    const e = H.recent[0], m = e.date.split('-');
    const when = +m[2] + ' ' + BD.MONTHS[+m[1] - 1] + ' ' + m[0];
    return '<div class="card outlook fold">' + foldHead('outlookFold', I('waves', 18) + 'Last big flood', esc(when) + ' · ' + esc(e.rivers.join(' and '))) + (!BD.state.outlookOpen ? '</div>' :
      '<div id="fold-outlook"><p><b>' + when + '</b>: ' + esc(e.rivers.join(' and ')) + ' rivers overflowed (' + esc(e.cause) + '). ' +
      e.families_evacuated + ' families evacuated.</p>' +
      '<p>' + H.floodSites.flood_prone_sites_total + ' flood-prone sites are listed in the city. PAGASA monitors the ' + esc(H.rivers.join(', ')) + ' rivers. ' +
      '<a href="' + H.links.flood + '" target="_blank" rel="noopener">River flood status</a></p>' +
      '<p class="src">' + esc(e.source) + ' · ' + esc(H.floodSites.source) + '</p></div></div>');
  }
  // A card title row that opens and closes the card (closed: the title and a one-line summary).
  function foldHead(action, title, peek) {
    const open = !!BD.state[action.replace('Fold', 'Open')];
    return '<h3 class="fold-h"><button data-action="' + action + '" aria-expanded="' + open + '"><span class="st-txt"><span class="fold-title">' + title + '</span>' +
      (open ? '' : '<span class="st-peek fold-peek"><span>' + peek + '</span></span>') + '</span>' + I('chevdown', 20, 'st-chev') + '</button></h3>';
  }
  function radar() {
    const rows = BD.threats().map(t => '<button class="radar-row" data-action="go" data-tab="' + t.tab + '">' +
      '<span class="radar-ic sev-' + t.sev + '">' + I(t.icon, 20) + '</span>' +
      '<span class="q-body"><span class="q-title">' + esc(t.name) + '</span><span class="q-meta">' + esc(t.line) + '</span><span class="radar-detail">' + esc(t.detail) + '</span></span>' +
      '<span class="sev-tag sev-' + t.sev + '">' + BD.SEV[t.sev] + '</span></button>').join('');
    // Folds like the Mapa list: closed it shows how many threats and the top one with its level; the choice is remembered.
    const open = !!BD.state.radarOpen, list = BD.threats(), top = BD.topThreat(), active = list.filter(t => t.sev > 0).length;
    return '<div class="sec-head sec-toggle"><h2><button data-action="radarFold" aria-expanded="' + open + '" aria-controls="radar-list">' +
      '<span class="st-txt"><span class="st-title">Threat radar</span>' +
      '<span class="sum"><span class="radar-live"><i></i>Live</span> · ' + active + ' of ' + list.length + ' threats active</span>' +
      (!open ? '<span class="st-peek"><span class="radar-ic sev-' + top.sev + ' mini">' + I(top.icon, 14) + '</span><span>' + esc(top.name) + '</span><span class="sev-tag sev-' + top.sev + '">' + BD.SEV[top.sev] + '</span></span>' : '') +
      '</span>' + I('chevdown', 20, 'st-chev') + '</button></h2></div>' +
      (open ? '<div class="card radar" id="radar-list">' + rows + '</div>' : '');
  }

  BD.tabs = BD.tabs || {};
  BD.tabs.peligro = {
    render() {
      const heat = BD.state.season === 'heat';
      if (BD.ui.peligroView === 'air') return seasonSwitch() + BD.airView() + '<div class="spacer"></div>';
      return seasonSwitch() + (heat
        ? heatCard() + (BD.warnShareRow ? BD.warnShareRow() : '') + hourlyChart() + weekStrip() + outlook() + radar() + levelTable()
        : rainCard() + (BD.warnShareRow ? BD.warnShareRow() : '') + rainChart() + outlook() + radar() + rainLegend()) + '<div class="spacer"></div>';
    },
    enter() {
      // Opening Peligro completes the "check today's heat / rainfall warning" quest.
      const q = BD.quests()[0], t = BD.today();
      if (!BD.locked() && BD.unlocked(q) && !t.q[q.id]) {
        setTimeout(() => {
          BD.commit(() => { BD.today().q[q.id] = true; }, document.querySelector('.hi-card .hi-num, .rain-card .rain-ic'));
          BD.toast(I('check', 16) + 'Quest done: ' + q.title + ' +' + q.xp + ' XP');
        }, 450);
      }
    }
  };

  Object.assign(BD.actions = BD.actions || {}, {
    outlookFold() { BD.state.outlookOpen = !BD.state.outlookOpen; BD.save(); BD.render(); },
    radarFold() { BD.state.radarOpen = !BD.state.radarOpen; BD.save(); BD.render(); },
    peligroAir() { if (BD.ui.peligroView === 'air') return; BD.ui.peligroView = 'air'; BD.render({ enter: true }); },
    season(el) {
      const k = el.dataset.s, wasAir = BD.ui.peligroView === 'air';
      if (BD.seasonLocked() && k !== BD.state.season) return;
      BD.ui.peligroView = 'season';
      if (k === BD.state.season) { if (wasAir) BD.render({ enter: true }); return; }
      document.documentElement.dataset.season = k;
      BD.ui.symptoms = {};
      BD.commit(s => { s.season = k; s.mapFilter = 'all'; BD.today().season = k; }, BD.locked() ? 'guest-ok' : null);
      BD.notify({ kind: 'threat', icon: BD.SEASONS[k].icon, title: (k === 'heat' ? 'Heat mode is on' : 'Rain mode is on') + ' · ' + BD.SEASONS[k].sub, body: 'New quests, threats, map and first aid for the season. Ingat!', tab: 'karon' });
      BD.checkTriggers();
    },
    setHI() {
      const v = parseFloat((document.getElementById('hiInput') || {}).value);
      if (!(v >= 20 && v <= 70)) { BD.toast(I('info', 16) + 'Enter a heat index between 20 and 70°C.'); return; }
      BD.state.manualHI = v; BD.save(); BD.render(); BD.checkTriggers();
    },
    clearHI() { BD.state.manualHI = null; BD.save(); BD.render(); },
    rainLevel(el) { BD.state.rainLevel = el.dataset.l; BD.save(); BD.render(); BD.checkTriggers(); }
  });
})(window.BD);
