// ИИ-помощник. Ключ Gemini живёт только здесь, на сервере, в переменных Vercel —
// в код и в GitHub он не попадает. Пускаем только тех, кого подписал Telegram.
import crypto from 'crypto';
import { topicById } from '../src/data/topics.js';

const MAX_AGE = 24 * 3600;
// Свежие модели — первыми. Если какая-то недоступна, пробуем следующую.
const MODELS = (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [])
  .concat(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);

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
  if (ctx && ctx.kind === 'answer') about = `\n\nСЕЙЧАС ТЕСТ. Ей задали вопрос по-русски: «${String(ctx.question).slice(0, 200)}». Её сообщение — это её ответ на этот вопрос. Проверь его строго по формату:
1-я строка: «✅ Правильно!» если ответ понятный и без ошибок; «🟡 Почти!» если смысл верный, но есть ошибки; «❌ Не совсем.» если ответ не по вопросу или непонятный. Эту строку пиши всегда по-русски, первым символом — значок.
2-я строка: «Правильно: …» — её же ответ, но исправленный (сохрани её мысль и её слова, не придумывай другой ответ). Если ошибок нет — пропусти эту строку.
Потом 1–2 коротких строки: какая ошибка и почему так (род, окончание, падеж, время), с переводом на кыргызский, если объясняешь по-русски.
Если ответ не по вопросу — мягко покажи пример хорошего ответа.
В конце — одна короткая похвала. Не больше 70 слов. Не задавай вопросов.`;
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
    signal: AbortSignal.timeout(12000),
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

