/* Tab 4 – Tabang (Help): First aid and Tawag (Hotlines) under one tab, picked with a switch. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc;

  BD.tabs = BD.tabs || {};
  const firstAid = {
    render() {
      const fa = BD.FIRST_AID[BD.state.season], sel = BD.ui.symptoms || {};
      const chip = (x, danger) => '<button class="sym' + (danger ? ' danger' : '') + (sel[x.id] ? ' on' : '') + '" data-action="symptom" data-id="' + x.id + '" aria-pressed="' + !!sel[x.id] + '">' +
        '<span class="sym-box" aria-hidden="true">' + (sel[x.id] ? I('check', 14) : '') + '</span><span class="sym-t">' + esc(x.label) + '</span></button>';
      const dangerSel = fa.danger.filter(x => sel[x.id]), mildSel = fa.mild.filter(x => sel[x.id]);
      let result;
      if (dangerSel.length) {
        result = '<div class="call-alert"><div class="ca-top">' + I('siren', 28) + '<div><span class="ca-k">Peligro! Tabang dayon</span><b>Call 911 now</b></div></div>' +
          '<p>' + esc(fa.dangerText) + '</p><p class="ca-signs">Signs: ' + dangerSel.map(x => esc(x.label)).join(', ') + '</p>' +
          '<a class="btn btn-call" href="tel:911">' + I('phone', 20) + 'Call 911 · free, 24/7</a>' + (BD.aidShareBtn ? BD.aidShareBtn(true) : '') + '</div>';
      } else if (mildSel.length) {
        result = '<div class="card advice"><div class="card-head"><h3>' + I('heart', 18) + 'What to do</h3><span class="tag ok">Mild signs</span></div>' +
          mildSel.map(x => '<div class="adv-row"><b>' + esc(x.label) + '</b><span>' + esc(x.tip) + '</span></div>').join('') +
          '<p class="fine">' + I('info', 13) + 'If signs get worse or don\'t improve in 30 minutes, call 911.</p>' + (BD.aidShareBtn ? BD.aidShareBtn(false) : '') + '</div>';
      } else {
        result = '<div class="hint-card">' + I('aid', 22) + '<span>Tap the signs you or the person has. You can pick more than one.</span></div>';
      }
      // The result sits above the options so the outcome is the first thing you read.
      return '<div class="aid-head"><span class="aid-ic">' + I('aid', 26) + '</span><div><span class="fine-k">First aid</span><h2>' + esc(fa.title) + '</h2><p>Unsa imong gibati? What do you feel?</p></div></div>' +
        '<div id="aid-result">' + result + '</div>' +
        '<div class="card"><div class="card-head"><h3>Mild signs</h3></div><div class="syms">' + fa.mild.map(x => chip(x)).join('') + '</div>' +
        '<div class="card-head danger-h"><h3>' + I('alert', 16) + 'Danger signs</h3></div><div class="syms">' + fa.danger.map(x => chip(x, true)).join('') + '</div>' +
        (Object.keys(sel).some(k => sel[k]) ? '<button class="link-btn" data-action="clearSymptoms">' + I('x', 14) + 'Clear</button>' : '') + '</div>' +
        (BD.photoCard ? BD.photoCard() : '') +
        '<div class="card steps"><div class="card-head"><h3>DOH first aid steps</h3></div><ol>' +
        fa.steps.map((x, i) => '<li><span class="step-n num">' + (i + 1) + '</span><span>' + esc(x) + '</span></li>').join('') + '</ol></div>' +
        '<div class="card donts"><div class="card-head"><h3>' + I('alert', 18) + 'Remember</h3></div><ul>' +
        fa.donts.map(x => '<li>' + I('x', 15) + '<span>' + esc(x) + '</span></li>').join('') + '</ul></div>' +
        '<a class="btn btn-call outline" href="tel:911">' + I('phone', 18) + 'Emergency? Call 911</a><div class="spacer"></div>';
    }
  };

  const hotlines = {
    render() {
      const cards = BD.HOTLINES.map(h => {
        const nums = h.numbers.map(n => {
          const tel = n.n.replace(/[^\d+]/g, '');
          return '<div class="num-row"><div><span class="n-label">' + esc(n.label) + '</span><b class="num">' + esc(n.n) + '</b></div>' +
            '<div class="num-btns"><button class="icon-btn" data-action="copy" data-n="' + esc(n.n) + '" aria-label="' + esc(BD.tr('Copy') + ' ' + n.n) + '">' + I('copy', 18) + '</button>' +
            (n.sms ? '<a class="icon-btn" href="sms:' + tel + '" aria-label="' + esc(BD.tr('Text') + ' ' + n.n) + '">' + I('message', 18) + '</a>' : '') +
            '<a class="btn ' + (h.big ? 'btn-call' : 'btn-primary') + ' sm" href="tel:' + tel + '">' + I('phone', 16) + 'Call</a></div></div>';
        }).join('');
        return '<div class="card hotline' + (h.big ? ' big' : '') + '">' +
          '<div class="hl-head"><span class="hl-ic">' + I(h.big ? 'siren' : (h.name.indexOf('DCWD') === 0 ? 'droplet' : 'phone'), 22) + '</span><div><b>' + esc(h.name) + '</b><span>' + esc(h.desc) + '</span></div></div>' + nums + '</div>';
      }).join('');
      return '<div class="aid-head"><span class="aid-ic tawag">' + I('phone', 26) + '</span><div><span class="fine-k">Tawag · Hotlines</span><h2>Who to call</h2><p>Save these numbers. Tap Call or Copy.</p></div></div>' +
        cards +
        '<div class="card note"><div class="hl-head"><span class="hl-ic radio">' + I('radio', 22) + '</span><div><b>River and evacuation updates</b><span>Follow the CDRRMO Facebook page and listen to Davao City Disaster Radio.</span></div></div></div>' +
        '<p class="fine center">Numbers must be verified by the City before public release.</p><div class="spacer"></div>';
    }
  };

  BD.tabs.tabang = {
    render() {
      const on = BD.ui.help === 'call' ? 'call' : 'aid';
      const b = (k, icon, label) => '<button class="' + (on === k ? 'on' : '') + '" data-action="help" data-h="' + k + '" aria-pressed="' + (on === k) + '">' + I(icon, 18) + label + '</button>';
      // Page title like Pamilya and Profile, then the First aid / Hotlines switch.
      return '<div class="view-head"><h2>' + I('aid', 22) + 'Tabang</h2></div>' +
        '<div class="seg seg-help" role="group" aria-label="Help">' + b('aid', 'aid', 'First aid') + b('call', 'phone', 'Hotlines') + '</div>' +
        (on === 'call' ? hotlines : firstAid).render();
    }
  };

  Object.assign(BD.actions = BD.actions || {}, {
    help(el) {
      if (BD.ui.help === el.dataset.h) return;
      BD.ui.help = el.dataset.h; BD.render({ enter: true });
    },
    symptom(el) {
      BD.ui.symptoms = BD.ui.symptoms || {};
      BD.ui.symptoms[el.dataset.id] = !BD.ui.symptoms[el.dataset.id];
      const wasDanger = el.classList.contains('danger') && BD.ui.symptoms[el.dataset.id];
      const scr = document.getElementById('screen'), before = el.getBoundingClientRect().top;
      BD.render();
      // Keep the tapped chip where it was, then bring the result above it into view.
      const chip = document.querySelector('[data-action="symptom"][data-id="' + el.dataset.id + '"]');
      if (chip) scr.scrollTop += chip.getBoundingClientRect().top - before;
      const r = document.getElementById('aid-result');
      if (r && BD.ui.symptoms[el.dataset.id]) { r.scrollIntoView({ behavior: BD.calm() ? 'auto' : 'smooth', block: 'nearest' }); }
      if (wasDanger) BD.vibrate([60, 40, 60]);
    },
    clearSymptoms() { BD.ui.symptoms = {}; BD.render(); },
    copy(el) {
      const n = el.dataset.n;
      const done = () => BD.toast(I('check', 16) + 'Copied ' + n);
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(n).then(done, () => fallback(n, done));
      else fallback(n, done);
    }
  });
  function fallback(n, done) {
    const t = document.createElement('textarea'); t.value = n; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { }
    t.remove(); done();
  }
})(window.BD);
