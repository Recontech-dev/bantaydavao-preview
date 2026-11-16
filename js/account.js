/* Accounts. With a server set up (js/config.js) people sign in before they use the app: Google, Facebook or
   email and password. Without an account only Peligro and Tabang (warnings, hotlines, first aid) open.
   Once signed in, the session stays on the phone, so the app keeps working offline.
   The notes below describe the older optional-account flow, still used by the web demo and the tests.
   - BantayDavao works fully without one there.
   - Guest account: made automatically the first time you create or join a family, so Pamilya needs no sign-in.
   - Link Google (Settings -> Account): for safety. Your XP, streaks, profile and settings get a cloud copy, and
     signing in with Google on a new phone brings them back, together with your family.
   - A guest account lives only on this phone: deleting the app or losing the phone loses it, so the app suggests
     linking Google once you are in a family.
   Two backends share one interface: Supabase (js/config.js) and a local stand-in for the web demo and tests.
   Schema: supabase/migrations/0001_family.sql and 0002_accounts.sql */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;
  const C = BD.CONFIG || {};
  // Tests and the presenter demo (window.BD_TEST) stay on the local stand-in unless they ask for the real server.
  const T = window.BD_TEST || null;
  const LIVE = !!(C.supabaseUrl && C.supabaseKey) && !(T && !T.live);
  // The sign-in gate: on whenever the real server is used (tests can switch it on over the stand-in).
  const GATE = LIVE || !!(T && T.gate);
  const toUser = u => (u ? { id: u.id, email: u.email || null, guest: !!u.is_anonymous } : null);
  const APP_LINK = 'ph.recontech.bantaydavao://auth';   // must be in Supabase's Redirect URLs and in AndroidManifest.xml
  const TAKEN = /already|exists|linked to another/i;   // this Google account already has a BantayDavao account

  /* ---------- Supabase backend ---------- */
  function supabaseBackend() {
    let sb = null;
    const script = src => new Promise((ok, no) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = no; document.head.appendChild(e); });
    async function client() {
      if (sb) return sb;
      if (!window.supabase) await script('vendor/supabase/supabase.js');
      sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, detectSessionInUrl: !BD.native, flowType: 'pkce' } });
      return sb;
    }
    const must = r => { if (r.error) throw r.error; return r.data; };
    const social = () => (BD.native && window.Capacitor.Plugins.SocialLogin) || null;
    const back = () => location.origin + location.pathname;
    async function idToken() {
      const SL = social();
      const ios = window.Capacitor.getPlatform() === 'ios';
      await SL.initialize({ google: ios
        ? { iOSClientId: C.googleIosClientId, iOSServerClientId: C.googleWebClientId }
        : { webClientId: C.googleWebClientId } });
      return (await SL.login({ provider: 'google', options: { scopes: ['email', 'profile'] } })).result.idToken;
    }
    return {
      live: true, client,
      async user() { const s = must(await (await client()).auth.getSession()).session; return toUser(s && s.user); },
      async guest() { must(await (await client()).auth.signInAnonymously()); },
      // Email and password. signUp resolves false when the person must confirm their email first.
      async emailIn(email, password) { must(await (await client()).auth.signInWithPassword({ email, password })); },
      async emailUp(email, password) {
        const d = must(await (await client()).auth.signUp({ email, password, options: { emailRedirectTo: back() } }));
        // Supabase answers a sign-up for an existing email with a user that has no identities.
        if (d.user && d.user.identities && !d.user.identities.length) throw new Error('email-taken');
        return !!d.session;
      },
      // Google or Facebook through the browser. The first time, this also creates the account.
      // On the web the page goes to the provider and comes back. In the Android app the phone's browser opens
      // and returns through the app link (APP_LINK), where finish() turns the code into a session.
      async oauth(provider) {
        const c = await client();
        if (!BD.native) { must(await c.auth.signInWithOAuth({ provider, options: { redirectTo: back() } })); return; }
        const d = must(await c.auth.signInWithOAuth({ provider, options: { redirectTo: APP_LINK, skipBrowserRedirect: true } }));
        location.href = d.url;   // not an app address, so Capacitor hands it to the phone's browser
      },
      async finish(url) {
        const q = new URL(url).searchParams, code = q.get('code');
        if (!code) throw new Error(q.get('error_description') || q.get('error') || 'no code');
        must(await (await client()).auth.exchangeCodeForSession(code));
      },
      // Which sign-in methods the server has switched on.
      async providers() {
        const r = await fetch(C.supabaseUrl + '/auth/v1/settings', { headers: { apikey: C.supabaseKey } });
        const x = (await r.json()).external || {};
        return { email: !!x.email, google: !!x.google, facebook: !!x.facebook };
      },
      // Sign in with Google, or link Google to the guest account on this phone.
      async google() {
        const c = await client(), s = must(await c.auth.getSession()).session, guest = !!(s && s.user.is_anonymous);
        if (social()) {
          const token = await idToken();
          if (guest) { const r = await c.auth.linkIdentity({ provider: 'google', token }); if (r.error) throw TAKEN.test(r.error.message || r.error.code || '') ? new Error('google-taken') : r.error; }
          else must(await c.auth.signInWithIdToken({ provider: 'google', token }));
        } else if (guest) must(await c.auth.linkIdentity({ provider: 'google', options: { redirectTo: back() } }));
        else must(await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back() } }));
      },
      // This Google account already has BantayDavao: delete the guest account here, then sign in to the Google one.
      async switchToGoogle() {
        const c = await client();
        must(await c.rpc('delete_my_account')); await c.auth.signOut();
        await this.google();
      },
      async signOut() { const SL = social(); if (SL) await SL.logout({ provider: 'google' }).catch(() => { }); await (await client()).auth.signOut(); },
      async remove() { must(await (await client()).rpc('delete_my_account')); await this.signOut(); },
      async pull() { return must(await (await client()).from('saves').select('data, level, updated_at').maybeSingle()); },
      async push(uid, data, level) { must(await (await client()).from('saves').upsert({ user_id: uid, data, level, updated_at: new Date().toISOString() })); }
    };
  }

  /* ---------- demo backend (local only) ---------- */
  function demoBackend() {
    const KEY = 'bantaydavao-account-demo';
    let d; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    d = d || { user: null, save: null };
    const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { } };
    const wait = v => new Promise(ok => setTimeout(() => ok(v), 120));
    return {
      live: false,
      user: () => wait(d.user && Object.assign({}, d.user)),
      async guest() { d.user = { id: 'me', email: null, guest: true }; keep(); },
      async google() { d.user = { id: 'me', email: 'you@gmail.com', guest: false }; keep(); },
      async oauth(provider) { d.user = { id: 'me', email: 'you@' + (provider === 'google' ? 'gmail' : provider) + '.com', guest: false }; keep(); },
      async emailIn(email, password) { if (password === 'wrong-password') throw new Error('Invalid login credentials'); d.user = { id: 'me', email, guest: false }; keep(); },
      async emailUp(email) { if (email === 'taken@example.com') throw new Error('email-taken'); if (email === 'confirm@example.com') return false; d.user = { id: 'me', email, guest: false }; keep(); return true; },
      providers: async () => ({ email: true, google: true, facebook: true }),
      async switchToGoogle() { return this.google(); },
      async signOut() { d.user = null; keep(); },
      async remove() { d = { user: null, save: null }; keep(); },
      pull: () => wait(d.save && JSON.parse(JSON.stringify(d.save))),
      async push(uid, data, level) { d.save = { data, level, updated_at: new Date().toISOString() }; keep(); }
    };
  }

  const api = LIVE ? supabaseBackend() : BD.demo ? demoBackend() : null;
  const A = { user: null, busy: false, err: '', taken: false, offer: null, savedAt: null, confirm: null, ready: false,
    auth: { mode: 'in', email: '', msg: '', ok: '', form: false } };
  BD.accountState = A;

  BD.account = {
    available: !!api,
    live: LIVE,
    client: () => api && api.client ? api.client() : Promise.reject(new Error('no backend')),
    // Offline, an expired session cannot be renewed and reads as signed out. The person last seen on this phone is
    // kept in that case, so the app stays usable without a connection.
    async user() {
      if (!api) return null;
      let u = null, failed = false;
      try { u = await api.user(); } catch (e) { failed = true; }
      if (!u && GATE && (failed || navigator.onLine === false)) { try { u = JSON.parse(localStorage.getItem('bd-last-user') || 'null'); } catch (e) { u = null; } }
      A.user = u; A.ready = true; return A.user;
    },
    uid: () => (A.user ? A.user.id : null),
    // Pamilya calls this before creating or joining a family: makes a guest account when there is none.
    async ensure() { if (!(await this.user())) { await api.guest(); await this.user(); } return A.user; },
    linked: () => !!(A.user && !A.user.guest),
    gate: GATE
  };

  /* ---------- the sign-in gate ---------- */
  const HINT = 'bd-signed-in', PROV = 'bd-auth-providers', PENDING = 'bd-auth-pending';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } };
  let providers = { email: true, google: false, facebook: false };
  try { providers = Object.assign(providers, JSON.parse(get(PROV) || '{}')); } catch (e) { }
  // Tabs anyone can open. Everything else needs an account.
  // A guest (not signed in) gets the information only: warnings, the map and hotlines with first aid.
  // No quests, XP, badges, Pamilya or profile, and nothing a guest does is saved.
  BD.OPEN_TABS = ['peligro', 'mapa', 'tabang'];
  // True while the app must show the sign-in screen. Before the saved session has been read, the last known
  // answer is used, so a signed-in person never sees the sign-in screen flash by on start (also offline).
  BD.locked = () => GATE && (A.ready ? !BD.account.linked() : get(HINT) !== '1');
  BD.lockedTab = tab => BD.locked() && BD.OPEN_TABS.indexOf(tab) < 0;
  const remember = () => { const on = BD.account.linked(); put(HINT, on ? '1' : null); put('bd-last-user', on ? JSON.stringify(A.user) : null); };

  const G_MARK = '<svg class="auth-mark" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const F_MARK = '<svg class="auth-mark" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.8-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.52c-1.49 0-1.95.93-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12z"/></svg>';
  // The login screen: shown first, full screen (no top bar, no bottom bar). Google and Facebook come first; one tap
  // signs in and, the first time, makes the account. Email and password open only when asked for.
  // "Continue as guest" at the bottom opens the information-only part of the app.
  BD.authScreen = function () {
    const x = A.auth, up = x.mode === 'up', b = A.busy ? ' disabled' : '';
    // Email is a fold: closed it is one quiet row, open it drops down the two fields.
    const fold = '<button class="auth-fold' + (x.form ? ' open' : '') + '" data-action="authForm" aria-expanded="' + !!x.form + '" aria-controls="auth-form">Or use your email?' + I('chevdown', 18) + '</button>';
    const form = !x.form ? '' : '<div class="auth-form" id="auth-form"><div class="mini-seg auth-mode" role="group" aria-label="Sign in or create account">' +
        '<button class="' + (up ? '' : 'on') + '" data-action="authMode" data-m="in" aria-pressed="' + !up + '">I have an account</button>' +
        '<button class="' + (up ? 'on' : '') + '" data-action="authMode" data-m="up" aria-pressed="' + up + '">I\'m new here</button></div>' +
        '<label class="fam-field"><span class="set-k">Email</span><input class="set-input auth-input" id="authEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="none" maxlength="120" value="' + esc(x.email) + '"></label>' +
        '<label class="fam-field"><span class="set-k">' + (up ? 'Password, at least 8 characters' : 'Password') + '</span><input class="set-input auth-input" id="authPw" type="password" autocomplete="' + (up ? 'new-password' : 'current-password') + '" maxlength="72"></label>' +
        '<button class="btn btn-primary btn-block" data-action="authEmail"' + b + '>' + (up ? 'Create account' : 'Sign in') + '</button></div>';
    return '<div class="auth"><div class="auth-hero"><span class="auth-logo">' + BD.logo('mark') + '</span>' +
      '<h2>Welcome to BantayDavao</h2><p>Sign in to use quests, the map, Pamilya and to keep your progress.</p></div>' +
      '<div class="auth-panel">' +
      '<button class="auth-btn auth-google" data-action="authGoogle"' + b + '>' + G_MARK + 'Continue with Google</button>' +
      // Facebook is greyed out with a "Soon" tag until it is switched on in Supabase (docs/FAMILY_SETUP.md).
      '<button class="auth-btn auth-fb' + (providers.facebook ? '' : ' off') + '" data-action="authFacebook"' + (providers.facebook ? b : ' disabled') + '>' + F_MARK + 'Continue with Facebook' + (providers.facebook ? '' : '<span class="auth-soon">Soon</span>') + '</button>' +
      '<p class="auth-fine">New here? Your account is made the first time you continue.</p>' +
      (x.msg ? '<p class="fam-err" role="alert">' + I('alert', 16) + esc(x.msg) + '</p>' : '') +
      (x.ok ? '<p class="auth-ok" role="status">' + I('check', 16) + esc(x.ok) + '</p>' : '') +
      fold + form + '</div>' +
      '<div class="auth-sos"><button class="auth-link" data-action="go" data-tab="peligro">' + I('user', 18) + 'Continue as guest</button>' +
      '<p>Guests see warnings, the map and hotlines. Nothing is saved.</p></div>' +
      '<div class="mini-seg theme-seg auth-lang" role="group" aria-label="Language" data-i18n-skip>' +
      BD.LANGS.map(l => '<button class="' + (BD.lang() === l[0] ? 'on' : '') + '" data-action="setLang" data-l="' + l[0] + '" aria-pressed="' + (BD.lang() === l[0]) + '" lang="' + l[0] + '">' + l[1] + '</button>').join('') + '</div></div>';
  };
  const AUTH_ERR = e => {
    const m = String((e && (e.message || e.code)) || '');
    if (m === 'email-taken' || /already registered|already been registered/i.test(m)) return 'This email already has an account. Sign in instead.';
    if (/invalid login|invalid_credentials/i.test(m)) return 'Wrong email or password.';
    if (/not confirmed/i.test(m)) return 'Check your email and tap the link to confirm your account, then sign in here.';
    if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a few minutes and try again.';
    if (/password/i.test(m)) return 'Use a password with at least 8 characters.';
    if (/email/i.test(m) && /invalid|valid/i.test(m)) return 'Enter your email and a password.';
    return 'Something went wrong. Check your connection and try again.';
  };
  function social(provider, notReady) {
    // A provider the server has not switched on would only show an error page in the browser.
    if (!providers[provider]) { A.auth.ok = ''; A.auth.msg = notReady; BD.render(); return; }
    put(PENDING, '1');
    // Google in the app uses the phone's own account picker when its client ID is set; otherwise the browser.
    const picker = provider === 'google' && BD.native && C.googleWebClientId;
    signIn(async () => { if (picker) { await api.google(); return true; } await api.oauth(provider); return BD.account.live ? false : true; });
  }
  // Runs one sign-in attempt and shows what happened on the sign-in screen.
  async function signIn(fn) {
    const x = A.auth; x.msg = ''; x.ok = ''; A.busy = true; BD.render();
    let done = false;
    try { done = (await fn()) !== false; } catch (e) { if (!/cancel/i.test((e && e.message) || '')) x.msg = AUTH_ERR(e); }
    try { await BD.account.user(); } catch (e) { }
    A.busy = false; remember();
    if (done && BD.account.linked()) {
      put(PENDING, null); x.email = ''; x.form = false;
      await checkSaved();
      if (BD.familyAccountChanged) await BD.familyAccountChanged(false);
      BD.toast(I('check', 16) + 'Signed in. Maayong pag-abot!');
    }
    BD.render();
  }

  /* ---------- cloud save (linked accounts only) ---------- */
  const snapshot = () => { const s = JSON.parse(JSON.stringify(BD.state)); delete s.notifs; delete s.simHour; return s; };
  let dirty = false, pushT = null;
  async function upload() {
    clearTimeout(pushT); pushT = null;
    if (!api || !BD.account.linked() || A.offer) return;
    try { await api.push(A.user.id, snapshot(), BD.levelOf(BD.totalXP()).level); dirty = false; A.savedAt = new Date(); }
    catch (e) { /* offline: try again on the next change or when the app goes to the background */ }
  }
  const save = BD.save;
  BD.save = function () {
    const ok = save.apply(this, arguments);
    if (BD.account.linked() && !A.offer) { dirty = true; if (!pushT) pushT = setTimeout(upload, 20000); }
    return ok;
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) upload(); });

  // After signing in with Google: bring back saved progress. A phone with no progress of its own restores
  // right away; otherwise Settings asks which one to keep.
  async function checkSaved() {
    if (!BD.account.linked()) return;
    let r = null; try { r = await api.pull(); } catch (e) { return; }
    if (!r || !r.data) { upload(); return; }
    A.savedAt = new Date(r.updated_at);
    const fresh = BD.totalXP() <= 0 && !Object.keys(BD.state.days || {}).some(k => BD.state.days[k] && Object.keys(BD.state.days[k].q || {}).length);
    if (fresh) { restore(r); BD.toast(I('check', 16) + 'Your saved progress is back. Padayon!'); }
    else if (JSON.stringify(r.data.days || {}) !== JSON.stringify(BD.state.days || {})) A.offer = r;
  }
  function restore(r) {
    const keepLocal = { theme: BD.state.theme, lang: BD.state.lang };
    BD.replaceState(Object.assign(JSON.parse(JSON.stringify(r.data)), keepLocal, { notifs: BD.state.notifs }));
    A.offer = null; A.savedAt = new Date(r.updated_at);
    if (BD.applyTheme) BD.applyTheme();
    if (BD.familyProfileChanged) BD.familyProfileChanged();
  }

  /* ---------- actions ---------- */
  async function busy(fn, deleting) {
    A.busy = true; A.err = ''; BD.render();
    let ok = true;
    try { await fn(); } catch (e) {
      ok = false;
      if (e && e.message === 'google-taken') A.taken = true;
      else if (!/cancel/i.test((e && e.message) || '')) A.err = 'Something went wrong. Check your connection and try again.';
    }
    A.busy = false; await BD.account.user(); remember();
    if (BD.familyAccountChanged) await BD.familyAccountChanged(deleting && ok);
    // Signed out or deleted while the gate is on: back to the sign-in screen, with the Settings page closed.
    if (BD.locked() && BD.ui.center) BD.actions.closeCenter();
    BD.render();
  }
  Object.assign(BD.actions = BD.actions || {}, {
    authMode(el) { const e = document.getElementById('authEmail'); A.auth.email = e ? e.value.trim() : A.auth.email; A.auth.mode = el.dataset.m; A.auth.msg = ''; A.auth.ok = ''; BD.render(); },
    authEmail() {
      const x = A.auth, email = (document.getElementById('authEmail').value || '').trim(), pw = document.getElementById('authPw').value || '';
      x.email = email; x.ok = '';
      if (!/^\S+@\S+\.\S+$/.test(email) || !pw) { x.msg = 'Enter your email and a password.'; BD.render(); return; }
      if (x.mode === 'up' && pw.length < 8) { x.msg = 'Use a password with at least 8 characters.'; BD.render(); return; }
      signIn(async () => {
        if (x.mode === 'in') { await api.emailIn(email, pw); return true; }
        if (await api.emailUp(email, pw)) return true;
        x.mode = 'in'; x.ok = 'Check your email and tap the link to confirm your account, then sign in here.';
        return false;
      });
    },
    authForm() { A.auth.form = !A.auth.form; A.auth.msg = ''; BD.render(); const e = document.getElementById('authEmail'); if (e) e.focus(); },
    // Google and Facebook leave the app to sign in; the pending mark makes the return finish the job.
    authGoogle() { social('google', 'Google sign-in is not turned on yet. Use email for now.'); },
    authFacebook() { social('facebook', 'Facebook sign-in is not turned on yet. Use email for now.'); },
    acctGoogle() { busy(async () => { await api.google(); await BD.account.user(); A.taken = false; await checkSaved(); if (BD.account.linked()) BD.toast(I('check', 16) + 'Saved with Google.'); }); },
    acctSwitch() { busy(async () => { await api.switchToGoogle(); await BD.account.user(); A.taken = false; await checkSaved(); }); },
    acctCancel() { A.taken = false; BD.render(); },
    acctSignOut() { busy(async () => { if (dirty) await upload(); await api.signOut(); A.savedAt = null; A.offer = null; }); },
    acctDelete() {
      if (A.confirm !== 'delete') { A.confirm = 'delete'; BD.render(); setTimeout(() => { A.confirm = null; }, 4000); return; }
      A.confirm = null;
      busy(async () => { await api.remove(); A.savedAt = null; A.offer = null; }, true).then(() => BD.toast(I('check', 16) + 'Your account was deleted. Your progress stays on this phone.'));
    },
    acctUseSaved() { if (A.offer) { restore(A.offer); BD.toast(I('check', 16) + 'Saved progress restored.'); BD.render(); } },
    acctKeepPhone() { A.offer = null; upload().then(() => BD.render()); }
  });

  /* ---------- Settings: Account card ---------- */
  function when(d) { return d ? BD.timeLabel(d) + (BD.dateKey(d) === BD.todayKey() ? '' : ', ' + BD.MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate()) : ''; }
  BD.accountSettings = function () {
    if (!api) return '';
    const u = A.user, b = A.busy ? ' disabled' : '';
    let body;
    if (A.taken) {
      body = '<p class="fam-p"><b>This Google account already has BantayDavao.</b> Switch to it? The guest account on this phone will be deleted, including its place in a family.</p>' +
        '<div class="backup-btns"><button class="btn btn-primary sm" data-action="acctSwitch"' + b + '>' + I('user', 16) + 'Switch account</button>' +
        '<button class="btn btn-soft sm" data-action="acctCancel">Cancel</button></div>';
    } else if (!u) {
      body = '<p class="fam-p">You are using BantayDavao without an account. Everything works.</p>' +
        '<button class="btn btn-primary sm acct-google" data-action="acctGoogle"' + b + '>' + I('user', 16) + 'Save progress with Google</button>' +
        '<p class="fine">' + I('shieldcheck', 13) + 'Optional. Keeps a copy of your XP, streaks and profile, and brings back your family if you change phones.</p>';
    } else if (u.guest) {
      body = '<p class="fam-p"><b>Guest account</b> · used for Pamilya.</p>' +
        '<p class="fine">' + I('alert', 13) + 'A guest account stays only on this phone. If you delete the app or lose your phone, it can\'t be recovered. Link Google to keep it safe.</p>' +
        '<div class="backup-btns"><button class="btn btn-primary sm" data-action="acctGoogle"' + b + '>' + I('user', 16) + 'Link Google</button>' +
        '<button class="btn btn-ghost sm danger-txt" data-action="acctDelete"' + b + '>' + I('x', 16) + (A.confirm === 'delete' ? 'Tap again to delete' : 'Delete account') + '</button></div>';
    } else {
      body = '<p class="fam-p">' + (GATE ? 'Signed in' : 'Saved with Google') + ' · <b data-i18n-skip>' + esc(u.email || '') + '</b></p>' +
        (A.offer ? '<div class="acct-offer"><p class="fam-p"><b>Saved progress found</b> · Level ' + (A.offer.level || 1) + ', ' + when(new Date(A.offer.updated_at)) + '</p>' +
          '<div class="backup-btns"><button class="btn btn-primary sm" data-action="acctUseSaved">Use saved</button><button class="btn btn-soft sm" data-action="acctKeepPhone">Keep this phone\'s</button></div></div>'
          : '<p class="fine">' + I('check', 13) + (A.savedAt ? 'Progress saved ' + when(A.savedAt) + '.' : 'Your progress is saved to your account.') + '</p>') +
        '<div class="backup-btns"><button class="btn btn-soft sm" data-action="acctSignOut"' + b + '>' + I('back', 16) + 'Sign out</button>' +
        '<button class="btn btn-ghost sm danger-txt" data-action="acctDelete"' + b + '>' + I('x', 16) + (A.confirm === 'delete' ? 'Tap again to delete' : 'Delete account') + '</button></div>';
    }
    return '<h4>Account</h4><div class="card flat fam-acct">' + body +
      (A.err ? '<p class="fam-err">' + I('alert', 16) + esc(A.err) + '</p>' : '') +
      (u ? '<p class="fine">' + I('info', 13) + 'Deleting removes your account, your cloud save, your place in a family, your shared location and check-ins. Your progress stays on this phone.</p>' : '') +
      (api.live ? '' : '<p class="fine">' + I('info', 13) + 'Demo: no real Google account is used.</p>') + '</div>';
  };

  // Start quietly: restore a session and, for a linked account, check the cloud save.
  BD.accountBoot = async function () {
    if (!api) return;
    if (!BD.native && /error_code=identity_already_exists/.test(location.hash + location.search)) { A.taken = true; history.replaceState(history.state, '', location.pathname); }
    const App = BD.native && window.Capacitor.Plugins.App;
    if (App && api.finish) App.addListener('appUrlOpen', ev => {
      if (!ev || String(ev.url).indexOf(APP_LINK) !== 0) return;
      signIn(async () => { await api.finish(ev.url); return true; });
    });
    if (GATE && api.providers) api.providers().then(p => { providers = p; put(PROV, JSON.stringify(p)); if (BD.locked()) BD.render(); }, () => { });
    try {
      await BD.account.user(); remember();
      // Back from Google or Facebook in the browser: finish like any other sign-in (saved progress, welcome).
      if (get(PENDING)) { put(PENDING, null); if (BD.account.linked()) { await checkSaved(); BD.toast(I('check', 16) + 'Signed in. Maayong pag-abot!'); return; } }
      // Already signed in on this phone: this phone's progress is the current one, so just show when it was saved.
      if (BD.account.linked()) { const r = await api.pull(); if (r) A.savedAt = new Date(r.updated_at); else upload(); }
    } catch (e) { A.ready = true; }
  };
})(window.BD);