// Проверка настроек: открыть в браузере /api/ask?check=1.
// Ключи не показывает — только «есть / нет» и что ответил Google.
let lastCheck = 0, lastResult = null;
let good = null;            // какая модель ответила последней
async function check() {
  if (Date.now() - lastCheck < 20000 && lastResult) return lastResult;   // не чаще раза в 20 секунд
  const out = {
    версия: 'Gemini + Groq параллельно, 4',
    BOT_TOKEN: process.env.BOT_TOKEN ? (/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(String(process.env.BOT_TOKEN).trim()) ? 'есть' : 'есть, но не похож на токен бота') : 'НЕТ',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'есть' : 'нет',
    GROQ_API_KEY: process.env.GROQ_API_KEY ? 'есть (запасной ИИ)' : 'нет — запасного ИИ нет',
    ALLOWED_IDS: ALLOWED.length ? `${ALLOWED.length} номер(а)` : 'не задано — пускаем всех из Telegram',
    модели: {}
  };
  // от какого бота токен — должен совпадать с ботом, из которого открывают приложение
  if (process.env.BOT_TOKEN) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${String(process.env.BOT_TOKEN).trim()}/getMe`, { signal: AbortSignal.timeout(6000) });
      const j = await r.json();
      out.бот = j.ok ? '@' + j.result.username + ' — приложение должно открываться именно из этого бота' : 'Telegram не признал токен: ' + (j.description || r.status);
    } catch (e) { out.бот = 'не удалось спросить Telegram'; }
  }
  await Promise.all(providers().map(async p => {
    const t0 = Date.now();
    try {
      const text = await p.run('Отвечай одним словом.', [{ role: 'user', parts: [{ text: 'Скажи по-русски: привет' }] }]);
      out.модели[p.name] = `работает за ${((Date.now() - t0) / 1000).toFixed(1)} с: ${text.slice(0, 30)}`;
    } catch (e) {
      out.модели[p.name] = `ошибка ${e.status || ''}: ${String(e.message).slice(0, 140)}`;
    }
  }));
  const okModel = Object.values(out.модели).some(v => v.startsWith('работает'));
  out.итог = out.BOT_TOKEN !== 'есть' ? 'Проблема с BOT_TOKEN'
    : !process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY ? 'Нет ни GEMINI_API_KEY, ни GROQ_API_KEY в Vercel'
    : okModel ? 'ИИ на сервере работает' : 'Ни одна модель не ответила — смотри «модели»';
  lastCheck = Date.now(); lastResult = out;
  return out;
}

// ---------- запасной ИИ: Groq (как в JOL-Bilim) ----------
// Включается, если в Vercel задан GROQ_API_KEY. Бесплатный и очень быстрый.
const GROQ_MODELS = (process.env.GROQ_MODEL ? [process.env.GROQ_MODEL] : []).concat(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);

async function callGroq(model, system, contents) {
  const messages = [{ role: 'system', content: system }]
    .concat(contents.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts[0].text })));
  const body = { model, messages, temperature: 0.4, max_tokens: 1500 };
  if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';      // меньше «раздумий» — быстрее ответ
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${String(process.env.GROQ_API_KEY).trim()}` },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((j && j.error && j.error.message) || `HTTP ${r.status}`); e.status = r.status; throw e; }
  const text = String((j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim();
  if (!text) { const e = new Error('пустой ответ'); e.status = 502; throw e; }
  return text;
}

// Все, кто может ответить, по порядку: сначала Gemini, потом Groq
function providers() {
  const g = process.env.GEMINI_API_KEY ? MODELS.map(m => ({ name: m, run: (sys, msgs) => callGemini(m, sys, msgs) })) : [];
  const q = process.env.GROQ_API_KEY ? GROQ_MODELS.map(m => ({ name: 'groq: ' + m, run: (sys, msgs) => callGroq(m, sys, msgs) })) : [];
  const list = [];
  for (let i = 0; i < Math.max(g.length, q.length); i++) { if (g[i]) list.push(g[i]); if (q[i]) list.push(q[i]); }
  return list;              // gemini-3.8 → groq-120b → gemini-lite → groq-20b
}

// Не ждём по очереди: запускаем первого, и если за 4 секунды нет ответа —
// подключаем следующего. Кто первым ответил — того и берём. Упал — сразу следующий.
const STAGGER = 4000;
function race(order, system, msgs) {
  return new Promise((resolve, reject) => {
    let i = 0, running = 0, done = false, timer = null, lastErr = null;
    const launch = () => {
      if (done) return;
      if (i >= order.length) { if (!running) { done = true; reject(lastErr || new Error('никто не ответил')); } return; }
      const p = order[i++]; running++;
      clearTimeout(timer);
      timer = setTimeout(launch, STAGGER);
      p.run(system, msgs).then(
        text => { if (done) return; done = true; clearTimeout(timer); resolve({ text, name: p.name }); },
        e => { running--; lastErr = e; launch(); }
      );
    };
    launch();
  });
}

// от какого бота токен на сервере — пригодится, чтобы объяснить ошибку подписи
let botName = null;
async function serverBot() {
  if (botName) return botName;
  try {
    const r = await fetch(`https://api.telegram.org/bot${String(process.env.BOT_TOKEN || '').trim()}/getMe`, { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    if (j.ok) botName = '@' + j.result.username;
  } catch (e) {}
  return botName;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && req.query && req.query.check) return res.status(200).json(await check());
  if (req.method !== 'POST') return res.status(405).json({ error: 'только POST' });
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) return res.status(500).json({ error: 'на сервере не задан ни GEMINI_API_KEY, ни GROQ_API_KEY' });

  const raw = req.headers['x-init-data'];
  const who = inspect(Array.isArray(raw) ? raw[0] : raw || '');
  if (!who.user) {
    let why = who.why;
    if (/подпись не сошлась/.test(why)) {
      const b = await serverBot();
      if (b) why = `подпись не сошлась: в Vercel стоит токен бота ${b}, а приложение открыто из другого бота. Поставь в BOT_TOKEN токен того бота, из которого открываешь.`;
    }
    return res.status(401).json({ error: why });
  }
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
  // Модель, которая ответила последней, пробуем первой: если основная перегружена,
  // не будем каждый раз ждать её отказа.
  const all = providers();
  const order = good && Date.now() - good.at < 10 * 60 * 1000
    ? [...all.filter(p => p.name === good.name), ...all.filter(p => p.name !== good.name)] : all;
  let last = null;
  try {
    const won = await race(order, system, msgs);
    good = { name: won.name, at: Date.now() };
    return res.status(200).json({ text: won.text, model: won.name });
  } catch (e) { last = e; }
  const status = last && last.status === 429 ? 429 : 502;
  res.status(status).json({ error: status === 429 ? 'ИИ сейчас занят, попробуйте через минуту' : 'ИИ не ответил: ' + (last ? last.message : '') });
}
