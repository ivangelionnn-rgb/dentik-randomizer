// ============================================================
//  РАНДОМАЙЗЕР DENTIK__ — script.js
// ============================================================
/* global tmi */

const $ = id => document.getElementById(id);

// --- Основные элементы ---
const participantsEl = $('participants');
const countEl        = $('count');
const canvas         = $('wheel');
const ctx            = canvas.getContext('2d');
const winnersEl      = $('winners');
const timerEl        = $('timer');
const timerBar       = $('timerBar');
const historyEl      = $('history');
const keywordEl      = $('keyword');

// --- Чат победителя ---
const chatPanel      = $('chatPanel');
const chatMessagesEl = $('chatMessages');
const chatTitleEl    = $('chatTitle');
const openChatBtn    = $('openChatBtn');
let chatWinner       = null;

// --- Состояние ---
let history = [];
let timerInterval = null;
let twitchClient = null;
let twitchConnected = false;
const collectedUsers = new Set();

let currentAngle = 0;
let isSpinning = false;

let raceActive = false;
let raceWinner = null;
let raceTimeout = null;

const recentWinners = [];

const STORAGE_KEY = 'dentik_randomizer_v1';

// ============================================================
//  ДИСКЛЕЙМЕР — меняй только этот блок
// ============================================================
// 1) Текст дисклеймера (заголовок + описание)
const DISCLAIMER_TITLE = '💰 Добавлены ставки!';
const DISCLAIMER_BODY  = 'Теперь зрители могут писать !bet 100...';

// 2) Версия — меняй при каждом обновлении текста (v1 → v2 → v3 → ...)
//    Каждая новая версия покажет дисклеймер всем зрителям заново.
const DISCLAIMER_VERSION = 'v2';
// ============================================================

// ============================================================
//  ЧАТ ПОБЕДИТЕЛЯ — открыть / закрыть
// ============================================================
function showChat() {
  chatPanel.classList.add('open');
  openChatBtn.classList.remove('visible');
}
function hideChat() {
  chatPanel.classList.remove('open');
  openChatBtn.classList.add('visible');
}

openChatBtn.addEventListener('click', showChat);

$('clearChat').addEventListener('click', () => {
  hideChat();
  chatWinner = null;
  chatTitleEl.textContent = '💬 Чат победителя';
  chatMessagesEl.innerHTML = '<div class="chat-empty">Здесь появятся сообщения победителя</div>';
});

function setChatWinner(winner) {
  chatWinner = winner;
  chatTitleEl.textContent = '💬 ' + winner;
  chatMessagesEl.innerHTML = '<div class="chat-empty">Ждём сообщений от ' + winner + '…</div>';
  showChat();
}

