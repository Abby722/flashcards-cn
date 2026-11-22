/* Builds data/lexicon.js, data/lexicon-extra.js and data/emoji.js.
   Run: npm install && ./fetch-sources.sh && node build-lex.js */
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'data') + path.sep;
const SRC = path.join(__dirname, 'sources');
const { pinyin, convert } = require('pinyin-pro');
const HSK = require(path.join(SRC, 'complete.min.json'));
const CED = require('./node_modules/cc-cedict/data/all.js').default.all; // [trad, simp, pinyinNum, defs, ...]
const EMOJILIB = require('./node_modules/emojilib/dist/emoji-en-US.json');
const UEJ = require('./node_modules/unicode-emoji-json/data-by-emoji.json');

const norm = s => s.toLowerCase().replace(/[05]/g, '').replace(/u:/g, 'v').replace(/ü/g, 'v').replace(/\s+/g, ' ').trim();
const numOf = w => pinyin(w, { toneType: 'num', type: 'array' }).join(' ');
const TONES = { a: 'āáǎàa', e: 'ēéěèe', i: 'īíǐìi', o: 'ōóǒòo', u: 'ūúǔùu', v: 'ǖǘǚǜü' };
function sylMark(syl) {
  syl = syl.replace(/ü/g, 'v').replace(/Ü/g, 'V'); const m = syl.match(/^([A-Za-z:]+?)([0-5])?$/); if (!m) return syl;
  let base = m[1].replace(/u:/g, 'v').replace(/U:/g, 'V'); const t = +(m[2] || 5);
  const cap = base[0] !== base[0].toLowerCase(); let b = base.toLowerCase();
  let idx = -1;
  if (t >= 1 && t <= 4) {
    if (b.includes('a')) idx = b.indexOf('a'); else if (b.includes('e')) idx = b.indexOf('e'); else if (b.includes('ou')) idx = b.indexOf('o');
    else { for (let i = b.length - 1; i >= 0; i--) if ('iouv'.includes(b[i])) { idx = i; break; } }
  }
  let r = '';
  for (let i = 0; i < b.length; i++) { const c = b[i]; if (i === idx) r += TONES[c][t - 1]; else r += c === 'v' ? 'ü' : c; }
  return cap ? r[0].toUpperCase() + r.slice(1) : r;
}
const fixR = s => s.replace(/ r(?=\s|$)/g, 'r');
const marksFromNum = n => fixR(n.trim().replace(/([1-5])(?=[a-zA-Z])/g, '$1 ').split(/\s+/).map(sylMark).join(' '));

