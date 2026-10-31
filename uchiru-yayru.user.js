// ==UserScript==
// @name         yayru - решатель Учи.Ру
// @namespace    https://www.hayrulla.gamer.free
// @version      1.0.0
// @description  Бесплатный решатель карточек Учи.ру. Сделано: www.hayrulla.gamer.free
// @author       www.hayrulla.gamer.free
// @match        https://uchi.ru/exercise/player/*
// @match        https://uchi.ru/teens/tasking/player/*
// @grant        none
// @run-at       document-end
// @noframes     false
// ==/UserScript==

(function () {
  'use strict';

  // ─── 1. Проверка контекста ────────────────────────────────────
  const url = new URL(location.href);
  const cardId = url.searchParams.get('card_id');
  const subjectId = url.searchParams.get('subject_id');
  const contentCardId = url.searchParams.get('content_card_id');
  const gatewayKey = url.searchParams.get('gateway_idempotency_key');

  if (!cardId || !subjectId) return;

  // ─── 2. Настройки ─────────────────────────────────────────────
  const STORAGE_KEY = 'yayru_settings';
  const settings = Object.assign(
    { autoSolve: false, minimize: false },
    JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  );
  const saveSettings = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

  // ─── 3. UI через Shadow DOM ──────────────────────────────────
  const host = document.createElement('div');
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .wrap {
        position: fixed;
        bottom: calc(20px + env(safe-area-inset-bottom, 0px));
        right: 20px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }
      .btn {
        width: 56px; height: 56px;
        border-radius: 50%;
        border: none;
        background: #7C5CFC;
        color: #fff;
        font-size: 28px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(124,92,252,0.45);
        display: flex; align-items: center; justify-content: center;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        transition: transform .15s, background .15s;
      }
      .btn:active { transform: scale(0.92); }
      .btn.loading { background: #6A48E8; animation: pulse 1s infinite; }
      .btn.ok { background: #10B981; box-shadow: 0 6px 18px rgba(16,185,129,0.45); }
      .btn.err { background: #EF4444; box-shadow: 0 6px 18px rgba(239,68,68,0.45); }
      .panel {
        background: #fff;
        border-radius: 16px;
        padding: 12px 14px;
        width: 240px;
        box-shadow: 0 8px 30px rgba(30,20,60,0.18);
        font-size: 13px;
        color: #1E1B3A;
        display: none;
      }
      .panel.show { display: block; }
      .panel h3 { margin: 0 0 6px; font-size: 14px; color: #1E1B3A; }
      .panel p { margin: 0 0 10px; font-size: 12px; color: #64607A; line-height: 1.4; }
      .panel label {
        display: flex; align-items: center; gap: 8px;
        font-size: 12px; color: #1E1B3A;
        margin-bottom: 8px; cursor: pointer;
      }
      .panel input[type="checkbox"] {
        width: 16px; height: 16px; accent-color: #7C5CFC;
      }
      .panel .brand {
        font-size: 10px; color: #A8A3B8;
        text-align: center;
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px solid #ECE9F4;
      }
      .panel .brand a { color: #7C5CFC; text-decoration: none; }
      .status {
        font-size: 11px;
        color: #64607A;
        background: rgba(255,255,255,0.9);
        border-radius: 8px;
        padding: 4px 8px;
        max-width: 220px;
        text-align: right;
        display: none;
      }
      .status.show { display: block; }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      @media (prefers-color-scheme: dark) {
        .panel { background: #1A1729; color: #F2F0FA; }
        .panel h3 { color: #F2F0FA; }
        .panel p { color: #B4AFC8; }
        .panel label { color: #F2F0FA; }
        .panel .brand { border-color: #2A263B; color: #7C7792; }
        .status { background: rgba(26,23,41,0.9); color: #B4AFC8; }
      }
    </style>
    <div class="wrap">
      <div class="status" id="status"></div>
      <div class="panel" id="panel">
        <h3>yayru</h3>
        <p>Решатель карточек Учи.ру.</p>
        <label>
          <input type="checkbox" id="auto" ${settings.autoSolve ? 'checked' : ''}>
          Решать автоматически
        </label>
        <div class="brand">Сделано: <a href="http://www.hayrulla.gamer.free" target="_blank">www.hayrulla.gamer.free</a></div>
      </div>
      <button class="btn" id="btn" title="yayru — решить">y</button>
    </div>
  `;

  const wrap = shadow.querySelector('.wrap');
  wrap.style.position = 'fixed';
  wrap.style.bottom = 'calc(20px + env(safe-area-inset-bottom, 0px))';
  wrap.style.right = '20px';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'flex-end';
  wrap.style.gap = '8px';

  shadow.querySelector('.btn').style.cssText += 'position: relative;';
  // Перемещаем позиционирование к .wrap, а не к .btn
  shadow.querySelector('.wrap').style.cssText = `
    position: fixed;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    right: 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    z-index: 2147483647;
  `;

  const btn = shadow.querySelector('#btn');
  const panel = shadow.querySelector('#panel');
  const status = shadow.querySelector('#status');
  const autoCheckbox = shadow.querySelector('#auto');

  (document.body || document.documentElement).appendChild(host);

  function setStatus(text, timeout = 4000) {
    status.textContent = text;
    status.classList.add('show');
    if (timeout) setTimeout(() => status.classList.remove('show'), timeout);
  }

  function setBtnState(state) {
    btn.classList.remove('loading', 'ok', 'err');
    if (state === 'loading') { btn.classList.add('loading'); btn.textContent = '…'; btn.disabled = true; }
    else if (state === 'ok') { btn.classList.add('ok'); btn.textContent = '✓'; }
    else if (state === 'err') { btn.classList.add('err'); btn.textContent = '✕'; }
    else { btn.textContent = 'y'; btn.disabled = false; }
  }

  // Долгое нажатие на кнопку = открыть панель настроек
  let pressTimer = null;
  let longPressed = false;

  const startPress = () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      panel.classList.toggle('show');
    }, 500);
  };
  const endPress = () => {
    clearTimeout(pressTimer);
    if (!longPressed) {
      if (panel.classList.contains('show')) {
        panel.classList.remove('show');
        return;
      }
      solveCard().catch(e => {
        console.error('[yayru]', e);
        setBtnState('err');
        setStatus('Ошибка: ' + (e.message || 'неизвестно'));
        setTimeout(() => setBtnState('idle'), 3000);
      });
    }
  };

  btn.addEventListener('mousedown', startPress);
  btn.addEventListener('mouseup', endPress);
  btn.addEventListener('mouseleave', () => clearTimeout(pressTimer));
  btn.addEventListener('touchstart', startPress, { passive: true });
  btn.addEventListener('touchend', (e) => { e.preventDefault(); endPress(); });
  btn.addEventListener('touchcancel', () => clearTimeout(pressTimer));

  autoCheckbox.addEventListener('change', () => {
    settings.autoSolve = autoCheckbox.checked;
    saveSettings();
    setStatus(settings.autoSolve ? 'Авто-решение включено' : 'Авто-решение выключено');
  });

  // ─── 4. API ───────────────────────────────────────────────────
  const API = 'https://uchi.ru/exercise/player/api/v1';
  let sessionId = '';

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Student-Session': sessionId,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // ─── 5. Решатель ──────────────────────────────────────────────
  async function solveCard() {
    if (btn.disabled && btn.classList.contains('loading')) return;

    setBtnState('loading');
    setStatus('Авторизация…');

    const sess = await api('POST', '/students/sessions');
    sessionId = sess.session_id;

    setStatus('Загрузка карточки…');
    const card = await api(
      'GET',
      `/cards/${cardId}?subject_id=${subjectId}&content_card_id=${contentCardId}&gateway_idempotency_key=${gatewayKey}`
    );
    const progress = await api(
      'GET',
      `/cards/${cardId}/progress?content_card_id=${contentCardId}&gateway_idempotency_key=${gatewayKey}`
    );

    if (progress?.card_progress_state === 'completed') {
      setBtnState('ok');
      setStatus('Карточка уже решена ✓');
      setTimeout(() => setBtnState('idle'), 2000);
      return;
    }

    const chunks = card.chunks || [];
    let startIdx = 0;
    if (progress?.chunk_id != null) {
      const idx = chunks.findIndex(c => c.id === progress.chunk_id);
      if (idx !== -1) startIdx = idx;
    }
    const pending = chunks.slice(startIdx);
    let total = 0;

    for (const chunk of pending) {
      const chunkData = await api('GET', `/chunks_old_v1/${chunk.id}`);
      const required = Math.max(1, chunk.required_generations_count ?? 1);
      const order = chunkData.order.slice(0, required);

      for (const genId of order) {
        await api('POST', `/cards/${cardId}/generation_complete`, {
          chunk_id: chunk.id,
          generation_id: genId,
          correct: true,
          unmistakable: true,
          working_out: false,
          spent: 8 + Math.floor(Math.random() * 23),
          subject_id: Number(subjectId),
          free: false,
          content_card_id: contentCardId === null ? null : Number(contentCardId),
          gateway_idempotency_key: gatewayKey
        });
        total++;
        setStatus(`Отправлено ${total} ответ(ов)…`);
      }
    }

    await api('POST', `/cards/${cardId}/complete`, {
      subject_id: Number(subjectId),
      content_card_id: contentCardId === null ? null : Number(contentCardId),
      gateway_idempotency_key: gatewayKey
    });

    setBtnState('ok');
    setStatus('Готово! Перезагрузка…');
    setTimeout(() => location.reload(), 1200);
  }

  // ─── 6. Авто-старт ────────────────────────────────────────────
  if (settings.autoSolve) {
    setTimeout(() => {
      solveCard().catch(e => {
        console.error('[yayru] auto', e);
        setBtnState('err');
      });
    }, 1500);
  }

  console.log('[yayru] v1.0.0 · www.hayrulla.gamer.free');
})();
