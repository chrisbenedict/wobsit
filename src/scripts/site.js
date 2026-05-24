// chrisbenedict.me — all client-side behavior
// imported by src/pages/index.astro. Astro bundles + hashes this automatically.

(function () {
  // ──────── live clock ────────
  function tick() {
    const d = new Date();
    const t = d.toTimeString().slice(0, 8);
    const el = document.getElementById('time');
    if (el) el.textContent = t + ' local';
  }
  tick();
  setInterval(tick, 1000);

  // ──────── timezone as "location" ────────
  // the IANA tz database uses America/Los_Angeles for the whole US Pacific
  // zone (SF, LA, San Diego, etc.) — display the SF label since that's
  // where the site owner lives.
  try {
    let tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'America/Los_Angeles') tz = 'America/San_Francisco';
    const loc = document.getElementById('loc');
    if (loc && tz) loc.textContent = tz.replace(/_/g, ' ').toLowerCase();
  } catch (_) { /* swallow */ }

  // ──────── build / touched / version ────────
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  setText('build',   `${yy}.${mm}.${dd}`);
  setText('touched', now.toISOString().slice(0, 10));
  setText('ver',     `0.${yy}.${mm}`);

  // ──────── tab routing ────────
  const tabs = Array.from(document.querySelectorAll('nav.tabs button'));
  const panels = Array.from(document.querySelectorAll('.panel'));
  const names = tabs.map(t => t.dataset.tab);

  function setTab(name) {
    if (!names.includes(name)) return;
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false'));
    panels.forEach(p => { p.dataset.active = (p.dataset.tab === name) ? 'true' : 'false'; });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
  }
  tabs.forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));

  // 1 / 2 / 3 keyboard shortcuts
  const keyMap = { '1': 'home', '2': 'about', '3': 'contact' };
  document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLElement && e.target.matches('input, textarea, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const next = keyMap[e.key];
    if (next) { e.preventDefault(); setTab(next); }
  });

  // honor hash on load + on change
  const hash = (location.hash || '').slice(1);
  if (hash && names.includes(hash)) setTab(hash);
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').slice(1);
    if (names.includes(h)) setTab(h);
  });

  // ──────── now playing ────────
  // fetches /now-playing.json (refreshed by a GitHub Action — no socials exposed)
  // states: loading → empty (no data) | recent (last played, static) | live (streaming now, pulses)
  fetch(`/now-playing.json?t=${Date.now()}`, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      const box = document.getElementById('now');
      if (!box) return;
      if (!data || !data.title) {
        setText('now-title',  '—');
        setText('now-artist', '');
        setText('now-stamp',  '// no recent tracks');
        box.dataset.state = 'empty';
        return;
      }
      setText('now-title',  data.title);
      setText('now-artist', data.artist || '');
      setText('now-stamp', data.playing
        ? '// streaming · now'
        : `// last heard · ${relTime(data.played_at || data.updated_at)}`);
      box.dataset.state = data.playing ? 'live' : 'recent';
    })
    .catch(() => {
      const box = document.getElementById('now');
      if (!box) return;
      setText('now-title',  '—');
      setText('now-artist', '');
      setText('now-stamp',  '// feed unavailable');
      box.dataset.state = 'empty';
    });

  // ──────── helpers ────────
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // spelled-out units — uppercase single-letter abbreviations are
  // ambiguous in JetBrains Mono ("1D" reads like "10").
  function relTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (s < 45)        return 'just now';
    if (s < 3600) {
      const m = Math.max(1, Math.floor(s / 60));
      return m === 1 ? '1 min ago' : `${m} min ago`;
    }
    if (s < 86400) {
      const h = Math.floor(s / 3600);
      return h === 1 ? '1 hr ago' : `${h} hrs ago`;
    }
    if (s < 172800) return 'yesterday';
    if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
    if (s < 1209600) return 'last week';
    if (s < 2592000) return `${Math.floor(s / 604800)} weeks ago`;
    const mo = Math.floor(s / 2592000);
    return mo === 1 ? '1 month ago' : `${mo} months ago`;
  }
})();