function appendChatMessage(sender, message) {
  if (!chatWinner) return;
  if ((sender || '').toLowerCase() !== chatWinner.toLowerCase()) return;

  const empty = chatMessagesEl.querySelector('.chat-empty');
  if (empty) empty.remove();

  const time = new Date().toLocaleTimeString().slice(0, 5);
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.textContent = message;
  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = time;
  div.appendChild(timeSpan);
  chatMessagesEl.appendChild(div);

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// ============================================================
//  ТЕМЫ
// ============================================================
const THEMES = ['', 'theme-neon', 'theme-cyberpunk', 'theme-valentine'];
const THEME_NAMES = ['Classic', 'Neon', 'Cyberpunk', 'Valentine'];
let currentThemeIdx = 0;

function applyTheme(idx) {
  document.body.classList.remove('theme-neon', 'theme-cyberpunk', 'theme-valentine');
  if (THEMES[idx]) document.body.classList.add(THEMES[idx]);
  currentThemeIdx = idx;
  $('themeBtn').textContent = '🎨 ' + THEME_NAMES[idx];
  localStorage.setItem('dentik_theme', String(idx));
  drawWheel(getParticipants(), currentAngle);
}

$('themeBtn').addEventListener('click', () => {
  applyTheme((currentThemeIdx + 1) % THEMES.length);
});

// ============================================================
//  УЧАСТНИКИ
// ============================================================
function isIgnored(name) {
  const raw = ($('ignoreList').value || '').trim().toLowerCase();
  if (!raw) return false;
  const list = raw.split(',').map(s => s.trim().toLowerCase());
  return list.includes((name || '').toLowerCase());
}

function getParticipants() {
  return participantsEl.value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(n => !isIgnored(n));
}

function updateCount() {
  countEl.textContent = getParticipants().length;
}

// ============================================================
//  КОЛЕСО
// ============================================================
function sectorColors() {
  const css = getComputedStyle(document.body);
  const accent = css.getPropertyValue('--accent').trim() || '#8b6dff';
  const accent2 = css.getPropertyValue('--accent-2').trim() || '#6a4fe0';
  const win = css.getPropertyValue('--win').trim() || '#4fd18b';
  return [accent, accent2, accent, '#a866ff', accent2, win, accent, '#3d246e'];
}

function drawWheel(participants, rotation = 0) {
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2 - 8;

  ctx.clearRect(0, 0, w, h);

  if (participants.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#22232b';
    ctx.fill();
    ctx.strokeStyle = sectorColors()[0];
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#e8e8f0';
    ctx.font = 'bold 48px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
    return;
  }

  const n = participants.length;
  const anglePer = (Math.PI * 2) / n;
  const colors = sectorColors();

  for (let i = 0; i < n; i++) {
    const start = i * anglePer + rotation;
    const end = start + anglePer;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#1e1f26';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + anglePer / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    let name = participants[i];
    if (name.length > 14) name = name.slice(0, 12) + '…';
    ctx.fillText(name, r - 14, 0);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 2);
  ctx.lineTo(cx - 14, cy - r - 26);
  ctx.lineTo(cx + 14, cy - r - 26);
  ctx.closePath();
  ctx.fillStyle = '#ffb454';
  ctx.fill();
  ctx.strokeStyle = '#1e1f26';
  ctx.lineWidth = 2;
  ctx.stroke();
}

drawWheel([]);

// ============================================================
//  ЗВУК
// ============================================================
function playSound(src) {
  if (!$('soundOn').checked) return;
  const audio = new Audio(src);
  audio.volume = 0.6;
  audio.play().catch(() => {});
}

// ============================================================
//  КОНФЕТТИ
// ============================================================
const confettiCanvas = $('confetti');
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let confettiAnimId = null;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfetti();
window.addEventListener('resize', resizeConfetti);

function launchConfetti() {
  if (!$('confettiOn').checked) return;
  const colors = ['#8b6dff', '#ffb454', '#4fd18b', '#ff5c8a', '#00ffe1', '#ffe600'];
  confettiParticles = [];
  for (let i = 0; i < 180; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 5,
      size: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3
    });
  }
  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animateConfetti();
}

function animateConfetti() {
  const w = confettiCanvas.width;
  const h = confettiCanvas.height;
  confettiCtx.clearRect(0, 0, w, h);
  let alive = 0;
  for (const p of confettiParticles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.rot += p.vrot;
    if (p.y < h + 30) {
      alive++;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
    }
  }
  if (alive > 0) confettiAnimId = requestAnimationFrame(animateConfetti);
  else { confettiCtx.clearRect(0, 0, w, h); confettiAnimId = null; }
}

function highlightWinnerInList() {
  participantsEl.classList.add('winner-active');
  setTimeout(() => participantsEl.classList.remove('winner-active'), 3000);
}

