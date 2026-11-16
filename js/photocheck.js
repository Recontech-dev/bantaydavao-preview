/* Tabang – Photo check: take a photo of the affected area, the app makes it clearer (auto brightness, contrast
   and sharpening, tap to zoom), then shows the possible signs and illnesses to watch for, with what to do.
   PLACEHOLDER: the photo itself is not analysed yet. Suggestions come from what the person picks ("what does it
   look like?") and the season. Later, Google Gemini can read the photo (see docs/SERVICES.md) through our own
   server, only with the user's consent. This is never a diagnosis. The photo stays on the phone. */
window.BD = window.BD || {};
(function (BD) {
  const I = BD.icon, esc = BD.esc, MAX = 1280;

  // What it looks like -> possible conditions, per season. Advice follows DOH first-aid guidance.
  const LOOKS = [
    { id: 'rash', label: 'Red rash or bumps', icon: 'bug' },
    { id: 'wound', label: 'Wound or cut', icon: 'aid' },
    { id: 'swell', label: 'Swelling or bite', icon: 'alert' },
    { id: 'redskin', label: 'Red, burning skin', icon: 'sun' },
    { id: 'feet', label: 'Itchy or peeling feet', icon: 'waves' },
    { id: 'yellow', label: 'Yellow skin or eyes', icon: 'alert' }
  ];
  const C = {
    heatrash: { name: 'Heat rash (bungang-araw)', sign: 'Tiny itchy red bumps where you sweat: neck, chest, back, folds of skin.',
      todo: 'Cool down in the shade, wear loose cotton clothes and keep the skin dry. Avoid thick creams.', help: 'See a health center if there are pus bumps, fever, or it spreads.' },
    dengue: { name: 'Dengue rash', sign: 'A red rash, often with high fever, headache and body pain, usually a few days after the fever starts.',
      todo: 'Rest, drink plenty of fluids and take paracetamol for fever. No aspirin or ibuprofen.', help: 'Go to the hospital now if there is bleeding from gums or nose, severe belly pain, nonstop vomiting or drowsiness.', danger: true },
    lepto: { name: 'Leptospirosis risk (floodwater wound)', sign: 'Any cut or scratch that touched floodwater can let the germ in.',
      todo: 'Wash with soap and clean water, then cover it. Visit a health center within 1–2 days and ask about preventive medicine.', help: 'Go to the hospital if fever comes with calf pain, red or yellow eyes, or little urine.', danger: true },
    infected: { name: 'Infected wound', sign: 'Redness that spreads, warmth, swelling, pus or a bad smell around a wound.',
      todo: 'Clean it gently with soap and water and cover with a clean bandage. Change it every day.', help: 'See a health center today if it spreads or you have fever.' },
    bite: { name: 'Insect bite or sting', sign: 'A swollen, itchy bump, sometimes with a small dot in the middle.',
      todo: 'Wash it, put a cold compress for 10 minutes and try not to scratch.', help: 'Call 911 if the face, lips or tongue swell, or breathing is hard.', danger: true },
    sprain: { name: 'Sprain or bruise', sign: 'Swelling and pain after a fall or twist, sometimes blue or purple skin.',
      todo: 'Rest it, put a cold compress wrapped in cloth, and raise it.', help: 'See a doctor if you cannot move it or the pain is severe.' },
    sunburn: { name: 'Sunburn', sign: 'Red, hot, painful skin after time in the sun.',
      todo: 'Cool the skin with clean water, stay in the shade and drink water.', help: 'See a health center if there are big blisters, fever or chills.' },
    heatstroke: { name: 'Heat stroke warning', sign: 'Hot, red, dry skin with confusion, fainting or a very high temperature.',
      todo: 'Call 911, move the person to the shade and cool them with water and fanning.', help: 'This is an emergency. Call 911 now.', danger: true, call: true },
    feet: { name: 'Athlete\'s foot (alipunga) or skin infection', sign: 'Itchy, peeling or cracked skin between the toes after wet feet.',
      todo: 'Wash and dry the feet well, change to dry socks and use an antifungal cream from the pharmacy.', help: 'See a health center if it turns red, swollen and painful.' },
    jaundice: { name: 'Possible leptospirosis or liver problem', sign: 'Yellow color in the eyes or skin.',
      todo: 'Do not wait. Go to the hospital.', help: 'Go to the hospital now. Call 911 if you need transport.', danger: true, call: true }
  };
  const MAP = {
    heat: { rash: ['heatrash', 'bite'], wound: ['infected'], swell: ['bite', 'sprain'], redskin: ['sunburn', 'heatstroke'], feet: ['feet'], yellow: ['jaundice'] },
    rain: { rash: ['dengue', 'bite'], wound: ['lepto', 'infected'], swell: ['bite', 'sprain'], redskin: ['sunburn'], feet: ['feet', 'lepto'], yellow: ['jaundice'] }
  };

  /* ---------- make the photo clearer: auto levels, a little brightness if dark, light sharpening ---------- */
  function loadImage(url) { return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; }); }
  async function clarify(file) {
    const url = URL.createObjectURL(file), im = await loadImage(url);
    const k = Math.min(1, MAX / Math.max(im.width, im.height)), w = Math.round(im.width * k), h = Math.round(im.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    const img = x.getImageData(0, 0, w, h), d = img.data, n = w * h;
    // per-channel 1% / 99% stretch
    const lo = [0, 0, 0], hi = [255, 255, 255];
    for (let ch = 0; ch < 3; ch++) {
      const hist = new Uint32Array(256);
      for (let i = ch; i < d.length; i += 4) hist[d[i]]++;
      let acc = 0, a = 0, b = 255;
      for (; a < 255; a++) { acc += hist[a]; if (acc > n * 0.01) break; }
      acc = 0; for (; b > 0; b--) { acc += hist[b]; if (acc > n * 0.01) break; }
      if (b - a > 40) { lo[ch] = a; hi[ch] = b; }
    }
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) for (let ch = 0; ch < 3; ch++) { const v = (d[i + ch] - lo[ch]) * 255 / (hi[ch] - lo[ch]); d[i + ch] = v < 0 ? 0 : v > 255 ? 255 : v; if (ch === 1) sum += d[i + 1]; }
    const mean = sum / n / 255, g = mean < 0.42 ? 0.8 : 1;   // lift a dark photo
    if (g !== 1) { const lut = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) lut[v] = 255 * Math.pow(v / 255, g); for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; } }
    // light sharpening (3x3 unsharp)
    const src = new Uint8ClampedArray(d), s = 0.45, row = w * 4;
    for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
      const i = y * row + xx * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v = src[i + ch], blur = (src[i + ch - 4] + src[i + ch + 4] + src[i + ch - row] + src[i + ch + row]) / 4;
        d[i + ch] = v + (v - blur) * s * 2;
      }
    }
    x.putImageData(img, 0, 0);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9));
    return { file, url, clear: URL.createObjectURL(blob), clearFile: new File([blob], 'bantaydavao-photo-check.jpg', { type: 'image/jpeg' }) };
  }

  document.addEventListener('change', async e => {
    if (e.target.id !== 'signPhoto' || !e.target.files[0]) return;
    clear();
    BD.ui.photoCheck = { busy: true }; BD.render();
    try { BD.ui.photoCheck = Object.assign(await clarify(e.target.files[0]), { view: 'clear', look: null, zoom: null }); }
    catch (x) { BD.ui.photoCheck = null; BD.toast(I('alert', 16) + 'Could not open that photo. Try another one.'); }
    BD.render();
  });
  function clear() { const p = BD.ui.photoCheck; if (p) ['url', 'clear'].forEach(k => p[k] && URL.revokeObjectURL(p[k])); BD.ui.photoCheck = null; }

  /* ---------- the card ---------- */
  BD.photoCard = function () {
    const p = BD.ui.photoCheck, season = BD.state.season;
    const head = '<div class="card-head"><h3>' + I('camera', 18) + 'Photo check</h3><span class="tag sample">Preview</span></div>';
    if (!p) return '<div class="card photo-card">' + head +
      '<p class="fine">' + I('info', 13) + 'Take a photo of the affected area (rash, wound, swelling). BantayDavao makes it clearer and shows the possible signs to watch for. The photo stays on your phone.</p>' +
      '<label class="btn btn-primary btn-block photo-pick">' + I('camera', 18) + 'Take a photo<input type="file" id="signPhoto" accept="image/*" capture="environment" hidden></label></div>';
    if (p.busy) return '<div class="card photo-card">' + head + '<div class="dd-empty">' + I('sparkle', 16) + 'Making the photo clearer…</div></div>';
    const z = p.zoom, src = p.view === 'clear' ? p.clear : p.url;
    const img = '<div class="pc-frame' + (z ? ' zoomed' : '') + '" data-action="photoZoom" role="button" tabindex="0" aria-label="Tap to zoom">' +
      '<img src="' + src + '" alt="Photo of the affected area"' + (z ? ' style="transform-origin:' + z[0] + '% ' + z[1] + '%"' : '') + '></div>';
    const seg = '<div class="mini-seg pc-seg" role="group" aria-label="Photo">' +
      '<button class="' + (p.view === 'clear' ? 'on' : '') + '" data-action="photoView" data-v="clear">' + I('sparkle', 14) + 'Clearer</button>' +
      '<button class="' + (p.view === 'orig' ? 'on' : '') + '" data-action="photoView" data-v="orig">Original</button></div>';
    const looks = '<p class="pc-q">What does it look like?</p><div class="syms pc-looks">' + LOOKS.filter(l => MAP[season][l.id]).map(l =>
      '<button class="sym' + (p.look === l.id ? ' on' : '') + '" data-action="photoLook" data-id="' + l.id + '" aria-pressed="' + (p.look === l.id) + '">' + (p.look === l.id ? I('check', 14) : '') + l.label + '</button>').join('') + '</div>';
    let result = '';
    if (p.look) {
      const list = MAP[season][p.look].map(id => C[id]);
      result = '<div class="pc-result"><p class="pc-k">Possible signs to watch for</p>' + list.map(c =>
        '<div class="pc-cond' + (c.danger ? ' danger' : '') + '"><b>' + esc(c.name) + '</b><span>' + esc(c.sign) + '</span>' +
        '<span class="pc-do">' + I('check', 14) + '<span>' + esc(c.todo) + '</span></span>' +
        '<span class="pc-help">' + I('alert', 14) + '<span>' + esc(c.help) + '</span></span></div>').join('') +
        (list.some(c => c.call) ? '<a class="btn btn-call btn-block" href="tel:911">' + I('phone', 18) + 'Call 911 · free, 24/7</a>' : '') + '</div>';
    }
    return '<div class="card photo-card">' + head + img + seg +
      '<p class="fine pc-note">' + I('info', 13) + 'Photo reading by AI is coming soon. For now, the suggestions come from what you pick below, not from the photo. This is not a diagnosis: when in doubt, see a health worker.</p>' +
      looks + result +
      '<div class="backup-btns"><button class="btn btn-soft sm" data-action="photoSend">' + I('share', 16) + 'Send photo</button>' +
      '<label class="btn btn-ghost sm photo-pick">' + I('camera', 16) + 'Retake<input type="file" id="signPhoto" accept="image/*" capture="environment" hidden></label></div>' +
      '<button class="link-btn" data-action="photoClear">' + I('x', 14) + 'Remove photo</button></div>';
  };

  Object.assign(BD.actions = BD.actions || {}, {
    photoView(el) { BD.ui.photoCheck.view = el.dataset.v; BD.render(); },
    photoLook(el) { const p = BD.ui.photoCheck; p.look = p.look === el.dataset.id ? null : el.dataset.id; BD.render(); },
    photoZoom(el, e) {
      const p = BD.ui.photoCheck;
      if (p.zoom) p.zoom = null;
      else { const r = el.getBoundingClientRect(), ev = window.event || e; const cx = ev && ev.clientX != null ? ev.clientX : r.left + r.width / 2, cy = ev && ev.clientY != null ? ev.clientY : r.top + r.height / 2; p.zoom = [Math.round((cx - r.left) / r.width * 100), Math.round((cy - r.top) / r.height * 100)]; }
      BD.render();
    },
    async photoSend() {
      const p = BD.ui.photoCheck; if (!p || p.busy) return;
      const fa = BD.FIRST_AID[BD.state.season], sel = BD.ui.symptoms || {};
      const picked = fa.mild.concat(fa.danger).filter(x => sel[x.id]).map(x => BD.tr(x.label));
      const look = p.look && LOOKS.find(l => l.id === p.look), conds = p.look ? MAP[BD.state.season][p.look].map(id => BD.tr(C[id].name)) : [];
      const msg = BD.tr('BantayDavao · photo check') + (look ? '\n' + BD.tr('Looks like') + ': ' + BD.tr(look.label) : '') + (conds.length ? '\n' + BD.tr('Possible') + ': ' + conds.join(', ') : '') +
        (picked.length ? '\n' + BD.tr('Signs') + ': ' + picked.join(', ') : '') + '\n' + BD.tr('From') + ' ' + BD.state.name + ', ' + BD.timeLabel(BD.now()) + '.\n' + BD.tr('If there are danger signs, call 911.');
      try { if (await BD.shareOut([p.view === 'orig' ? p.file : p.clearFile], msg, BD.tr('Photo check'))) BD.toast(I('check', 16) + 'Photo sent.'); }
      catch (e) { BD.toast(I('info', 16) + 'This browser cannot send photos. Save it and send it from your gallery.'); }
    },
    photoClear() { clear(); BD.render(); }
  });
  BD.PHOTO_CHECK = { LOOKS, C, MAP };   // for tests and translation tools
})(window.BD);
