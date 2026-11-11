// Озвучка русских слов. Основной путь — готовый звук с нашего сервера:
// играет как обычное аудио на любом телефоне. Если сервер не ответил — голос самого телефона.
const norm = s => String(s || '').replace(/[()«»]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
const url = t => '/api/say?t=' + encodeURIComponent(t);

let current = null;        // что играет сейчас
let currentState = null;   // чья кнопка сейчас «играет» — чтобы погасить её, если нажали другую

export function speak(text, onState = () => {}) {
  const t = norm(text);
  if (!t) return;
  stopAll();
  currentState = onState;

  const a = new Audio(url(t));
  current = a;
  let done = false;
  const set = st => { if (currentState === onState) onState(st); };
  const fallback = () => { if (done) return; done = true; speakPhone(t, set); };

  set('load');
  a.addEventListener('playing', () => set('play'));
  a.addEventListener('ended', () => set('idle'));
  a.addEventListener('pause', () => { if (!a.ended && !done) set('idle'); });
  a.addEventListener('error', fallback, { once: true });
  // play() вызываем сразу в нажатии — иначе айфон не даст играть звук
  const p = a.play();
  if (p && p.catch) p.catch(e => { if (e && e.name === 'AbortError') return; fallback(); });
}

function stopAll() {
  try { if (current) { current.pause(); current.removeAttribute('src'); } } catch (e) {}
  try { if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel(); } catch (e) {}
  if (currentState) { try { currentState('idle'); } catch (e) {} }
  current = null; currentState = null;
}

// Заранее подкачиваем звук, который скорее всего нажмут: примеры урока, слово на карточке.
// Браузер положит его в свой кэш, и по нажатию звук заиграет без ожидания.
const fetched = new Set();
let queue = [], busy = 0;
export function preload(texts) {
  for (const x of texts) { const t = norm(x); if (t && !fetched.has(t)) { fetched.add(t); queue.push(t); } }
  pump();
}
function pump() {
  while (busy < 2 && queue.length) {
    const t = queue.shift(); busy++;
    fetch(url(t)).then(r => r.arrayBuffer()).catch(() => fetched.delete(t)).finally(() => { busy--; pump(); });
  }
}

// Голос телефона — запасной вариант
let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  return (window.speechSynthesis.getVoices() || []).find(v => /^ru(-|_|$)/i.test(v.lang)) || null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  voice = pickVoice();
  try { window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; } catch (e) {}
}
function speakPhone(text, set) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { set('err'); setTimeout(() => set('idle'), 900); return; }
  try {
    const s = window.speechSynthesis;
    // в Safari «сбросить и сразу сказать» глотает фразу — сбрасываем, только если что-то звучит
    if (s.speaking || s.pending) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = 0.85;
    u.onstart = () => set('play');
    u.onend = () => set('idle');
    u.onerror = () => set('idle');
    s.speak(u);
  } catch (e) { set('idle'); }
}
