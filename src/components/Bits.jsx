// Мелкие общие детали интерфейса.
import { useState } from 'react';
import { speak } from '../lib/speak';
import { t } from '../lib/i18n';
import { haptic } from '../lib/tg';

export function LangToggle({ lang, setLang }) {
  return (
    <div className="lang" role="group" aria-label="Тил / Язык">
      <button className={lang === 'ky' ? 'on' : ''} onClick={() => setLang('ky')}>Кыргызча</button>
      <button className={lang === 'ru' ? 'on' : ''} onClick={() => setLang('ru')}>Русский</button>
    </div>
  );
}

export function Header({ title, lang, setLang, onBack }) {
  return (
    <header className="top">
      <div className="top-row">
        {onBack && <button className="back" onClick={onBack} aria-label={t('back', lang)}>‹</button>}
        <h1>{title}</h1>
      </div>
      <LangToggle lang={lang} setLang={setLang} />
    </header>
  );
}

// Кнопка «Озвучка»: при нажатии — волна, пока грузится — крутится кольцо,
// пока звучит — прыгают полоски. Так понятно, что нажатие сработало.
const Speaker = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);
const Bars = () => <span className="bars" aria-hidden="true"><i /><i /><i /><i /></span>;

export function Say({ text, lang }) {
  const [st, setSt] = useState('idle');
  const [tap, setTap] = useState(0);
  const press = e => {
    e.stopPropagation();
    haptic('light');
    setTap(n => n + 1);
    speak(text, setSt);
  };
  const label = st === 'load' ? (lang === 'ky' ? 'Жүктөлүүдө' : 'Загрузка')
    : st === 'play' ? (lang === 'ky' ? 'Угулууда' : 'Звучит')
    : (lang === 'ky' ? 'Угуу' : 'Озвучка');
  return (
    <button className={'say ' + st} onClick={press} aria-label={label}>
      <span className="say-ic">
        {tap > 0 && <i key={tap} className="say-ripple" />}
        {st === 'load' && <i className="say-spin" />}
        {st === 'play' ? <Bars /> : <Speaker />}
      </span>
      <small>{label}</small>
    </button>
  );
}

// внизу каждого экрана
export function AskBar({ lang, onAsk }) {
  return (
    <div className="askbar">
      <button onClick={onAsk}><span>✨</span> {t('ask', lang)}</button>
    </div>
  );
}
