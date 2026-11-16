/* Live Davao City forecast (hourly temperature, humidity and rain chance, 7 days), cached for offline use.
   The provider lives only in this file, so it can be swapped (for example to MET Norway) without touching the UI.
   Open-Meteo data: CC BY 4.0. Their free tier is for non-commercial use; confirm with info@open-meteo.com before release. */
window.BD = window.BD || {};
(function (BD) {
  const KEY = 'bantaydavao-weather', MAX_AGE = 30 * 60 * 1000, STALE = 36 * 60 * 60 * 1000;
  const URL_ = 'https://api.open-meteo.com/v1/forecast?latitude=7.0731&longitude=125.6128' +
    '&hourly=temperature_2m,relative_humidity_2m,precipitation_probability' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=Asia%2FManila&forecast_days=7';

  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }

  // Hour index by "YYYY-MM-DDTHH" for quick lookups.
  let index = null;
  function build() {
    index = {};
    if (!data) return;
    data.hourly.time.forEach((t, i) => { index[t.slice(0, 13)] = i; });
  }
  build();

  const pad = n => (n < 10 ? '0' : '') + n;
  const hourKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours());
  const usable = () => !!data && Date.now() - data.at < STALE;

  BD.weather = {
    get live() { return usable(); },
    get updatedAt() { return data ? new Date(data.at) : null; },
    source: 'Open-Meteo',
    // Air temperature (°C) and humidity (%) for a clock hour (may be fractional) on day `dayIndex` from today.
    at(hour, dayIndex) {
      if (!usable()) return null;
      const base = BD.addDays(BD.now(), dayIndex || 0), h0 = Math.floor(hour), f = hour - h0;
      const get = h => { const d = new Date(base); d.setHours(0, 0, 0, 0); d.setHours(h); const i = index[hourKey(d)]; return i == null ? null : i; };
      const a = get(h0), b = get(h0 + 1);
      if (a == null) return null;
      const H = data.hourly, mix = (arr) => b == null ? arr[a] : arr[a] + (arr[b] - arr[a]) * f;
      return { temp: mix(H.temperature_2m), rh: mix(H.relative_humidity_2m), rain: H.precipitation_probability[a] };
    },
    // 7 days from today: high/low air temperature and rain chance, or null when there is no fresh forecast.
    days() {
      if (!usable()) return null;
      const D = data.daily, today = BD.todayKey(), start = D.time.indexOf(today);
      if (start < 0) return null;
      const take = arr => arr.slice(start, start + 7).map(v => Math.round(v));
      const out = { high: take(D.temperature_2m_max), low: take(D.temperature_2m_min), rain: take(D.precipitation_probability_max) };
      return out.high.length === 7 ? out : null;
    },
    async refresh(force) {
      if (!navigator.onLine) return false;
      if (!force && data && Date.now() - data.at < MAX_AGE) return false;
      try {
        const r = await fetch(URL_, { cache: 'no-store' });
        if (!r.ok) return false;
        const j = await r.json();
        if (!j.hourly || !j.daily) return false;
        data = { at: Date.now(), hourly: j.hourly, daily: j.daily };
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { }
        build();
        return true;
      } catch (e) { return false; }
    }
  };

  // The 7-day forecast the UI uses: live when we have it, otherwise the embedded sample (labelled as such).
  BD.forecastDays = function (season) {
    const live = BD.weather.days();
    if (live) return Object.assign({ live: true }, live);
    const f = BD.FORECAST[season || 'heat'];
    return { live: false, high: f.high, low: f.low, rain: f.rain };
  };
})(window.BD);
