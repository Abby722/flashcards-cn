/* Parts of speech: one colour per category. Content words are coloured,
   function words (particles, linking words) are greys, so sentence patterns stand out. */
window.App = window.App || {};

App.POS = [
  { key: 'pronoun',  en: 'Pronoun',      de: 'Pronomen',    zh: '代词',   bg: '#7E22CE', fg: '#fff' },
  { key: 'noun',     en: 'Noun',         de: 'Nomen',       zh: '名词',   bg: '#1D4ED8', fg: '#fff' },
  { key: 'verb',     en: 'Verb',         de: 'Verb',        zh: '动词',   bg: '#DC2626', fg: '#fff' },
  { key: 'adj',      en: 'Adjective',    de: 'Adjektiv',    zh: '形容词', bg: '#15803D', fg: '#fff' },
  { key: 'adv',      en: 'Adverb',       de: 'Adverb',      zh: '副词',   bg: '#C2410C', fg: '#fff' },
  { key: 'measure',  en: 'Measure word', de: 'Zählwort',    zh: '量词',   bg: '#0F766E', fg: '#fff' },
  { key: 'number',   en: 'Number',       de: 'Zahl',        zh: '数词',   bg: '#92400E', fg: '#fff' },
  { key: 'time',     en: 'Time word',    de: 'Zeitwort',    zh: '时间词', bg: '#BE185D', fg: '#fff' },
  { key: 'particle', en: 'Particle',     de: 'Partikel',    zh: '助词',   bg: '#64748B', fg: '#fff' },
  { key: 'link',     en: 'Linking word', de: 'Bindewort',   zh: '连接词', bg: '#334155', fg: '#fff' },
  { key: 'phrase',   en: 'Phrase',       de: 'Redewendung', zh: '短语',   bg: '#EAB308', fg: '#22303C' },
  { key: 'other',    en: 'Other',        de: 'Sonstiges',   zh: '其他',   bg: '#CBD5E1', fg: '#22303C' },
];
App.POS_BY = Object.fromEntries(App.POS.map(p => [p.key, p]));
App.posNorm = k => (k === 'prep' || k === 'conj') ? 'link' : (App.POS_BY[k] ? k : 'other');
App.pos = k => App.POS_BY[App.posNorm(k)];
