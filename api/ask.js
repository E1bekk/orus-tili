// ИИ-помощник. Ключ Gemini живёт только здесь, на сервере, в переменных Vercel —
// в код и в GitHub он не попадает. Пускаем только тех, кого подписал Telegram.
import crypto from 'crypto';
import { topicById } from '../src/data/topics.js';

const MAX_AGE = 24 * 3600;
// Свежие модели — первыми. Если какая-то недоступна, пробуем следующую.
const MODELS = (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [])
  .concat(['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash']);

// ---------- кто пришёл ----------
function inspect(initData, token = String(process.env.BOT_TOKEN || '').trim()) {
  if (!token) return { why: 'на сервере не задан BOT_TOKEN' };
  if (!initData) return { why: 'приложение открыто не из Telegram' };
  const q = new URLSearchParams(initData);
  const hash = q.get('hash');
  if (!hash) return { why: 'нет подписи Telegram' };
  q.delete('hash');
  // новые версии Telegram шлют поле signature — пробуем и с ним, и без
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const variants = [[...q.entries()]];
  if (q.has('signature')) variants.push([...q.entries()].filter(([k]) => k !== 'signature'));
  let ok = false;
  for (const fields of variants) {
    const check = fields.map(([k, v]) => `${k}=${v}`).sort().join('\n');
    const got = crypto.createHmac('sha256', secret).update(check).digest('hex');
    try { if (got.length === hash.length && crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(hash, 'hex'))) { ok = true; break; } } catch (e) {}
  }
  if (!ok) return { why: 'подпись не сошлась — BOT_TOKEN не от этого бота' };
  const age = Math.floor(Date.now() / 1000) - Number(q.get('auth_date') || 0);
  if (!(age >= -300 && age < MAX_AGE)) return { why: 'подпись устарела — откройте приложение заново' };
  let user = null;
  try { user = JSON.parse(q.get('user') || 'null'); } catch (e) {}
  if (!user || !user.id) return { why: 'Telegram не сообщил, кто пользователь' };
  return { user: { id: Number(user.id), name: user.first_name || '' } };
}

// Если задан ALLOWED_IDS — пускаем только эти номера (маму и тебя). Так чужие не потратят лимит ИИ.
const ALLOWED = String(process.env.ALLOWED_IDS || '').split(/[,\s]+/).map(Number).filter(Boolean);

// Не больше 40 вопросов за 10 минут с одного человека — хватит с запасом
const hits = new Map();
function tooOften(id) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(id) || []).filter(t => now - t < win);
  list.push(now); hits.set(id, list);
  return list.length > 40;
}

// ---------- что сказать ИИ ----------
function topicText(id) {
  const tp = topicById(id);
  if (!tp) return '';
  const out = [`Тема урока: ${tp.title.ru}.`];
  for (const b of tp.blocks) {
    if (b.type === 'text' || b.type === 'tip') out.push(b.ru);
    if (b.type === 'table') out.push(b.rows.map(r => r.join(' | ')).join('; '));
    if (b.type === 'examples') out.push('Примеры: ' + b.items.map(e => e.ru).join(' '));
    if (b.type === 'mistakes') out.push('Частые ошибки: ' + b.items.map(m => `${m.bad} → ${m.good}`).join('; '));
    if (b.type === 'dialog') out.push('Диалог: ' + b.lines.map(l => l.ru).join(' / '));
  }
  return out.join('\n').slice(0, 2500);
}

