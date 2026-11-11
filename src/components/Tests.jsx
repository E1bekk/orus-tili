// Тесты, где мама отвечает сама: слова, на слух, собери фразу, впиши слово, ответ с проверкой ИИ.
import { useEffect, useMemo, useRef, useState } from 'react';
import { THEMES, ALL_WORDS } from '../data/dictionary';
import { BUILD, FILL, ASK } from '../data/tests';
import { topicById } from '../data/topics';
import { speak } from '../lib/speak';
import { askAI } from '../lib/api';
import { haptic } from '../lib/tg';
import { Say } from './Bits';

const L = (lang, ru, ky) => (lang === 'ky' ? ky : ru);
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[.,!?«»:;—–-]+/g, ' ').replace(/\s+/g, ' ').trim();
const tilesOf = s => String(s).replace(/[.,!?«»:;]+/g, ' ').split(/\s+/).filter(Boolean);

export const MODES = [
  { id: 'words',  icon: '🔤', ru: 'Слова', ky: 'Сөздөр', subRu: 'Выбери перевод', subKy: 'Которуусун тап', n: 10 },
  { id: 'listen', icon: '👂', ru: 'На слух', ky: 'Угуп түшүн', subRu: 'Послушай и пойми', subKy: 'Угуп, маанисин тап', n: 10 },
  { id: 'build',  icon: '🧩', ru: 'Собери фразу', ky: 'Сүйлөм кур', subRu: 'Сложи из слов', subKy: 'Сөздөрдөн түз', n: 8 },
  { id: 'fill',   icon: '✍️', ru: 'Впиши слово', ky: 'Сөздү жаз', subRu: 'Напиши нужную форму', subKy: 'Туура формасын жаз', n: 8 },
  { id: 'answer', icon: '💬', ru: 'Ответь сама', ky: 'Өзүң жооп бер', subRu: 'ИИ проверит ответ', subKy: 'ИИ жообуңду текшерет', n: 5 }
];

