/* Tab 6 – Profile: your bantay card, progress and shortcuts. The gear on the card opens Settings
   (a full-screen page: name, district, theme, alerts, backup & restore, demo tools). */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;

  BD.tabs = BD.tabs || {};
  BD.tabs.profile = {
    render() {
      const s = BD.state, xp = BD.totalXP(), L = BD.levelOf(xp), st = BD.streak(), unread = BD.unread();
      const d = BD.DISTRICTS.find(x => x.id === s.district) || BD.DISTRICTS[0];
      const full = Object.keys(s.days).filter(k => BD.isFull(s.days[k])).length;
      return '<div class="view-head"><h2>' + I('user', 22) + 'Profile</h2></div>' +
        (BD.ui.editMe ? editCard() :
        '<section class="card me">' +
        '<button class="icon-btn me-gear" data-action="openSettings" aria-label="Settings">' + I('settings', 22) + '</button>' +
        '<button class="me-av" data-action="editMe" aria-label="Change your photo and name">' + BD.avatar() + '<i class="num">' + L.level + '</i></button>' +
        '<div class="me-txt"><span class="fine-k">Bantay · Level ' + L.level + '</span><h2>' + esc(s.name) + '</h2>' +
        '<span class="rank-chip">' + I('shield', 14) + esc(L.rank) + '</span>' +
        '<span class="me-where">' + I('pin', 14) + esc(d.name) + ', Davao City</span>' +
        '<button class="link-btn me-edit-btn" data-action="editMe">' + I('edit', 14) + 'Edit name and photo</button></div></section>') +
        '<div class="card"><div class="xp-line"><b class="num">' + xp.toLocaleString() + ' XP</b>' + (L.max ? ' · Max level' : ' · ' + L.toNext + ' to Level ' + (L.level + 1)) + '</div>' + BD.bar('me', L.pct, 'bar-xp') + '</div>' +
        '<div class="stats">' +
        // Icon at the top centre (no box), then the number and its label.
        '<div class="stat stat-c"><span class="stat-ico c-sun" aria-hidden="true">' + I('flame', 22) + '</span><b class="num">' + st + '</b><span>Day streak</span></div>' +
        '<div class="stat stat-c"><span class="stat-ico c-gulf" aria-hidden="true">' + I('trophy', 22) + '</span><b class="num">' + full + '</b><span>Full days</span></div>' +
        '<div class="stat stat-c"><span class="stat-ico c-gulf" aria-hidden="true">' + I('star', 22) + '</span><b class="num">' + BD.bonusWeeks().length + '</b><span>Bonus weeks</span></div></div>' +
        (BD.badgesCard ? BD.badgesCard() : '') +
        (BD.shareCard ? BD.shareCard() : '') +
        '<div class="card flat">' +
        row('openCenter', 'bell', 'Notifications', unread ? unread + ' unread' : 'All caught up', unread ? '<span class="pill-count num">' + unread + '</span>' : '') +
        (BD.native ? '' : row('openSettings', 'download', 'Backup & restore', s.lastBackup ? 'Last saved ' + s.lastBackup : 'Not backed up yet. Keep your XP safe.', s.lastBackup ? '' : '<span class="dot-warn"></span>')) +
        row('openSettings', 'settings', 'Settings', 'Name, district, theme and alerts', '') + '</div>' +
        BD.donateCard() +
        '<p class="fine center">' + (BD.demo ? 'BantayDavao demo · by Recontech' : 'BantayDavao · Free, no ads · by Recontech') + '</p><div class="spacer"></div>';
    }
  };

  /* ---------- optional donations (prepared; see docs/DONATIONS.md) ----------
     A donation is an in-app purchase that unlocks nothing: every feature is free with or without it.
     Google Play and the App Store require their own billing for this, through a purchases plugin
     (planned: @capgo/native-purchases, exposed as Capacitor.Plugins.NativePurchases). Until that plugin is
     installed and the products exist in the stores, the card explains the donation and shows no buttons. */
  const D = { products: null, busy: false };
  const shop = () => (BD.native && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases) || null;
  const donationIds = () => (BD.CONFIG && BD.CONFIG.donationProducts) || [];
  // Asks the store for the donation amounts and their local prices. Quiet when the store is not ready.
  BD.donateBoot = async function () {
    const S = shop();
    if (!S || !donationIds().length) return;
    try {
      const r = await S.getProducts({ productIdentifiers: donationIds(), productType: 'inapp' });
      D.products = (r.products || []).map(p => ({ id: p.identifier, price: p.priceString })).filter(p => p.id && p.price);
      if (BD.ui.tab === 'profile' && !BD.ui.center) BD.render();
    } catch (e) { D.products = null; }
  };
  BD.donateCard = function () {
    const ready = D.products && D.products.length;
    return '<div class="card donate"><div class="card-head"><h3>' + I('heart', 18) + 'Support BantayDavao</h3><span class="tag ok">Optional</span></div>' +
      '<p class="donate-p">BantayDavao is free. Every feature works without paying, and it stays that way.</p>' +
      '<p class="donate-p">Recontech pays for the app right now. A donation helps build and maintain BantayDavao. Anything extra goes to new apps for Davao.</p>' +
      (ready ? '<div class="donate-btns">' + D.products.map(p => '<button class="btn btn-soft sm" data-action="donate" data-id="' + esc(p.id) + '"' + (D.busy ? ' disabled' : '') + ' data-i18n-skip>' + esc(p.price) + '</button>').join('') + '</div>'
        : '<p class="fine">' + I('info', 13) + 'Donations will open when BantayDavao is on Google Play and the App Store.</p>') + '</div>';
  };
  Object.assign(BD.actions = BD.actions || {}, {
    async donate(el) {
      const S = shop();
      if (!S || D.busy) return;
      D.busy = true; BD.render();
      try {
        // Consumable, so the same person can give again later.
        await S.purchaseProduct({ productIdentifier: el.dataset.id, productType: 'inapp', quantity: 1, isConsumable: true });
        BD.toast(I('heart', 16) + 'Salamat! Your donation helps keep BantayDavao running.');
      } catch (e) {
        if (!/cancel/i.test(String((e && e.message) || e))) BD.toast(I('info', 16) + 'The donation did not go through. You were not charged.');
      }
      D.busy = false; BD.render();
    }
  });
  // Your photo (a small square JPEG kept on the phone) or your initial.
  BD.avatar = function (photo) {
    const p = photo === undefined ? BD.state.photo : photo;
    return p ? '<img src="' + p + '" alt="">' : '<span class="av-i">' + esc((BD.state.name.trim()[0] || 'B').toUpperCase()) + '</span>';
  };
  function editCard() {
    const e = BD.ui.editMe, photo = e.photo;
    return '<section class="card me-edit"><h3>Edit profile</h3>' +
      '<span class="me-av big">' + BD.avatar(photo) + '</span>' +
      '<div class="me-photo-btns"><label class="btn btn-soft sm">' + I('camera', 16) + (photo ? 'Change photo' : 'Add photo') +
      '<input type="file" id="mePhoto" accept="image/*" hidden></label>' +
      (photo ? '<button class="btn btn-ghost sm" data-action="mePhotoRemove">' + I('x', 16) + 'Remove</button>' : '') + '</div>' +
      '<label class="me-name"><span class="set-k">Your name</span><input class="set-input" id="meName" value="' + esc(e.name) + '" maxlength="24" autocomplete="nickname"></label>' +
      '<p class="fine">' + I('shieldcheck', 13) + (BD.native ? 'Your photo stays on this phone.' : 'Your photo stays on this phone. It is only in backups you save.') + '</p>' +
      '<div class="me-save"><button class="btn btn-ghost" data-action="editMeCancel">Cancel</button><button class="btn btn-primary" data-action="editMeSave">' + I('check', 18) + 'Save</button></div></section>';
  }
  // Crop the picked photo to a centered square and shrink it to 256 px so it fits in local storage.
  document.addEventListener('change', e => {
    if (e.target.id !== 'mePhoto' || !e.target.files[0] || !BD.ui.editMe) return;
    const f = e.target.files[0], url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const S = 256, c = document.createElement('canvas'), k = Math.min(img.width, img.height);
      c.width = c.height = S;
      c.getContext('2d').drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, S, S);
      URL.revokeObjectURL(url);
      BD.ui.editMe.name = (document.getElementById('meName') || {}).value || BD.ui.editMe.name;
      BD.ui.editMe.photo = c.toDataURL('image/jpeg', 0.82); BD.render();
    };
    img.onerror = () => { URL.revokeObjectURL(url); BD.toast(I('alert', 16) + 'That picture could not be opened. Try another one.'); };
    img.src = url;
    e.target.value = '';
  });

  // About: what the app is, who made it, and where its data comes from.
  BD.aboutCard = function () {
    return '<h4>About</h4><div class="card flat about">' + '<span class="about-logo">' + BD.logo('logo', 'BantayDavao logo') + '</span>' +
      '<p><b>BantayDavao</b> · version ' + BD.VERSION + '<br>Free. No ads. No account needed.</p>' +
      '<p class="fine">Made by Recontech in Davao City. Not an official app of the City Government of Davao, PAGASA or DOH. In an emergency, call 911.</p>' +
      '<p class="fine">Heat index levels: PAGASA. Weather forecast and air quality estimate: Open-Meteo.com (CC BY 4.0). Air quality levels: DENR. Map and places: © OpenStreetMap contributors (ODbL), map style by Protomaps.</p>' +
      '<p class="fine">Background photo: georgeparrilla (CC BY 2.0). Other photos are credited where they appear.</p>' +
      '<div class="about-links"><a class="btn btn-soft sm" href="privacy.html">' + I('shieldcheck', 16) + 'Privacy policy</a>' +
      '<a class="btn btn-soft sm" href="terms.html">' + I('notepad', 16) + 'Terms of use</a></div></div>';
  };
  function row(action, icon, title, sub, extra) {
    return '<button class="toggle-row" data-action="' + action + '"><span class="q-ic c-gulf">' + I(icon, 18) + '</span><span class="q-body"><span class="q-title">' + title + '</span>' +
      '<span class="q-meta">' + esc(sub) + '</span></span>' + extra + I('chevron', 18) + '</button>';
  }

  // Body of the Settings page (rendered inside the full-screen sheet by app.js).
  BD.settingsBody = function () {
    const s = BD.state, d = BD.DISTRICTS.find(x => x.id === s.district) || BD.DISTRICTS[0];
    const th = (k, icon, label) => '<button class="' + (s.theme === k ? 'on' : '') + '" data-action="theme" data-t="' + k + '" aria-pressed="' + (s.theme === k) + '">' + I(icon, 14) + label + '</button>';
    const opts = BD.DISTRICTS.map(x => '<option value="' + x.id + '"' + (x.id === d.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
    return '<h4>You</h4><div class="card flat set-list">' +
      '<label class="set-row"><span class="set-k">Your name</span><input class="set-input" id="nameInput" data-change="setName" value="' + esc(s.name) + '" maxlength="24" autocomplete="nickname"></label>' +
      '<div class="set-row"><span class="set-k" id="distLbl">Your district</span><label class="sel small">' + I('pin', 14) + '<select data-change="district" aria-labelledby="distLbl">' + opts + '</select>' + I('chevdown', 14) + '</label></div>' +
      '<button class="btn btn-soft sm btn-block gps-btn" data-action="mapLocate">' + I('locate', 16) + 'Use my current location</button>' +
      (BD.ui.here && BD.ui.here.gps ? '<p class="fine">' + I('check', 13) + 'Using your current location.</p>' : '') + '</div>' +
      BD.accountSettings() +
      '<h4>Language</h4><div class="card flat"><div class="mini-seg theme-seg" role="group" aria-label="Language" data-i18n-skip>' +
      BD.LANGS.map(l => '<button class="' + (BD.lang() === l[0] ? 'on' : '') + '" data-action="setLang" data-l="' + l[0] + '" aria-pressed="' + (BD.lang() === l[0]) + '" lang="' + l[0] + '">' + l[1] + '</button>').join('') + '</div>' +
      '<p class="fine">' + I('info', 13) + 'Tagalog and Bisaya are new. Help us improve them: tell us any word that sounds wrong.</p></div>' +
      '<h4>Theme</h4><div class="card flat"><div class="mini-seg theme-seg" role="group" aria-label="Theme">' + th('auto', 'monitor', 'Device') + th('light', 'sun', 'Light') + th('dark', 'moon', 'Dark') + '</div>' +
      '<p class="fine">' + I('info', 13) + 'Device follows your phone\'s light or dark setting.</p></div>' +
      // Easier to use: bigger text and calmer screens, for lolo, lola and anyone who needs it.
      '<h4>Easier to use</h4><div class="card flat">' +
      '<div class="set-k set-k-top" id="sizeLbl">Text size</div><div class="mini-seg size-seg" role="group" aria-labelledby="sizeLbl">' +
      [['normal', 'Normal', 15], ['large', 'Large', 18], ['xl', 'Extra large', 21]].map(z => '<button class="' + ((s.textSize || 'normal') === z[0] ? 'on' : '') + '" data-action="textSize" data-z="' + z[0] + '" aria-pressed="' + ((s.textSize || 'normal') === z[0]) + '">' +
        '<span class="aa" style="font-size:' + z[2] + 'px" aria-hidden="true">Aa</span>' + z[1] + '</button>').join('') + '</div>' +
      '<button class="toggle-row" data-action="calmMotion" role="switch" aria-checked="' + (s.motion === 'reduce') + '"><span class="q-ic c-gulf">' + I('pause', 18) + '</span>' +
      '<span class="q-body"><span class="q-title">Reduce motion</span><span class="q-meta">Fewer moving and blinking things on screen</span></span><span class="switch' + (s.motion === 'reduce' ? ' on' : '') + '"><i></i></span></button></div>' +
      '<h4>Alerts</h4><div class="card flat">' + BD.reminders.settingsRow() +
      BD.toggleRow('weather', 'Weather alerts', 'Heat index and PAGASA rainfall warnings', 'alert') +
      BD.toggleRow('quests', 'Quest reminders', 'When a new quest unlocks', 'notepad') +
      BD.toggleRow('water', 'Water reminders', 'Every 2 hours until 8 glasses', 'droplet') + '</div>' +
      // The app saves by itself to the phone; only the web version has a backup file.
      (BD.native ? '<h4>Your progress</h4><div class="card flat"><p class="fine">' + I('shieldcheck', 13) + 'Your XP, streaks and history are saved on this phone by the app. You don\'t need to do anything.</p></div>'
        : '<h4>Backup & restore</h4><div class="card flat backup">' +
      '<p class="fine">' + I('shieldcheck', 13) + 'Your XP, streaks and history live on this phone. Save a backup file before you change phones or reinstall, then load it back.</p>' +
      '<div class="backup-btns"><button class="btn btn-primary sm" data-action="backupSave">' + I('download', 16) + 'Save backup</button>' +
      '<button class="btn btn-soft sm" data-action="backupLoad">' + I('refresh', 16) + 'Load backup</button></div>' +
      (s.lastBackup ? '<p class="fine">Last backup: ' + esc(s.lastBackup) + '</p>' : '') +
      '<input type="file" id="backupFile" accept=".json,application/json" hidden></div>') +
      (BD.demo ? '<h4>Demo tools</h4>' + BD.demoControls('in-sheet', true) : '') + BD.aboutCard() +
      '<p class="fine center">' + (BD.demo ? 'BantayDavao prototype · ' : '') + 'Map data © OpenStreetMap contributors</p>';
  };

  /* ---------- backup & restore: a JSON file the user keeps (works offline, no account) ---------- */
  function backupFile() {
    const stamp = BD.dateKey(new Date());
    const data = JSON.stringify({ app: 'BantayDavao', v: 1, savedAt: new Date().toISOString(), level: BD.levelOf(BD.totalXP()).level, xp: BD.totalXP(), state: BD.state });
    return new File([data], 'bantaydavao-backup-' + stamp + '.json', { type: 'application/json' });
  }
  function markSaved() { BD.state.lastBackup = BD.dateKey(new Date()); BD.save(); BD.render(); BD.toast(I('check', 16) + 'Backup saved. Keep the file somewhere safe.'); }
  function download(file) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  document.addEventListener('change', e => {
    if (e.target.id !== 'backupFile' || !e.target.files[0]) return;
    e.target.files[0].text().then(txt => {
      const b = JSON.parse(txt);
      if (!b || b.app !== 'BantayDavao' || !b.state || typeof b.state.days !== 'object') throw new Error('not a backup');
      try { localStorage.setItem('bantaydavao-before-restore', JSON.stringify(BD.state)); } catch (err) { }
      BD.replaceState(b.state); BD.applyTheme(); BD.render();
      BD.toast(I('check', 16) + 'Progress loaded: Level ' + BD.levelOf(BD.totalXP()).level + ', ' + BD.totalXP().toLocaleString() + ' XP.');
    }).catch(() => BD.toast(I('alert', 16) + 'That file is not a BantayDavao backup.'));
    e.target.value = '';
  });

  Object.assign(BD.actions = BD.actions || {}, {
    setName(el) {
      const n = el.value.replace(/\s+/g, ' ').trim().slice(0, 24) || 'Dabawenyo';
      if (n === BD.state.name) { el.value = n; return; }
      BD.state.name = n; BD.save(); BD.render();
      BD.toast(I('check', 16) + 'Saved. Hi, ' + esc(n) + '!');
    },
    editMe() { BD.ui.editMe = { name: BD.state.name, photo: BD.state.photo || null }; BD.render(); },
    editMeCancel() { BD.ui.editMe = null; BD.render(); },
    mePhotoRemove() { BD.ui.editMe.name = document.getElementById('meName').value; BD.ui.editMe.photo = null; BD.render(); },
    editMeSave() {
      const n = (document.getElementById('meName').value || '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Dabawenyo';
      BD.state.name = n; BD.state.photo = BD.ui.editMe.photo || null; BD.ui.editMe = null;
      if (BD.familyProfileChanged) BD.familyProfileChanged();
      if (!BD.save() && BD.state.photo) { BD.toast(I('alert', 16) + 'Could not save the photo. Try a smaller one.'); BD.state.photo = null; BD.save(); }
      else BD.toast(I('check', 16) + 'Saved. Hi, ' + esc(n) + '!');
      BD.render();
    },
    backupSave() {
      const file = backupFile();
      // On phones, the share sheet lets people save to Drive or send it to themselves; elsewhere it downloads.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'BantayDavao backup' }).then(markSaved, err => { if (err.name !== 'AbortError') { download(file); markSaved(); } });
      } else { download(file); markSaved(); }
    },
    backupLoad() { const f = document.getElementById('backupFile'); if (f) f.click(); }
  });
})(window.BD);
