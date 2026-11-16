/* BantayDavao app shell: rendering, navigation, notification center, demo panel, boot. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc, $ = s => document.querySelector(s);
  const TABS = [
    { id: 'karon', label: 'Karon', icon: 'home', title: 'Home', bar: true },
    { id: 'peligro', label: 'Peligro', icon: 'alert', title: 'Threats', bar: true },
    { id: 'mapa', label: 'Mapa', icon: 'map', title: 'Map', bar: true },
    { id: 'pamilya', label: 'Pamilya', icon: 'users', title: 'Family', bar: true },
    { id: 'tabang', label: 'Tabang', icon: 'aid', title: 'First aid and hotlines' },
    { id: 'profile', label: 'Profile', icon: 'user', title: 'Your profile' },
    // Quests is not in the bottom bar: it opens from the target button in the top bar's Notifications | Quests pill.
    { id: 'quests', label: 'Quests', icon: 'notepad', title: 'Today\'s quests', bar: true, hidden: true },
    // Notifications opens the same way, from the bell on the right of that pill.
    { id: 'notifs', label: 'Notifications', icon: 'bell', title: 'Notifications', bar: true, hidden: true }
  ];
  BD.ui = { tab: 'karon', selDay: null, checklistOpen: false, symptoms: {}, center: false, help: 'aid' };

  /* ---------- animated rings and bars ---------- */
  const prev = {};
  BD.ring = function (id, pct, size, stroke, cls) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = prev[id] != null ? prev[id] : 0, h = size / 2;
    return '<svg class="ring ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle class="ring-track" cx="' + h + '" cy="' + h + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
      '<circle class="ring-fill" cx="' + h + '" cy="' + h + '" r="' + r + '" stroke-width="' + stroke + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - p) + '" transform="rotate(-90 ' + h + ' ' + h + ')" data-ring="' + id + '" data-pct="' + Math.max(0, Math.min(1, pct)) + '" data-c="' + c + '"/></svg>';
  };
  BD.bar = function (id, pct, cls) {
    const p = prev['b' + id] != null ? prev['b' + id] : 0;
    return '<div class="bar ' + (cls || '') + '"><i data-bar="' + id + '" data-pct="' + Math.max(0, Math.min(1, pct)) + '" style="width:' + p * 100 + '%"></i></div>';
  };
  function animateMeters() {
    const rings = document.querySelectorAll('[data-ring]'), bars = document.querySelectorAll('[data-bar]');
    void document.body.offsetWidth;
    requestAnimationFrame(() => {
      rings.forEach(el => { const p = +el.dataset.pct; el.style.strokeDashoffset = el.dataset.c * (1 - p); prev[el.dataset.ring] = p; });
      bars.forEach(el => { const p = +el.dataset.pct; el.style.width = p * 100 + '%'; prev['b' + el.dataset.bar] = p; });
    });
  }

  /* ---------- rendering ---------- */
  BD.renderAppbar = function () {
    const s = BD.season(), n = BD.unread(), t = BD.today();
    const todo = BD.quests().filter(q => BD.unlocked(q) && !t.q[q.id]).length;   // quests open right now
    $('#appbar').innerHTML =
      '<div class="ab-left"><span class="logo"><img src="icons/mark-dark.png" alt=""></span><div><b class="ab-title">BantayDavao</b>' +
      '<span class="ab-sub">' + (navigator.onLine ? I(s.icon, 13) + s.label + ' · ' + s.sub.split(' · ')[0] : '<span class="ab-off">' + I('wifioff', 13) + 'Offline · saved info</span>') + '</span></div></div>' +
      '<div class="ab-right">' +
      // Guests have no quests or notifications: the top bar offers Sign in.
      (BD.locked() ? '<button class="btn ab-signin" data-action="go" data-tab="karon">' + I('user', 16) + 'Sign in</button>' :
      '<div class="ab-pair"><button class="bell ab-quests' + (BD.ui.tab === 'quests' ? ' on' : '') + '" data-action="go" data-tab="quests" aria-label="Quests, ' + todo + ' to do"' + (BD.ui.tab === 'quests' ? ' aria-current="page"' : '') + '>' +
      I('notepad', 22) + (todo ? '<span class="badge num q-badge">' + todo + '</span>' : '') + '</button>' +
      '<span class="ab-sep" aria-hidden="true"></span><button class="bell ab-notifs' + (BD.ui.tab === 'notifs' ? ' on' : '') + '" data-action="openCenter" aria-label="Notifications, ' + n + ' unread"' + (BD.ui.tab === 'notifs' ? ' aria-current="page"' : '') + '>' +
      I('bell', 22) + (n ? '<span class="badge num">' + (n > 9 ? '9+' : n) + '</span>' : '') + '</button></div>') + '</div>';
  };
  let tabbarHtml = '';
  function renderTabbar() {
    const hot = BD.topThreat().sev >= 2;
    // A guest sees only the open tabs, plus Sign in (any locked tab shows the login screen).
    const guest = BD.locked();
    const tabs = guest ? TABS.filter(t => BD.OPEN_TABS.indexOf(t.id) >= 0).concat([{ id: 'karon', label: 'Sign in', icon: 'user', title: 'Sign in or create an account' }]) : TABS.filter(t => !t.hidden);
    const html = tabs.map(t => '<button class="tab' + (BD.ui.tab === t.id ? ' on' : '') + '" data-action="go" data-tab="' + t.id + '" aria-label="' + t.label + ' (' + t.title + ')"' + (BD.ui.tab === t.id ? ' aria-current="page"' : '') + '>' +
      '<span class="tab-ic">' + I(t.icon, 22) + (t.id === 'peligro' && hot ? '<i class="red-dot"></i>' : '') + '</span><span>' + t.label + '</span></button>').join('');
    // Rewrite the bar only when it changed: replacing a button while a finger is on it can lose the tap.
    // The language is part of the check because translation rewrites the labels in place.
    const key = BD.lang() + html;
    if (key !== tabbarHtml) { tabbarHtml = key; $('#tabbar').innerHTML = html; }
  }
  function renderStatus() {
    const el = $('#statusTime');
    if (el) el.textContent = BD.timeLabel(BD.now()).replace(/ [AP]M/, '');
  }
  BD.render = function (opts) {
    const scr = $('#screen'), tab = BD.ui.tab, keep = scr.scrollTop;
    // Without an account only Peligro and Tabang open; every other tab shows the sign-in screen.
    const gated = BD.lockedTab(tab);
    scr.innerHTML = '<div class="tab-body' + (opts && opts.enter ? ' enter' : '') + '">' + (gated ? BD.authScreen() : BD.tabs[tab].render()) + '</div>';
    scr.scrollTop = opts && opts.enter ? 0 : keep;
    // Only Karon and Peligro have the top bar; it floats over the screen and hides while scrolling down.
    const app = $('#app'), bar = !gated && (TABS.find(t => t.id === tab) || {}).bar;
    app.classList.toggle('no-bar', !bar);
    app.classList.toggle('auth-on', !!gated);
    if (opts && opts.enter) app.classList.remove('bar-hide');
    BD.renderAppbar(); renderTabbar(); renderStatus();
    if (bar) app.style.setProperty('--bar-h', $('#appbar').offsetHeight + 'px');
    if (BD.ui.center) renderCenter();
    if (!BD.native) renderPitchDemo();   // the presenter panel exists only on the web
    animateMeters();
    initChips(opts && opts.enter);
    if (!gated && BD.tabs[tab].after) BD.tabs[tab].after();
    BD.nativeChrome();
  };

  /* ---------- side-scrolling chip rows (Mapa filters) ----------
     Phones swipe them natively. This adds: an edge fade where more chips are hidden, mouse drag and
     wheel scrolling for laptops and projectors, and keeps the row's position when a chip re-renders the tab. */
  function chipEdges(row) {
    const max = row.scrollWidth - row.clientWidth;
    row.classList.toggle('more-l', row.scrollLeft > 4);
    row.classList.toggle('more-r', row.scrollLeft < max - 4);
  }
  function initChips(enter) {
    document.querySelectorAll('#screen .chips').forEach(row => {
      const key = row.getAttribute('aria-label');
      BD.ui.chipX = BD.ui.chipX || {};
      if (!enter && BD.ui.chipX[key] != null) row.scrollLeft = BD.ui.chipX[key];
      else {
        const on = row.querySelector('.on');
        if (on && on.offsetLeft + on.offsetWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - 16;
      }
      chipEdges(row);
    });
  }
  document.addEventListener('scroll', e => {
    const row = e.target;
    if (!row.classList || !row.classList.contains('chips')) return;
    BD.ui.chipX = BD.ui.chipX || {};
    BD.ui.chipX[row.getAttribute('aria-label')] = row.scrollLeft;
    chipEdges(row);
  }, true);
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const row = e.pointerType === 'mouse' && e.button === 0 && e.target.closest('.chips');
    drag = row ? { row, x: e.clientX, left: row.scrollLeft, moved: false } : null;
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) { drag.moved = true; drag.row.classList.add('dragging'); }
    if (drag.moved) drag.row.scrollLeft = drag.left - dx;
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    drag.row.classList.remove('dragging');
    // A drag must not also tap the chip under the pointer.
    if (drag.moved) document.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
    drag = null;
  });
  /* ---------- swipe a notification to the right to remove it ----------
     Works on the pop-up banners and on the rows of the Notifications page. Up and down still scrolls.
     Without swiping: the Delete key on a row, or Clear all. */
  let sw = null, swipedAt = 0;
  const swReset = el => { el.classList.remove('swiping'); el.style.transform = ''; el.style.opacity = ''; if (el.classList.contains('banner')) el._t = setTimeout(el._close, 3000); };
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest && e.target.closest('.banner, .n-item[data-id]');
    sw = el && !(e.pointerType === 'mouse' && e.button !== 0) ? { el, x: e.clientX, y: e.clientY, on: false, dx: 0 } : null;
  });
  document.addEventListener('pointermove', e => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.on) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }   // scrolling, not swiping
      if (dx < 10) return;
      sw.on = true; sw.el.classList.add('swiping'); clearTimeout(sw.el._t);
    }
    sw.dx = Math.max(0, dx);
    sw.el.style.transform = 'translateX(' + sw.dx + 'px)';
    sw.el.style.opacity = String(Math.max(.3, 1 - sw.dx / sw.el.offsetWidth));
  });
  function swEnd(cancelled) {
    const s = sw; sw = null;
    if (!s || !s.on) return;
    swipedAt = Date.now();
    const el = s.el;
    if (cancelled || s.dx < Math.min(110, el.offsetWidth * .3)) { swReset(el); return; }
    el.classList.remove('swiping'); el.classList.add('swiped');
    el.style.transform = 'translateX(110%)'; el.style.opacity = '0';
    setTimeout(() => { if (el.classList.contains('banner')) el._drop(); else BD.actions.removeNotif(el); }, BD.calm() ? 0 : 220);
  }
  document.addEventListener('pointerup', () => swEnd(false));
  document.addEventListener('pointercancel', () => swEnd(true));
  // A swipe must not also open the notification under the finger.
  document.addEventListener('click', e => { if (Date.now() - swipedAt < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('keydown', e => {
    const el = document.activeElement;
    if ((e.key === 'Delete' || e.key === 'Backspace') && el && el.matches && el.matches('.n-item[data-id]')) { e.preventDefault(); BD.actions.removeNotif(el); }
  });
  document.addEventListener('wheel', e => {
    const row = e.target.closest && e.target.closest('.chips');
    if (!row || Math.abs(e.deltaX) > Math.abs(e.deltaY) || row.scrollWidth <= row.clientWidth) return;
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  }, { passive: false });
  // Android back button: Karon is the root entry, any other tab sits one entry above it, and the
  // full-screen page (Settings) one more. So back closes the page, then returns to Karon, then exits.
  BD.go = function (tab, fromHistory) {
    if (tab === 'tawag') { tab = 'tabang'; BD.ui.help = 'call'; }
    if (tab === 'hangin') { tab = 'peligro'; BD.ui.peligroView = 'air'; }   // air quality view of Peligro
    if (!BD.tabs[tab]) return;
    if (!fromHistory && tab !== BD.ui.tab) {
      const st = history.state || {};
      if (tab === 'karon' && st.tab && st.tab !== 'karon') { history.back(); return; }
      if (tab !== 'karon') { if (BD.ui.tab === 'karon') history.pushState({ tab }, ''); else history.replaceState({ tab }, ''); }
    }
    const same = BD.ui.tab === tab;
    BD.ui.tab = tab;
    BD.render({ enter: !same });
    if (same) $('#screen').scrollTo({ top: 0, behavior: BD.calm() ? 'auto' : 'smooth' });
    if (BD.tabs[tab].enter && !BD.lockedTab(tab)) BD.tabs[tab].enter();
  };

  /* ---------- toast ---------- */
  let toastT;
  BD.toast = function (html) {
    const t = $('#toast');
    t.innerHTML = html; t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('in'), 2400);
  };

  /* ---------- notification center ---------- */
  BD.demoControls = function (where, noTheme) {
    const s = BD.state;
    let hours = '<option value="">Live (' + BD.timeLabel(new Date()) + ')</option>';
    for (let h = 5; h <= 22; h++) hours += '<option value="' + h + '"' + (s.simHour === h ? ' selected' : '') + '>' + BD.hourLabel(h) + '</option>';
    const th = k => '<button class="' + (s.theme === k ? 'on' : '') + '" data-action="theme" data-t="' + k + '">' + (k === 'auto' ? I('monitor', 14) + 'Device' : k === 'light' ? I('sun', 14) + 'Light' : I('moon', 14) + 'Dark') + '</button>';
    const se = k => '<button class="' + (s.season === k ? 'on' : '') + '" data-action="season" data-s="' + k + '">' + I(BD.SEASONS[k].icon, 14) + BD.SEASONS[k].short + '</button>';
    return '<div class="demo ' + where + '">' +
      '<div class="demo-row2"><span>Season</span><div class="mini-seg">' + se('heat') + se('rain') + '</div></div>' +
      '<div class="demo-row2"><span>Demo clock</span><label class="sel small"><select data-change="simHour" aria-label="Demo clock">' + hours + '</select>' + I('chevdown', 14) + '</label></div>' +
      (noTheme ? '' : '<div class="demo-row2"><span>Theme</span><div class="mini-seg">' + th('auto') + th('light') + th('dark') + '</div></div>') +
      '<div class="demo-btns"><button class="btn btn-soft sm" data-action="sampleNotif">' + I('bell', 15) + 'Sample notification</button>' +
      '<button class="btn btn-ghost sm" data-action="resetDemo">' + I('refresh', 15) + 'Reset demo</button></div></div>';
  };
  // A switch row bound to any action (BD.toggleRow below is bound to a setting).
  BD.toggleRowRaw = (action, label, sub, icon, on) => '<button class="toggle-row" data-action="' + action + '" role="switch" aria-checked="' + !!on + '">' +
    '<span class="q-ic c-gulf">' + I(icon, 18) + '</span><span class="q-body"><span class="q-title">' + label + '</span><span class="q-meta">' + sub + '</span></span><span class="switch' + (on ? ' on' : '') + '"><i></i></span></button>';
  BD.toggleRow = (k, label, sub, icon) => '<button class="toggle-row" data-action="setting" data-k="' + k + '" role="switch" aria-checked="' + !!BD.state.settings[k] + '">' +
    '<span class="q-ic c-gulf">' + I(icon, 18) + '</span><span class="q-body"><span class="q-title">' + label + '</span><span class="q-meta">' + sub + '</span></span><span class="switch' + (BD.state.settings[k] ? ' on' : '') + '"><i></i></span></button>';
  // The slide-in page holds Settings. Re-renders keep its scroll position.
  function renderCenter() {
    const old = document.querySelector('#sheet .sheet-body'), keep = old ? old.scrollTop : 0;
    $('#sheet').innerHTML = page('Settings', BD.settingsBody());
    const body = document.querySelector('#sheet .sheet-body'); if (body) body.scrollTop = keep;
  }
  function page(title, body) {
    return '<div class="sheet-back" data-action="closeCenter"></div><div class="sheet" role="dialog" aria-label="' + title + '">' +
      '<div class="sheet-head"><button class="icon-btn" data-action="closeCenter" aria-label="Back">' + I('back', 22) + '</button><h3>' + title + '</h3></div>' +
      '<div class="sheet-body">' + body + '</div></div>';
  }
  // Notifications: a page in the screen like Quests (top bar and bottom bar stay), opened from the bell.
  BD.tabs = BD.tabs || {};
  BD.tabs.notifs = {
    render() {
      const s = BD.state, list = s.notifs.filter(n => n.date === BD.todayKey()), up = BD.upcoming(), unread = BD.unread();
      return '<div class="sec-head"><h2>Notifications</h2><span class="sum num">' + (unread ? unread + ' unread' : 'All caught up') + '</span></div>' +
      (BD.demo ? '<button class="btn btn-primary btn-block" data-action="sampleNotif">' + I('bell', 18) + 'Send a sample notification</button>' : '') +
      '<h4>Today</h4>' + (list.length ? '<div class="n-list">' + list.map(n => '<button class="n-item k-' + n.kind + (n.read ? '' : ' unread') + '" data-action="openNotif" data-id="' + n.id + '">' +
        '<span class="n-ic' + (BD.noticeIsApp(n) ? ' is-logo' : '') + '">' + BD.noticeIcon(n, 18) + '</span><span class="q-body"><span class="q-title">' + esc(n.title) + '</span><span class="q-meta">' + esc(n.body) + '</span></span><span class="n-time num">' + n.time + '</span>' + (n.tab ? I('chevron', 16) : '') + '</button>').join('') + '</div>'
        + '<div class="n-tools"><p class="fine">' + I('info', 13) + 'Swipe a notification to the right to remove it.</p><button class="btn btn-soft sm" data-action="clearNotifs">Clear all</button></div>'
        : '<div class="dd-empty">' + I('bell', 16) + 'No notifications yet today.</div>') +
      '<h4>Coming up today</h4>' + (up.length ? '<div class="n-list">' + up.map(u => '<div class="n-item soon"><span class="n-ic">' + I(u.icon, 18) + '</span><span class="q-body"><span class="q-title">' + esc(u.title) + '</span><span class="q-meta">' + esc(u.body) + '</span></span><span class="n-time num">' + BD.hourLabel(u.hour) + '</span></div>').join('') + '</div>'
        : '<div class="dd-empty">' + I('moon', 16) + 'Nothing else today. Pahuway na.</div>') +
      '<button class="btn btn-soft btn-block" data-action="openSettings">' + I('settings', 18) + 'Alert settings</button>';
    },
    // Reading the page marks everything read, after a moment so the unread dots are seen first.
    enter() {
      BD.dismissBanners();
      setTimeout(() => { if (BD.ui.tab !== 'notifs') return; BD.state.notifs.forEach(n => { n.read = true; }); BD.save(); BD.render(); }, 600);
    }
  };
  // Open a notification at the card it is about: the quest, the water tracker, the warning or your level.
  const TARGETS = { water: '.water-head', level: '.hero', threat: '.hi-top' };
  function showTarget(n) {
    const sel = n.qid ? '.quest-list [data-id="' + n.qid + '"]' : TARGETS[n.kind];
    const el = sel && document.querySelector('#screen ' + sel);
    if (!el) return;
    const card = el.closest('.quest, .card') || el;
    setTimeout(() => {
      card.scrollIntoView({ behavior: BD.calm() ? 'auto' : 'smooth', block: 'center' });
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    }, 350);
  }
  let afterClose = null;
  function closePage() { BD.ui.center = false; $('#sheet').classList.remove('open'); }
  window.addEventListener('popstate', e => {
    const st = e.state || { tab: 'karon' };
    if (BD.ui.center && !st.page) closePage();
    if (afterClose) { const f = afterClose; afterClose = null; f(); return; }
    if (st.tab && st.tab !== BD.ui.tab) BD.go(st.tab, true);
  });
  function renderPitchDemo() { const p = $('#pitchDemo'); if (p) p.innerHTML = BD.demoControls('in-pitch'); }

  BD.applyTheme = function () {
    const t = BD.state.theme, root = document.documentElement;
    if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
    root.dataset.season = BD.state.season;
    // Easier to use: text size and reduce motion (Settings).
    root.dataset.text = BD.state.textSize || 'normal';
    if (BD.state.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion;
  };

  /* ---------- actions ---------- */
  Object.assign(BD.actions = BD.actions || {}, {
    go(el) { BD.go(el.dataset.tab); },
    // Opens the Notifications page. If Settings is open over the screen, it closes first and the page opens after.
    openCenter() {
      if (BD.ui.center && history.state && history.state.page) { afterClose = () => BD.go('notifs'); history.back(); }
      else { if (BD.ui.center) closePage(); BD.go('notifs'); }
    },
    // Closing pops the page's history entry; the popstate handler does the actual close (and any pending jump).
    closeCenter() {
      if (!BD.ui.center) return;
      if (history.state && history.state.page) history.back(); else closePage();
    },
    removeNotif(el) { const id = el.dataset.id; BD.state.notifs = BD.state.notifs.filter(n => n.id !== id); BD.save(); BD.render(); },
    clearNotifs() { const today = BD.todayKey(); BD.state.notifs = BD.state.notifs.filter(n => n.date !== today); BD.save(); BD.render(); },
    openNotif(el) {
      const n = BD.state.notifs.find(x => x.id === el.dataset.id);
      if (el.classList.contains('banner')) { clearTimeout(el._t); el._close && el._close(); }
      if (n) { n.read = true; BD.save(); }
      // Quest and water alerts open the Quests tab (older saved alerts still say karon).
      const jump = () => {
        if (n && n.alert) { BD.go('karon'); setTimeout(BD.actions.openAlert, 250); return; }   // "Today's top threat" reopens its pop-up
        if (n && n.tab) { BD.go(n.qid || n.kind === 'water' ? 'quests' : n.tab); showTarget(n); } else BD.render();
      };
      if (BD.ui.center && history.state && history.state.page) { afterClose = jump; history.back(); } else { closePage(); jump(); }
    },
    openSettings() {
      const swap = BD.ui.center;
      if (!swap) history.pushState({ tab: BD.ui.tab, page: true }, '');
      BD.ui.page = 'settings'; BD.ui.center = true; renderCenter();
      if (swap) $('#sheet .sheet-body').scrollTop = 0; else $('#sheet').classList.add('open');
    },
    sampleNotif() { BD.actions.closeCenter(); setTimeout(() => { BD.sampleNotif(); if (BD.ui.tab === 'notifs') BD.render(); }, 250); },
    setting(el) { const k = el.dataset.k; BD.state.settings[k] = !BD.state.settings[k]; BD.save(); BD.render(); },
    theme(el) { BD.state.theme = el.dataset.t; BD.save(); BD.applyTheme(); BD.render(); },
    textSize(el) { BD.state.textSize = el.dataset.z; BD.save(); BD.applyTheme(); BD.render(); },
    calmMotion() { BD.state.motion = BD.state.motion === 'reduce' ? 'device' : 'reduce'; BD.save(); BD.applyTheme(); BD.render(); },
    setLang(el) { BD.state.lang = el.dataset.l; BD.save(); BD.render(); BD.i18nApply(); },
    resetDemo() {
      BD.resetAll(); BD.ui.selDay = null; BD.ui.symptoms = {}; BD.ui.help = 'aid'; prevLevel = BD.levelOf(BD.totalXP()).level;
      BD.applyTheme(); BD.actions.closeCenter(); BD.go('karon'); BD.toast(I('refresh', 16) + 'Demo reset with a sample week.');
    },
    closeModal() { BD.closeModal(); },
    simHour(el) {
      BD.state.simHour = el.value === '' ? null : +el.value; BD.save();
      BD.render(); BD.checkTriggers();
      BD.toast(I('clock', 16) + (BD.state.simHour == null ? 'Live clock' : 'Demo clock set to ' + BD.hourLabel(BD.state.simHour)));
    }
  });

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = BD.actions[el.dataset.action];
    if (fn) { if (el.tagName !== 'A') e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-change]');
    if (el && BD.actions[el.dataset.change]) BD.actions[el.dataset.change](el, e);
  });
  document.addEventListener('keydown', e => {
    // Rows marked role=button act like buttons from the keyboard too.
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-action]')) { e.preventDefault(); e.target.click(); return; }
    if (e.key === 'Escape') { if ($('#modal').classList.contains('alert-open')) BD.actions.closeAlert(); else if ($('#modal').classList.contains('open')) BD.closeModal(); else if (BD.ui.center) BD.actions.closeCenter(); }
    if (e.key === 'Enter' && e.target.id === 'hiInput') BD.actions.setHI();
  });

  /* ---------- fit phone frame to the screen ---------- */
  function fit() {
    const stage = $('.stage');
    if (window.matchMedia('(min-width: 900px)').matches) {
      const s = Math.min(1, (window.innerHeight - 40) / 868);
      stage.style.setProperty('--s', s.toFixed(4));
    } else stage.style.removeProperty('--s');
  }

  /* ---------- clock tick: midnight reset, unlocks, reminders ---------- */
  let lastKey, lastHour, prevLevel;
  function tick() {
    const now = BD.now(), k = BD.dateKey(now), h = now.getHours();
    renderStatus();
    if (k !== lastKey || h !== lastHour) {
      if (lastKey && k !== lastKey) BD.ui.selDay = null;
      lastKey = k; lastHour = h;
      if (!BD.ui.center && !$('#modal').classList.contains('open')) BD.render();
    }
    BD.checkTriggers();
  }

  /* ---------- boot ---------- */
  function boot() {
    BD.load();
    BD.seedSample();
    BD.today();
    BD.save();
    BD.applyTheme();
    prevLevel = BD.levelOf(BD.totalXP()).level;
    history.replaceState({ tab: 'karon' }, '');
    if (BD.checkBadges) BD.checkBadges(true);   // remember badges already earned, without celebrating them
    BD.render({ enter: true });
    BD.i18nApply();
    BD.openFamilyLink();
    lastKey = BD.todayKey(); lastHour = BD.now().getHours();
    fit();
    window.addEventListener('resize', fit);
    // Hide the top bar on scroll down, show it on scroll up or near the top.
    let lastY = 0;
    // The top bar grows when the phone reports its status bar height after the first draw: keep the page's top space in step,
    // or the bar covers the first card (Today's top threat).
    if (window.ResizeObserver) new ResizeObserver(() => { const h = $('#appbar').offsetHeight; if (h) $('#app').style.setProperty('--bar-h', h + 'px'); }).observe($('#appbar'));
    $('#screen').addEventListener('scroll', e => {
      const scr = e.target, y = scr.scrollTop, app = $('#app');
      if (app.classList.contains('no-bar')) return;
      if (y < 24) { app.classList.remove('bar-hide'); lastY = y; BD.nativeChrome(); return; }
      if (Math.abs(y - lastY) < 8) return;
      const atEnd = y + scr.clientHeight >= scr.scrollHeight - 2;
      if (y > lastY) app.classList.add('bar-hide'); else if (!atEnd) app.classList.remove('bar-hide');
      lastY = y; BD.nativeChrome();
    }, { passive: true });
    setTimeout(() => {
      if (!BD.state.sent.welcome) {
        BD.state.sent.welcome = 1;
        BD.notify({ kind: 'level', icon: 'shieldcheck', title: 'Maayong pag-abot, bantay!', body: 'Finish your daily quests to guard your family and level up.', tab: 'karon' });
      }
      BD.checkTriggers();
    }, 1200);
    setInterval(tick, 15000);
    // Offline support: cache the app, and show an Offline badge when the connection drops.
    // The service worker is for the web version only; the app already has every file on the phone.
    if (!BD.native && 'serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
    BD.nativeReady();
    BD.accountBoot().then(() => { BD.familyBoot(); if (!BD.ui.center && !$('#modal').classList.contains('open')) BD.render(); });
    BD.reminders.boot();
    BD.donateBoot();
    // Progress kept in the phone's save file comes back by itself, then the location is refreshed.
    BD.restoreLocal().then(back => {
      if (back) { BD.applyTheme(); prevLevel = BD.levelOf(BD.totalXP()).level; if (BD.checkBadges) BD.checkBadges(true); BD.render(); BD.i18nApply(); }
      BD.gpsBoot();
    });
    // Live forecast: fetch on start, every 15 minutes (it only re-downloads when an hour old) and when back online.
    const wx = () => Promise.all([BD.weather.refresh(), BD.pagasa.refresh(), BD.air.refresh()]).then(r => r[0] || r[1] || r[2]).then(changed => {
      if (changed && !BD.ui.center && !$('#modal').classList.contains('open')) BD.render();
      if (changed) BD.checkTriggers();
    });
    wx(); setInterval(wx, 15 * 60 * 1000); window.addEventListener('online', wx);
    window.addEventListener('online', BD.renderAppbar);
    window.addEventListener('offline', BD.renderAppbar);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => BD.render());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.BD);