// ---------- список тестов ----------
export function TestsHome({ lang, best, onStart }) {
  return (
    <div className="list">
      <p className="tests-intro">{L(lang, 'Здесь вы отвечаете сами — так слова и правила запоминаются лучше всего.', 'Бул жерде өзүңүз жооп бересиз — сөздөр жана эрежелер ушинтип жакшы эсте калат.')}</p>
      {MODES.map(m => (
        <button key={m.id} className={'row test-row t-' + m.id} onClick={() => onStart(m.id)}>
          <span className="row-ic">{m.icon}</span>
          <span className="row-txt"><b>{L(lang, m.ru, m.ky)}</b><small>{L(lang, m.subRu, m.subKy)} · {m.n} {L(lang, 'заданий', 'тапшырма')}</small></span>
          {best[m.id] != null ? <span className="best">{best[m.id]}%</span> : <span className="chev">›</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- вопросы на выбор: слова и «на слух» ----------
function makeChoice(mode, themeId) {
  const pool = (themeId === 'all' ? ALL_WORDS.filter(w => w.theme !== 'small' && w.theme !== 'phrases' && w.ru.length < 26)
    : ALL_WORDS.filter(w => w.theme === themeId));
  return shuffle(pool).slice(0, 10).map(w => {
    const same = ALL_WORDS.filter(x => x.theme === w.theme && x.ru !== w.ru && x.ky !== w.ky);
    const others = shuffle(same.length >= 3 ? same : ALL_WORDS.filter(x => x.ru !== w.ru)).slice(0, 3);
    const dir = mode === 'listen' ? 'ru-ky' : Math.random() < 0.5 ? 'ru-ky' : 'ky-ru';
    const opts = shuffle([w, ...others]);
    return { w, dir, opts, answer: opts.indexOf(w) };
  });
}

function ChoiceQ({ q, mode, lang, onAnswer }) {
  const [pick, setPick] = useState(null);
  const [st, setSt] = useState('idle');
  useEffect(() => { setPick(null); }, [q]);
  const choose = k => {
    if (pick !== null) return;
    setPick(k);
    const ok = k === q.answer;
    haptic(ok ? 'ok' : 'bad');
    onAnswer(ok, ok ? null : { q: mode === 'listen' ? '🔊 ' + q.w.ru : (q.dir === 'ru-ky' ? q.w.ru : q.w.ky), right: q.dir === 'ru-ky' ? q.w.ky : q.w.ru });
  };
  return (
    <>
      {mode === 'listen'
        ? <div className="listen">
            <button className={'listen-btn ' + st} onClick={() => speak(q.w.ru, setSt)}>
              <span>{st === 'load' ? '⏳' : st === 'play' ? '🔊' : '▶'}</span>
              <small>{st === 'load' ? L(lang, 'Загрузка…', 'Жүктөлүүдө…') : L(lang, 'Нажмите, чтобы послушать', 'Угуу үчүн басыңыз')}</small>
            </button>
            {pick !== null && <p className="listen-word">{q.w.ru}</p>}
          </div>
        : <div className="ask-word">
            <small>{q.dir === 'ru-ky' ? L(lang, 'Как это по-кыргызски?', 'Кыргызчасы кандай?') : L(lang, 'Как это по-русски?', 'Орусчасы кандай?')}</small>
            <b>{q.dir === 'ru-ky' ? q.w.ru : q.w.ky}</b>
            {q.dir === 'ru-ky' && <Say text={q.w.ru} lang={lang} />}
          </div>}
      <div className="opts">
        {q.opts.map((o, k) => {
          const cls = pick === null ? '' : k === q.answer ? ' ok' : k === pick ? ' no' : ' dim';
          return <button key={k} className={'opt' + cls} onClick={() => choose(k)}>{q.dir === 'ru-ky' ? o.ky : o.ru}</button>;
        })}
      </div>
    </>
  );
}

// ---------- собери фразу ----------
function BuildQ({ item, lang, onAnswer, onLesson }) {
  const tiles = useMemo(() => shuffle([...tilesOf(item.show), ...item.extra]).map((t, i) => ({ t, i })), [item]);
  const [used, setUsed] = useState([]);
  const [res, setRes] = useState(null);
  useEffect(() => { setUsed([]); setRes(null); }, [item]);
  const line = used.map(i => tiles.find(x => x.i === i).t).join(' ');
  const check = () => {
    const ok = [item.show, ...(item.alt || [])].some(a => norm(a) === norm(line));
    setRes(ok); haptic(ok ? 'ok' : 'bad');
    onAnswer(ok, ok ? null : { q: item.ky, right: item.show, mine: line });
  };
  return (
    <>
      <div className="ask-word"><small>{L(lang, 'Скажите по-русски:', 'Орусча айтыңыз:')}</small><b className="ky-big">{item.ky}</b></div>
      <div className={'build-line' + (res === true ? ' ok' : res === false ? ' no' : '')}>
        {used.length ? used.map(i => (
          <button key={i} className="wtile on" disabled={res !== null} onClick={() => setUsed(u => u.filter(x => x !== i))}>{tiles.find(x => x.i === i).t}</button>
        )) : <span className="build-ph">{L(lang, 'Нажимайте на слова внизу по порядку', 'Төмөнкү сөздөрдү ирети менен басыңыз')}</span>}
      </div>
      <div className="tiles">
        {tiles.map(x => (
          <button key={x.i} className={'wtile' + (used.includes(x.i) ? ' gone' : '')} disabled={used.includes(x.i) || res !== null}
            onClick={() => { haptic(); setUsed(u => u.concat(x.i)); }}>{x.t}</button>
        ))}
      </div>
      {res === null
        ? <button className="btn wide-c" disabled={!used.length} onClick={check}>{L(lang, 'Проверить', 'Текшерүү')}</button>
        : <Verdict ok={res} right={item.show} lang={lang} topic={item.topic} onLesson={onLesson} />}
    </>
  );
}

// ---------- впиши слово ----------
function FillQ({ item, lang, onAnswer, onLesson }) {
  const [val, setVal] = useState('');
  const [res, setRes] = useState(null);
  const input = useRef(null);
  useEffect(() => { setVal(''); setRes(null); setTimeout(() => input.current && input.current.focus(), 80); }, [item]);
  const [before, after] = item.s.split('___');
  const check = e => {
    e && e.preventDefault();
    if (!val.trim() || res !== null) return;
    const ok = item.a.some(a => norm(a) === norm(val));
    setRes(ok); haptic(ok ? 'ok' : 'bad');
    onAnswer(ok, ok ? null : { q: item.s, right: item.a[0], mine: val });
  };
  return (
    <form onSubmit={check}>
      <div className="ask-word"><small>{L(lang, 'Впишите слово в нужной форме', 'Сөздү туура формада жазыңыз')}</small>
        <span className="hint">({item.hint})</span></div>
      <p className="fill-s">
        {before}
        <input ref={input} className={'fill-in' + (res === true ? ' ok' : res === false ? ' no' : '')} value={val}
          onChange={e => setVal(e.target.value)} disabled={res !== null} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck="false"
          size={Math.max(6, (item.a[0] || '').length + 2)} />
        {after}
      </p>
      <p className="fill-ky">{item.ky}</p>
      {res === null
        ? <button className="btn wide-c" disabled={!val.trim()}>{L(lang, 'Проверить', 'Текшерүү')}</button>
        : <Verdict ok={res} right={item.s.replace('___', item.a[0])} lang={lang} topic={item.topic} onLesson={onLesson} />}
    </form>
  );
}

function Verdict({ ok, right, lang, topic, onLesson }) {
  const tp = topic && topicById(topic);
  return (
    <div className={'why ' + (ok ? 'ok' : 'no')}>
      <b>{ok ? '✓ ' + L(lang, 'Правильно!', 'Туура!') : '✗ ' + L(lang, 'Правильно так:', 'Туурасы мындай:')}</b>
      {!ok && <div className="ex-ru"><span>{right}</span><Say text={right} lang={lang} /></div>}
      {!ok && tp && <button className="link" type="button" onClick={() => onLesson(tp.id)}>📘 {L(lang, 'Повторить урок', 'Сабакты кайталоо')}: {tp.title[lang]}</button>}
    </div>
  );
}

// ---------- ответь сама (проверяет ИИ) ----------
function AnswerQ({ item, lang, onAnswer }) {
  const [val, setVal] = useState('');
  const [fb, setFb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showKy, setShowKy] = useState(false);
  useEffect(() => { setVal(''); setFb(null); setErr(''); setShowKy(false); }, [item]);
  const send = async () => {
    if (!val.trim() || busy) return;
    setBusy(true); setErr('');
    try {
      const text = await askAI({ history: [{ role: 'user', text: val.trim() }], lang, context: { kind: 'answer', question: item.q } });
      setFb(text);
      const ok = /^[\s*]*✅/.test(text);
      haptic(ok ? 'ok' : 'light');
      onAnswer(ok, ok ? null : { q: item.q, right: L(lang, 'см. разбор ИИ', 'ИИнин түшүндүрмөсүн кара'), mine: val.trim() });
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <div className="ask-word">
        <small>{L(lang, 'Ответьте по-русски своими словами', 'Өз сөзүңүз менен орусча жооп бериңиз')}</small>
        <div className="ex-ru"><b>{item.q}</b><Say text={item.q} lang={lang} /></div>
        <button className="link" type="button" onClick={() => setShowKy(s => !s)}>{showKy ? item.ky : L(lang, 'Показать перевод', 'Которуусун көрсөт')}</button>
      </div>
      <textarea className="answer-in" rows={3} value={val} onChange={e => setVal(e.target.value)} disabled={!!fb || busy}
        placeholder={L(lang, 'Напишите ответ…', 'Жообуңузду жазыңыз…')} />
      {err && <p className="ask-err">{err}</p>}
      {!fb
        ? <button className="btn wide-c" disabled={!val.trim() || busy} onClick={send}>{busy ? L(lang, 'ИИ проверяет…', 'ИИ текшерип жатат…') : L(lang, 'Проверить', 'Текшерүү')}</button>
        : <div className="why ai-fb">{fb.split('\n').filter(Boolean).map((l, i) => <p key={i}>{l.replace(/\*\*/g, '')}</p>)}</div>}
    </>
  );
}

// ---------- сам тест ----------
export function TestRun({ mode, lang, onFinish, onLesson }) {
  const meta = MODES.find(m => m.id === mode);
  const [theme, setTheme] = useState(mode === 'words' || mode === 'listen' ? null : 'all');
  const [round, setRound] = useState(0);
  const items = useMemo(() => {
    if (!theme) return [];
    if (mode === 'words' || mode === 'listen') return makeChoice(mode, theme);
    if (mode === 'build') return shuffle(BUILD).slice(0, meta.n);
    if (mode === 'fill') return shuffle(FILL).slice(0, meta.n);
    return shuffle(ASK).slice(0, meta.n);
  }, [mode, theme, round]); // eslint-disable-line
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState([]);
  const [over, setOver] = useState(false);

  const restart = () => { setI(0); setAnswered(false); setScore(0); setWrong([]); setOver(false); setRound(r => r + 1); };

  // выбор темы для «слов» и «на слух»
  if (!theme) return (
    <div className="list">
      <p className="tests-intro">{L(lang, 'Какие слова проверим?', 'Кайсы сөздөрдү текшеребиз?')}</p>
      <div className="theme-chips">
        <button className="chip-t on" onClick={() => setTheme('all')}>🎲 {L(lang, 'Все вперемешку', 'Баары аралаш')}</button>
        {THEMES.filter(t => t.id !== 'small' && t.id !== 'phrases').map(t => (
          <button key={t.id} className="chip-t" onClick={() => setTheme(t.id)}>{t.icon} {t.title[lang]}</button>
        ))}
      </div>
    </div>
  );

  const q = items[i];
  const onAnswer = (ok, miss) => {
    setAnswered(true);
    if (ok) setScore(s => s + 1);
    else if (miss) setWrong(w => w.concat(miss));
  };
  const next = () => {
    if (i + 1 >= items.length) { setOver(true); onFinish(Math.round(((score) / items.length) * 100)); return; }
    setI(i + 1); setAnswered(false);
    // на слух: следующее слово звучит сразу (нажатие «Дальше» разрешает звук)
    if (mode === 'listen') speak(items[i + 1].w.ru);
  };

  if (over) {
    const pct = Math.round(score / items.length * 100);
    return (
      <div className="lesson">
        <div className="quiz">
          <h3>{meta.icon} {L(lang, meta.ru, meta.ky)}</h3>
          <div className="score"><b>{score} / {items.length}</b><span>{L(lang, 'правильных ответов', 'туура жооп')}</span>
            <span className="stars">{pct >= 90 ? '🌟🌟🌟' : pct >= 60 ? '🌟🌟' : '🌟'}</span>
            <span>{pct >= 90 ? L(lang, 'Отлично!', 'Эң сонун!') : pct >= 60 ? L(lang, 'Хорошо, ещё немного!', 'Жакшы, дагы бир аз!') : L(lang, 'Повторим ещё раз — получится!', 'Дагы бир кайталайбыз — болот!')}</span>
          </div>
        </div>
        {wrong.length > 0 && (
          <div className="card">
            <h3>{L(lang, 'Разбор ошибок', 'Каталарды талдоо')}</h3>
            {wrong.map((m, k) => (
              <div key={k} className="mis">
                <div><span className="ex-ky">{m.q}</span></div>
                {m.mine && <div><span className="bad">✗ {m.mine}</span></div>}
                <div className="ex-ru"><span className="good">✓ {m.right}</span>{/[а-яё]/i.test(m.right) && !m.right.startsWith('см.') && <Say text={m.right} lang={lang} />}</div>
              </div>
            ))}
          </div>
        )}
        <button className="btn wide-c" onClick={restart}>↻ {L(lang, 'Ещё раз', 'Дагы бир жолу')}</button>
      </div>
    );
  }

  if (!q) return null;
  return (
    <div className="lesson test-run">
      <div className="test-top">
        <span>{meta.icon} {L(lang, meta.ru, meta.ky)}</span>
        <span>{i + 1} / {items.length}</span>
      </div>
      <div className="test-bar"><i style={{ width: ((i + (answered ? 1 : 0)) / items.length * 100) + '%' }} /></div>
      <div className="quiz test-card">
        {(mode === 'words' || mode === 'listen') && <ChoiceQ key={round + '-' + i} q={q} mode={mode} lang={lang} onAnswer={onAnswer} />}
        {mode === 'build' && <BuildQ key={round + '-' + i} item={q} lang={lang} onAnswer={onAnswer} onLesson={onLesson} />}
        {mode === 'fill' && <FillQ key={round + '-' + i} item={q} lang={lang} onAnswer={onAnswer} onLesson={onLesson} />}
        {mode === 'answer' && <AnswerQ key={round + '-' + i} item={q} lang={lang} onAnswer={onAnswer} />}
        {answered && <button className="btn wide-c" onClick={next}>{i + 1 >= items.length ? L(lang, 'Результат', 'Жыйынтык') : L(lang, 'Дальше', 'Кийинки')} →</button>}
      </div>
    </div>
  );
}
