/* Dictionary lookups for the deck editor. The big data files load only when the editor needs them. */
(function () {
  const L = App.lex = {};
  const U = App.util;

  L.ready = async function () {
    await U.loadScript('data/lexicon.js');
  };
  L.readyEmoji = () => U.loadScript('data/emoji.js');
  L.readyPinyin = () => U.loadScript('js/vendor/pinyin-pro.js');
  L.readyExtra = () => U.loadScript('data/lexicon-extra.js');

  const fromEntry = (w, e) => e && { hz: w, py: e[0], pos: App.posNorm(e[1]), en: e[2] || '', de: e[3] || '', emoji: e[4] || '' };

  /* Full lookup: core list, then the large fallback dictionary, then pinyin only. */
  L.lookup = async function (w) {
    await L.ready();
    let r = fromEntry(w, window.ZH_LEX[w]);
    if (!r) { await L.readyExtra().catch(() => {}); r = fromEntry(w, (window.ZH_LEX_EXTRA || {})[w]); }
    if (!r) r = { hz: w, py: await L.pinyin(w), pos: 'other', en: '', de: '', emoji: '' };
    if (!r.emoji && ['noun', 'adj', 'verb'].includes(r.pos)) { await L.readyEmoji().catch(() => {}); r.emoji = L.suggestEmoji(r.en)[0] || ''; }
    return r;
  };
  L.known = w => !!((window.ZH_LEX && window.ZH_LEX[w]) || (window.ZH_LEX_EXTRA && window.ZH_LEX_EXTRA[w]));

  L.pinyin = async function (text) {
    await L.readyPinyin();
    return window.pinyinPro.pinyin(text, { nonZh: 'consecutive' });
  };

  /* Per-character readings of a whole sentence, so 得 in 跑得很快 reads de, not dé. */
  L.contextPinyin = async function (text) {
    await L.readyPinyin();
    return window.pinyinPro.pinyin(text, { type: 'array', nonZh: 'removed' });
  };

  /* Pinyin for a word inside a sentence: deck card first, then dictionary, then pinyin-pro. */
  L.wordPinyin = async function (w, deck) {
    const c = deck && deck.cards.find(c => c.hz === w);
    if (c) return c.py;
    await L.ready();
    const e = window.ZH_LEX[w] || (window.ZH_LEX_EXTRA || {})[w];
    return e ? e[0] : L.pinyin(w);
  };

  /* Split a sentence into words. Spaces typed by the teacher always win;
     otherwise take the longest word known from the deck or the dictionary. */
  L.segment = async function (text, deck) {
    await L.ready();
    const deckWords = new Set((deck ? deck.cards : []).map(c => c.hz));
    const isWord = w => deckWords.has(w) || !!window.ZH_LEX[w];
    const out = [];
    for (const chunk of text.trim().split(/\s+/)) {
      if (!chunk) continue;
      if (!U.isHan(chunk) || chunk.length === 1) { out.push(chunk); continue; }
      let i = 0;
      while (i < chunk.length) {
        let len = Math.min(4, chunk.length - i);
        while (len > 1 && !isWord(chunk.slice(i, i + len))) len--;
        out.push(chunk.slice(i, i + len)); i += len;
      }
    }
    return out;
  };

  /* Words of a Chinese phrase with pinyin and word type: deck words first, then dictionary,
     particles and 一/不 from the dictionary, other single characters from sentence context. */
  L.analyse = async function (body, deck) {
    const words = await L.segment(body, deck);
    const ctx = await L.contextPinyin(words.join(''));
    const out = []; let at = 0;
    for (const w of words) {
      const c = deck && deck.cards.find(c => c.hz === w);
      const lex = c ? null : (window.ZH_LEX[w] || (window.ZH_LEX_EXTRA || {})[w]);
      const n = Array.from(w).filter(ch => U.isHan(ch)).length;
      const fromCtx = ctx.slice(at, at + n).join(' '); at += n;
      const useLex = lex && (n > 1 || App.posNorm(lex[1]) === 'particle' || w === '一' || w === '不');
      const py = !n ? '' : c ? c.py : useLex ? lex[0] : (fromCtx || await L.wordPinyin(w, deck));
      out.push({ w, py, pos: c ? c.pos : App.posNorm(lex ? lex[1] : 'other') });
    }
    return out;
  };
  /* A line of dialogue: Chinese runs become words with pinyin; punctuation and names stay as they are. */
  L.tokens = async function (text, deck) {
    const parts = text.match(/[\u3400-\u9fff\uf900-\ufaff]+|[^\u3400-\u9fff\uf900-\ufaff]+/g) || [];
    const out = [];
    for (const p of parts) {
      if (U.isHan(p)) (await L.analyse(p, deck)).forEach(x => out.push({ w: x.w, py: x.py }));
      else out.push({ w: p, py: '' });
    }
    return out;
  };

  /* Split a pasted list of words; an unknown run of characters that is made of known words gets split. */
  L.splitWordList = async function (text) {
    await L.ready();
    const tokens = text.split(/[\s,，、;；。/|]+/).map(t => t.trim()).filter(Boolean);
    const out = [];
    for (const t of tokens) {
      if (t.length > 2 && !L.known(t)) { const parts = await L.segment(t); if (parts.length > 1 && parts.every(p => window.ZH_LEX[p])) { out.push(...parts); continue; } }
      out.push(t);
    }
    return [...new Set(out)];
  };

  /* Emoji search by English keyword. */
  L.searchEmoji = function (q, limit = 60) {
    const list = window.ZH_EMOJI || [];
    q = (q || '').toLowerCase().trim();
    if (!q) return list.slice(0, limit).map(e => e[0]);
    const words = q.split(/\s+/);
    const scored = [];
    for (const [emo, kw] of list) {
      const toks = kw.split(' ');
      let s = 0;
      for (const w of words) {
        if (toks[0] === w) s += 5;
        else if (toks.includes(w)) s += 3;
        else if (toks.some(t => t.startsWith(w))) s += 1;
        else { s = 0; break; }
      }
      if (s) scored.push([s, emo]);
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(x => x[1]);
  };
  L.headword = en => (en || '').replace(/\([^)]*\)/g, ' ').split(/[;,]/)[0].replace(/^\s*(to|a|an|the)\s+/i, '').trim().toLowerCase();
  L.suggestEmoji = function (en) {
    const hw = L.headword(en);
    if (!hw) return [];
    let r = L.searchEmoji(hw, 12);
    if (!r.length && hw.includes(' ')) r = L.searchEmoji(hw.split(' ').pop(), 12);
    return r;
  };
})();
