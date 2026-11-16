/* PAGASA's daily heat index for Davao City.
   PAGASA has no API. In the hot months (March–May) it publishes a daily PDF table, "Updated Computed and Daily
   Heat Index Values", with one row per synoptic station (Davao City is one) and one column per date.
   The rest of the year the file is missing (HTTP 404): issuance was suspended on 5 June 2026 and resumes
   on 1 March 2027. The PDF reader below is a best effort and must be checked against the first real bulletin
   (or a sample from PAGASA); anything it can't read falls back to the estimate and a link to the bulletin. */
window.BD = window.BD || {};
(function (BD) {
  const URL_ = 'https://pubfiles.pagasa.dost.gov.ph/tamss/weather/heat_index_summary.pdf';
  const KEY = 'bantaydavao-pagasa', EVERY = 3 * 60 * 60 * 1000;
  BD.PAGASA_PAGE = 'https://www.pagasa.dost.gov.ph/weather/heat-index';
  BD.PAGASA_RESUMES = '1 March 2027';
  BD.PAGASA_RAIN = 'https://www.pagasa.dost.gov.ph/regional-forecast/minprsd';

  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; }
  const keep = o => { st = Object.assign({ at: Date.now() }, o); try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } };

  // Text strings from the PDF's content streams (FlateDecode streams are inflated with DecompressionStream).
  async function pdfText(buf) {
    const bytes = new Uint8Array(buf), latin = new TextDecoder('latin1').decode(bytes), out = [];
    const re = /stream\r?\n/g;
    let m;
    while ((m = re.exec(latin))) {
      const start = m.index + m[0].length, end = latin.indexOf('endstream', start);
      if (end < 0) break;
      const dict = latin.slice(Math.max(0, latin.lastIndexOf('obj', m.index)), m.index);
      // Use the exact /Length when it is a plain number; otherwise drop the line break before "endstream".
      // (The browser's inflater rejects trailing bytes.)
      const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      let stop = len ? Math.min(end, start + +len[1]) : end;
      while (!len && stop > start && (bytes[stop - 1] === 10 || bytes[stop - 1] === 13)) stop--;
      let chunk = bytes.subarray(start, stop);
      if (/FlateDecode/.test(dict) && 'DecompressionStream' in window) {
        try { chunk = new Uint8Array(await new Response(new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()); }
        catch (e) { continue; }
      }
      const s = new TextDecoder('latin1').decode(chunk);
      // (text) Tj  and  [(te) -20 (xt)] TJ
      s.replace(/\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^)\\]|\\.)*)\)\s*Tj/g, (all, arr, one) => {
        out.push(arr != null ? arr.replace(/\((?:[^)\\]|\\.)*\)|[^()]+/g, p => p[0] === '(' ? p.slice(1, -1) : (Math.abs(parseFloat(p)) > 200 ? ' ' : '')) : one);
        return '';
      });
      re.lastIndex = end;
    }
    return out.join(' ').replace(/\\([()\\])/g, '$1').replace(/\s+/g, ' ');
  }

  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  // Dates in the table header (e.g. "10 May 2024" or "May 10"), in order, then the numbers on the Davao City row.
  function readDavao(text) {
    const i = text.search(/Davao\s+City/i);
    if (i < 0) return null;
    const head = text.slice(0, i), dates = [];
    head.replace(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/gi,
      (all, d1, m1, m2, d2) => { dates.push({ m: MONTHS.indexOf((m1 || m2).toLowerCase()), d: +(d1 || d2) }); return ''; });
    const row = text.slice(i, i + 160).replace(/Davao\s+City[^0-9]*/i, '');
    // Only the numbers right after the station name, so the next station's row isn't read as Davao's.
    const lead = row.match(/^(?:\s*\d{2}\b)+/), vals = lead ? lead[0].trim().split(/\s+/).map(Number).filter(v => v >= 20 && v <= 70) : [];
    return vals.length ? { dates: dates.slice(-vals.length), vals } : null;
  }

  // In the app, use native HTTP: PAGASA's "not found" page has no CORS header, so a WebView fetch can't even see the 404.
  async function download() {
    const H = BD.native && window.Capacitor.Plugins.CapacitorHttp;
    if (H) {
      const r = await H.get({ url: URL_, responseType: 'arraybuffer' });
      if (r.status !== 200) return { status: r.status };
      const bin = atob(r.data), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return { status: 200, buf: buf.buffer };
    }
    try {
      const r = await fetch(URL_, { cache: 'no-store' });
      return r.ok ? { status: 200, buf: await r.arrayBuffer() } : { status: r.status };
    } catch (e) { return { status: 0 }; }
  }

  BD.pagasa = {
    _readDavao: readDavao,   // for tests/unit_test.py
    inSeason: mo => mo >= 2 && mo <= 4, // March to May
    // { state: 'ok' | 'suspended' | 'unreadable' | 'unknown', hi?: today's PAGASA heat index for Davao City }
    get today() {
      if (!st) return { state: 'unknown' };
      if (st.state !== 'ok') return { state: st.state };
      const now = BD.now(), k = st.days && st.days[(now.getMonth()) + '-' + now.getDate()];
      return k ? { state: 'ok', hi: k } : { state: 'unreadable' };
    },
    async refresh(force) {
      if (!navigator.onLine) return false;
      if (!force && st && Date.now() - st.at < EVERY) return false;
      // PAGASA issues the bulletin only in March–May; outside that window don't ask for it.
      const mo = BD.now().getMonth();
      if (!BD.pagasa.inSeason(mo)) { if (!st || st.state !== 'suspended') { keep({ state: 'suspended' }); return true; } return false; }
      try {
        const got = await download();
        if (got.status === 404) { keep({ state: 'suspended' }); return true; }
        if (!got.buf) { if (!st || st.state !== 'unreadable') { keep({ state: 'unreadable' }); return true; } return false; }
        const row = readDavao(await pdfText(got.buf));
        if (!row || !row.dates.length) { keep({ state: 'unreadable' }); return true; }
        const days = {};
        row.dates.forEach((d, j) => { if (row.vals[j] != null) days[d.m + '-' + d.d] = row.vals[j]; });
        keep({ state: 'ok', days });
        return true;
      } catch (e) { return false; }
    }
  };
  BD.pagasa._readDavao = readDavao; BD.pagasa._pdfText = pdfText; // exposed for tests
})(window.BD);