// ============================================================
//  РОЗЫГРЫШ
// ============================================================
$('startBtn').addEventListener('click', () => {
  const list = getParticipants();
  if (list.length === 0) {
    alert('Добавь участников!');
    return;
  }

  const winnersCount = Math.min(parseInt($('winnersCount').value) || 1, list.length);

  winnersEl.textContent = '';
  timerEl.textContent = '';
  timerBar.style.width = '100%';
  $('raceStatus').textContent = '';

  const anti = parseInt($('antiRepeat').value) || 0;
  let pool = [...list];
  if (anti > 0) {
    const filtered = pool.filter(n => !recentWinners.includes(n));
    if (filtered.length >= winnersCount) pool = filtered;
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const winners = pool.slice(0, winnersCount);

  const spin = $('spinAnim').checked;
  if (spin) playSound('assets/drum.mp3');

  const winnerIndexInList = list.indexOf(winners[0]);
  const anglePer = (Math.PI * 2) / list.length;
  const targetRotation =
    -Math.PI / 2 - winnerIndexInList * anglePer - anglePer / 2 + Math.PI * 2 * 5;

  if (!spin) {
    currentAngle = targetRotation;
    drawWheel(list, currentAngle);
    finishRound(winners);
    return;
  }

  isSpinning = true;
  const startAngle = currentAngle;
  const endAngle = targetRotation;
  const duration = 4000;
  const startTime = performance.now();

  function animate(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    currentAngle = startAngle + (endAngle - startAngle) * eased;
    drawWheel(list, currentAngle);
    if (t < 1) requestAnimationFrame(animate);
    else { isSpinning = false; finishRound(winners); }
  }
  requestAnimationFrame(animate);
});

// ============================================================
//  ФИНАЛ РАУНДА
// ============================================================
function finishRound(winners) {
  winnersEl.textContent = '🏆 ' + winners.join(', ');
  playSound('assets/ding.mp3');
  setTimeout(() => playSound('assets/ding.mp3'), 250);

  launchConfetti();
  highlightWinnerInList();

  if (winners.length > 0) setChatWinner(winners[0]);

  const stamp = new Date().toLocaleTimeString();
  history.unshift('[' + stamp + '] ' + winners.join(', '));
  historyEl.innerHTML = history.slice(0, 10).map(h => '<li>' + h + '</li>').join('');

  const anti = parseInt($('antiRepeat').value) || 0;
  if (anti > 0) {
    recentWinners.unshift(...winners);
    while (recentWinners.length > anti) recentWinners.pop();
  }

  startTimer(parseInt($('timerSec').value) || 60);
  if ($('raceMode').checked) startRace(winners[0]);
}

// ============================================================
//  ТАЙМЕР
// ============================================================
function startTimer(seconds) {
  clearInterval(timerInterval);
  const total = seconds;
  let left = seconds;

  timerEl.textContent = left + ' сек на ответ';
  timerBar.style.width = '100%';

  timerInterval = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = 'Время вышло!';
      timerBar.style.width = '0%';
      return;
    }
    timerEl.textContent = left + ' сек на ответ';
    timerBar.style.width = ((left / total) * 100).toFixed(1) + '%';
  }, 1000);
}

// ============================================================
//  РЕЖИМ «КТО БЫСТРЕЕ»
// ============================================================
function startRace(winner) {
  raceActive = true;
  raceWinner = winner;
  const sec = parseInt($('timerSec').value) || 60;
  let left = sec;
  $('raceStatus').textContent = '⏳ Ждём ответа от ' + winner + '… ' + left + ' сек';

  clearTimeout(raceTimeout);
  const tick = setInterval(() => {
    left--;
    if (!raceActive || left <= 0) {
      clearInterval(tick);
      if (raceActive) {
        raceActive = false;
        $('raceStatus').textContent = '❌ ' + winner + ' не ответил.';
      }
      return;
    }
    $('raceStatus').textContent = '⏳ Ждём ответа от ' + winner + '… ' + left + ' сек';
  }, 1000);
}

// ============================================================
//  TWITCH
// ============================================================
function updateChatStatus(online) {
  const btn = $('addFromChat');
  if (online) {
    btn.textContent = '🟢 Подключено к чату DENTIK__';
    btn.classList.add('connected');
  } else {
    btn.textContent = '🔴 Подключиться к чату DENTIK__';
    btn.classList.remove('connected');
  }
}

