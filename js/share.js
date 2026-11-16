/* Sharing, no server needed:
   - "Share with family": what matters today (the forecast or warning and what to do) plus an invite to use
     BantayDavao, as a picture and a link (+15 XP for the sharer, once a day). Personal stats are not shared.
   - Opening a family link shows a check-in card (+20 XP for the viewer, once a day).
   - The Tabang photo check (taking, clearing up and sending the photo) lives in js/photocheck.js. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;
  const SHARE_XP = 15, FAMILY_XP = 20;

  function snapshot() {
    const t = BD.today(), L = BD.levelOf(BD.totalXP());
    // What the family should know: the top threats today and what to do (not the sharer's own quests or stats).
    const reminders = BD.threats().filter(x => x.sev >= 1).sort((x, y) => y.sev - x.sev).slice(0, 2).map(x => x.name + ': ' + x.detail);
    return { n: BD.state.name, l: L.level, r: L.rank, s: BD.streak(), q: BD.doneCount(t), g: t.glasses, d: BD.todayKey(), w: reminders.slice(0, 3), f: forecastLine() };
  }
  // Today's forecast in one line: the heat index peak and its risky hours, or the rain warning and rain chance.
  function forecastLine() {
    if (BD.state.season === 'heat') {
      const pk = BD.peakHeat(), win = BD.cautionWindow();
      return 'Up to ' + Math.round(pk.hi) + '°C heat index today · ' + pk.level.name + (win ? ' · ' + BD.hourLabel(win.from) + '–' + BD.hourLabel(win.to) : '');
    }
    const lv = BD.state.rainLevel, f = BD.forecastDays('rain');
    return (lv && lv !== 'none' ? BD.RAIN_LEVELS[lv].name + ' rainfall warning · ' : '') + f.rain[0] + '% chance of rain today';
  }
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
  function link(o, k) { if (!BD.demo) return BD.PLAY_URL; return location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html?' + (k || 'f') + '=' + enc(o); }
  function text(o) {
    return '🛡️ BantayDavao · Davao City today\n' + (o.f ? '🌤️ ' + o.f + '\n' : '') +
      (o.w.length ? '\n' + o.w.map(x => '• ' + x).join('\n') + '\n' : '') +
      '\nJoin me on BantayDavao, it\'s free. Let\'s look after each other.\n— ' + o.n + '\n' +
      (BD.demo ? 'Open to check in (+' + FAMILY_XP + ' XP): ' : 'Get BantayDavao free: ') + link(o);
  }

  // A 1080×1080 picture of today's forecast and reminders with an invite, drawn on a canvas (works offline).
  function image(o) {
    const c = document.createElement('canvas'); c.width = c.height = 1080;
    const x = trCtx(c.getContext('2d')), F = 'Inter, sans-serif', B = 'Inter, sans-serif';
    const g = x.createLinearGradient(0, 0, 1080, 1080); g.addColorStop(0, '#003823'); g.addColorStop(1, '#008039');
    x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);
    x.fillStyle = '#F97316'; x.font = '700 40px ' + B; x.fillText('BANTAYDAVAO · DAVAO CITY TODAY', 80, 130);
    // the forecast, big
    const f = BD.tr(o.f || ''), parts = f.split(' · ');
    x.fillStyle = '#fff'; x.font = '800 64px ' + F;
    wrap(x, parts[0], 920).slice(0, 2).forEach((l, i) => x.fillText(l, 80, 230 + i * 76));
    x.font = '700 40px ' + B; x.fillStyle = '#FDE68A';
    if (parts.length > 1) x.fillText(parts.slice(1).join(' · ').slice(0, 48), 80, 410);
    x.fillStyle = '#fff'; x.font = '700 40px ' + B; x.fillText('Reminders for the family', 80, 520);
    x.font = '400 36px ' + B;
    // Translate before shortening, or the shortened line can't be looked up.
    let ry = 588;
    o.w.forEach(r => {
      const ls = wrap(x, '• ' + BD.tr(r), 920);
      ls.slice(0, 2).forEach((l, i) => { if (ry < 840) x.fillText(i === 1 && ls.length > 2 ? l.replace(/\s*\S*$/, '…') : l, i ? 104 : 80, ry); ry += 46; });
      ry += 14;
    });
    // the invite
    x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.roundRect(80, 860, 920, 150, 28); x.fill();
    x.fillStyle = '#fff'; x.font = '800 44px ' + F; x.fillText('Join me on BantayDavao', 116, 925);
    x.font = '400 32px ' + B; x.globalAlpha = .9; x.fillText('Free on Google Play · ' + o.n.slice(0, 18), 116, 975); x.globalAlpha = 1;
    return new Promise(ok => c.toBlob(b => ok(new File([b], 'bantaydavao-' + o.d + '.png', { type: 'image/png' })), 'image/png'));
  }

  function award(field, xp, el) {
    const t = BD.today();
    if (t[field] || BD.locked()) return false;   // guests share without XP
    BD.commit(() => { BD.today()[field] = xp; }, el);
    return true;
  }

  BD.shareCard = function (compact) {
    const o = snapshot(), done = !!BD.today().xpShare;
    if (compact) return '<button class="card share-row" data-action="shareFamily"><span class="q-ic c-purple">' + I('users', 20) + '</span><span class="q-body"><span class="q-title">Share today with family</span>' +
      '<span class="q-meta">' + (done ? 'Shared today. Share again anytime.' : 'Forecast and invite · +' + SHARE_XP + ' XP') + '</span></span>' + I('share', 20) + '</button>';
    return '<div class="card share-card"><div class="sc-top"><span class="q-ic c-purple">' + I('users', 20) + '</span><div class="q-body"><span class="q-title">Share with family</span>' +
      '<span class="q-meta">Send today\'s forecast and reminders, and invite them to BantayDavao. ' + (done ? 'Shared today.' : '+' + SHARE_XP + ' XP once a day.') + '</span></div></div>' +
      (o.f ? '<p class="sc-fc">' + I(BD.state.season === 'heat' ? 'thermometer' : 'rain', 16) + '<span>' + esc(o.f) + '</span></p>' : '') +
      (o.w.length ? '<ul class="sc-rem">' + o.w.map(r => '<li>' + I('bell', 13) + esc(r) + '</li>').join('') + '</ul>' : '') +
      '<button class="btn btn-primary btn-block" data-action="shareFamily">' + I('share', 18) + 'Share with family</button></div>';
  };

  async function shareFamily(el) {
    const o = snapshot(), file = canShareFiles() ? await image(o).catch(() => null) : null;
    if (!(await send([file], text(o)))) return;
    if (!award('xpShare', SHARE_XP, el)) BD.toast(I('check', 16) + 'Shared. Salamat for looking after your family!');
  }

  // Someone opened a family link: show the check-in and give them XP once a day.
  BD.openFamilyLink = function () {
    const q = new URLSearchParams(location.search), p = q.get('f'), w = q.get('p');
    if (!p && !w) return;
    history.replaceState({ tab: 'karon' }, '', location.pathname);
    let o; try { o = dec(p || w); } catch (e) { return; }
    const first = !BD.today().xpFamily;
    if (first && !BD.locked()) { BD.today().xpFamily = FAMILY_XP; BD.save(); BD.render(); }
    if (w) {
      // A shared Peligro warning: open Peligro so they see the live numbers.
      BD.go('peligro');
      const head = o.h ? 'Heat index ' + o.h.hi + '°C · ' + heatLv(o.h.lv).name + '. Peak ' + o.h.pk[0] + '°C around ' + BD.hourLabel(o.h.pk[1]) + '.'
        : 'PAGASA rainfall warning: ' + (o.r.lv === 'none' ? 'none' : BD.RAIN_LEVELS[o.r.lv].name + ' · ' + BD.RAIN_LEVELS[o.r.lv].tag) + '.';
      const top = (o.th || []).filter(t => t[1] >= 2).map(t => t[0] + ' (' + BD.SEV[t[1]] + ')');
      BD.celebrate({ icon: 'alert', kicker: 'Warning from ' + o.n + ' · ' + (o.d === BD.todayKey() ? o.t : o.d),
        title: 'Peligro in Davao City', body: head + (top.length ? ' Watch out for: ' + top.join(', ') + '.' : '') + ' Below are the live numbers.' +
          (first ? ' You earned +' + FAMILY_XP + ' XP for checking.' : ''),
        cta: first ? 'Ingat! +' + FAMILY_XP + ' XP' : 'Ingat!' });
      return;
    }
    BD.celebrate({ icon: 'users', kicker: 'Family check-in · ' + (o.d === BD.todayKey() ? 'today' : o.d),
      title: o.n + ' · Level ' + o.l + ' bantay',
      body: '🔥 ' + o.s + '-day streak · ' + o.q + '/8 quests · ' + o.g + '/8 glasses.' + (o.w && o.w.length ? ' Reminders: ' + o.w.join(' · ') : '') +
        (first ? ' You earned +' + FAMILY_XP + ' XP for checking in.' : ''),
      cta: first ? 'Ingat! +' + FAMILY_XP + ' XP' : 'Ingat!' });
  };

  /* ---------- shared helpers ---------- */
  const F = 'Inter, sans-serif', B = 'Inter, sans-serif';
  // Data colors are CSS variables; a canvas needs the real value.
  function col(c) {
    const m = /var\((--[\w-]+)\)/.exec(c || '');
    return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#94A3B8' : c;
  }
  // Dark text on the light warning colors (yellow, gray), white on the rest.
  const inkOn = c => /^#?(EAB308|94A3B8)$/i.test(col(c).replace('#', '')) ? '#0B2A1C' : '#fff';
  function wrap(x, s, w) {
    s = BD.tr(s);
    const out = []; let line = '';
    String(s).split(' ').forEach(word => {
      const t = line ? line + ' ' + word : word;
      if (x.measureText(t).width > w && line) { out.push(line); line = word; } else line = t;
    });
    if (line) out.push(line);
    return out;
  }
  function canvas(h) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = h;
    const x = trCtx(c.getContext('2d')), g = x.createLinearGradient(0, 0, 1080, h);
    g.addColorStop(0, '#002A1A'); g.addColorStop(1, '#00552F');
    x.fillStyle = g; x.fillRect(0, 0, 1080, h); x.textBaseline = 'alphabetic';
    return { c, x };
  }
  const toFile = (c, name) => new Promise(ok => c.toBlob(b => ok(new File([b], name, { type: 'image/png' })), 'image/png'));
  function copyText(s) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(s);
    const t = document.createElement('textarea'); t.value = s; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { }
    t.remove(); return Promise.resolve();
  }
  // Share files + text through the phone's own apps; on desktop, copy the text instead. Resolves true when sent or copied.
  // Share images speak the app's language too.
  function trCtx(x) { x.fillText = (t, ...a) => CanvasRenderingContext2D.prototype.fillText.call(x, BD.tr(t), ...a); return x; }
  async function send(files, msg) {
    msg = BD.tr(msg);
    try {
      return await BD.shareOut(files, msg);
    } catch (e) {
      if (e && e.message === 'share-unavailable') {
        await copyText(msg);
        BD.toast(I('copy', 16) + 'Message copied. Paste it in your family chat.');
        return true;
      }
      BD.toast(I('alert', 16) + 'Could not share. Try again.');
      return false;
    }
  }
  const canShareFiles = () => BD.native || !!navigator.share;
  const dayName = i => i === 0 ? 'Today' : BD.DAYS[BD.addDays(BD.now(), i).getDay()].slice(0, 3);

  /* ---------- Peligro: share today's warning ---------- */
  const WARN_XP = 10;
  function warnSnap() {
    const now = BD.now(), heat = BD.state.season === 'heat';
    const o = { n: BD.state.name, d: BD.todayKey(), t: BD.DAYS[now.getDay()].slice(0, 3) + ' ' + BD.timeLabel(now), s: BD.state.season,
      th: BD.threats().map(t => [t.name, t.sev, t.line]) };
    if (heat) {
      const c = BD.currentHeat(), pk = BD.peakHeat(), w = BD.cautionWindow(), f = BD.forecastDays('heat');
      o.h = { hi: Math.round(c.hi), lv: c.level.key, temp: c.temp.toFixed(1), rh: Math.round(c.rh), m: !!c.manual, pk: [Math.round(pk.hi), pk.hour],
        w: w ? [w.from, w.to, w.level.name] : null, hrs: BD.hoursToday().map(x => [x.hour, Math.round(x.hi)]),
        wk: [0, 1, 2, 3, 4, 5, 6].map(i => [f.high[i], f.low[i], BD.heatLevel(BD.hourly(14, i).hi).key, f.rain[i]]) };
    } else {
      const f = BD.forecastDays('rain'), max = Math.max.apply(null, f.rain);
      o.r = { lv: BD.state.rainLevel, wk: f.rain.slice(0, 7), hi: f.high.slice(0, 7), wet: f.rain.indexOf(max) };
    }
    return o;
  }
  const heatLv = k => BD.HEAT_LEVELS.find(l => l.key === k) || BD.HEAT_LEVELS[0];
  function warnText(o) {
    let s = '⚠️ BantayDavao · Peligro today\nDavao City · ' + o.t + '\n\n';
    if (o.h) {
      const lv = heatLv(o.h.lv);
      s += '🌡️ Heat index now: ' + o.h.hi + '°C · ' + lv.name + (o.h.m ? ' (own reading)' : '') + '\n' +
        'Air ' + o.h.temp + '°C · Humidity ' + o.h.rh + '%\n' +
        '📈 Peak ' + o.h.pk[0] + '°C around ' + BD.hourLabel(o.h.pk[1]) + '.' + (o.h.w ? ' ' + o.h.w[2] + ' from ' + BD.hourLabel(o.h.w[0]) + ' to ' + BD.hourLabel(o.h.w[1]) + '.' : '') + '\n' +
        '👉 ' + lv.advice + '\n';
    } else {
      const r = BD.RAIN_LEVELS[o.r.lv];
      s += '🌧️ PAGASA rainfall warning: ' + (r.key === 'none' ? 'None' : r.name + ' · ' + r.tag) + ' (' + r.mm + ')\n' +
        r.meaning + '\n👉 ' + r.act + '\n' +
        '📅 Wettest: ' + dayName(o.r.wet) + ' (' + o.r.wk[o.r.wet] + '% rain chance)\n';
    }
    s += '\nThreats:\n' + o.th.map(t => '• ' + t[0] + ': ' + BD.SEV[t[1]] + ' · ' + t[2]).join('\n') + '\n';
    const lite = { n: o.n, d: o.d, t: o.t, s: o.s, th: o.th.map(t => [t[0], t[1]]) };
    if (o.h) lite.h = { hi: o.h.hi, lv: o.h.lv, pk: o.h.pk }; else lite.r = { lv: o.r.lv };
    return s + (BD.demo ? '\nOpen BantayDavao for live updates (+' + FAMILY_XP + ' XP): ' : '\nLive updates in BantayDavao, free: ') + link(lite, 'p');
  }
  const SEV_C = ['#22C55E', '#EAB308', '#F97316', '#DC2626'];
  function warnImage(o) {
    const { c, x } = canvas(1350);
    x.fillStyle = '#F97316'; x.font = '700 38px ' + B; x.fillText('BANTAYDAVAO · PELIGRO TODAY', 80, 110);
    x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '400 36px ' + B; x.fillText('Davao City · ' + o.t, 80, 162);
    let y;
    if (o.h) {
      const lv = heatLv(o.h.lv), bg = col(lv.color), ink = inkOn(lv.color);
      x.fillStyle = bg; x.beginPath(); x.roundRect(80, 200, 920, 330, 36); x.fill();
      x.fillStyle = ink; x.font = '700 34px ' + B; x.fillText('Heat index now' + (o.h.m ? ' · own reading' : ''), 120, 260);
      x.font = '800 170px ' + F; x.fillText(o.h.hi + '°C', 112, 430);
      x.font = '800 54px ' + F; x.textAlign = 'right'; x.fillText(lv.name, 960, 330);
      x.font = '400 34px ' + B; x.fillText('Air ' + o.h.temp + '°C', 960, 395); x.fillText('Humidity ' + o.h.rh + '%', 960, 440); x.textAlign = 'left';
      x.font = '400 32px ' + B; x.fillText(wrap(x, lv.advice, 840)[0], 120, 500);
      // Hour-by-hour bars
      x.fillStyle = '#fff'; x.font = '700 40px ' + B; x.fillText('Hour by hour', 80, 610);
      const top = 650, base = 900, bw = 920 / o.h.hrs.length, yv = v => base - (Math.max(20, Math.min(52, v)) - 20) / 32 * (base - top);
      o.h.hrs.forEach((h, i) => {
        const bx = 80 + i * bw + 5, by = yv(h[1]);
        x.fillStyle = col(BD.heatLevel(h[1]).color); x.beginPath(); x.roundRect(bx, by, bw - 10, base - by, 8); x.fill();
        x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '400 26px ' + B; x.textAlign = 'center';
        if (h[0] % 3 === 0) x.fillText(BD.shortHour(h[0]), bx + (bw - 10) / 2, base + 38);
        if (h[0] === o.h.pk[1]) { x.fillStyle = '#fff'; x.font = '700 30px ' + B; x.fillText(h[1] + '°', bx + (bw - 10) / 2, by - 12); }
        x.textAlign = 'left';
      });
      x.fillStyle = '#fff'; x.font = '400 32px ' + B;
      x.fillText(BD.tr('Peak ' + o.h.pk[0] + '°C around ' + BD.hourLabel(o.h.pk[1])) + (o.h.w ? ' · ' + BD.tr(o.h.w[2]) + ' ' + BD.shortHour(o.h.w[0]) + '–' + BD.shortHour(o.h.w[1]) : ''), 80, 990);
      y = 1060;
    } else {
      const r = BD.RAIN_LEVELS[o.r.lv], ink = inkOn(r.color);
      x.fillStyle = col(r.color); x.beginPath(); x.roundRect(80, 200, 920, 330, 36); x.fill();
      x.fillStyle = ink; x.font = '700 34px ' + B; x.fillText('PAGASA rainfall warning', 120, 260);
      x.font = '800 120px ' + F; x.fillText(r.key === 'none' ? 'None' : r.name, 112, 390);
      x.font = '800 48px ' + F; x.textAlign = 'right'; x.fillText(r.tag, 960, 330); x.font = '400 34px ' + B; x.fillText(r.mm, 960, 385); x.textAlign = 'left';
      x.font = '400 32px ' + B; wrap(x, r.act, 840).slice(0, 2).forEach((l, i) => x.fillText(l, 120, 455 + i * 42));
      x.fillStyle = '#fff'; x.font = '700 40px ' + B; x.fillText('Rain chance · 7 days', 80, 610);
      const top = 670, base = 900, bw = 920 / 7;
      o.r.wk.forEach((v, i) => {
        const bx = 80 + i * bw + 14, by = base - v / 100 * (base - top);
        x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.roundRect(bx, top, bw - 28, base - top, 12); x.fill();
        x.fillStyle = i === o.r.wet ? '#B9F2CC' : '#3DBE75'; x.beginPath(); x.roundRect(bx, by, bw - 28, base - by, 12); x.fill();
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '700 30px ' + B; x.fillText(v + '%', bx + (bw - 28) / 2, top - 14);
        x.font = '400 28px ' + B; x.fillText(dayName(i), bx + (bw - 28) / 2, base + 40); x.textAlign = 'left';
      });
      x.fillStyle = '#fff'; x.font = '400 32px ' + B; x.fillText('Wettest: ' + dayName(o.r.wet) + ' (' + o.r.wk[o.r.wet] + '%). Plan errands for drier days.', 80, 990);
      y = 1060;
    }
    x.font = '700 36px ' + B; x.fillText('Threats', 80, y);
    o.th.slice(0, 4).forEach((t, i) => {
      const ty = y + 56 + i * 52;
      x.fillStyle = SEV_C[t[1]]; x.beginPath(); x.arc(96, ty - 11, 13, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.font = '700 32px ' + B; x.fillText(t[0], 126, ty);
      x.font = '400 32px ' + B; x.globalAlpha = .8; x.textAlign = 'right'; x.fillText(BD.SEV[t[1]], 1000, ty); x.textAlign = 'left'; x.globalAlpha = 1;
    });
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '400 26px ' + B; x.fillText('Ingat! · Shared by ' + o.n.slice(0, 20) + ' · PAGASA levels · sample forecast', 80, 1320);
    return toFile(c, 'bantaydavao-peligro-' + o.d + '.png');
  }
  BD.warnShareRow = function () {
    const done = !!BD.today().xpWarn;
    return '<button class="card share-row" data-action="shareWarn"><span class="q-ic c-sun">' + I('share', 20) + '</span><span class="q-body"><span class="q-title">Share today\'s warning</span>' +
      '<span class="q-meta">' + (done ? 'Shared today. Send it to more people anytime.' : 'Picture and summary' + (BD.locked() ? '' : ' · +' + WARN_XP + ' XP')) + '</span></span>' + I('chevron', 20) + '</button>';
  };
  async function shareWarn(el) {
    const o = warnSnap(), file = canShareFiles() ? await warnImage(o).catch(() => null) : null;
    if (!(await send([file], warnText(o)))) return;
    if (!award('xpWarn', WARN_XP, el)) BD.toast(I('check', 16) + 'Warning shared. Salamat, bantay!');
  }

  /* ---------- Tabang: share the first aid result ---------- */
  function aidSnap() {
    const fa = BD.FIRST_AID[BD.state.season], sel = BD.ui.symptoms || {};
    return { fa, danger: fa.danger.filter(x => sel[x.id]), mild: fa.mild.filter(x => sel[x.id]) };
  }
  function aidText(a) {
    let s = (a.danger.length ? '🚨 ' : '🩹 ') + 'BantayDavao · First aid: ' + a.fa.title + '\nFrom ' + BD.state.name + ', ' + BD.timeLabel(BD.now()) + '\n\n';
    if (a.danger.length) s += 'DANGER SIGNS: ' + a.danger.map(x => x.label).join(', ') + '\n' + a.fa.dangerText + '\n📞 Call 911 now (free, 24/7).\n';
    if (a.mild.length) s += (a.danger.length ? '\nAlso: ' : 'Mild signs: ') + a.mild.map(x => x.label).join(', ') + '\n' + a.mild.map(x => '• ' + x.label + ': ' + x.tip).join('\n') + '\n';
    s += '\nDOH first aid steps:\n' + a.fa.steps.map((x, i) => (i + 1) + '. ' + x).join('\n');
    if (!a.danger.length) s += '\n\nIf signs get worse or don\'t improve in 30 minutes, call 911.';
    return s;
  }
  function aidImage(a) {
    const { c, x } = canvas(1350), d = a.danger.length > 0;
    x.fillStyle = d ? '#F87171' : '#4ADE80'; x.font = '700 38px ' + B; x.fillText('BANTAYDAVAO · FIRST AID', 80, 110);
    x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '400 36px ' + B; x.fillText(a.fa.title + ' · ' + BD.state.name.slice(0, 18) + ', ' + BD.timeLabel(BD.now()), 80, 162);
    let y = d ? 200 : 250;
    if (d) {
      x.font = '400 34px ' + B;
      const body = wrap(x, a.fa.dangerText, 840), sig = wrap(x, 'Signs: ' + a.danger.map(s => s.label).join(', '), 840), h = 190 + (body.length + sig.length) * 44;
      x.fillStyle = '#DC2626'; x.beginPath(); x.roundRect(80, y, 920, h, 36); x.fill();
      x.fillStyle = '#fff'; x.font = '800 84px ' + F; x.fillText('Call 911 now', 120, y + 110);
      x.font = '400 34px ' + B; body.concat(sig).forEach((l, i) => x.fillText(l, 120, y + 170 + i * 44));
      y += h + 60;
    }
    if (a.mild.length) {
      x.fillStyle = '#fff'; x.font = '700 40px ' + B; x.fillText(d ? 'Also' : 'What to do', 80, y); y += 56;
      a.mild.forEach(m => {
        if (y > 1150) return;
        x.font = '700 34px ' + B; x.fillText(m.label, 80, y);
        x.font = '400 32px ' + B; x.globalAlpha = .85; wrap(x, m.tip, 920).forEach(l => { y += 42; x.fillText(l, 80, y); }); x.globalAlpha = 1; y += 58;
      });
    }
    if (y < 1100) {
      x.fillStyle = '#fff'; x.font = '700 40px ' + B; x.fillText('DOH first aid steps', 80, y); y += 54;
      x.font = '400 32px ' + B;
      a.fa.steps.forEach((s, i) => { wrap(x, (i + 1) + '. ' + s, 920).forEach(l => { if (y < 1240) x.fillText(l, 80, y); y += 42; }); y += 6; });
    }
    x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '400 28px ' + B; x.fillText(d ? 'Emergency: 911 · free, 24/7' : 'If signs get worse or don\'t improve in 30 minutes, call 911.', 80, 1310);
    return toFile(c, 'bantaydavao-first-aid.png');
  }
  BD.aidShareBtn = function (danger) {
    const p = BD.ui.photoCheck && !BD.ui.photoCheck.busy ? ' + photo' : '';
    return '<button class="btn ' + (danger ? 'btn-ghost-light' : 'btn-soft') + ' btn-block aid-share" data-action="shareAid">' + I('share', 18) + 'Share this result' + p + '</button>';
  };
  async function shareAid() {
    const a = aidSnap(); if (!a.danger.length && !a.mild.length) return;
    const file = canShareFiles() ? await aidImage(a).catch(() => null) : null, p = BD.ui.photoCheck;
    if (await send([file, p && !p.busy && (p.view === 'orig' ? p.file : p.clearFile)], aidText(a)) && canShareFiles()) BD.toast(I('check', 16) + 'Result shared.');
  }

  Object.assign(BD.actions = BD.actions || {}, {
    shareFamily(el) { shareFamily(el); },
    shareWarn(el) { shareWarn(el); },
    shareAid() { shareAid(); }
  });
})(window.BD);
