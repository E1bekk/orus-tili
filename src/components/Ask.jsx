// ИИ-помощник. Открывается с любого экрана и знает, откуда его позвали.
import { useEffect, useRef, useState } from 'react';
import { askAI } from '../lib/api';
import { inTelegram } from '../lib/tg';
import { t } from '../lib/i18n';

// Безопасный показ ответа: только переносы строк и **жирный**, без чужого HTML
function Rich({ text }) {
  return text.split('\n').map((line, i) => (
    <p key={i}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? <b key={j}>{part.slice(2, -2)}</b> : <span key={j}>{part.replace(/^\s*[*-]\s+/, '• ')}</span>
      )}
    </p>
  ));
}

function contextLabel(ctx, lang) {
  if (!ctx) return null;
  if (ctx.kind === 'topic') return `${t('aiAbout', lang)} ${ctx.title}`;
  if (ctx.kind === 'word') return `${t('aiAbout', lang)} «${ctx.ru}»`;
  if (ctx.kind === 'theme') return `${t('aiAbout', lang)} ${ctx.title}`;
  return null;
}

export function Ask({ lang, context }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef(null);
  const input = useRef(null);

  useEffect(() => { end.current && end.current.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  const send = async raw => {
    const q = String(raw || '').trim();
    if (!q || busy) return;
    const history = msgs.concat({ role: 'user', text: q });
    setMsgs(history); setText(''); setErr(''); setBusy(true);
    try {
      const a = await askAI({ history: history.slice(-10), lang, context });
      setMsgs(h => h.concat({ role: 'ai', text: a }));
    } catch (e) {
      // общая фраза + точная причина мелким шрифтом — по ней видно, что чинить
      setErr((inTelegram ? t('aiError', lang) : t('aiOnlyTg', lang)) + (e && e.message ? '\n' + e.message : ''));
    } finally { setBusy(false); }
  };

  // «проверь фразу» — подставляем начало, мама дописывает свою фразу
  const startCheck = () => {
    setText(lang === 'ky' ? 'Текшерип бериңиз: ' : 'Проверь, пожалуйста: ');
    setTimeout(() => input.current && input.current.focus(), 50);
  };

  const label = contextLabel(context, lang);
  const chips = [
    { k: 'aiCheck', act: startCheck },
    { k: 'aiExplain', act: () => send(t('aiExplain', lang) + (label ? ': ' + label.replace(t('aiAbout', lang), '').trim() : '')) },
    { k: 'aiMore', act: () => send(t('aiMore', lang) + (label ? ': ' + label.replace(t('aiAbout', lang), '').trim() : '')) },
    { k: 'aiWhen', act: () => send(t('aiWhen', lang) + (label ? ' ' + label.replace(t('aiAbout', lang), '').trim() : '')) }
  ];

  return (
    <div className="ask">
      {label && <div className="ask-ctx">✨ {label}</div>}
      <div className="ask-body">
        <div className="msg ai"><Rich text={t('aiHello', lang)} /></div>
        {msgs.map((m, i) => <div key={i} className={'msg ' + m.role}><Rich text={m.text} /></div>)}
        {busy && <div className="msg ai thinking"><span /><span /><span /> {t('aiThink', lang)}</div>}
        {err && <p className="ask-err">{err.split('\n')[0]}{err.includes('\n') && <small>{err.split('\n').slice(1).join(' ')}</small>}</p>}
        <div ref={end} />
      </div>
      <div className="chips">
        {chips.map(c => <button key={c.k} onClick={c.act} disabled={busy}>{t(c.k, lang)}</button>)}
      </div>
      <form className="ask-send" onSubmit={e => { e.preventDefault(); send(text); }}>
        <textarea ref={input} rows={1} value={text} onChange={e => setText(e.target.value)} placeholder={t('aiPlace', lang)} maxLength={800}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
        <button disabled={busy || !text.trim()} aria-label={t('send', lang)}>➤</button>
      </form>
    </div>
  );
}
