// Озвучка русских слов. Основной путь — готовый звук с нашего сервера:
// играет как обычное аудио, работает на любом телефоне и не зависит от голосов телефона.
// Если сервер не ответил — пробуем голос самого телефона.
const norm = s => String(s || '').replace(/[()«»]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
let current = null;

export function speak(text, onState) {
  const t = norm(text);
  if (!t) return;
  try { if (current) { current.pause(); current.src = ''; } } catch (e) {}
  if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel();

  const a = new Audio('/api/say?t=' + encodeURIComponent(t));
  current = a;
  let done = false;
  const fallback = () => {
    if (done) return; done = true;
    if (onState) onState('idle');
    speakPhone(t);
  };
  if (onState) onState('load');
  a.addEventListener('playing', () => onState && onState('play'));
  a.addEventListener('ended', () => onState && onState('idle'));
  a.addEventListener('error', fallback, { once: true });
  // play() надо вызвать сразу в нажатии — иначе айфон не даст играть звук
  const p = a.play();
  if (p && p.catch) p.catch(fallback);
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
function speakPhone(text) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  try {
    const s = window.speechSynthesis;
    // в Safari «сбросить и сразу сказать» глотает фразу — сбрасываем только если что-то звучит
    if (s.speaking || s.pending) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = 0.85;
    s.speak(u);
  } catch (e) {}
}
