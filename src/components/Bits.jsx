// Мелкие общие детали интерфейса.
import { canSpeak, speak } from '../lib/speak';
import { t } from '../lib/i18n';

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

// кнопка «послушать» — только если телефон умеет говорить
export function Say({ text, lang }) {
  if (!canSpeak()) return null;
  return (
    <button className="say" onClick={e => { e.stopPropagation(); speak(text); }} aria-label={t('listen', lang)} title={t('listen', lang)}>🔊</button>
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
