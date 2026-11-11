// Озвучка русских слов голосом телефона. Если телефон не умеет — кнопка просто не показывается.
let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const all = window.speechSynthesis.getVoices() || [];
  return all.find(v => /^ru(-|_|$)/i.test(v.lang)) || null;
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

if (canSpeak()) {
  voice = pickVoice();
  try { window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; } catch (e) {}
}

export function speak(text) {
  if (!canSpeak() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[()«»]/g, ''));
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = 0.85;            // чуть медленнее — легче расслышать окончания
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