function connectTwitch() {
  if (twitchClient) return;
  if (typeof tmi === 'undefined') {
    alert('tmi.js не загрузился. Проверь файл tmi.min.js рядом с index.html.');
    return;
  }

  twitchClient = new tmi.Client({
    options: { debug: false, skipMembership: true, skipUpdatingEmotesets: true },
    connection: { secure: true, reconnect: true },
    channels: ['dentik__']
  });

  twitchClient.connect()
    .then(() => {
      twitchConnected = true;
      console.log('✅ Подключено к чату dentik__');
      updateChatStatus(true);
    })
    .catch(err => {
      console.error('❌ Ошибка подключения:', err);
      updateChatStatus(false);
    });

  twitchClient.on('message', (channel, tags, message, self) => {
    if (self) return;

    const sender = tags['display-name'] || tags.username;
    const lower = message.trim().toLowerCase();

    appendChatMessage(sender, message);

    if ($('cmdMode').checked) {
      if (lower === '!join') {
        if (sender && !collectedUsers.has(sender) && !isIgnored(sender)) {
          collectedUsers.add(sender);
          renderCollectedUsers();
        }
        return;
      }
      if (lower === '!leave') {
        if (sender && collectedUsers.has(sender)) {
          collectedUsers.delete(sender);
          participantsEl.value = Array.from(collectedUsers).join('\n');
          updateCount();
          drawWheel(getParticipants(), currentAngle);
        }
        return;
      }
    }

    if (raceActive && raceWinner) {
      if ((sender || '').toLowerCase() === raceWinner.toLowerCase()) {
        raceActive = false;
        clearTimeout(raceTimeout);
        $('raceStatus').textContent = '✅ ' + raceWinner + ' ответил! Приз его.';
        return;
      }
    }

    const keyword = (keywordEl.value.trim() || '!розыгрыш').toLowerCase();
    if (lower.includes(keyword)) {
      if (sender && !collectedUsers.has(sender) && !isIgnored(sender)) {
        collectedUsers.add(sender);
        renderCollectedUsers();
      }
    }
  });

  twitchClient.on('disconnected', reason => {
    twitchConnected = false;
    updateChatStatus(false);
    console.warn('⚠️ Отключено:', reason);
  });
}

function disconnectTwitch() {
  if (!twitchClient) return;
  twitchClient.disconnect();
  twitchClient = null;
  twitchConnected = false;
  updateChatStatus(false);
}

function renderCollectedUsers() {
  const list = Array.from(collectedUsers);
  const existing = getParticipants();
  const merged = Array.from(new Set([...existing, ...list]));
  participantsEl.value = merged.join('\n');
  updateCount();
  if (!isSpinning) drawWheel(getParticipants(), currentAngle);
}

// ============================================================
//  КНОПКИ
// ============================================================
$('addFromChat').addEventListener('click', () => {
  if (!twitchConnected) connectTwitch();
  else if (confirm('Отключиться от чата? Собранные участники сохранятся.')) disconnectTwitch();
});

$('resetBtn').addEventListener('click', () => {
  winnersEl.textContent = '';
  timerEl.textContent = '';
  timerBar.style.width = '100%';
  $('raceStatus').textContent = '';
  clearInterval(timerInterval);
  raceActive = false;
  drawWheel(getParticipants(), currentAngle);
});

$('testBtn').addEventListener('click', () => {
  const fakeNames = ['nagibator', 'kekw_master', 'lurker42', 'mimi_cat', 'toxic_guy'];
  const name = fakeNames[Math.floor(Math.random() * fakeNames.length)]
             + '_' + Math.floor(Math.random() * 999);
  collectedUsers.add(name);
  renderCollectedUsers();
});

