// Прогресс мамы: язык, пройденные темы, выученные и сохранённые слова.
// Хранится в облаке Telegram — не пропадёт, если поменять телефон.
import { useEffect, useState, useCallback } from 'react';
import { load, save, loadList, saveList } from './tg';


export function useStore() {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState('ky');
  const [done, setDone] = useState([]);      // пройденные темы
  const [saved, setSaved] = useState([]);    // «мои слова»
  const [known, setKnown] = useState([]);    // выученные карточками
  const [best, setBest] = useState({});      // лучшие результаты тестов, %

  useEffect(() => {
    Promise.all([load('lang'), loadList('done'), loadList('saved'), loadList('known'), load('best')]).then(([l, d, s, k, b]) => {
      if (l === 'ru' || l === 'ky') setLangState(l);
      setDone(d); setSaved(s); setKnown(k);
      try { const o = JSON.parse(b || '{}'); if (o && typeof o === 'object') setBest(o); } catch (e) {}
      setReady(true);
    });
  }, []);

  const setLang = useCallback(l => { setLangState(l); save('lang', l); }, []);

  const markDone = useCallback(id => setDone(p => {
    if (p.includes(id)) return p;
    const n = p.concat(id); saveList('done', n); return n;
  }), []);

  const toggleSaved = useCallback(w => setSaved(p => {
    const n = p.includes(w) ? p.filter(x => x !== w) : p.concat(w);
    saveList('saved', n); return n;
  }), []);

  const setKnownWord = useCallback((w, yes) => setKnown(p => {
    const has = p.includes(w);
    if (yes === has) return p;
    const n = yes ? p.concat(w) : p.filter(x => x !== w);
    saveList('known', n); return n;
  }), []);

  const setScore = useCallback((mode, pct) => setBest(p => {
    if (p[mode] != null && p[mode] >= pct) return p;
    const n = { ...p, [mode]: pct }; save('best', JSON.stringify(n)); return n;
  }), []);

  return { best, setScore, ready, lang, setLang, done, markDone, saved, toggleSaved, known, setKnownWord };
}