function systemPrompt(lang, ctx) {
  const answerLang = lang === 'ky'
    ? 'Объясняй на кыргызском языке (кириллица, простые слова). Русские слова и фразы, которые она учит, пиши по-русски.'
    : 'Объясняй на очень простом русском языке, короткими предложениями. Если слово трудное — дай перевод на кыргызский в скобках.';
  let about = '';
  if (ctx && ctx.kind === 'topic') about = '\n\nСейчас она открыла урок. Вот его содержание, опирайся на него:\n' + topicText(ctx.id);
  if (ctx && ctx.kind === 'word') about = `\n\nСейчас она смотрит слово «${String(ctx.ru).slice(0, 60)}» (по-кыргызски: ${String(ctx.ky || '').slice(0, 60)}). Если вопрос про него — покажи, как его использовать, в каком роде, как меняется, с примерами из жизни.`;
  if (ctx && ctx.kind === 'theme') about = `\n\nСейчас она открыла раздел словаря «${String(ctx.title).slice(0, 60)}».`;

  return `Ты — добрый и терпеливый учитель русского языка. Твоя ученица — взрослая женщина, её родной язык кыргызский. Она уже немного говорит по-русски, но путается в формах: род (он/она/оно), окончания, падежи, где/куда, вид глагола (делать/сделать), глаголы движения (идти/ехать), прошедшее время женского рода (я была, я пошла).

${answerLang}

Как отвечать:
- Коротко: до 120 слов. Одна мысль за раз.
- Без сложных терминов. Если термин нужен — объясни его простыми словами.
- 2–3 примера из жизни: рынок, магазин, семья, больница, транспорт, кухня. Каждый русский пример — с переводом на кыргызский.
- Если она прислала свою фразу: сначала скажи, верно или нет; потом напиши правильный вариант; потом одной фразой — почему.
- Помни, что она женщина: в примерах от первого лица используй женский род (я была, я сделала).
- Она учится на массажистку. Если к месту — бери примеры из массажа: разговор с клиентом, части тела, приёмы.
- Когда помогает — сравнивай с кыргызским: жөндөмөлөр (-да, -га, -ны, -дан), «менен» = «с», «менде бар» = «у меня есть».
- Хвали за попытку, не ругай за ошибки.
- Не используй таблицы и заголовки. Можно выделить главное **жирным**.
- Если вопрос не про язык — ответь очень коротко и мягко предложи вернуться к русскому.${about}`;
}

// ---------- вызов Gemini ----------
async function callGemini(model, system, contents) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(25000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
    })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (j && j.error && j.error.message) || `HTTP ${r.status}`;
    const e = new Error(msg); e.status = r.status; throw e;
  }
  const cand = j && j.candidates && j.candidates[0];
  const text = ((cand && cand.content && cand.content.parts) || []).map(p => p.text || '').join('').trim();
  if (!text) { const e = new Error('пустой ответ'); e.status = 502; throw e; }
  return text;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'только POST' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'на сервере не задан GEMINI_API_KEY' });

  const raw = req.headers['x-init-data'];
  const who = inspect(Array.isArray(raw) ? raw[0] : raw || '');
  if (!who.user) return res.status(401).json({ error: who.why });
  if (ALLOWED.length && !ALLOWED.includes(who.user.id)) return res.status(403).json({ error: 'этот помощник только для своих' });
  if (tooOften(who.user.id)) return res.status(429).json({ error: 'много вопросов подряд — передохните пару минут' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const lang = body.lang === 'ru' ? 'ru' : 'ky';
  const ctx = body.context && typeof body.context === 'object' ? body.context : null;

  // последние 10 сообщений разговора; ИИ видит, о чём говорили только что
  const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
    .map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: String(m.text || '').slice(0, 1000) }] }))
    .filter(m => m.parts[0].text.trim());
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return res.status(400).json({ error: 'нет вопроса' });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();   // разговор должен начинаться с вопроса

  const system = systemPrompt(lang, ctx);
  let last = null;
  for (const model of MODELS) {
    try {
      const text = await callGemini(model, system, msgs);
      return res.status(200).json({ text, model });
    } catch (e) {
      last = e;
      // модель не найдена или нет доступа — пробуем следующую; остальное — сразу отвечаем
      if (![400, 403, 404].includes(e.status)) break;
    }
  }
  const status = last && last.status === 429 ? 429 : 502;
  res.status(status).json({ error: status === 429 ? 'ИИ сейчас занят, попробуйте через минуту' : 'ИИ не ответил: ' + (last ? last.message : '') });
}