// ---- HanDeDict index
const HDD = {};
for (const line of fs.readFileSync(path.join(SRC, 'handedict.u8'), 'utf8').split('\n')) {
  if (!line || line[0] === '#') continue;
  const m = line.match(/^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/);
  if (!m) continue;
  (HDD[m[2]] ||= []).push({ trad: m[1], py: norm(m[3]), senses: m[4].split('/') });
}
const HDPOS = { Geo: 'noun', Org: 'noun', Pers: 'noun', Name: 'noun', S: 'noun', V: 'verb', Adj: 'adj', A: 'adj', Adv: 'adv', Pron: 'pronoun', 'Zähl': 'measure', Num: 'number', Konj: 'conj', 'Präp': 'prep', Int: 'phrase', Eig: 'noun', Redew: 'phrase', Sprichw: 'phrase' };
function cleanList(s, max = 42) {
  const parts = s.split(/;\s*/).map(x => x.trim()).filter(Boolean);
  let r = '';
  for (const p of parts) { const n = r ? r + '; ' + p : p; if (n.length > max && r) break; r = n; }
  r = r.replace(/[\s,;:]+$/, '');
  if (r.length > max + 8) { r = r.slice(0, max).replace(/[\s,;:(]+\S*$/, '') + '…'; }
  return r;
}
function parseDeSense(s) {
  s = s.replace(/;?\s*Bsp\.:.*$/, '').replace(/\s*\((Lehnwort|alt:[^)]*)\)/g, '').replace(/,?\s*ZEW:[^()]*\(?[^)]*\)?/, '').trim();
  let pos = null;
  const tag = s.match(/\(([^()]*)\)\s*$/);
  if (tag) { const first = tag[1].split(',')[0].trim(); if (HDPOS[first] || /^[A-ZÄÖÜ][a-zäöü]*$/.test(first)) { pos = HDPOS[first] || null; s = s.slice(0, tag.index).trim(); } }
  return { text: s, pos };
}
function german(w, pyNorm, posWanted, trad) {
  const ents = HDD[w]; if (!ents) return { de: '', pos: null };
  let use = ents.filter(e => e.py === pyNorm);
  if (!use.length) use = ents;
  if (trad && use.some(e => e.trad === trad)) use = use.filter(e => e.trad === trad);
  const senses = use.flatMap(e => e.senses.map(parseDeSense));
  const good = senses.filter(x => x.text && !/^siehe|^Variante|^Nachname|^Familienname|^\(onom/.test(x.text));
  const posOk = posWanted ? good.filter(x => x.pos === posWanted) : [];
  const pool = posOk.length ? posOk : good;
  if (!pool.length) return { de: '', pos: null };
  // first sense, unless a later one of the same POS is a much simpler single word
  let pick = pool[0];
  const simple = pool.find(x => !/[,;(]/.test(x.text) && x.text.length <= 14);
  if (simple && /[,;]/.test(pick.text)) pick = simple;
  return { de: cleanList(pick.text), pos: pick.pos };
}
// ---- English cleanup
const BAD = /^(variant of|old variant|surname|used in|see |abbr\. for|unofficial variant|erhua variant|Japanese variant|archaic variant)/i;
function cleanEn(m) {
  return m.replace(/\((Note|Taiwan pr|CL|also pr|also written|bound form|literary|lit\.|figuratively|fig\.|loanword|onom\.)[^)]*\)/gi, '').replace(/\s+/g, ' ').replace(/^[\s;,]+|[\s;,]+$/g, '').trim();
}
function englishFrom(meanings, pos) {
  if (!Array.isArray(meanings)) meanings = meanings ? [String(meanings)] : [];
  let ms = meanings.filter(m => !BAD.test(m) && !/^\(onom\.\)/.test(m)).map(cleanEn).filter(Boolean);
  if (!ms.length) return '';
  const pref = pos === 'verb' ? (m => /^to /.test(m)) : pos === 'measure' ? (m => /classifier/.test(m)) : (pos === 'noun' || pos === 'adj') ? (m => !/^to |classifier|^\(/.test(m)) : null;
  if (pref) { const k = ms.findIndex(pref); if (k > 0) ms = [ms[k], ...ms.filter((_, j) => j !== k)]; }
  let r = cleanList(ms[0]);
  if (r.length < 18 && ms[1] && !ms[1].includes('(') && (r + '; ' + ms[1]).length <= 42 && (!pref || pref(ms[1]))) r += '; ' + cleanList(ms[1], 42 - r.length - 2);
  return r;
}
const HSKPOS = { n: 'noun', nz: 'noun', nr: 'noun', ns: 'noun', nt: 'noun', s: 'noun', f: 'noun', v: 'verb', vn: 'verb', a: 'adj', an: 'adj', b: 'adj', z: 'adj', ad: 'adv', d: 'adv', r: 'pronoun', Rg: 'pronoun', q: 'measure', qv: 'measure', qt: 'measure', mq: 'measure', m: 'number', Mg: 'number', t: 'time', tg: 'time', p: 'prep', c: 'conj', cc: 'conj', u: 'particle', y: 'particle', e: 'phrase', o: 'phrase', k: 'particle', h: 'particle', l: 'phrase', i: 'phrase' };

const CEDIDX = {};
for (const [trad, simp, pyn, defs] of CED) (CEDIDX[simp] ||= []).push(pyn);
const toneless = s => norm(s).replace(/[1-4]/g, '').split(' ').map(x => x === 'er' ? 'r' : x).join(' ');
const HSKBY = {}; for (const e of HSK) HSKBY[e.s] = e;
function chooseForm(e, pos) {
  const ref = norm(numOf(e.s));
  const forms = e.f.filter(f => f.m.some(m => !BAD.test(m) && !/^\(onom\.\)/.test(m)));
  if (!forms.length) return e.f[0];
  let best = null, bs = -1e9;
  for (const f of forms) {
    let sc = 0;
    if (norm(f.i.n) === ref) sc += 3; else if (toneless(f.i.n) === toneless(ref)) sc += 2;
    if (f.i.y[0] === f.i.y[0].toLowerCase()) sc += 2;
    sc += Math.min(f.m.filter(m => !BAD.test(m)).length, 5) * .3;
    if (pos === 'particle' && !/[1-4]/.test(f.i.n)) sc += 4;
    if (sc > bs) { bs = sc; best = f; }
  }
  return best;
}
function bestPinyin(w, override) {
  if (override) return override;
  const ref = norm(numOf(w));
  const e = HSKBY[w];
  if (e) {
    const fs_ = e.f.filter(f => f.m.some(m => !BAD.test(m)));
    const f = fs_.find(f => norm(f.i.n) === ref) || fs_.find(f => toneless(f.i.n) === toneless(ref) && f.i.y[0] === f.i.y[0].toLowerCase()) || fs_.find(f => toneless(f.i.n) === toneless(ref));
    if (f) return marksFromNum(f.i.n);
  }
  const c = CEDIDX[w];
  if (c) { const p = c.find(p => norm(p) === ref) || c.find(p => toneless(p) === toneless(ref) && p === p.toLowerCase()) || c.find(p => toneless(p) === toneless(ref)); if (p) return marksFromNum(p); }
  return pinyin(w);
}
const LEX = {};
// curated first
for (const line of fs.readFileSync(path.join(__dirname, 'curated.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line[0] === '#') continue;
  const [w, pos, en, de, emo, py] = line.split('|');
  if (LEX[w]) continue;
  LEX[w] = [bestPinyin(w, py), pos, en, de, emo || '', 1];
}
let hskCount = 0;
for (const e of HSK) {
  const w = e.s; if (LEX[w]) continue;
  const pos = (e.p || []).map(p => HSKPOS[p]).find(Boolean) || '';
  const form = chooseForm(e, pos);
  const en = englishFrom(form.m, pos);
  const g = german(w, norm(form.i.n), pos, form.t);
  LEX[w] = [marksFromNum(form.i.n), pos || g.pos || '', en, g.de, '', 0];
  hskCount++;
}
// hand corrections for generated entries
for (const line of fs.readFileSync(path.join(__dirname, 'overrides.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line[0] === '#') continue;
  const [w, pos, en, de, emo] = line.split('|');
  const e = LEX[w]; if (!e) { console.warn('override for unknown word', w); continue; }
  if (pos) e[1] = pos; if (en) e[2] = en; if (de) e[3] = de; if (emo) e[4] = emo;
  e[5] = 1;
}
// extra: CEDICT words not yet present
const EXTRA = {};
for (const [trad, simp, pyn, defs] of CED) {
  if (LEX[simp] || EXTRA[simp] || simp.length > 4 || /[A-Za-z0-9·，]/.test(simp)) continue;
  const en = englishFrom(defs); if (!en) continue;
  const pyNorm = norm(pyn);
  const g = german(simp, pyNorm, null);
  const py = marksFromNum(pyn);
  EXTRA[simp] = [py, g.pos || (/^[A-Z]/.test(pyn) ? 'noun' : ''), en, g.de];
}
const header = '/* Generated. English: CC-CEDICT (CC BY-SA 4.0, mdbg.net) via complete-hsk-vocabulary (MIT). German: HanDeDict (CC BY-SA 2.0). Curated beginner entries by the app author. */\n';
fs.writeFileSync(out + 'lexicon.js', header + 'window.ZH_LEX=' + JSON.stringify(LEX) + ';\n');
fs.writeFileSync(out + 'lexicon-extra.js', header + 'window.ZH_LEX_EXTRA=' + JSON.stringify(EXTRA) + ';\n');
// emoji search index
const EMO = [];
for (const [emo, kws] of Object.entries(EMOJILIB)) {
  const meta = UEJ[emo]; if (meta && /Flags/.test(meta.group) && !/flag_/.test(kws[0])) continue;
  EMO.push([emo, kws.join(' ').replace(/_/g, ' ')]);
}
fs.writeFileSync(out + 'emoji.js', '/* emojilib (MIT) keywords */\nwindow.ZH_EMOJI=' + JSON.stringify(EMO) + ';\n');
console.log('curated+hsk', Object.keys(LEX).length, 'hsk', hskCount, 'extra', Object.keys(EXTRA).length);
console.log('Built', Object.keys(LEX).length, 'core words and', Object.keys(EXTRA).length, 'extra words into data/.');
