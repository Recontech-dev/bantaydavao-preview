/* Language: English, Tagalog (tl) and Davao Bisaya (ceb). The picker lives in Settings.
   The UI is written in English; this layer translates what is shown, so render code stays as it is:
   - Text nodes and the placeholder / aria-label / title attributes inside #app are translated as they appear.
   - BD.tr() translates strings that never reach the page as text (share messages, share images, notifications).
   Lookup: the whole string first, then each sentence, then each " · " part. Numbers are replaced by {#} before the
   lookup and put back after, so "3 of 8 glasses" and "5 of 8 glasses" share one entry.
   Dictionaries: js/i18n-tl.js and js/i18n-ceb.js (BD.I18N.tl / BD.I18N.ceb). Review sheet: docs/translations.csv. */
window.BD = window.BD || {};
(function (BD) {
  BD.I18N = BD.I18N || {};
  BD.LANGS = [['en', 'English'], ['tl', 'Tagalog'], ['ceb', 'Bisaya']];
  const NUM = /\d+(?:[.,:]\d+)*/g;

  BD.lang = function () {
    const s = BD.state && BD.state.lang;
    if (s) return s;
    const n = (navigator.language || 'en').toLowerCase();
    return /^(tl|fil)/.test(n) ? 'tl' : /^(ceb|bis)/.test(n) ? 'ceb' : 'en';
  };

  function look(dict, s) {
    const nums = s.match(NUM);
    const hit = dict[nums ? s.replace(NUM, '{#}') : s];
    if (hit == null) return null;
    let i = 0;
    return nums ? hit.replace(/\{#\}/g, () => (nums[i] != null ? nums[i++] : '')) : hit;
  }
  // Weekdays and months, for date strings such as "Friday, 23 October" or "Mon".
  const DATE = {
    tl: { Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miyerkules', Thursday: 'Huwebes', Friday: 'Biyernes', Saturday: 'Sabado', Sunday: 'Linggo',
      Mon: 'Lun', Tue: 'Mar', Wed: 'Miy', Thu: 'Huw', Fri: 'Biy', Sat: 'Sab', Sun: 'Lin', Today: 'Ngayon',
      January: 'Enero', February: 'Pebrero', March: 'Marso', April: 'Abril', May: 'Mayo', June: 'Hunyo', July: 'Hulyo', August: 'Agosto',
      September: 'Setyembre', October: 'Oktubre', November: 'Nobyembre', December: 'Disyembre', Oct: 'Okt' },
    ceb: { Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miyerkoles', Thursday: 'Huwebes', Friday: 'Biyernes', Saturday: 'Sabado', Sunday: 'Domingo',
      Mon: 'Lun', Tue: 'Mar', Wed: 'Miy', Thu: 'Huw', Fri: 'Biy', Sat: 'Sab', Sun: 'Dom', Today: 'Karon',
      January: 'Enero', February: 'Pebrero', March: 'Marso', April: 'Abril', May: 'Mayo', June: 'Hunyo', July: 'Hulyo', August: 'Agosto',
      September: 'Septiyembre', October: 'Oktubre', November: 'Nobyembre', December: 'Disyembre', Oct: 'Okt' }
  };
  const DATE_ONLY = /^(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun|January|February|March|April|May|June|July|August|September|October|November|December|Oct)\b|[\d,:\s]|AM\b|PM\b)+$/;
  function trDate(s) {
    const w = DATE[BD.lang()];
    return w && DATE_ONLY.test(s) ? s.replace(/[A-Za-z]+/g, t => w[t] || t) : null;
  }
  // Bullets, emoji and step numbers in front ("• ", "👉 ", "3. ") are kept and the rest is translated.
  const LEAD = /^((?:[•·\-–]|\d+\.|\p{Extended_Pictographic}\uFE0F?)\s+)([\s\S]+)$/u;
  function trText(dict, s) {
    const whole = look(dict, s);
    if (whole != null) return whole;
    const d = trDate(s);
    if (d != null) return d;
    const lead = LEAD.exec(s);
    if (lead) return lead[1] + trText(dict, lead[2]);
    // "Label: text" translates as two parts.
    const c = /^([^:]{2,40}): ([\s\S]+)$/.exec(s);
    if (c) { const h = look(dict, c[1]), t = trText(dict, c[2]); if (h != null || t !== c[2]) return (h != null ? h : c[1]) + ': ' + t; }
    // Sentences, then " · " parts, so composed strings still translate piece by piece.
    const sent = s.split(/(?<=[.!?])\s+/);
    if (sent.length > 1) { let any = false; const out = sent.map(x => { const t = trText(dict, x); if (t !== x) any = true; return t; }); if (any) return out.join(' '); }
    // Comma lists ("Confused, Fainted, Seizure") translate when every item is known.
    const items = s.split(', ');
    if (items.length > 1) {
      const out = [];
      for (let i = 0; i < items.length;) {
        let j = items.length, hit = null;
        for (; j > i; j--) { hit = look(dict, items.slice(i, j).join(', ')); if (hit != null) break; }
        if (hit == null) { out.length = 0; break; }
        out.push(hit); i = j;
      }
      if (out.length) return out.join(', ');
    }
    const parts = s.split(' · ');
    if (parts.length > 1) { let any = false; const out = parts.map(x => { const t = trText(dict, x); if (t !== x) any = true; return t; }); if (any) return out.join(' · '); }
    return s;
  }
  // Translate a string to the current language (keeps leading/trailing spaces and works line by line).
  BD.tr = function (s) {
    const dict = BD.I18N[BD.lang()];
    if (!dict || s == null) return s;
    return String(s).split('\n').map(line => {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(line);
      return m[2] ? m[1] + trText(dict, m[2]) + m[3] : line;
    }).join('\n');
  };

  // One-letter weekday initials, Monday first (a single letter can't be looked up: M is Monday and Wednesday).
  BD.weekLetters = () => ({ tl: 'LMMHBSL', ceb: 'LMMHBSD' }[BD.lang()] || 'MTWTFSS');

  const ATTRS = ['placeholder', 'aria-label', 'title'];
  const SKIP = 'script, style, svg, .glmap, .maplibregl-ctrl-attrib, [data-i18n-skip], input, textarea';
  const done = new WeakMap(); // node -> the translated text we wrote, so we don't translate twice
  function node(n) {
    const v = n.nodeValue;
    if (!v || !/[A-Za-z]/.test(v) || done.get(n) === v) return;
    const p = n.parentElement;
    if (!p || p.closest(SKIP)) return;
    const t = BD.tr(v);
    done.set(n, t);
    if (t !== v) n.nodeValue = t;
  }
  function el(e) {
    if (e.closest && e.closest('svg, .glmap')) return;
    ATTRS.forEach(a => { const v = e.getAttribute && e.getAttribute(a); if (v && /[A-Za-z]/.test(v) && e['_i18n_' + a] !== v) { const t = BD.tr(v); e['_i18n_' + a] = t; if (t !== v) e.setAttribute(a, t); } });
  }
  function walk(root) {
    if (root.nodeType === 3) { node(root); return; }
    if (root.nodeType !== 1) return;
    el(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = it.nextNode())) { if (n.nodeType === 3) node(n); else el(n); }
  }
  let obs = null;
  BD.i18nApply = function () {
    const app = document.getElementById('app');
    document.documentElement.lang = BD.lang() === 'ceb' ? 'ceb' : BD.lang() === 'tl' ? 'tl' : 'en';
    if (!app) return;
    if (BD.lang() === 'en') { if (obs) { obs.disconnect(); obs = null; } return; }
    walk(app);
    if (!obs) {
      obs = new MutationObserver(list => list.forEach(m => {
        if (m.type === 'characterData') node(m.target);
        else if (m.type === 'attributes') el(m.target);
        else m.addedNodes.forEach(walk);
      }));
      obs.observe(app, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
  };
})(window.BD);
