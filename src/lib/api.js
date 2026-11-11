import { initData } from './tg';

// Вопрос ИИ-помощнику. history — прошлые сообщения этого разговора.
export async function askAI({ history, lang, context }) {
  const r = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData() },
    body: JSON.stringify({ messages: history, lang, context })
  });
  let j = null;
  try { j = await r.json(); } catch (e) {}
  if (!r.ok || !j || !j.text) throw new Error((j && j.error) || 'ИИ не ответил');
  return j.text;
}
