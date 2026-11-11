// Озвучка русских слов и фраз. Голос делает Gemini, готовый звук кэшируется
// на серверах Vercel навсегда: каждое слово генерируется один раз на всех.
// Озвучиваем только то, что есть в приложении, — чужой текст сюда не пролезет.
import { TOPICS } from '../src/data/topics.js';
import { ALL_WORDS } from '../src/data/dictionary.js';
import { TEST_PHRASES } from '../src/data/tests.js';

const VOICE = process.env.TTS_VOICE || 'Kore';            // ровный, чёткий голос
const norm = s => String(s || '').replace(/[()«»]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

// все русские фразы приложения: слова словаря, примеры и диалоги уроков
const ALLOWED = new Set(ALL_WORDS.map(w => norm(w.ru)));
TEST_PHRASES.forEach(t => ALLOWED.add(norm(t)));
for (const tp of TOPICS) for (const b of tp.blocks) {
  if (b.type === 'examples') b.items.forEach(e => ALLOWED.add(norm(e.ru)));
  if (b.type === 'dialog') b.lines.forEach(l => ALLOWED.add(norm(l.ru)));
}

// Звук приходит либо готовым WAV, либо «сырым» PCM 24 кГц — тогда дописываем заголовок
function toWav(buf) {
  if (buf.slice(0, 4).toString('ascii') === 'RIFF') return buf;
  const rate = 24000, ch = 1, bits = 16;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + buf.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * ch * bits / 8, 28); h.writeUInt16LE(ch * bits / 8, 32); h.writeUInt16LE(bits, 34);
  h.write('data', 36); h.writeUInt32LE(buf.length, 40);
  return Buffer.concat([h, buf]);
}

const API = 'https://generativelanguage.googleapis.com/v1beta';
async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((j && j.error && j.error.message) || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return j;
}

// Два способа обратиться к Google — пробуем по очереди, пока какой-то не даст звук
const WAYS = [
  { name: 'gemini-3.8-flash-tts (generateContent)', run: t => viaGenerate('gemini-3.8-flash-tts', t) },
  { name: 'gemini-3.8-flash-tts (interactions)', run: t => viaInteractions('gemini-3.8-flash-tts', t) },
  { name: 'gemini-3.8-flash-lite-tts (generateContent)', run: t => viaGenerate('gemini-3.8-flash-lite-tts', t) },
  { name: 'gemini-2.5-flash-preview-tts (generateContent)', run: t => viaGenerate('gemini-2.5-flash-preview-tts', t) }
];

async function viaGenerate(model, text) {
  const j = await post(`${API}/models/${model}:generateContent`, {
    contents: [{ parts: [{ text }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } }
  });
  const parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  const audio = parts.find(p => p.inlineData && p.inlineData.data);
  if (!audio) throw new Error('в ответе нет звука');
  return Buffer.from(audio.inlineData.data, 'base64');
}

async function viaInteractions(model, text) {
  const j = await post(`${API}/interactions`, {
    model,
    input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice: VOICE }] }
  });
  const steps = (j && j.steps) || [];
  const outs = steps.filter(s => s.type === 'model_output').flatMap(s => s.content || []);
  const audio = outs.filter(c => c.type === 'audio' && c.data).pop();
  if (!audio) throw new Error('в ответе нет звука');
  return Buffer.from(audio.data, 'base64');
}

let working = null;            // какой способ сработал последним — с него и начинаем

async function synth(text) {
  const order = working ? [working, ...WAYS.filter(w => w !== working)] : WAYS;
  const tried = [];
  for (const w of order) {
    try { const buf = await w.run(text); working = w; return { wav: toWav(buf), tried }; }
    catch (e) {
      tried.push(`${w.name}: ${e.status || ''} ${String(e.message).slice(0, 140)}`);   // пробуем следующий способ
    }
  }
  const err = new Error('не получилось озвучить'); err.tried = tried; throw err;
}

export default async function handler(req, res) {
  const q = req.query || {};
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'на сервере не задан GEMINI_API_KEY' });

  // проверка: /api/say?check=1 — какой способ озвучки работает
  if (q.check) {
    res.setHeader('Cache-Control', 'no-store');
    try { const r = await synth('Привет'); return res.status(200).json({ итог: 'озвучка работает', способ: working.name, не_сработали: r.tried, фраз_разрешено: ALLOWED.size }); }
    catch (e) { return res.status(200).json({ итог: 'озвучка НЕ работает', попытки: e.tried }); }
  }

  const text = norm(q.t);
  if (!text) return res.status(400).json({ error: 'нет текста' });
  if (!ALLOWED.has(text)) return res.status(403).json({ error: 'этой фразы нет в приложении' });

  try {
    const { wav } = await synth(text);
    // один раз сгенерировали — дальше Vercel отдаёт из кэша мгновенно и бесплатно
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.status(200).send(wav);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: e.message, попытки: e.tried });
  }
}
