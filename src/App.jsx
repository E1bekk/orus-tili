import { useCallback, useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { backButton, userName } from './lib/tg';
import { t } from './lib/i18n';
import { TOPICS, topicById } from './data/topics';
import { ALL_WORDS, GENDER } from './data/dictionary';
import { Header, AskBar, Say } from './components/Bits';
import { LessonList, LessonPage } from './components/Lessons';
import { DictHome, WordList, Cards, themeById, savedWords } from './components/Dictionary';
import { Ask } from './components/Ask';
import { TestsHome, TestRun, MODES } from './components/Tests';

// слово дня: каждый день новое, у всех одинаковое
function wordOfDay() {
  const d = new Date();
  const n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return ALL_WORDS[(n * 7919) % ALL_WORDS.length];
}

function Home({ lang, done, known, best, go }) {
  const tried = Object.keys(best).length;
  const w = wordOfDay();
  const name = userName();
  const g = w.g && GENDER[w.g];
  return (
    <div className="home">
      <p className="hello">{t('hello', lang)}{name ? ', ' + name : ''}! 👋</p>
      <button className="tile t-learn" onClick={() => go({ s: 'lessons' })}>
        <span className="tile-ic">📘</span>
        <span className="tile-txt"><b>{t('learn', lang)}</b><small>{t('learnSub', lang)}</small></span>
        <span className="tile-num">{done.length}/{TOPICS.length}<small>{t('done', lang)}</small></span>
      </button>
      <button className="tile t-dict" onClick={() => go({ s: 'dict' })}>
        <span className="tile-ic">📖</span>
        <span className="tile-txt"><b>{t('dict', lang)}</b><small>{t('dictSub', lang)}</small></span>
        <span className="tile-num">{known.length}/{ALL_WORDS.length}<small>{t('learned', lang)}</small></span>
      </button>
      <button className="tile t-test" onClick={() => go({ s: 'tests' })}>
        <span className="tile-ic">🎯</span>
        <span className="tile-txt"><b>{t('tests', lang)}</b><small>{t('testsSub', lang)}</small></span>
        <span className="tile-num">{tried}/{MODES.length}<small>{lang === 'ky' ? 'аракет' : 'пройдено'}</small></span>
      </button>
      <button className="tile t-ask" onClick={() => go({ s: 'ask' })}>
        <span className="tile-ic">✨</span>
        <span className="tile-txt"><b>{t('ask', lang)}</b><small>{t('askSub', lang)}</small></span>
      </button>
      <div className="wod">
        <small>{lang === 'ky' ? 'Бүгүнкү сөз' : 'Слово дня'}</small>
        <div className="wod-row">
          <b>{w.ru}</b>{g && <span className={'g ' + g.cls}>{g[lang]}</span>}<Say text={w.ru} lang={lang} />
        </div>
        <span>{w.ky}</span>
      </div>
    </div>
  );
}

export default function App() {
  const st = useStore();
  const { lang, setLang } = st;
  const [stack, setStack] = useState([{ s: 'home' }]);
  const cur = stack[stack.length - 1];

  const go = useCallback(scr => { setStack(p => p.concat(scr)); window.scrollTo(0, 0); }, []);
  const back = useCallback(() => { setStack(p => (p.length > 1 ? p.slice(0, -1) : p)); window.scrollTo(0, 0); }, []);

  // кнопка «Назад» Telegram — когда есть куда возвращаться
  useEffect(() => backButton(stack.length > 1, back), [stack.length, back]);

  if (!st.ready) return <div className="splash">📘</div>;

  const ask = ctx => go({ s: 'ask', ctx });
  let title = t('appName', lang), body = null, ctx = null;

  if (cur.s === 'home') {
    body = <Home lang={lang} done={st.done} known={st.known} best={st.best} go={go} />;
  } else if (cur.s === 'lessons') {
    title = t('learn', lang);
    body = <LessonList lang={lang} done={st.done} onOpen={id => go({ s: 'lesson', id })} />;
  } else if (cur.s === 'lesson') {
    const tp = topicById(cur.id);
    title = tp.title[lang];
    ctx = { kind: 'topic', id: tp.id, title: tp.title[lang] };
    body = <LessonPage topic={tp} lang={lang} onDone={() => st.markDone(tp.id)} />;
  } else if (cur.s === 'dict') {
    title = t('dict', lang);
    body = <DictHome lang={lang} saved={st.saved} known={st.known} onSave={st.toggleSaved} onAsk={ask}
      onTheme={id => go({ s: 'theme', id })} onSaved={() => go({ s: 'saved' })} />;
  } else if (cur.s === 'theme' || cur.s === 'saved') {
    const th = cur.s === 'theme' ? themeById(cur.id) : null;
    const words = th ? th.words : savedWords(st.saved);
    title = th ? th.title[lang] : t('myWords', lang);
    if (th) ctx = { kind: 'theme', id: th.id, title: th.title[lang] };
    body = (
      <div className="list">
        {words.length > 0 && <button className="btn wide" onClick={() => go({ s: 'cards', id: cur.id || 'saved' })}>🃏 {t('cards', lang)}</button>}
        <WordList words={words} lang={lang} saved={st.saved} known={st.known} onSave={st.toggleSaved} onAsk={ask} empty={t('noSaved', lang)} />
      </div>
    );
  } else if (cur.s === 'cards') {
    const th = cur.id !== 'saved' ? themeById(cur.id) : null;
    title = t('cards', lang);
    body = <Cards words={th ? th.words : savedWords(st.saved)} lang={lang} known={st.known} setKnown={st.setKnownWord} onDone={back} />;
  } else if (cur.s === 'tests') {
    title = t('tests', lang);
    body = <TestsHome lang={lang} best={st.best} onStart={mode => go({ s: 'test', mode })} />;
  } else if (cur.s === 'test') {
    const m = MODES.find(x => x.id === cur.mode);
    title = lang === 'ky' ? m.ky : m.ru;
    body = <TestRun key={cur.mode} mode={cur.mode} lang={lang} onFinish={pct => st.setScore(cur.mode, pct)} onLesson={id => go({ s: 'lesson', id })} />;
  } else if (cur.s === 'ask') {
    title = t('ask', lang);
    body = <Ask lang={lang} context={cur.ctx || null} />;
  }

  return (
    <div className={'app' + (cur.s === 'ask' ? ' is-ask' : '')}>
      <Header title={title} lang={lang} setLang={setLang} onBack={stack.length > 1 ? back : null} />
      <main>{body}</main>
      {cur.s !== 'ask' && <AskBar lang={lang} onAsk={() => ask(ctx)} />}
    </div>
  );
}