$('obsModeBtn').addEventListener('click', () => {
  document.body.classList.toggle('obs');
  $('obsModeBtn').textContent = document.body.classList.contains('obs')
    ? '🎬 Выйти из OBS' : '🎬 OBS-режим (временно не работает)';
});

// ============================================================
//  LOCALSTORAGE
// ============================================================
function saveState() {
  const state = {
    participants: participantsEl.value,
    keyword: keywordEl.value,
    ignoreList: $('ignoreList').value,
    winnersCount: $('winnersCount').value,
    timerSec: $('timerSec').value,
    antiRepeat: $('antiRepeat').value,
    soundOn: $('soundOn').checked,
    spinAnim: $('spinAnim').checked,
    raceMode: $('raceMode').checked,
    cmdMode: $('cmdMode').checked,
    confettiOn: $('confettiOn').checked,
    theme: currentThemeIdx
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (s.participants) participantsEl.value = s.participants;
    if (s.keyword) keywordEl.value = s.keyword;
    if (s.ignoreList) $('ignoreList').value = s.ignoreList;
    if (s.winnersCount) $('winnersCount').value = s.winnersCount;
    if (s.timerSec) $('timerSec').value = s.timerSec;
    if (s.antiRepeat !== undefined) $('antiRepeat').value = s.antiRepeat;
    if (typeof s.soundOn === 'boolean') $('soundOn').checked = s.soundOn;
    if (typeof s.spinAnim === 'boolean') $('spinAnim').checked = s.spinAnim;
    if (typeof s.raceMode === 'boolean') $('raceMode').checked = s.raceMode;
    if (typeof s.cmdMode === 'boolean') $('cmdMode').checked = s.cmdMode;
    if (typeof s.confettiOn === 'boolean') $('confettiOn').checked = s.confettiOn;

    const list = (s.participants || '').split('\n').map(x => x.trim()).filter(Boolean);
    list.forEach(n => collectedUsers.add(n));
    updateCount();

    const themeIdx = parseInt(localStorage.getItem('dentik_theme') || '0') || 0;
    applyTheme(themeIdx);

    drawWheel(getParticipants(), currentAngle);
  } catch (e) {
    console.warn('Не удалось загрузить состояние:', e);
  }
}

[
  'participants', 'keyword', 'ignoreList', 'winnersCount', 'timerSec',
  'antiRepeat', 'soundOn', 'spinAnim', 'raceMode', 'cmdMode', 'confettiOn'
].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('change', saveState);
});
participantsEl.addEventListener('input', () => {
  saveState();
  updateCount();
  if (!isSpinning) drawWheel(getParticipants(), currentAngle);
});
keywordEl.addEventListener('input', saveState);

$('clearStorage').addEventListener('click', () => {
  if (confirm('Удалить сохранённые настройки и участников?')) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('dentik_theme');
    location.reload();
  }
});

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================
loadState();
updateCount();
updateChatStatus(false);
drawWheel(getParticipants(), currentAngle);
hideChat();

// ============================================================
//  ДИСКЛЕЙМЕР — логика
// ============================================================
const disclaimerEl = document.getElementById('disclaimer');
const disclaimerCloseBtn = document.getElementById('disclaimerClose');

if (disclaimerEl && disclaimerCloseBtn) {
  // Подставляем текст из переменных выше
  const titleEl = document.getElementById('disclaimerTitle');
  const bodyEl  = document.getElementById('disclaimerBody');
  if (titleEl) titleEl.textContent = DISCLAIMER_TITLE;
  if (bodyEl)  bodyEl.textContent  = DISCLAIMER_BODY;

  const seen = localStorage.getItem('dentik_disclaimer_seen_' + DISCLAIMER_VERSION);
  if (!seen) {
    setTimeout(() => disclaimerEl.classList.add('show'), 800);
  }
  disclaimerCloseBtn.addEventListener('click', () => {
    disclaimerEl.classList.remove('show');
    localStorage.setItem('dentik_disclaimer_seen_' + DISCLAIMER_VERSION, '1');
  });
}