/* Native bridge for the Android app (Capacitor). On the web every helper falls back to browser APIs.
   Capacitor injects window.Capacitor and its plugins globally, so no bundler is needed. */
window.BD = window.BD || {};
(function (BD) {
  const C = window.Capacitor;
  BD.native = !!(C && C.isNativePlatform && C.isNativePlatform());
  // Demo mode (presenter controls, demo clock, sample history and sample places) is for the web pitch only.
  // The app is the public release; add ?demo to the web address to present it.
  BD.demo = !BD.native || /[?&]demo(&|=|$)/.test(location.search);
  BD.VERSION = '1.0.0';
  BD.PLAY_URL = 'https://play.google.com/store/apps/details?id=ph.recontech.bantaydavao';
  const P = name => (BD.native && C.Plugins && C.Plugins[name]) || null;

  function base64(blob) {
    return new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = no;
      r.readAsDataURL(blob);
    });
  }

  // Share text plus optional files (File/Blob objects). Resolves true when shared, false when cancelled.
  // Throws when sharing isn't possible, so callers can fall back (for example to copying the text).
  BD.shareOut = async function (files, text, title) {
    files = (files || []).filter(Boolean);
    const Share = P('Share'), FS = P('Filesystem');
    if (Share && FS) {
      const uris = [];
      for (const f of files) {
        const name = (f.name || 'bantaydavao-' + Date.now() + '.png').replace(/[^\w.-]/g, '_');
        const r = await FS.writeFile({ path: name, data: await base64(f), directory: 'CACHE' });
        uris.push(r.uri);
      }
      try {
        await Share.share(Object.assign({ text, dialogTitle: title || 'Share' }, title ? { title } : {}, uris.length ? { files: uris } : {}));
        return true;
      } catch (e) {
        if (/cancel/i.test((e && e.message) || '')) return false;
        throw e;
      }
    }
    if (navigator.share) {
      const data = files.length && navigator.canShare && navigator.canShare({ files }) ? { files, text } : { text };
      if (title) data.title = title;
      try { await navigator.share(data); return true; } catch (e) { if (e && e.name === 'AbortError') return false; throw e; }
    }
    throw new Error('share-unavailable');
  };

  // One GPS fix: resolves { lat, lng, accuracy } or rejects with a short reason.
  BD.locate = async function () {
    const G = P('Geolocation');
    if (G) {
      let perm = await G.checkPermissions();
      if (perm.location !== 'granted') perm = await G.requestPermissions({ permissions: ['location'] });
      if (perm.location !== 'granted') throw new Error('denied');
      const pos = await G.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    }
    if (!navigator.geolocation) throw new Error('unavailable');
    return new Promise((ok, no) => navigator.geolocation.getCurrentPosition(
      pos => ok({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => no(new Error(err.code === 1 ? 'denied' : 'failed')), { enableHighAccuracy: true, timeout: 15000 }));
  };

  // Status bar icons follow the app bar: light icons on the dark green bar, dark icons on light pages.
  let lastBar = '';
  BD.nativeChrome = function () {
    const SB = P('StatusBar');
    if (!SB) return;
    const app = document.getElementById('app'), dark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    // The strip behind the status bar stays green on pages with a top bar, also while the bar is hidden by scrolling.
    const lightIcons = dark || (app && !app.classList.contains('no-bar') && !BD.ui.center);
    const style = lightIcons ? 'DARK' : 'LIGHT';
    if (style !== lastBar) { lastBar = style; SB.setStyle({ style }).catch(() => { }); }
  };

  BD.nativeReady = function () {
    if (!BD.native) return;
    document.documentElement.classList.add('is-native');
    const S = P('SplashScreen');
    if (S) setTimeout(() => S.hide().catch(() => { }), 150);
    BD.nativeChrome();
  };
})(window.BD);
