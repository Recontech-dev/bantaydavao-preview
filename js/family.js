/* Tab – Pamilya (Family Location): see your family on a map and check in during disasters.
   - No sign-in needed: creating or joining a family makes a guest account (js/account.js). Linking Google there
     is optional and keeps the family if you change phones.
   - One family per account, joined with a 6-letter invite code.
   - Your location is shared only while BantayDavao is open (no background tracking), and you can pause it.
   - "I'm safe" / "I need help" check-ins show on everyone's list and map.
   Two backends share one interface: Supabase (js/config.js) and a local demo with sample relatives, used on the
   web presenter build and in tests when Supabase isn't set up. Schema: supabase/migrations/0001_family.sql */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;
  const LIVE = BD.account.live;
  const EVERY = 3 * 60 * 1000; // location refresh while the app is open
  const ERR = {
    'already in a family': 'You are already in a family. Leave it first.',
    'no family with that code': 'No family has that code. Check the 6 letters and try again.',
    'family is full': 'That family is full (20 people).'
  };
  const nice = e => { const m = String((e && e.message) || e || ''); const k = Object.keys(ERR).find(x => m.indexOf(x) >= 0); return k ? ERR[k] : 'Something went wrong. Check your connection and try again.'; };

  /* ---------- Supabase backend ---------- */
  function supabaseBackend() {
    const client = () => BD.account.client();
    const must = r => { if (r.error) throw r.error; return r.data; };
    let sb = null, uid = null;
    return {
      live: true,
      async load() {
        const c = sb = await client(); uid = BD.account.uid();
        const members = must(await c.from('members').select('*'));
        if (!members.length) return { family: null };
        const family = must(await c.from('families').select('*').single());
        const locations = must(await c.from('locations').select('*'));
        const checkins = must(await c.from('checkins').select('*'));
        return { family, members, locations, checkins, me: uid };
      },
      async create(name) { must(await (await client()).rpc('create_family', { p_name: name, p_member: BD.state.name, p_photo: BD.state.photo || null })); },
      async join(code) { must(await (await client()).rpc('join_family', { p_code: code, p_member: BD.state.name, p_photo: BD.state.photo || null })); },
      async leave() { must(await (await client()).rpc('leave_family')); },
      async remove(id) { must(await (await client()).from('members').delete().eq('user_id', id)); },
      async updateMe() { must(await (await client()).from('members').update({ name: BD.state.name, photo: BD.state.photo || null }).eq('user_id', uid)); },
      async setSharing(on) {
        const c = await client();
        must(await c.from('members').update({ sharing: on }).eq('user_id', uid));
        if (!on) must(await c.from('locations').delete().eq('user_id', uid));
      },
      async push(fid, p) { must(await (await client()).from('locations').upsert({ user_id: uid, family_id: fid, lat: p.lat, lng: p.lng, accuracy: p.accuracy || null, updated_at: new Date().toISOString() })); },
      async checkIn(fid, status, p, event) {
        must(await (await client()).from('checkins').upsert({ user_id: uid, family_id: fid, status, event, lat: p ? p.lat : null, lng: p ? p.lng : null, created_at: new Date().toISOString() }));
      },
      async askAll() { must(await (await client()).rpc('request_checkin')); },
      subscribe(fid, fn) {
        if (!sb) return () => { };
        const ch = sb.channel('family-' + fid);
        ['members', 'locations', 'checkins'].forEach(t => ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: 'family_id=eq.' + fid }, fn));
        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'families', filter: 'id=eq.' + fid }, fn);
        ch.subscribe();
        return () => sb.removeChannel(ch);
      }
    };
  }

  /* ---------- demo backend (local only, sample relatives) ---------- */
  function demoBackend() {
    const KEY = 'bantaydavao-family-demo', ago = m => new Date(Date.now() - m * 60000).toISOString();
    let d; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    d = d || { family: null, members: [], locations: [], checkins: [] };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { } };
    const me = () => d.members.find(m => m.user_id === 'me');
    function sample(fid) {
      const rel = [['lola', 'Lola Nena', 7.0314, 125.5017, 12, 'safe'], ['kuya', 'Kuya Jun', 7.1093, 125.6155, 4, null], ['inday', 'Inday', 7.0589, 125.5701, 0, null]];
      rel.forEach(([id, name, lat, lng, min, st], i) => {
        d.members.push({ user_id: id, family_id: fid, name, photo: null, role: 'member', sharing: i < 2, joined_at: ago(900) });
        if (i < 2) d.locations.push({ user_id: id, family_id: fid, lat, lng, accuracy: 30, updated_at: ago(min) });
        if (st) d.checkins.push({ user_id: id, family_id: fid, status: st, event: 'manual', lat, lng, created_at: ago(min + 20) });
      });
    }
    const wait = v => new Promise(ok => setTimeout(() => ok(v), 120));
    let onChange = null;
    return {
      live: false,
      // Deleting the account (Settings) removes this phone's family data too.
      async wipe() { d = { family: null, members: [], locations: [], checkins: [] }; save(); },
      load: () => wait(d.family ? { family: d.family, members: d.members, locations: d.locations.filter(l => (d.members.find(m => m.user_id === l.user_id) || {}).sharing), checkins: d.checkins, me: 'me' } : { family: null }),
      async create(name) {
        if (d.family) throw new Error('already in a family');
        d.family = { id: 'fam', name, code: 'K7M2QX', owner: 'me', created_at: ago(0) };
        d.members = [{ user_id: 'me', family_id: 'fam', name: BD.state.name, photo: BD.state.photo || null, role: 'owner', sharing: true, joined_at: ago(0) }];
        sample('fam'); save();
      },
      async join(code) {
        if (d.family) throw new Error('already in a family');
        if (code !== 'DEMO26') throw new Error('no family with that code');
        d.family = { id: 'fam', name: 'Santos family', code: 'DEMO26', owner: 'lola', created_at: ago(9000) };
        d.members = [{ user_id: 'me', family_id: 'fam', name: BD.state.name, photo: BD.state.photo || null, role: 'member', sharing: true, joined_at: ago(0) }];
        sample('fam'); d.members.find(m => m.user_id === 'lola').role = 'owner'; save();
      },
      async leave() { d.family = null; d.members = []; d.locations = []; d.checkins = []; save(); },
      async remove(id) { d.members = d.members.filter(m => m.user_id !== id); d.locations = d.locations.filter(l => l.user_id !== id); d.checkins = d.checkins.filter(c => c.user_id !== id); save(); },
      async updateMe() { const m = me(); if (m) { m.name = BD.state.name; m.photo = BD.state.photo || null; save(); } },
      async setSharing(on) { const m = me(); if (m) m.sharing = on; if (!on) d.locations = d.locations.filter(l => l.user_id !== 'me'); save(); },
      async push(fid, p) { d.locations = d.locations.filter(l => l.user_id !== 'me').concat({ user_id: 'me', family_id: fid, lat: p.lat, lng: p.lng, accuracy: p.accuracy, updated_at: ago(0) }); save(); },
      async checkIn(fid, status, p, event) { d.checkins = d.checkins.filter(c => c.user_id !== 'me').concat({ user_id: 'me', family_id: fid, status, event, lat: p ? p.lat : null, lng: p ? p.lng : null, created_at: ago(0) }); save(); },
      // Ask everyone to check in. In the demo, Kuya Jun and Lola Nena answer after a few seconds; Inday (paused) doesn't.
      async askAll() {
        if (d.family.check_at && Date.now() - new Date(d.family.check_at) < 10 * 60000) return;
        d.family.check_at = ago(0); d.family.check_by = 'me'; save();
        [['kuya', 'safe', 2500], ['lola', 'safe', 6000]].forEach(([id, st, ms]) => setTimeout(() => {
          const loc = d.locations.find(l => l.user_id === id) || {};
          d.checkins = d.checkins.filter(c => c.user_id !== id).concat({ user_id: id, family_id: d.family.id, status: st, event: 'request', lat: loc.lat, lng: loc.lng, created_at: ago(0) });
          save(); if (onChange) onChange();
        }, ms));
      },
      subscribe(fid, fn) { onChange = fn; return () => { onChange = null; }; }
    };
  }

  const api = !BD.account.available ? null : LIVE ? supabaseBackend() : demoBackend();
  BD.family = { available: !!api, live: LIVE };

  /* ---------- state ---------- */
  const F = { stage: 'idle', user: null, data: null, busy: false, err: '', unsub: null, timer: null, locErr: '', lastPush: 0 };
  BD.familyState = F;
  const rerender = () => { if (BD.ui.tab === 'pamilya' || BD.ui.tab === 'karon') BD.render(); };
  let reloadT = null;
  function reloadSoon() { clearTimeout(reloadT); reloadT = setTimeout(() => refresh().then(rerender), 400); }

  async function refresh() {
    // No backend (the app before Pamilya's server exists): show the intro. Leaving the stage on 'idle' made render() call refresh() forever and froze the app.
    if (!api) { F.stage = 'out'; return; }
    try {
      F.user = await BD.account.user();
      F.data = F.user ? await api.load() : null;
      F.stage = !F.user ? 'out' : F.data && F.data.family ? 'in' : 'nofamily';
      if (F.stage === 'in' && !F.unsub) F.unsub = api.subscribe(F.data.family.id, reloadSoon);
      if (F.stage !== 'in' && F.unsub) { F.unsub(); F.unsub = null; }
      F.err = '';
      const ask = askState();
      if (ask && !ask.byMe && !ask.mineDone && !BD.state.sent['ask:' + ask.at]) {
        BD.state.sent['ask:' + ask.at] = 1; BD.save();
        BD.notify({ kind: 'family', icon: 'users', title: (ask.by ? ask.by.name + ' · ' : '') + 'Family check-in', body: 'Asked everyone to check in. Tap I\'m safe or I need help so your family knows.', tab: 'pamilya' }, { force: true });
      }
    } catch (e) { F.err = nice(e); if (F.stage === 'idle') F.stage = 'out'; }
  }
  const mine = () => F.data && F.data.members ? F.data.members.find(m => m.user_id === F.data.me) : null;
  const ASK_FOR = 12 * 3600 * 1000, ASK_AGAIN = 10 * 60 * 1000;
  // An open "check in, everyone" request: who asked, when, and who has answered since.
  function askState() {
    const f = F.stage === 'in' && F.data.family;
    if (!f || !f.check_at || Date.now() - new Date(f.check_at) > ASK_FOR) return null;
    const at = new Date(f.check_at).getTime(), by = F.data.members.find(m => m.user_id === f.check_by);
    const answer = m => { const c = by_(F.data.checkins, m.user_id); return c && new Date(c.created_at).getTime() >= at - 1000 ? c : null; };
    const rows = F.data.members.map(m => ({ m, c: answer(m) }));
    return { at, by, byMe: f.check_by === F.data.me, rows, mineDone: !!answer(mine() || {}),
      safe: rows.filter(r => r.c && r.c.status === 'safe'), help: rows.filter(r => r.c && r.c.status === 'help'), wait: rows.filter(r => !r.c) };
  }
  BD.familyAsk = askState;

  // Share my position while the app is open (every few minutes and when you come back to the app).
  async function pushLocation(force) {
    const m = mine();
    if (F.stage !== 'in' || !m || !m.sharing || document.hidden) return;
    if (!force && Date.now() - F.lastPush < EVERY - 5000) return;
    try {
      const p = await BD.locate();
      F.lastPush = Date.now(); F.locErr = ''; F.here = p;
      await api.push(F.data.family.id, p);
      reloadSoon();
    } catch (e) { F.locErr = e.message === 'denied' ? 'denied' : 'failed'; if (BD.ui.tab === 'pamilya') BD.render(); }
  }
  function startLoop() {
    if (F.timer) return;
    F.timer = setInterval(() => pushLocation(false), 30 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pushLocation(true); });
  }

  /* ---------- helpers ---------- */
  function ago(ts) {
    const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 24 * 60 ? Math.round(m / 60) + ' h ago' : BD.timeLabel(new Date(ts));
  }
  const by = (list, id) => (list || []).find(x => x.user_id === id), by_ = (...a) => by(...a);
  function avatarOf(m, size) {
    return '<span class="fam-av" style="width:' + size + 'px;height:' + size + 'px">' + (m.photo ? '<img src="' + esc(m.photo) + '" alt="">' : '<span data-i18n-skip>' + esc((m.name.trim()[0] || '?').toUpperCase()) + '</span>') + '</span>';
  }
  // Status of one member for the list: safe / help / sharing / paused / location off.
  function statusOf(m) {
    const loc = by(F.data.locations, m.user_id), ci = by(F.data.checkins, m.user_id), fresh = ci && Date.now() - new Date(ci.created_at) < 24 * 3600 * 1000;
    if (fresh && ci.status === 'help') return { k: 'help', txt: 'Needs help · ' + ago(ci.created_at), loc: loc || (ci.lat != null ? ci : null) };
    if (!m.sharing) return { k: 'paused', txt: 'Paused location sharing', loc: null, safe: fresh && ci.status === 'safe' ? ci : null };
    if (!loc) return { k: 'off', txt: 'Location off or app not opened yet', loc: null, safe: fresh && ci.status === 'safe' ? ci : null };
    return { k: fresh && ci.status === 'safe' ? 'safe' : 'seen', txt: (fresh && ci.status === 'safe' ? 'Safe · ' + ago(ci.created_at) : 'Seen ' + ago(loc.updated_at)), loc };
  }

  /* ---------- disaster check (Marked Safe) ---------- */
  // A safety check is open while PAGASA's rainfall warning is Orange or Red, or the heat index reaches Danger.
  BD.safetyEvent = function () {
    const s = BD.state;
    if (s.season === 'rain' && (s.rainLevel === 'orange' || s.rainLevel === 'red')) return { id: BD.todayKey() + '-rain-' + s.rainLevel, label: BD.RAIN_LEVELS[s.rainLevel].name + ' rainfall warning' };
    if (s.season === 'heat') { const pk = BD.peakHeat(); if (Math.round(pk.hi) >= 42) return { id: BD.todayKey() + '-heat', label: BD.heatLevel(pk.hi).name + ' heat index' }; }
    return null;
  };
  BD.safetyCard = function (where) {
    const ev = BD.safetyEvent(), m = F.stage === 'in' ? by(F.data.checkins, F.data.me) : null;
    const done = m && Date.now() - new Date(m.created_at) < 12 * 3600 * 1000 ? m : null;
    const ask = askState(), asked = ask && !ask.byMe && !ask.mineDone ? ask : null;
    if (where === 'karon' && !ev && !asked) return '';
    const inPop = where === 'pop';
    return '<div class="' + (inPop ? 'pop-safe' : 'card safe-card' + (ev || asked ? ' alerting' : '')) + '"><div class="sc-top"><span class="q-ic c-red">' + I('shieldcheck', 20) + '</span><div class="q-body">' +
      '<span class="q-title">' + (ev || asked ? 'Are you safe?' : 'Check in with your family') + '</span>' +
      '<span class="q-meta">' + (asked ? '<span data-i18n-skip>' + esc(asked.by ? asked.by.name : '') + '</span> asked everyone to check in.' : ev ? esc(ev.label) + ' in Davao City. Let your family know.' : 'Tell your family you are OK, or that you need help.') + '</span></div></div>' +
      (done ? '<p class="safe-done ' + done.status + '">' + I(done.status === 'safe' ? 'check' : 'alert', 16) + (done.status === 'safe' ? 'You marked yourself safe ' : 'You asked for help ') + ago(done.created_at) + '.</p>' : '') +
      '<div class="safe-btns"><button class="btn btn-safe" data-action="markSafe" data-s="safe">' + I('check', 18) + 'I\'m safe</button>' +
      '<button class="btn btn-call" data-action="markSafe" data-s="help">' + I('alert', 18) + 'I need help</button></div>' +
      (F.stage === 'in' ? '' : '<p class="fine">' + I('info', 13) + 'Not in a family yet: this shares a message to any chat.</p>') + '</div>';
  };

  /* ---------- the tab ---------- */
  function head() {
    return '<div class="view-head"><h2>' + I('users', 22) + 'Pamilya</h2>' + (F.stage === 'in' ? '<span class="fam-name" data-i18n-skip>' + esc(F.data.family.name) + '</span>' : '') + '</div>';
  }
  function intro() {
    if (!api) return '<div class="card fam-hero"><span class="fam-ic">' + I('users', 30) + '</span><h3>Family Location is coming soon</h3><p>See your family on the map and mark yourselves safe during floods and heat.</p></div>';
    return '<div class="card fam-hero"><span class="fam-ic">' + I('users', 30) + '</span><h3>See your family on the map</h3>' +
      '<p>Share where you are with the family you invite, and mark yourselves safe during floods and heat.</p>' +
      '<ul class="fam-points"><li>' + I('lock', 16) + 'Only people you invite can see you.</li><li>' + I('locate', 16) + 'Shared only while BantayDavao is open.</li><li>' + I('x', 16) + 'Pause or leave anytime.</li></ul>' +
      '<p class="fine">' + I('info', 13) + 'No sign-in needed. You can link Google later in Settings to keep your family if you change phones.</p>' +
      (api.live ? '' : '<p class="fine">' + I('info', 13) + 'Demo: join code for the sample family: DEMO26.</p>') + '</div>';
  }
  function noFamily() {
    if (!api) return intro();
    return (F.user ? '' : intro()) + '<div class="card"><div class="card-head"><h3>' + I('plus', 18) + 'Start a family</h3></div>' +
      '<label class="fam-field"><span class="set-k">Family name</span><input class="set-input" id="famName" maxlength="40" placeholder="e.g. Santos family" autocomplete="off"></label>' +
      '<button class="btn btn-primary btn-block" data-action="famCreate"' + (F.busy ? ' disabled' : '') + '>Create family</button></div>' +
      '<div class="card"><div class="card-head"><h3>' + I('users', 18) + 'Join a family</h3></div>' +
      '<label class="fam-field"><span class="set-k">Invite code</span><input class="set-input fam-code-in" id="famCode" maxlength="6" placeholder="6 letters" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' +
      '<button class="btn btn-soft btn-block" data-action="famJoin"' + (F.busy ? ' disabled' : '') + '>Join</button></div>';
  }
  // Under the family: a nudge to link Google while the account is a guest.
  function account() {
    if (!F.user) return '';
    if (F.user.guest) return '<div class="card flat fam-keep"><div class="sc-top"><span class="q-ic c-sun">' + I('shieldcheck', 20) + '</span><div class="q-body">' +
      '<span class="q-title">Keep your family safe</span><span class="q-meta">You are using a guest account. Link Google so you can get your family back if you change or lose your phone.</span></div></div>' +
      '<button class="btn btn-soft btn-block" data-action="acctGoogle">' + I('user', 18) + 'Link Google</button></div>';
    return '<p class="fam-p center">' + I('check', 14) + 'Saved with Google · <span data-i18n-skip>' + esc(F.user.email || '') + '</span></p>';
  }
  function askCard() {
    const a = askState(), ev = BD.safetyEvent(), others = F.data.members.length - 1;
    if (others < 1) return '';
    if (!a) return '<div class="card flat ask-card"><div class="sc-top"><span class="q-ic c-sun">' + I('users', 20) + '</span><div class="q-body">' +
      '<span class="q-title">Ask everyone to check in</span><span class="q-meta">Everyone in the family gets asked to tap I\'m safe or I need help.</span></div></div>' +
      '<button class="btn ' + (ev ? 'btn-primary' : 'btn-soft') + ' btn-block" data-action="famAskAll"' + (F.busy ? ' disabled' : '') + '>' + I('bell', 18) + 'Ask everyone</button></div>';
    const who = r => '<span data-i18n-skip>' + esc(r.m.user_id === F.data.me ? BD.state.name : r.m.name) + '</span>';
    const again = Date.now() - a.at > ASK_AGAIN;
    const stat = (n, label, cls) => '<div class="ask-stat ' + cls + '"><b class="num">' + n + '</b><span>' + label + '</span></div>';
    return '<div class="card ask-card live"><div class="ask-head"><b>Family check-in</b><span class="ask-when">' + (a.byMe ? 'You asked ' : '<span data-i18n-skip>' + esc(a.by ? a.by.name : '') + '</span> asked ') + ago(new Date(a.at).toISOString()) + '</span></div>' +
      '<div class="ask-meter" aria-hidden="true">' + a.rows.map(r => '<i class="' + (r.c ? r.c.status : 'wait') + '"></i>').join('') + '</div>' +
      '<div class="ask-stats">' + stat(a.safe.length, 'Safe', 'ok') + stat(a.help.length, 'Need help', 'help') + stat(a.wait.length, 'Not yet', 'wait') + '</div>' +
      (a.help.length ? '<p class="ask-list help-t">' + I('alert', 14) + '<span>Needs help: ' + a.help.map(who).join(', ') + '</span></p>' : '') +
      (a.wait.length ? '<p class="ask-list">' + I('clock', 14) + '<span>Not yet: ' + a.wait.map(who).join(', ') + '</span></p>' : '<p class="ask-list ok-t">' + I('check', 14) + '<span>Everyone answered.</span></p>') +
      '<div class="backup-btns">' + (a.wait.length ? '<button class="btn btn-soft sm" data-action="famAskRemind">' + I('message', 16) + 'Remind in chat</button>' : '') +
      (again ? '<button class="btn btn-ghost sm" data-action="famAskAll">' + I('refresh', 16) + 'Ask again</button>' : '') + '</div></div>';
  }
  // In the threat pop-up: ask your family "Ligtas ka ba?". Inside a family it asks everyone in the app;
  // otherwise it shares the question to a chat, so you can send it to a family member in Messenger.
  BD.askFamilyRow = function () {
    const a = askState(), inFam = F.stage === 'in' && F.data.members.length > 1;
    if (inFam && a && a.byMe && Date.now() - a.at < ASK_AGAIN)
      return '<p class="pop-asked">' + I('check', 16) + '<span>You asked your family to check in. ' + a.safe.length + ' safe so far.</span></p>';
    return '<div class="pop-ask"><span class="q-meta">' + (inFam ? 'Ask your family if they are safe too.' : 'Ask a family member if they are safe.') + '</span>' +
      '<button class="btn btn-soft btn-block" data-action="' + (inFam ? 'famAskAll' : 'askByChat') + '">' + I(inFam ? 'users' : 'message', 18) + 'Ask: Are you safe?</button></div>';
  };
  function inFamily() {
    const d = F.data, me = mine(), others = d.members.filter(m => m.user_id !== d.me), owner = d.family.owner === d.me;
    const sharingWith = others.length;
    const list = [me].concat(others).filter(Boolean).map(m => {
      const st = statusOf(m), isMe = m.user_id === d.me, km = st.loc && F.here && !isMe ? BD.km(F.here, st.loc).toFixed(1) + ' km · ' : '';
      return '<div class="fam-row st-' + st.k + '">' + avatarOf(m, 44) +
        '<div class="q-body"><span class="q-title"><span data-i18n-skip>' + esc(m.name) + '</span>' + (isMe ? ' <span class="tag now">You</span>' : '') + (m.role === 'owner' ? ' <span class="tag">Owner</span>' : '') + '</span>' +
        '<span class="q-meta">' + km + st.txt + '</span></div>' +
        (st.loc && !isMe ? '<a class="btn btn-soft sm" href="https://www.google.com/maps/dir/?api=1&destination=' + st.loc.lat + ',' + st.loc.lng + '" target="_blank" rel="noopener" aria-label="Directions">' + I('nav', 16) + '</a>' : '') +
        (owner && !isMe ? '<button class="icon-btn" data-action="famRemove" data-id="' + esc(m.user_id) + '" aria-label="Remove from family">' + I('x', 16) + '</button>' : '') + '</div>';
    }).join('');
    const loc = F.locErr === 'denied' ? '<div class="flood-alert">' + I('locate', 20) + '<div><b>Location is off</b><span>Turn on location for BantayDavao in your phone settings so your family can see you.</span></div></div>'
      : F.locErr ? '<p class="fine">' + I('info', 13) + 'Could not get your location. It will try again.</p>' : '';
    return BD.safetyCard('pamilya') + askCard() +
      '<div class="card map-card"><div id="fam-map" class="map-slot fam-map"></div></div>' + loc +
      '<div class="sec-head"><h2>Family</h2><span class="sum">' + d.members.length + ' people</span></div><div class="card fam-list">' + list + '</div>' +
      '<div class="card flat">' + BD.toggleRowRaw('famSharing', 'Share my location', me && me.sharing ? 'With ' + sharingWith + ' family members, only while BantayDavao is open' : 'Paused. Your family sees "Paused".', 'locate', me && me.sharing) + '</div>' +
      '<div class="card fam-invite"><div class="card-head"><h3>' + I('plus', 18) + 'Invite family</h3></div>' +
      '<p class="fine">They install BantayDavao, open Pamilya and enter this code:</p>' +
      '<div class="fam-code" data-i18n-skip aria-label="Invite code">' + esc(d.family.code) + '</div>' +
      '<button class="btn btn-primary btn-block" data-action="famInvite">' + I('share', 18) + 'Share invite</button></div>' +
      '<div class="fam-foot"><button class="link-btn" data-action="famLeave">' + (F.confirm === 'leave' ? 'Tap again to leave the family' : 'Leave family') + '</button></div>' + account();
  }

  BD.tabs = BD.tabs || {};
  BD.tabs.pamilya = {
    render() {
      if (F.stage === 'idle') { refresh().then(rerender); return head() + '<div class="card"><div class="dd-empty">Loading…</div></div>'; }
      return head() + (F.err ? '<p class="fam-err">' + I('alert', 16) + esc(F.err) + '</p>' : '') +
        (F.stage === 'in' ? inFamily() : noFamily()) + '<div class="spacer"></div>';
    },
    enter() { refresh().then(() => { rerender(); pushLocation(true); }); },
    after() { if (F.stage === 'in') drawMap(); }
  };

  /* ---------- family map ---------- */
  let fm = null, fmEl = null, pins = [], fitted = false;
  async function drawMap() {
    const slot = document.getElementById('fam-map');
    if (!slot || !BD.mapKit) return;
    if (!fmEl) {
      fmEl = document.createElement('div'); fmEl.className = 'glmap';
      try { fm = await BD.mapKit.create(fmEl); } catch (e) { slot.innerHTML = '<div class="map-notice">' + I('map', 26) + '<b>Map unavailable</b></div>'; fmEl = null; return; }
    }
    const s2 = document.getElementById('fam-map');
    if (!s2) return;
    s2.innerHTML = ''; s2.appendChild(fmEl); fm.resize();
    const place = () => {
      pins.forEach(p => p.remove()); pins = [];
      const b = BD.mapKit.bounds(); let n = 0;
      F.data.members.forEach(m => {
        const st = statusOf(m); if (!st.loc) return;
        const el = document.createElement('div'); el.className = 'fam-pin st-' + st.k; el.innerHTML = '<i class="mk-grow">' + avatarOf(m, 36) + '</i>';
        el.title = m.name;
        pins.push(BD.mapKit.marker(el, [st.loc.lng, st.loc.lat], 'center').addTo(fm)); b.extend([st.loc.lng, st.loc.lat]); n++;
      });
      if (n && !fitted) { fm.fitBounds(b, { padding: 50, maxZoom: 14, duration: 0 }); fitted = true; }
    };
    if (fm.loaded()) place(); else fm.once('load', place);
  }

  /* ---------- actions ---------- */
  async function busy(fn) {
    F.busy = true; F.err = ''; BD.render();
    let err = '';
    try { await fn(); } catch (e) { err = nice(e); }
    F.busy = false; await refresh(); if (err) F.err = err; BD.render();
  }
  Object.assign(BD.actions = BD.actions || {}, {
    famCreate() {
      const n = (document.getElementById('famName').value || '').trim();
      if (!n) { F.err = 'Give your family a name.'; BD.render(); return; }
      busy(async () => { await BD.account.ensure(); await api.create(n.slice(0, 40)); }).then(() => pushLocation(true));
    },
    famJoin() {
      const c = (document.getElementById('famCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (c.length !== 6) { F.err = 'The invite code has 6 letters.'; BD.render(); return; }
      busy(async () => { await BD.account.ensure(); await api.join(c); }).then(() => pushLocation(true));
    },
    famLeave() {
      if (F.confirm !== 'leave') { F.confirm = 'leave'; BD.render(); setTimeout(() => { F.confirm = null; }, 4000); return; }
      F.confirm = null; fitted = false; busy(() => api.leave());
    },
    famRemove(el) { busy(() => api.remove(el.dataset.id)); },
    famSharing() { const m = mine(); busy(() => api.setSharing(!(m && m.sharing))).then(() => pushLocation(true)); },
    famAskAll() {
      busy(() => api.askAll()).then(() => {
        BD.toast(I('bell', 16) + 'Everyone was asked to check in.');
        if (document.getElementById('modal').classList.contains('alert-open')) BD.actions.openAlert();   // refresh the pop-up
      });
    },
    askByChat() {
      const ev = BD.safetyEvent(), t = BD.topThreat();
      const msg = BD.tr('Are you safe?') + ' ' + BD.tr(ev ? ev.label + ' in Davao City.' : BD.SEV[t.sev] + ' · ' + t.name) + '\n' +
        BD.tr('Reply to let me know, or open BantayDavao and tap "I\'m safe".') + '\n— ' + BD.state.name + ', via BantayDavao\n' + BD.tr('Get BantayDavao free') + ': ' + BD.PLAY_URL;
      BD.shareOut([], msg, BD.tr('Are you safe?')).catch(() => BD.toast(I('info', 16) + 'Could not share. Try again.'));
    },
    famAskRemind() {
      const a = askState(); if (!a) return;
      BD.shareOut([], BD.tr('Please open BantayDavao and tap "I\'m safe" or "I need help" so the family knows you are OK.') + '\n' + a.wait.map(r => r.m.name).join(', ') + '\n' + BD.tr('Get BantayDavao free') + ': ' + BD.PLAY_URL, BD.tr('Family check-in'))
        .catch(() => BD.toast(I('info', 16) + 'Could not share. Try again.'));
    },
    famInvite() {
      const d = F.data;
      BD.shareOut([], BD.tr('Join our family on BantayDavao so we can see each other on the map and check in during floods and heat.') + '\n' + BD.tr('Invite code') + ': ' + d.family.code + '\n' + BD.tr('Get BantayDavao free') + ': ' + BD.PLAY_URL, BD.tr('Invite to BantayDavao'))
        .catch(() => BD.toast(I('info', 16) + 'Invite code: ' + d.family.code));
    },
    // I'm safe / I need help: to the family when you're in one, otherwise as a message to any chat.
    async markSafe(el) {
      const status = el.dataset.s, ev = BD.safetyEvent(), id = ev ? ev.id : 'manual';
      let p = null; try { p = await BD.locate(); } catch (e) { }
      const first = !BD.today().xpSafe;
      if (F.stage === 'in') {
        try { await api.checkIn(F.data.family.id, status, p, id); } catch (e) { BD.toast(I('alert', 16) + nice(e)); return; }
        await refresh();
      } else {
        const where = p ? '\nhttps://www.google.com/maps?q=' + p.lat.toFixed(5) + ',' + p.lng.toFixed(5) : '';
        const msg = (status === 'safe' ? '✅ I\'m safe.' : '🆘 I need help.') + ' · ' + BD.timeLabel(BD.now()) + (ev ? ' · ' + ev.label : '') + where + '\n— ' + BD.state.name + ', via BantayDavao';
        try { if (!(await BD.shareOut([], BD.tr(msg)))) return; } catch (e) { BD.toast(I('alert', 16) + 'Could not share. Try again.'); return; }
      }
      if (document.getElementById('modal').classList.contains('alert-open')) BD.actions.closeAlert();
      if (status === 'help') BD.vibrate([80, 40, 80]);
      if (status === 'safe' && first) BD.commit(() => { BD.today().xpSafe = 15; }, el);
      else BD.render();
      BD.toast(I(status === 'safe' ? 'check' : 'alert', 16) + (status === 'safe' ? 'Marked safe. Salamat, bantay!' : 'Help request sent. If it is an emergency, call 911.'));
    }
  });
  // Keep the family copy of your name and photo current after you edit your profile.
  BD.familyProfileChanged = () => { if (F.stage === 'in') api.updateMe().catch(() => { }); };

  // Start quietly: restore a signed-in session and begin sharing if you're in a family.
  // Called by js/account.js after signing in or out, linking Google or deleting the account.
  BD.familyAccountChanged = async function (deleted) {
    if (!api) return;
    if (deleted && api.wipe) await api.wipe();
    fitted = false; await refresh();
    if (F.stage === 'in') pushLocation(true);
  };
  BD.familyBoot = function () {
    if (!api) return;
    refresh().then(() => { if (F.stage === 'in') { startLoop(); pushLocation(true); } if (BD.ui.tab === 'karon') BD.render(); });
    startLoop();
  };
})(window.BD);
