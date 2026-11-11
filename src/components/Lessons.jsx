// Уроки: список тем по разделам, страница темы и упражнение.
import { useEffect, useState } from 'react';
import { SECTIONS } from '../data/topics';
import { t } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { Say } from './Bits';
import { preload } from '../lib/speak';

export function LessonList({ lang, done, onOpen }) {
  return (
    <div className="list">
      {SECTIONS.map(s => (
        <section key={s.id} className="sec">
          <h2><span>{s.icon}</span> {s.title[lang]} <em>{s.topics.filter(x => done.includes(x.id)).length}/{s.topics.length}</em></h2>
          {s.topics.map(tp => (
            <button key={tp.id} className={'row' + (done.includes(tp.id) ? ' done' : '')} onClick={() => onOpen(tp.id)}>
              <span className="row-ic">{tp.icon}</span>
              <span className="row-txt">
                <b>{tp.title[lang]}</b>
                <small>{tp.short[lang]}</small>
              </span>
              {done.includes(tp.id) ? <span className="tick">✓</span> : <span className="chev">›</span>}
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function Block({ b, lang }) {
  if (b.type === 'text') return <p className="txt">{b[lang]}</p>;
  if (b.type === 'tip') return <div className="tip"><b>💡 {t('tip', lang)}</b><p>{b[lang]}</p></div>;

  if (b.type === 'table') {
    const head = b.head[lang] || b.head.ru;
    return (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }

  if (b.type === 'examples') return (
    <div className="card">
      <h3>{t('examples', lang)}</h3>
      {b.items.map((e, i) => (
        <div key={i} className="ex">
          <div className="ex-ru"><span>{e.ru}</span><Say text={e.ru} lang={lang} /></div>
          <div className="ex-ky">{e.ky}</div>
        </div>
      ))}
    </div>
  );

  if (b.type === 'dialog') return (
    <div className="card dialog">
      <h3>{lang === 'ky' ? 'Диалог' : 'Диалог'}</h3>
      {b.lines.map((l, i) => (
        <div key={i} className={'line' + (l.me ? ' me' : '')}>
          <span className="who">{l.me ? (lang === 'ky' ? 'Сиз' : 'Вы') : '👤'}</span>
          <div className="bubble">
            <div className="ex-ru"><span>{l.ru}</span><Say text={l.ru} lang={lang} /></div>
            <div className="ex-ky">{l.ky}</div>
          </div>
        </div>
      ))}
    </div>
  );

  if (b.type === 'mistakes') return (
    <div className="card">
      <h3>{t('mistakes', lang)}</h3>
      {b.items.map((m, i) => (
        <div key={i} className="mis">
          <div><span className="bad">✗ {m.bad}</span></div>
          <div><span className="good">✓ {m.good}</span></div>
          <small>{m[lang]}</small>
        </div>
      ))}
    </div>
  );
  return null;
}

function Quiz({ topic, lang, onFinish }) {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const q = topic.quiz[i];

  const choose = k => {
    if (pick !== null) return;
    setPick(k);
    const ok = k === q.answer;
    if (ok) setScore(s => s + 1);
    haptic(ok ? 'ok' : 'bad');
  };
  const next = () => {
    if (i + 1 < topic.quiz.length) { setI(i + 1); setPick(null); }
    else { setOver(true); onFinish(); }
  };
  const restart = () => { setI(0); setPick(null); setScore(0); setOver(false); };

  if (over) return (
    <div className="quiz">
      <h3>{t('practice', lang)}</h3>
      <div className="score">
        <b>{score} / {topic.quiz.length}</b>
        <span>{t('result', lang)}</span>
        <span className="stars">{score === topic.quiz.length ? '🌟🌟🌟' : score >= topic.quiz.length / 2 ? '🌟🌟' : '🌟'}</span>
      </div>
      <button className="btn ghost" onClick={restart}>{t('again', lang)}</button>
    </div>
  );

  return (
    <div className="quiz">
      <h3>{t('practice', lang)} <small>{i + 1} / {topic.quiz.length}</small></h3>
      <p className="q">{q.q}</p>
      <div className="opts">
        {q.options.map((o, k) => {
          const cls = pick === null ? '' : k === q.answer ? ' ok' : k === pick ? ' no' : ' dim';
          return <button key={k} className={'opt' + cls} onClick={() => choose(k)}>{o}</button>;
        })}
      </div>
      {pick !== null && (
        <div className={'why ' + (pick === q.answer ? 'ok' : 'no')}>
          <b>{pick === q.answer ? '✓ ' + t('right', lang) : '✗ ' + t('wrong', lang)}</b>
          <p>{q.why[lang]}</p>
          <button className="btn" onClick={next}>{t('next', lang)} →</button>
        </div>
      )}
    </div>
  );
}

export function LessonPage({ topic, lang, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => preload(topic.blocks.flatMap(b =>
      b.type === 'examples' ? b.items.map(e => e.ru) : b.type === 'dialog' ? b.lines.map(l => l.ru) : [])), 600);
    return () => clearTimeout(t);
  }, [topic.id]);
  return (
    <article className="lesson">
      <div className="lesson-head">
        <span className="big-ic">{topic.icon}</span>
        <p>{topic.short[lang]}</p>
      </div>
      {topic.blocks.map((b, i) => <Block key={i} b={b} lang={lang} />)}
      <Quiz key={topic.id} topic={topic} lang={lang} onFinish={onDone} />
    </article>
  );
}
