/* Phone notifications (Android app): quest unlocks, water reminders and a morning heat or rain heads-up,
   scheduled on the phone so they arrive while BantayDavao is closed. Nothing is sent to a server.
   They are scheduled when the app goes to the background and cancelled when it comes back,
   because while the app is open the in-app banners (BD.notify) do the same job. */
window.BD = window.BD || {};
(function (BD) {
  const C = window.Capacitor, LN = (BD.native && C.Plugins && C.Plugins.LocalNotifications) || null;
  const DAYS = 3, WATER_HOURS = [10, 12, 14, 16, 18, 20], KEY = 'bd-reminders';
  const CHANNELS = [
    { id: 'quests', name: 'Quest reminders', description: 'When a new quest unlocks', importance: 3 },
    { id: 'water', name: 'Water reminders', description: 'Every 2 hours until 8 glasses', importance: 3 },
    { id: 'weather', name: 'Weather alerts', description: 'Morning heat index or rain heads-up', importance: 4 }
  ];
  const R = BD.reminders = { supported: !!LN, perm: LN ? null : 'unsupported' };

  // Everything to schedule from `from` for the next few days, as { id, at, kind, icon, title, body, tab, keys }.
  // `keys` are the BD.checkTriggers "already sent" keys, so the in-app banner doesn't repeat a phone notification.
  R.plan = function (from) {
    const s = BD.state, set = BD.locked() ? { weather: s.settings.weather } : s.settings, t = BD.today(), out = [];
    for (let d = 0; d < DAYS; d++) {
      const day = BD.addDays(from, d), dk = BD.dateKey(day);
      const add = (n, h, x) => {
        const at = new Date(day); at.setHours(h, 0, 0, 0);
        if (at > from) out.push(Object.assign({ id: 1000 + d * 100 + n, at, keys: [] }, x));
      };
      if (set.weather) {
        const w = headsUp(d);
        if (w) add(0, w.hour, w);
      }
      if (set.quests) {
        const byHour = {};
        BD.quests().forEach(q => { if (!(d === 0 && t.q[q.id])) (byHour[q.hour] = byHour[q.hour] || []).push(q); });
        Object.keys(byHour).forEach((h, i) => {
          const qs = byHour[h], keys = qs.map(q => 'q:' + dk + ':' + q.id);
          add(10 + i, +h, qs.length === 1
            ? { kind: 'quests', icon: qs[0].icon, title: 'New quest: ' + qs[0].title, body: '+' + qs[0].xp + ' XP · ' + qs[0].desc, tab: 'quests', keys }
            : { kind: 'quests', icon: 'notepad', title: qs.length + ' new quests', body: qs.map(q => q.title).join(' · '), tab: 'quests', keys });
        });
      }
      if (set.water && !(d === 0 && t.glasses >= 8)) {
        const last = d === 0 && t.lastGlass ? t.lastGlass : 0;
        WATER_HOURS.forEach((h, i) => {
          const at = new Date(day); at.setHours(h, 0, 0, 0);
          if (last && at - last < 90 * 60000) return;
          add(50 + i, h, { kind: 'water', icon: 'droplet', title: 'Inom tubig!', keys: ['w:' + dk + ':' + Math.floor(h / 2)],
            body: d === 0 ? 'You have had ' + t.glasses + ' of 8 glasses today. Drink one now.' : 'Drink a glass of water. Aim for 8 glasses today.', tab: 'quests' });
        });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  };

  // Morning heads-up, only from the live forecast (never from the sample data).
  function headsUp(d) {
    if (BD.state.season === 'heat') {
      let peak = null;
      for (let h = 9; h <= 16; h++) { const x = BD.hourly(h, d); if ((x.live || x.pagasa) && (!peak || x.hi > peak.hi)) peak = x; }
      if (!peak || Math.round(peak.hi) < 33) return null;
      return { hour: 7, kind: 'weather', icon: 'thermometer', tab: 'peligro',
        title: 'Up to ' + Math.round(peak.hi) + '°C heat index today · ' + peak.level.name,
        body: peak.level.advice + (peak.pagasa ? ' PAGASA heat index for Davao City.' : ' Estimate from the forecast.') };
    }
    const f = BD.forecastDays('rain');
    if (!f.live || !(f.rain[d] >= 70)) return null;
    return { hour: 6, kind: 'weather', icon: 'rain', tab: 'peligro', title: 'Rain likely today · ' + f.rain[d] + '%',
      body: 'Check the PAGASA rainfall warning before you go out.' };
  }

  // Permission: 'granted', 'denied', 'prompt' (or 'prompt-with-rationale'), or 'unsupported' on the web.
  R.check = async function () {
    if (!LN) return R.perm;
    try { R.perm = (await LN.checkPermissions()).display; } catch (e) { R.perm = 'denied'; }
    return R.perm;
  };
  R.request = async function () {
    if (!LN) return R.perm;
    try { R.perm = (await LN.requestPermissions()).display; } catch (e) { R.perm = 'denied'; }
    return R.perm;
  };
  R.canAsk = () => R.perm === 'prompt' || R.perm === 'prompt-with-rationale';

  // Calls run one after another, so a quick background/foreground switch can't interleave cancel and schedule.
  let queue = Promise.resolve();
  const run = fn => (queue = queue.then(fn).catch(() => { }));

  async function cancelAll() {
    const p = await LN.getPending();
    if (p.notifications.length) await LN.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) });
  }
  R.schedule = () => run(async () => {
    if (!LN) return;
    await cancelAll();
    if ((await R.check()) !== 'granted') return;
    const list = R.plan(new Date());
    save(list);
    if (!list.length) return;
    await LN.schedule({ notifications: list.map(n => ({
      id: n.id, title: BD.tr(n.title), body: BD.tr(n.body), largeBody: BD.tr(n.body), channelId: n.kind,
      schedule: { at: n.at, allowWhileIdle: true }, extra: { tab: n.tab }
    })) });
  });
  // Back in the app: drop what's still pending, and copy what already arrived into the in-app notification center.
  R.resume = () => run(async () => {
    if (!LN) return;
    await cancelAll();
    LN.removeAllDeliveredNotifications().catch(() => { });
    const now = Date.now(), today = BD.todayKey();
    load().filter(n => n.at <= now && BD.dateKey(new Date(n.at)) === today).forEach(n => {
      if (n.keys.length && n.keys.every(k => BD.state.sent[k])) return;
      n.keys.forEach(k => { BD.state.sent[k] = 1; });
      BD.notify({ kind: n.kind === 'quests' ? 'quest' : n.kind === 'weather' ? 'threat' : 'water', icon: n.icon, title: n.title, body: n.body, tab: n.tab }, { silent: true, at: new Date(n.at) });
    });
    save([]);
  });
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.map(n => Object.assign({}, n, { at: +n.at })))); } catch (e) { } }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }

  // The Karon card that asks for permission, once, after the first finished quest.
  R.askCard = function () {
    if (!R.canAsk() || BD.state.sent.notifAsk || BD.totalXP() <= 0) return '';
    const I = BD.icon;
    return '<div class="card safe-card"><div class="sc-top"><span class="q-ic c-teal">' + I('bell', 20) + '</span><div class="q-body">' +
      '<span class="q-title">Get reminders on your phone</span>' +
      '<span class="q-meta">New quests, water and a morning heat or rain heads-up, even when BantayDavao is closed.</span></div></div>' +
      '<div class="safe-btns"><button class="btn btn-primary" data-action="notifAllow">' + I('bell', 18) + 'Allow</button>' +
      '<button class="btn btn-soft" data-action="notifLater">Not now</button></div></div>';
  };
  // The status line at the top of the Alerts card in Settings.
  R.settingsRow = function () {
    const I = BD.icon;
    if (!LN) return '<p class="fine">' + I('info', 13) + 'On the web, alerts show only while BantayDavao is open. The app also sends them to your phone.</p>';
    if (R.perm === 'granted') return '<p class="fine">' + I('check', 13) + 'Phone notifications are on. They also arrive when BantayDavao is closed.</p>';
    if (R.canAsk()) return '<button class="btn btn-soft sm notif-allow" data-action="notifAllow">' + I('bell', 16) + 'Allow phone notifications</button>';
    return '<p class="fine">' + I('info', 13) + 'Phone notifications are off. Turn them on in your phone\'s Settings → Apps → BantayDavao → Notifications.</p>';
  };

  Object.assign(BD.actions = BD.actions || {}, {
    async notifAllow() {
      BD.state.sent.notifAsk = 1; BD.save();
      const p = await R.request();
      BD.toast(BD.icon(p === 'granted' ? 'check' : 'info', 16) + (p === 'granted' ? 'Phone notifications are on.' : 'Phone notifications are off. You can turn them on in your phone settings.'));
      BD.render();
    },
    notifLater() { BD.state.sent.notifAsk = 1; BD.save(); BD.render(); }
  });

  R.boot = function () {
    if (!LN) return;
    CHANNELS.forEach(c => LN.createChannel(Object.assign({}, c, { name: BD.tr(c.name), description: BD.tr(c.description), visibility: 1 })).catch(() => { }));
    LN.addListener('localNotificationActionPerformed', a => {
      const tab = a.notification && a.notification.extra && a.notification.extra.tab;
      if (tab) BD.go(tab);
    });
    const App = C.Plugins.App, onState = active => (active ? R.resume() : R.schedule());
    if (App) App.addListener('appStateChange', s => onState(s.isActive));
    else document.addEventListener('visibilitychange', () => onState(!document.hidden));
    R.check().then(() => { R.resume(); BD.render(); });
  };
})(window.BD);
