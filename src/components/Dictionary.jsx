// Словарь: темы, поиск, «мои слова» и карточки для заучивания.
import { useEffect, useMemo, useState } from 'react';
import { THEMES, ALL_WORDS, GENDER } from '../data/dictionary';
import { t } from '../lib/i18n';
import { haptic } from '../lib/tg';
import { Say } from './Bits';
import { preload } from '../lib/speak';

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();

function Word({ w, lang, saved, known, onSave, onAsk }) {
  const [open, setOpen] = useState(false);
  const g = w.g && GENDER[w.g];
  return (
    <div className={'word' + (open ? ' open' : '')}>
      <div className="word-main" onClick={() => setOpen(o => !o)}>
        <div className="word-txt">
          <div className="word-ru">
            {w.ru}
            {g && <span className={'g ' + g.cls}>{g[lang]}</span>}
            {known && <span className="learned">✓</span>}
          </div>
          <div className="word-ky">{w.ky}</div>
        </div>
        <Say text={w.ru} lang={lang} />
        <button className={'star' + (saved ? ' on' : '')} aria-label={t('myWords', lang)}
          onClick={e => { e.stopPropagation(); haptic(); onSave(w.ru); }}>{saved ? '★' : '☆'}</button>
      </div>
      {open && (
        <button className="word-ask" onClick={() => onAsk({ kind: 'word', ru: w.ru, ky: w.ky })}>
          ✨ {lang === 'ky' ? `«${w.ru}» сөзүн кантип колдонуу керек?` : `Как использовать «${w.ru}»?`}
        </button>
      )}
    </div>
  );
}

export function WordList({ words, lang, saved, known, onSave, onAsk, empty }) {
  if (!words.length) return <p className="empty">{empty}</p>;
  return (
    <div className="words">
      {words.map(w => (
        <Word key={w.ru} w={w} lang={lang} saved={saved.includes(w.ru)} known={known.includes(w.ru)} onSave={onSave} onAsk={onAsk} />
      ))}
    </div>
  );
}

export function DictHome({ lang, saved, known, onTheme, onSaved, onSave, onAsk }) {
  const [q, setQ] = useState('');
  const found = useMemo(() => {
    const s = norm(q);
    if (s.length < 2) return null;
    // сначала слова, которые начинаются с того, что ввели, потом — где это просто внутри
    const words = t => norm(t).split(/[\s,;()/]+/);
    const rank = w => (words(w.ru).some(x => x.startsWith(s)) || words(w.ky).some(x => x.startsWith(s)) ? 0 : 1);
    return ALL_WORDS.filter(w => norm(w.ru).includes(s) || norm(w.ky).includes(s))
      .sort((a, b) => rank(a) - rank(b)).slice(0, 60);
  }, [q]);

  return (
    <div className="list">
      <input className="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('search', lang)} />

      {found
        ? <WordList words={found} lang={lang} saved={saved} known={known} onSave={onSave} onAsk={onAsk} empty={t('nothing', lang)} />
        : <>
            <button className="row mine" onClick={onSaved}>
              <span className="row-ic">⭐</span>
              <span className="row-txt"><b>{t('myWords', lang)}</b><small>{saved.length} {t('words', lang)}</small></span>
              <span className="chev">›</span>
            </button>
            {THEMES.map(th => {
              const k = th.words.filter(w => known.includes(w.ru)).length;
              return (
                <button key={th.id} className="row" onClick={() => onTheme(th.id)}>
                  <span className="row-ic">{th.icon}</span>
                  <span className="row-txt">
                    <b>{th.title[lang]}</b>
                    <small>{th.words.length} {t('words', lang)}{k ? ` · ${k} ${t('learned', lang)}` : ''}</small>
                  </span>
                  <span className="bar"><i style={{ width: Math.round(k / th.words.length * 100) + '%' }} /></span>
                </button>
              );
            })}
          </>}
    </div>
  );
}

// Карточки: сначала невыученные слова, по одному
export function Cards({ words, lang, known, setKnown, onDone }) {
  const queue = useMemo(() => {
    const fresh = words.filter(w => !known.includes(w.ru));
    return (fresh.length ? fresh : words).slice().sort(() => Math.random() - 0.5);
  }, [words]); // eslint-disable-line
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const w = queue[i];
  useEffect(() => { preload(queue.slice(i, i + 2).map(x => x.ru)); }, [i, queue]);

  if (!w) return (
    <div className="cards-end">
      <span className="big-ic">🎉</span>
      <b>{t('allKnown', lang)}</b>
      <button className="btn" onClick={onDone}>{t('back', lang)}</button>
    </div>
  );

  const answer = yes => {
    haptic(yes ? 'ok' : 'light');
    setKnown(w.ru, yes);
    setShow(false);
    setI(i + 1);
  };
  const g = w.g && GENDER[w.g];

  return (
    <div className="cards">
      <div className="cards-count">{i + 1} / {queue.length}</div>
      <button className={'flash' + (show ? ' show' : '')} onClick={() => setShow(true)}>
        <span className="flash-ru">{w.ru}</span>
        {g && <span className={'g ' + g.cls}>{g[lang]}</span>}
        {show ? <span className="flash-ky">{w.ky}</span> : <small>{t('tapShow', lang)}</small>}
      </button>
      <div className="cards-say"><Say text={w.ru} lang={lang} /></div>
      {show && (
        <div className="cards-btns">
          <button className="btn ghost" onClick={() => answer(false)}>↻ {t('repeat', lang)}</button>
          <button className="btn" onClick={() => answer(true)}>✓ {t('know', lang)}</button>
        </div>
      )}
    </div>
  );
}

export const themeById = id => THEMES.find(x => x.id === id);
export const savedWords = saved => ALL_WORDS.filter(w => saved.includes(w.ru));
