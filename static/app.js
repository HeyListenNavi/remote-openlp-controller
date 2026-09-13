'use strict';

(function () {
  const ICONS = {
    images: '🖼️',
    bibles: '📖',
    media: '🎬',
    songs: '🎵',
    presentations: '📽️',
    custom: '📝',
    alerts: '⚠️',
    audio: '🎧',
    notes: '📋',
  };

  const LABELS = {
    images: 'Image',
    bibles: 'Bible',
    media: 'Video',
    songs: 'Song',
    presentations: 'Slides',
    custom: 'Slide',
    alerts: 'Alert',
    audio: 'Audio',
    notes: 'Note',
  };

  const $ = (id) => document.getElementById(id);
  const listEl = $('item-list');
  const hdrIcon = $('hdr-icon');
  const hdrTitle = $('hdr-title');
  const hdrSub = $('hdr-sub');
  const dot = $('status-dot');
  const btnPrev = $('btn-prev');
  const btnNext = $('btn-next');
  const overlay = $('login-overlay');
  const loginForm = $('login-form');
  const loginPin = $('login-pin');
  const loginError = $('login-error');

  let config = { pollIntervalMs: 1500 };
  let items = [];
  let live = null;
  let connection = 'ok';
  let pollTimer = null;

  const iconFor = (plugin) => ICONS[plugin] || '📄';
  const labelFor = (plugin) => LABELS[plugin] || (plugin || '');

  function showLogin() {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    loginPin.focus();
  }

  function hideLogin() {
    overlay.classList.remove('flex');
    overlay.classList.add('hidden');
  }

  async function api(path, opts) {
    let res;
    const headers = Object.assign({ Accept: 'application/json' }, (opts && opts.headers) || {});
    try {
      res = await fetch('/api/openlp' + path, Object.assign({}, opts, { headers }));
    } catch (err) {
      connection = 'down';
      render();
      return null;
    }
    if (res.status === 401) {
      connection = 'auth';
      showLogin();
      render();
      return null;
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.json()).error || '';
      } catch (err) {}
      connection = detail === 'openlp-auth-failed' ? 'openpauth' : 'down';
      hideLogin();
      render();
      return null;
    }
    connection = 'ok';
    hideLogin();
    if (res.status === 204) return null;
    return res.json();
  }

  const get = (p) => api(p, { cache: 'no-store' });
  const post = (p, body) =>
    api(p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

  function slideIndex() {
    if (!live || !Array.isArray(live.slides) || !live.slides.length) return -1;
    const i = live.slides.findIndex((s) => s.selected);
    return i >= 0 ? i : 0;
  }

  function liveItemIndex() {
    if (!live) return -1;
    return items.findIndex((i) => i.id === live.id);
  }

  function canNext() {
    if (!live) return false;
    const s = slideIndex();
    if (live.slides && s >= 0 && s < live.slides.length - 1) return true;
    const li = liveItemIndex();
    return li >= 0 && li < items.length - 1;
  }

  function canPrev() {
    if (!live) return false;
    if (slideIndex() > 0) return true;
    return liveItemIndex() > 0;
  }

  function render() {
    const sIdx = slideIndex();
    const lIdx = liveItemIndex();
    const plugin = live ? pluginOf(live.id) || live.plugin || '' : '';

    hdrIcon.textContent = iconFor(plugin);
    hdrTitle.textContent = live ? live.title : 'Nothing live';

    if (live && live.slides && live.slides.length && sIdx >= 0) {
      const total = live.slides.length;
      const pos = total > 1 ? `${sIdx + 1}/${total}` : '';
      const tag = live.slides[sIdx].tag || '';
      hdrSub.textContent = [labelFor(plugin), tag, pos].filter(Boolean).join(' · ');
    } else if (connection === 'ok') {
      hdrSub.textContent = 'Ready';
    } else if (connection === 'down') {
      hdrSub.textContent = 'OpenLP unreachable';
    } else if (connection === 'openpauth') {
      hdrSub.textContent = 'OpenLP login failed';
    } else {
      hdrSub.textContent = 'PIN required';
    }

    dot.className =
      'h-3 w-3 shrink-0 rounded-full ' +
      (connection === 'ok'
        ? 'bg-emerald-500'
        : connection === 'down'
          ? 'bg-red-500'
          : 'bg-amber-400');

    listEl.innerHTML = '';
    items.forEach((it, idx) => {
      const active = lIdx === idx || (live && it.id === live.id);
      const row = document.createElement('button');
      row.type = 'button';
      row.className =
        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition active:bg-slate-800 ' +
        (active ? 'bg-indigo-500/20 ring-1 ring-indigo-400/40' : 'hover:bg-slate-800/60');

      const ic = document.createElement('span');
      ic.className = 'fe w-8 shrink-0 text-center text-2xl leading-none';
      ic.textContent = iconFor(it.plugin);

      const t = document.createElement('span');
      t.className =
        'min-w-0 flex-1 truncate text-sm font-medium ' + (active ? 'text-white' : 'text-slate-300');
      t.textContent = it.title;

      const lb = document.createElement('span');
      lb.className = 'shrink-0 text-[10px] uppercase tracking-wide text-slate-500';
      lb.textContent = labelFor(it.plugin);

      row.append(ic, t, lb);
      row.addEventListener('click', () => goShow(it.id));
      listEl.appendChild(row);

      if (active) setTimeout(() => row.scrollIntoView({ block: 'nearest' }), 0);
    });

    btnNext.disabled = !canNext();
    btnPrev.disabled = !canPrev();
  }

  function pluginOf(id) {
    const it = items.find((i) => i.id === id);
    return it ? it.plugin : '';
  }

  async function refresh() {
    const res = await Promise.all([get('/service/items'), get('/controller/live-items')]);
    if (!res[0]) return;
    items = res[0];
    live = res[1] && res[1].id ? res[1] : null;
    render();
  }

  async function goShow(id) {
    await post('/service/show', { id });
    refresh();
  }

  async function actNext() {
    if (!canNext()) return;
    const s = slideIndex();
    if (live && live.slides && s >= 0 && s < live.slides.length - 1) {
      await post('/controller/progress', { action: 'next' });
    } else {
      await post('/service/progress', { action: 'next' });
    }
    refresh();
  }

  async function actPrev() {
    if (!canPrev()) return;
    if (slideIndex() > 0) {
      await post('/controller/progress', { action: 'previous' });
    } else {
      await post('/service/progress', { action: 'previous' });
    }
    refresh();
  }

  btnNext.addEventListener('click', actNext);
  btnPrev.addEventListener('click', actPrev);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      actNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      actPrev();
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPin.value }),
      });
      if (r.ok) {
        loginPin.value = '';
        hideLogin();
        refresh();
      } else {
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.classList.remove('hidden');
    }
  });

  async function start() {
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) config = Object.assign(config, await r.json());
    } catch (err) {}
    if (!config.pollIntervalMs) config.pollIntervalMs = 1500;
    pollTimer = setInterval(refresh, config.pollIntervalMs);
    refresh();
  }

  start();
})();