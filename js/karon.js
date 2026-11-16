/* Tab 1 – Karon (Home): greeting, top threat, today at a glance, weekly tracker.
   Tab 2 – Quests: active quest, water tracker, today's quests, go-out checklist. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;

  function greeting(h) { return h < 12 ? 'Maayong buntag' : h < 18 ? 'Maayong hapon' : 'Maayong gabii'; }

  function hero() {
    const now = BD.now(), xp = BD.totalXP(), L = BD.levelOf(xp), st = BD.streak();
    // Photo banner: day photo in light mode, night photo in dark mode ("Device" follows the phone). Credits stay visible.
    const t = BD.state.theme, dark = t === 'dark' || (t !== 'light' && !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches));
    return '<section class="hero card hero-photo ' + (dark ? 'hero-night' : 'hero-day') + '">' +
      '<span class="hero-credit">' + (dark ? 'Photo: Patrickroque01 / CC BY-SA 4.0' : 'Photo: shankar s. / CC BY 2.0') + '</span>' +
      '<div class="hero-ring">' + BD.ring('lv', L.pct, 88, 9, 'ring-xp') +
      '<div class="hero-lv"><small>LEVEL</small><b>' + L.level + '</b></div></div>' +
      '<div class="hero-txt">' +
      '<div class="greet">' + greeting(now.getHours()) + ', ' + esc(BD.state.name) + '!</div>' +
      '<div class="date">' + BD.DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + BD.MONTHS[now.getMonth()] + '</div>' +
      '<div class="hero-chips"><span class="rank-chip">' + I('shield', 14) + esc(L.rank) + '</span>' +
      '<span class="streak-chip' + (st ? ' hot' : '') + '">' + I('flame', 14) + '<span><b class="num">' + st + '</b>-day streak</span></span></div>' +
      '<div class="xp-line"><b class="num">' + xp.toLocaleString() + ' XP</b>' + (L.max ? ' · Max level' : ' · ' + L.toNext + ' to Level ' + (L.level + 1)) + '</div>' +
      '</div></section>';
  }

  // Karon shows a slim "Today's top threat" bar; the full threat and "Are you safe?" open as a pop-up.
  // Photo banners for Karon's top threat (Leptospirosis, Dengue and Landslide keep the gradient style).
  const THREAT_PHOTOS = {
    dehydration: { cls: 'tb-water', credit: 'Photo: theowl84 / CC BY 2.0' }, stroke: { cls: 'tb-heat', credit: 'Photo: Horia Varlan / CC BY 2.0' },
    water: { cls: 'tb-tap', credit: 'Photo: otherpaths / CC BY-SA 2.0' }, flood: { cls: 'tb-flood', credit: 'Photo: Jeff Pioquinto, SJ / CC BY 2.0' },
    air: { cls: 'tb-air', credit: 'Photo: snigl3t / CC BY 2.0' }
  };
  function threatBar() {
    const t = BD.topThreat(), ev = BD.safetyEvent && BD.safetyEvent(), ask = BD.familyAsk && BD.familyAsk();
    const check = ev || (ask && !ask.byMe && !ask.mineDone);
    // A small banner, in the style of the greeting panel: severity-tinted gradient, a big faded icon, the threat and one line about it.
    // Photos (img/threat-*.jpg) are openly licensed; authors and licences are in THIRD_PARTY_NOTICES.md.
    // Threats with a photo show it under a veil in the threat's severity color (instead of the faded icon); credits stay visible.
    const p = THREAT_PHOTOS[t.id], photo = p ? ' tb-photo ' + p.cls : '';
    return '<button class="threat-bar sev-' + t.sev + (t.sev >= 2 ? ' pulse' : '') + photo + '" data-action="openAlert" aria-haspopup="dialog">' +
      (photo ? (p.credit ? '<span class="tb-credit">' + esc(p.credit) + '</span>' : '') : '<span class="tb-art" aria-hidden="true">' + I(t.icon, 48) + '</span>') +
      '<span class="threat-ic">' + I(t.icon, 20) + '</span>' +
      '<span class="tb-txt"><span class="tb-top"><span class="threat-kicker">Today\'s top threat</span>' + (check ? '<span class="tb-ask">Are you safe?</span>' : '') + '</span>' +
      '<b>' + BD.SEV[t.sev] + ' · ' + esc(t.name) + '</b>' + (t.line ? '<span class="tb-line">' + esc(t.line) + '</span>' : '') + '</span>' +
      '<span class="tb-go">' + I('chevron', 18) + '</span></button>';
  }
  // Open by itself when it matters: an Extreme threat, an Orange/Red rain warning or Danger heat, or a family
  // check-in request. Once per day for each of these (and again if it gets worse), never over another pop-up.
  function alertKey() {
    const t = BD.topThreat(), ev = BD.safetyEvent && BD.safetyEvent(), ask = BD.familyAsk && BD.familyAsk();
    const asked = ask && !ask.byMe && !ask.mineDone ? ask.at : '';
    if (t.sev < 3 && !ev && !asked) return null;
    return BD.todayKey() + ':' + t.sev + ':' + (ev ? ev.id : '') + ':' + asked;
  }
  BD.maybeAlert = function () {
    const k = alertKey(), m = document.getElementById('modal');
    if (BD.locked()) return;   // Karon is behind the sign-in screen
    if (window.BD_TEST && BD_TEST.noAutoAlert) return;   // test scripts that click around Karon turn this off
    if (!k || BD.ui.tab !== 'karon' || BD.ui.center || m.classList.contains('open') || BD.state.sent['alert:' + k]) return;
    BD.state.sent['alert:' + k] = 1; BD.save();
    const t = BD.topThreat(), ev = BD.safetyEvent && BD.safetyEvent();
    BD.notify({ kind: 'threat', icon: t.icon, title: 'Today\'s top threat: ' + BD.SEV[t.sev] + ' · ' + t.name,
      body: (ev ? 'Are you safe? Let your family know. ' : '') + t.line, tab: 'karon', alert: true }, { silent: true, force: true });
    BD.actions.openAlert();
  };
  function alertPop() {
    const t = BD.topThreat();
    return '<div class="modal-back" data-action="closeAlert"></div>' +
      '<div class="pop alert-pop" role="alertdialog" aria-modal="true" aria-labelledby="alertTitle">' +
      '<div class="pop-head"><span class="threat-kicker">Today\'s top threat</span>' +
      '<button class="icon-btn pop-x" data-action="closeAlert" aria-label="Close">' + I('x', 20) + '</button></div>' +
      '<div class="threat sev-' + t.sev + (t.sev >= 2 ? ' pulse' : '') + '">' +
      '<span class="threat-ic">' + I(t.icon, 22) + '</span>' +
      '<span class="threat-txt"><b id="alertTitle">' + BD.SEV[t.sev] + ' · ' + esc(t.name) + '</b><span>' + esc(t.line) + '</span></span></div>' +
      (BD.safetyCard ? BD.safetyCard('pop') : '') +
      (BD.askFamilyRow ? BD.askFamilyRow() : '') +
      '<button class="btn btn-soft btn-block" data-action="alertMore" data-tab="' + (t.tab || 'peligro') + '">' + I('alert', 18) + 'See what to do</button></div>';
  }

  function threatCard() {
    const t = BD.topThreat();
    return '<button class="threat sev-' + t.sev + (t.sev >= 2 ? ' pulse' : '') + '" data-action="go" data-tab="peligro">' +
      '<span class="threat-ic">' + I(t.icon, 22) + '</span>' +
      '<span class="threat-txt"><span class="threat-top"><span class="threat-kicker">Today\'s top threat</span>' +
      '<span class="sev-meter" aria-hidden="true">' + [0, 1, 2, 3].map(i => '<i' + (i <= t.sev ? ' class="on"' : '') + '></i>').join('') + '</span></span>' +
      '<b>' + BD.SEV[t.sev] + ' · ' + esc(t.name) + '</b><span>' + esc(t.line) + '</span></span>' +
      I('chevron', 20, 'threat-go') + '</button>';
  }

  function week() {
    const s = BD.state, now = BD.now(), keys = BD.weekKeys(now), today = BD.todayKey();
    const sel = BD.ui.selDay && keys.indexOf(BD.ui.selDay) >= 0 ? BD.ui.selDay : today;
    let strip = '', q = 0, g = 0, xp = 0;
    keys.forEach((k, i) => {
      const d = s.days[k], n = BD.doneCount(d), full = n >= 6, future = k > today;
      q += n; g += d ? d.glasses : 0; xp += BD.dayXP(d);
      const dt = new Date(k + 'T12:00:00');
      strip += '<button class="wd' + (k === today ? ' today' : '') + (k === sel ? ' picked' : '') + (future ? ' future' : '') + (full ? ' full' : '') + '" data-action="selDay" data-key="' + k + '" aria-label="' + BD.DAYS[dt.getDay()] + '">' +
        '<span class="wd-name" data-i18n-skip>' + BD.weekLetters()[i] + '</span>' +
        '<span class="wd-ring">' + BD.ring('wd' + i, n / 8, 36, 4, full ? 'ring-ok' : 'ring-day') +
        '<span class="wd-in">' + (full ? I('check', 14) : (future ? '' : n)) + '</span></span>' +
        '<span class="wd-num">' + dt.getDate() + '</span></button>';
    });
    const fullDays = BD.weekFullDays(keys), bonus = fullDays >= 5;
    if (bonus) xp += 150;

    // Selected day detail
    const d = s.days[sel], sdt = new Date(sel + 'T12:00:00');
    let detail;
    if (sel > today) detail = '<div class="dd-empty">' + I('calendar', 16) + ' ' + BD.DAYS[sdt.getDay()] + ' has not started yet. See you then!</div>';
    else if (!d || (!BD.doneCount(d) && !d.glasses)) detail = '<div class="dd-empty">' + I('info', 16) + ' No quests logged on this day.</div>';
    else {
      const qs = BD.quests(d.season).filter(x => d.q[x.id]);
      detail = '<div class="dd-head"><b>' + (sel === today ? 'Today' : BD.DAYS[sdt.getDay()]) + '</b>' + (d.sample ? '<span class="tag sample">Sample</span>' : '') + '</div>' +
        '<div class="dd-stats"><span>' + I('notepad', 15) + '<b>' + BD.doneCount(d) + '</b>/8 quests</span><span>' + I('droplet', 15) + '<b>' + d.glasses + '</b> glasses</span><span>' + I('sparkle', 15) + '<b>+' + BD.dayXP(d) + '</b> XP</span></div>' +
        '<div class="dd-quests">' + (d.glasses >= 8 ? '<span class="mini-q c-teal" title="8 glasses">' + I('droplet', 14) + '</span>' : '') +
        qs.map(x => '<span class="mini-q c-' + x.color + '" title="' + esc(x.title) + '">' + I(x.icon, 14) + '</span>').join('') + '</div>';
    }

    const ch = BD.season().challenge;
    return '<div class="sec-head"><h2>This week</h2>' +
      (s.sampleWeek ? '<span class="tag sample">Sample data</span><button class="link-btn" data-action="startFresh">' + I('refresh', 14) + 'Start fresh</button>' : '') + '</div>' +
      '<div class="card week">' +
      '<div class="week-strip">' + strip + '</div>' +
      '<div class="day-detail">' + detail + '</div></div>' +
      '<div class="stats">' +
      '<div class="stat"><b class="num">' + q + '</b><span>Quests this week</span></div>' +
      '<div class="stat"><b class="num">' + g + '</b><span>Glasses this week</span></div>' +
      '<div class="stat"><b class="num">' + xp + '</b><span>XP earned</span></div>' +
      '</div>' +
      '<div class="challenge' + (bonus ? ' won' : '') + '">' +
      '<div class="ch-top"><span class="ch-ic">' + I('trophy', 24) + '</span><div><span class="ch-kicker">Weekly challenge</span><b>' + ch + '</b></div><span class="xp-chip on-dark">+150 XP</span></div>' +
      '<p>' + (bonus ? 'Completed! You guarded your family 5 full days this week.' : 'Complete 5 full days (6+ quests) this week.') + '</p>' +
      '<div class="ch-bar">' + BD.bar('ch', Math.min(1, fullDays / 5)) + '<span class="num">' + Math.min(fullDays, 5) + '/5 days</span></div>' +
      '</div>';
  }

  function activeQuest(t) {
    const now = BD.now(), h = now.getHours();
    const since = t.lastGlass ? (Date.now() - t.lastGlass) / 60000 : (h >= 7.5 ? 999 : 0);
    if (t.glasses < 8 && since >= 90 && h >= 7 && h <= 22) {
      return '<div class="active tone-teal"><div class="active-top"><span class="active-kicker">' + I('zap', 14) + 'Active quest</span><span class="xp-chip on-dark">+25 XP at 8</span></div>' +
        '<div class="active-main"><span class="active-ic">' + I('droplet', 30) + '</span><div><b>Inom tubig!</b><span>' + (t.lastGlass ? 'No glass logged in 90 minutes.' : 'No glass logged yet today.') + ' You have ' + t.glasses + ' of 8.</span></div></div>' +
        '<button class="btn btn-light" data-action="glass" data-d="1">' + I('plus', 18) + 'I drank a glass</button></div>';
    }
    const qs = BD.quests();
    const open = qs.find(q => BD.unlocked(q) && !t.q[q.id]);
    if (open) {
      return '<div class="active tone-' + (BD.state.season === 'heat' ? 'gulf' : 'storm') + '"><div class="active-top"><span class="active-kicker">' + I('zap', 14) + 'Active quest</span><span class="xp-chip on-dark">+' + open.xp + ' XP</span></div>' +
        '<div class="active-main"><span class="active-ic">' + I(open.icon, 30) + '</span><div><b>' + esc(open.title) + '</b><span>' + esc(open.desc) + '</span></div></div>' +
        '<button class="btn btn-light" data-action="quest" data-id="' + open.id + '">' + I('check', 18) + 'Done</button></div>';
    }
    const next = qs.find(q => !BD.unlocked(q));
    if (next) {
      const mins = (next.hour - h) * 60 - now.getMinutes();
      return '<div class="active tone-soft"><div class="active-top"><span class="active-kicker">' + I('clock', 14) + 'Next quest · ' + BD.hourLabel(next.hour) + '</span><span class="xp-chip">+' + next.xp + ' XP</span></div>' +
        '<div class="active-main"><span class="active-ic">' + I(next.icon, 30) + '</span><div><b>' + esc(next.title) + '</b><span>Unlocks in ' + (mins >= 60 ? Math.floor(mins / 60) + 'h ' : '') + (mins % 60) + 'm. You\'re all caught up. Padayon!</span></div></div></div>';
    }
    if (BD.doneCount(t) >= 8) {
      return '<div class="active tone-purple"><div class="active-top"><span class="active-kicker">' + I('star', 14) + 'Perfect day</span><span class="xp-chip on-dark">+50 XP</span></div>' +
        '<div class="active-main"><span class="active-ic">' + I('trophy', 30) + '</span><div><b>All quests done!</b><span>Salamat, bantay. Rest well and come back tomorrow.</span></div></div></div>';
    }
    return '';
  }

  function water(t) {
    let pips = '';
    for (let i = 0; i < 8; i++) pips += '<button class="pip' + (i < t.glasses ? ' on' : '') + '" data-action="pip" data-i="' + i + '" aria-label="Glass ' + (i + 1) + '" style="--i:' + i + '">' + I('droplet', 22) + '</button>';
    const done = t.glasses >= 8;
    return '<div class="card water' + (done ? ' done' : '') + '">' +
      '<div class="water-head"><span class="q-ic c-teal">' + I('droplet', 20) + '</span>' +
      '<div class="q-body"><span class="q-title">Drink 8 glasses of water</span><span class="q-meta">All day · ' + (done ? 'Done! Inom pa gihapon.' : (8 - t.glasses) + ' more to go') + '</span></div>' +
      '<span class="q-xp">+25</span><span class="q-check">' + I('check', 16) + '</span></div>' +
      '<div class="pips">' + pips + '</div>' +
      '<div class="water-ctrl"><button class="round-btn" data-action="glass" data-d="-1" aria-label="Remove a glass"' + (t.glasses ? '' : ' disabled') + '>' + I('minus', 20) + '</button>' +
      '<span class="num"><b>' + t.glasses + '</b> / 8 glasses</span>' +
      '<button class="round-btn add" data-action="glass" data-d="1" aria-label="Add a glass"' + (t.glasses >= 12 ? ' disabled' : '') + '>' + I('plus', 20) + '</button></div></div>';
  }

  function questRow(q, t) {
    const done = !!t.q[q.id], locked = !BD.unlocked(q), fresh = done && BD.ui.justDone === q.id;
    return '<button class="quest' + (done ? ' done' : '') + (fresh ? ' just-done' : '') + (locked ? ' locked' : '') + '" data-action="' + (locked ? 'locked' : 'quest') + '" data-id="' + q.id + '">' +
      '<span class="q-ic c-' + q.color + '">' + I(locked ? 'lock' : q.icon, 20) + '</span>' +
      '<span class="q-body"><span class="q-title">' + esc(q.title) + '</span>' +
      '<span class="q-meta">' + (locked ? '<b>Unlocks ' + BD.hourLabel(q.hour) + '</b>' : BD.hourLabel(q.hour)) + ' · ' + esc(q.desc) + '</span></span>' +
      '<span class="q-xp">+' + q.xp + '</span><span class="q-check">' + I('check', 16) + '</span></button>';
  }

  // The bag at the top of the checklist: it fills as you pack, with a tip for the item you just packed.
  function gobag(n, total) {
    const tip = BD.ui.packTip != null ? BD.CHECKLIST_INFO[BD.state.season][BD.ui.packTip] : null;
    return '<div class="gobag"><span class="gb-bag" aria-hidden="true"><i class="gb-fill" style="height:' + Math.round(n / total * 100) + '%"></i><i class="gb-pocket"></i></span>' +
      '<span class="gb-txt"><b class="num">' + n + '/' + total + ' packed</b><span>' + (tip ? I('sparkle', 13) + esc(tip[1]) : 'Tap each item as you pack it.') + '</span></span></div>';
  }
  // Packing an item: its icon flies from the row into the bag, and the bag bounces.
  function flyToBag(fromRect, icon) {
    const bag = document.querySelector('.gb-bag'), app = document.getElementById('app');
    if (!bag || !fromRect || !Element.prototype.animate || BD.calm()) return;
    const a = app.getBoundingClientRect(), s = BD.scale(), to = bag.getBoundingClientRect();
    const fx = document.getElementById('fx'), o = document.createElement('span');
    o.className = 'gb-fly'; o.innerHTML = I(icon, 18);
    const x0 = (fromRect.left - a.left) / s, y0 = (fromRect.top - a.top) / s, x1 = (to.left - a.left + to.width / 2 - 14) / s, y1 = (to.top - a.top + to.height / 2 - 14) / s;
    o.style.left = x0 + 'px'; o.style.top = y0 + 'px'; fx.appendChild(o);
    o.animate([{ transform: 'translate(0, 0) scale(1)' }, { transform: 'translate(' + (x1 - x0) / 2 + 'px, ' + (Math.min(y0, y1) - y0 - 50) + 'px) scale(1.15)', offset: 0.5 },
      { transform: 'translate(' + (x1 - x0) + 'px, ' + (y1 - y0) + 'px) scale(.5)', opacity: 0.2 }], { duration: 620, easing: 'cubic-bezier(.5, 0, .3, 1)' })
      .onfinish = () => { o.remove(); const b = document.querySelector('.gb-bag'); if (b) { b.classList.remove('xp-bump'); void b.offsetWidth; b.classList.add('xp-bump'); } BD.vibrate(10); };
  }

  function checklist() {
    const s = BD.state, key = BD.todayKey() + ':' + s.season, items = BD.CHECKLIST[s.season], on = s.checklist[key] || {};
    const n = items.filter((x, i) => on[i]).length, open = BD.ui.checklistOpen, info = BD.CHECKLIST_INFO[s.season];
    return '<div class="card checklist' + (open ? ' open' : '') + '">' +
      '<button class="cl-head" data-action="toggleChecklist" aria-expanded="' + open + '">' +
      '<span class="q-ic c-sun">' + I('backpack', 20) + '</span><span class="q-body"><span class="q-title">Mugawas ka? Before you go out</span>' +
      '<span class="q-meta">' + n + ' of ' + items.length + ' ready' + (n === items.length ? ' · Ingat!' : '') + '</span></span>' + I('chevdown', 20, 'cl-chev') + '</button>' +
      '<div class="cl-body"><div>' + gobag(n, items.length) + items.map((x, i) => '<button class="cl-item' + (on[i] ? ' on' : '') + '" data-action="checkItem" data-i="' + i + '" aria-pressed="' + !!on[i] + '">' +
        '<span class="box">' + I('check', 14) + '</span><span class="cl-ic">' + I(info[i][0], 16) + '</span><span class="cl-t">' + esc(x) + '</span></button>').join('') +
      (n === items.length ? '<div class="cl-done">' + I('shieldcheck', 18) + 'Ready na! Ingat sa dalan.</div>' : '') + '</div></div></div>';
  }

  // Karon keeps a one-card summary of today; the full list lives in the Quests tab.
  function todayCard(t) {
    const qs = BD.quests(), n = BD.doneCount(t);
    const next = qs.find(q => BD.unlocked(q) && !t.q[q.id]) || qs.find(q => !BD.unlocked(q));
    return '<button class="card today-card" data-action="go" data-tab="quests">' +
      '<span class="tc-top"><span class="q-ic c-gulf">' + I('notepad', 20) + '</span><span class="q-body"><span class="q-title">Today\'s quests</span>' +
      '<span class="q-meta">' + n + ' of 8 done · ' + t.glasses + ' of 8 glasses · +' + BD.dayXP(t) + ' XP</span></span>' + I('chevron', 20) + '</span>' +
      BD.bar('todayk', n / 8, 'bar-quest') +
      '<span class="tc-next">' + (next ? I(BD.unlocked(next) ? 'zap' : 'clock', 14) + '<span>' + (BD.unlocked(next) ? 'Up next: ' : 'Unlocks ' + BD.hourLabel(next.hour) + ': ') + '<b>' + esc(next.title) + '</b></span>'
        : I('star', 14) + '<span>All done today. Salamat, bantay!</span>') + '</span></button>';
  }

  BD.tabs = BD.tabs || {};
  BD.tabs.karon = {
    after() { setTimeout(BD.maybeAlert, 700); },
    render() {
      // Karon: today's top threat first, then the Maayong buntag/hapon/gabii panel with today's quests right under it, then the week.
      return threatBar() + hero() + todayCard(BD.today()) + BD.reminders.askCard() + week() + '<div class="spacer"></div>';
    }
  };
  BD.tabs.quests = {
    render() {
      const t = BD.today(), qs = BD.quests(), n = BD.doneCount(t), xp = BD.dayXP(t);
      return '<div class="sec-head" id="quests"><h2>Today\'s quests</h2><span class="sum num"><b>' + n + '/8</b> · +' + xp + ' XP</span></div>' +
        '<div class="today-bar">' + BD.bar('today', n / 8, 'bar-quest') + '</div>' +
        activeQuest(t) + water(t) +
        '<div class="quest-list">' + qs.map(q => questRow(q, t)).join('') + '</div>' +
        '<div class="perfect-hint' + (n >= 8 ? ' won' : '') + '">' + I('star', 16) + '<span>' + (n >= 8 ? 'Perfect day! +50 XP bonus earned.' : 'Finish all 8 for a <b>+50 XP</b> perfect-day bonus. Resets at midnight.') + '</span>' + '</div>' +
        (BD.quizCard ? BD.quizCard() : '') + checklist() + '<div class="spacer"></div>';
    }
  };

  Object.assign(BD.actions = BD.actions || {}, {
    openAlert() {
      const m = document.getElementById('modal');
      m.innerHTML = alertPop(); m.classList.add('open', 'alert-open');
      BD.vibrate([30, 60, 30]);
      setTimeout(() => { const x = m.querySelector('.safe-btns .btn, .pop-x'); if (x) x.focus(); }, 60);
    },
    closeAlert() { const m = document.getElementById('modal'); m.classList.remove('open', 'alert-open'); m.innerHTML = ''; const b = document.querySelector('.threat-bar'); if (b) b.focus(); },
    alertMore(el) { BD.actions.closeAlert(); BD.go(el.dataset.tab || 'peligro'); },
    quest(el) {
      const q = BD.quests().find(x => x.id === el.dataset.id);
      if (!q || !BD.unlocked(q)) return;
      BD.ui.justDone = BD.today().q[q.id] ? null : q.id;   // the row glows once when it is ticked
      BD.commit(s => { const t = BD.today(); t.q[q.id] = !t.q[q.id]; }, el.querySelector('.q-check') || el);
      BD.ui.justDone = null;
    },
    locked(el) {
      const q = BD.quests().find(x => x.id === el.dataset.id);
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      BD.toast(I('lock', 16) + 'This quest unlocks at ' + BD.hourLabel(q.hour) + '.');
    },
    glass(el) {
      const d = +el.dataset.d;
      BD.commit(() => {
        const t = BD.today();
        t.glasses = Math.max(0, Math.min(12, t.glasses + d));
        if (d > 0) t.lastGlass = Date.now();
      }, el);
      if (d > 0) { const t = BD.today(); if (t.glasses < 8) BD.toast(I('droplet', 16) + (t.glasses === 4 ? 'Halfway there! Padayon!' : 'Inom tubig! ' + t.glasses + ' of 8.')); }
    },
    pip(el) {
      const i = +el.dataset.i;
      BD.commit(() => {
        const t = BD.today(), target = t.glasses === i + 1 ? i : i + 1;
        if (target > t.glasses) t.lastGlass = Date.now();
        t.glasses = target;
      }, el);
    },
    selDay(el) { BD.ui.selDay = el.dataset.key; BD.render(); },
    startFresh() {
      BD.commit(s => { BD.clearSample(); });
      BD.toast(I('refresh', 16) + 'Sample week cleared. Fresh start!');
    },
    toggleChecklist() { BD.ui.checklistOpen = !BD.ui.checklistOpen; BD.render(); },
    checkItem(el) {
      const s = BD.state, key = BD.todayKey() + ':' + s.season, i = +el.dataset.i;
      s.checklist = { [key]: Object.assign({}, s.checklist[key]) };
      s.checklist[key][i] = !s.checklist[key][i];
      const packed = s.checklist[key][i], ic = el.querySelector('.cl-ic'), from = ic && ic.getBoundingClientRect();
      BD.ui.packTip = packed ? i : null;
      BD.save(); BD.render();
      if (packed) flyToBag(from, BD.CHECKLIST_INFO[s.season][i][0]);
      if (BD.checkBadges) BD.checkBadges();
    }
  });
})(window.BD);
