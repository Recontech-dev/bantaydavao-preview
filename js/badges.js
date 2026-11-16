/* Badges (Profile): each badge levels up, Tanso → Pilak → Ginto (bronze, silver, gold), as you repeat what earned it.
   Example: Hydration Hero = 8 glasses every day for a full week; Tanso after 1 such week, Pilak after 3, Ginto after 10.
   Everything is worked out from your saved days, so it comes back with a backup too.
   BD.state.badges = { id: 'YYYY-MM-DD' } (first earned), BD.state.badgeTier = { id: 1..3 }. Profile shows 3 in a row; "See all" opens the rest. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;
  const TIERS = ['Tanso', 'Pilak', 'Ginto'];
  const days = () => Object.values(BD.state.days || {}).filter(Boolean);
  const questsDone = prefix => days().reduce((n, d) => n + Object.keys(d.q || {}).filter(id => d.q[id] && id.indexOf(prefix) === 0).length, 0);
  const perfectQuiz = d => d.quiz && d.quiz.ids && d.quiz.ids.length && d.quiz.ids.every(id => id in d.quiz.ans && d.quiz.ans[id] === (BD.QUIZ.find(q => q[0] === id) || [])[3]);
  const checklistDone = () => Object.keys(BD.state.checklist || {}).some(k => {
    const season = k.split(':')[1], items = BD.CHECKLIST[season] || [], on = BD.state.checklist[k] || {};
    return items.length && items.every((x, i) => on[i]);
  });
  // Full weeks (Monday to Sunday) with 8 glasses every day.
  const waterWeeks = () => {
    const per = {};
    Object.entries(BD.state.days || {}).forEach(([k, d]) => { if (d && d.glasses >= 8) { const w = BD.weekKeys(new Date(k + 'T12:00:00'))[0]; per[w] = (per[w] || 0) + 1; } });
    return Object.values(per).filter(n => n >= 7).length;
  };
  // Longest run of full days (6+ quests) ever.
  const bestStreak = () => {
    const keys = Object.keys(BD.state.days || {}).filter(k => BD.isFull(BD.state.days[k])).sort();
    let best = 0, run = 0, prev = null;
    keys.forEach(k => { const t = new Date(k + 'T12:00:00'); run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; });
    return best;
  };

  // One "time" of each badge, and how many times each level needs: tiers = [Tanso, Pilak, Ginto].
  const BADGES = [
    { id: 'water7', name: 'Hydration Hero', how: 'Drink 8 glasses every day for a full week (Monday to Sunday).', icon: 'droplet', c: 'c-teal', count: waterWeeks, tiers: [1, 3, 10] },
    { id: 'first', name: 'Unang Bantay', how: 'Finish quests.', icon: 'shieldcheck', c: 'c-gulf', count: () => questsDone(''), tiers: [1, 25, 100] },
    { id: 'streak7', name: 'Sunod-sunod', how: 'Full days in a row (6 or more quests each day), your best run.', icon: 'flame', c: 'c-sun', count: bestStreak, tiers: [7, 21, 60] },
    { id: 'perfect', name: 'Perfect Day', how: 'Finish all 8 quests in one day.', icon: 'star', c: 'c-sun', count: () => days().filter(d => BD.doneCount(d) >= 8).length, tiers: [1, 5, 20] },
    { id: 'heat10', name: 'Bantay sa Init', how: 'Finish heat-season quests.', icon: 'sun', c: 'c-sun', count: () => questsDone('h_'), tiers: [10, 30, 100] },
    { id: 'rain10', name: 'Bantay sa Baha', how: 'Finish rainy-season quests.', icon: 'rain', c: 'c-teal', count: () => questsDone('r_'), tiers: [10, 30, 100] },
    { id: 'quiz3', name: 'Quiz Master', how: 'Get a perfect Tama o Mali score.', icon: 'zap', c: 'c-purple', count: () => days().filter(perfectQuiz).length, tiers: [3, 10, 30] },
    { id: 'safe', name: 'Ligtas Ako', how: 'Check in with "I\'m safe" during a warning.', icon: 'check', c: 'c-gulf', count: () => days().filter(d => d.xpSafe).length, tiers: [1, 3, 10] },
    { id: 'share3', name: 'Tagapagbalita', how: 'Share the day\'s forecast with family.', icon: 'share', c: 'c-purple', count: () => days().filter(d => d.xpShare).length, tiers: [3, 10, 30] },
    { id: 'drill', name: 'Handa sa Baha', how: 'Finish an evacuation drill.', icon: 'house', c: 'c-teal', count: () => days().filter(d => d.drill).length, tiers: [1, 3, 10] },
    { id: 'ready', name: 'Laging Handa', how: 'Tick every item on the go-bag or going-out checklist.', icon: 'backpack', c: 'c-teal', count: () => days().filter(d => d.ready).length, tiers: [1, 5, 20] }
  ];
  // Level reached (0 = not yet, 1 Tanso, 2 Pilak, 3 Ginto) and progress to the next one.
  BD.badgeProgress = b => {
    const n = b.count(), tier = b.tiers.filter(t => n >= t).length, max = tier === b.tiers.length;
    const need = b.tiers[Math.min(tier, b.tiers.length - 1)];
    return { n, tier, need, max, pct: max ? 1 : Math.min(1, n / need) };
  };

  // Record new badges and upgrades. silent: just remember them (on start, so old progress doesn't celebrate).
  BD.checkBadges = function (silent) {
    if (BD.locked && BD.locked()) return;   // guests earn no badges
    const s = BD.state; s.badges = s.badges || {}; s.badgeTier = s.badgeTier || {};
    if (checklistDone() && !BD.today().ready) BD.today().ready = 1;   // counts go-bag days for "Laging Handa"
    const ups = [];
    BADGES.forEach(b => {
      const t = BD.badgeProgress(b).tier, was = s.badgeTier[b.id] || (s.badges[b.id] ? 1 : 0);
      if (t > was) { s.badgeTier[b.id] = t; if (!s.badges[b.id]) s.badges[b.id] = BD.todayKey(); ups.push([b, t, was]); }
    });
    if (!ups.length) return;
    BD.save();
    // Test scripts turn off pop-ups that open by themselves: on a Monday the demo has no sample days yet, so the first badge is new.
    if (silent || (window.BD_TEST && BD_TEST.noAutoAlert)) return;
    ups.forEach(([b, t, was], i) => setTimeout(() => {
      const kicker = was ? 'Badge upgraded!' : 'New badge!';
      BD.celebrate({ icon: b.icon, kicker: kicker, title: b.name + ' · ' + TIERS[t - 1], body: b.how, cta: 'Padayon!', tone: 'purple' });
      BD.notify({ kind: 'level', icon: b.icon, title: kicker + ' ' + b.name + ' · ' + TIERS[t - 1], body: b.how, tab: 'profile' }, { silent: true });
    }, 1200 + i * 300));
  };

  function tile(b) {
    const p = BD.badgeProgress(b), on = p.tier > 0, level = on ? TIERS[p.tier - 1] : 'Locked';
    const left = p.max ? 'Highest level' : Math.min(p.n, p.need) + '/' + p.need;
    return '<div class="badge-tile' + (on ? ' on tier-' + p.tier : '') + '" role="img" aria-label="' +
      esc(b.name + ', ' + level + '. ' + b.how + ' ' + (p.max ? 'Highest level.' : (on ? 'Next: ' + TIERS[p.tier] : TIERS[0]) + ', ' + left + '.')) + '">' +
      '<span class="bt-ic' + (on ? ' ' + b.c : '') + '">' + I(on ? b.icon : 'lock', 22) + '</span>' +
      '<b>' + esc(b.name) + '</b>' +
      '<span class="bt-tier" aria-hidden="true">' + b.tiers.map((t, i) => '<i class="' + (i < p.tier ? 't' + (i + 1) : '') + '"></i>').join('') + '</span>' +
      '<span class="bt-label">' + esc(level) + '</span>' +
      (p.max ? '' : '<span class="bt-bar" aria-hidden="true"><i style="width:' + Math.round(p.pct * 100) + '%"></i></span>') +
      '<span class="bt-n num">' + esc(left) + '</span></div>';
  }

  // Profile card: 3 in a row (highest level first, then closest to the next level); "See all" shows every badge.
  BD.badgesCard = function () {
    const all = !!BD.ui.badgesAll;
    const ranked = BADGES.slice().sort((a, b) => { const pa = BD.badgeProgress(a), pb = BD.badgeProgress(b); return pb.tier - pa.tier || pb.pct - pa.pct; });
    const got = BADGES.filter(b => BD.badgeProgress(b).tier > 0).length;
    return '<div class="card badges" id="badges"><div class="card-head"><h3>' + I('trophy', 18) + 'Badges</h3><span class="sum num">' + got + '/' + BADGES.length + '</span></div>' +
      '<div class="badge-grid">' + (all ? ranked : ranked.slice(0, 3)).map(tile).join('') + '</div>' +
      '<p class="fine">' + I('info', 13) + 'Each badge levels up: Tanso, then Pilak, then Ginto. Keep doing it to upgrade.</p>' +
      '<button class="btn btn-soft btn-block" data-action="badgesAll" aria-expanded="' + all + '">' + I('chevdown', 16) + (all ? 'Show fewer' : 'See all ' + BADGES.length + ' badges') + '</button></div>';
  };
  Object.assign(BD.actions = BD.actions || {}, {
    badgesAll() {
      BD.ui.badgesAll = !BD.ui.badgesAll; BD.render();
      if (!BD.ui.badgesAll) { const c = document.getElementById('badges'); if (c) c.scrollIntoView({ block: 'nearest' }); }
    }
  });
  BD.BADGES = BADGES;   // for tests
})(window.BD);
