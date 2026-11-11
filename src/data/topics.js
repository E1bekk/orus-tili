// Все темы по разделам. Порядок — от простого к сложному.
import forms from './topics-forms.js';
import verbs from './topics-verbs.js';
import cases from './topics-cases.js';
import sentence from './topics-sentence.js';
import forms2 from './topics-forms2.js';
import verbs2 from './topics-verbs2.js';
import cases2 from './topics-cases2.js';
import sentence2 from './topics-sentence2.js';
import life from './topics-life.js';
import massage from './topics-massage.js';

export const SECTIONS = [
  { id: 'forms',    icon: '🔤', title: { ru: 'Формы слов', ky: 'Сөздүн формалары' },  topics: [...forms, ...forms2] },
  { id: 'verbs',    icon: '🏃', title: { ru: 'Глаголы', ky: 'Этиштер' },               topics: [...verbs, ...verbs2] },
  { id: 'cases',    icon: '🧭', title: { ru: 'Падежи', ky: 'Жөндөмөлөр (падежи)' },    topics: [...cases, ...cases2] },
  { id: 'sentence', icon: '💬', title: { ru: 'Предложение', ky: 'Сүйлөм' },           topics: [...sentence, ...sentence2] },
  { id: 'life',     icon: '🏙️', title: { ru: 'Жизненные ситуации', ky: 'Турмуштук кырдаалдар' }, topics: life },
  { id: 'massage',  icon: '💆', title: { ru: 'Массаж', ky: 'Массаж (укалоо)' }, topics: massage }
];

export const TOPICS = SECTIONS.flatMap(s => s.topics.map(t => ({ ...t, section: s.id })));
export const topicById = id => TOPICS.find(t => t.id === id);
