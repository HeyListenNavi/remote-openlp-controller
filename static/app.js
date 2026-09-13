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

  const $ = (id) => document.getElementById(id);
  const listEl = $('item-list');
  const chipsEl = $('verse-chips');
  const liveInfo = $('live-info');
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
  let chipsVisible = false;

  const iconFor = (plugin) => ICONS[plugin] || '📄';

  function showLogin() {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    setTimeout(() => loginPin.focus(), 50);
  }

  function hideLogin() {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.classList.remove('flex'), 300);
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

  function shouldShowChips() {
    return live && live.name === 'bibles' && Array.isArray(live.slides) && live.slides.length >= 2;
  }

  function renderChips() {
    const wantVisible = shouldShowChips();

    if (!wantVisible) {
      if (chipsVisible) {
        chipsEl.classList.remove('chips-visible');
        chipsEl.classList.add('chips-hidden');
        chipsVisible = false;
      }
      return;
    }

    chipsEl.innerHTML = '';
    const sIdx = slideIndex();
    live.slides.forEach((slide, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = slide.tag || `${idx + 1}`;
      chip.className =
        'shrink-0 rounded-full px-5 py-3 text-sm font-semibold min-h-[48px] min-w-[60px] ' +
        (idx === sIdx
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-slate-200 text-slate-600');
      chip.addEventListener('click', () => goSlide(idx));
      chipsEl.appendChild(chip);
    });

    if (!chipsVisible) {
      chipsEl.classList.remove('chips-hidden');
      chipsEl.classList.add('chips-visible');
      chipsVisible = true;
    }
  }

  function setTextSmooth(el, text) {
    if (el.textContent === text) return;
    el.classList.add('fading');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('fading');
    }, 200);
  }

  function render() {
    const sIdx = slideIndex();
    const lIdx = liveItemIndex();

    let infoText = '';
    if (live) {
      const tag = sIdx >= 0 && live.slides[sIdx] && live.slides[sIdx].tag ? live.slides[sIdx].tag : '';
      const total = live.slides ? live.slides.length : 0;
      const pos = total > 1 ? `${sIdx + 1}/${total}` : '';
      infoText = [live.title, tag, pos].filter(Boolean).join(' · ');
    } else if (connection === 'ok') {
      infoText = 'Nada en vivo';
    } else if (connection === 'down') {
      infoText = 'Sin conexión';
    }

    setTextSmooth(liveInfo, infoText);

    dot.className =
      'fixed right-5 top-5 h-2.5 w-2.5 rounded-full z-10 transition-colors duration-300 ' +
      (connection === 'ok'
        ? 'bg-emerald-400'
        : connection === 'down'
          ? 'bg-red-400'
          : 'bg-amber-400');

    renderChips();

    listEl.innerHTML = '';
    items.forEach((it, idx) => {
      const active = live && it.id === live.id;
      const row = document.createElement('button');
      row.type = 'button';
      row.className =
        'flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all duration-200 ease-out ' +
        (active ? 'bg-indigo-50' : 'bg-transparent active:bg-slate-100');

      const ic = document.createElement('span');
      ic.className = 'fe shrink-0 text-center text-[1.6rem] leading-none';
      ic.textContent = iconFor(it.plugin);

      const t = document.createElement('span');
      t.className =
        'min-w-0 flex-1 truncate text-[15px] font-medium transition-colors duration-200 ' +
        (active ? 'text-indigo-700' : 'text-slate-700');
      t.textContent = it.title;

      if (active) {
        const check = document.createElement('span');
        check.className = 'shrink-0 text-indigo-500 text-sm font-medium';
        check.textContent = 'En vivo';
        row.append(ic, t, check);
      } else {
        row.append(ic, t);
      }

      row.addEventListener('click', () => goShow(it.id));
      listEl.appendChild(row);

      if (active && idx !== lIdx) {
        setTimeout(() => row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
      }
    });

    btnNext.disabled = !canNext();
    btnPrev.disabled = !canPrev();
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

  async function goSlide(idx) {
    await post('/controller/show', { id: idx });
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