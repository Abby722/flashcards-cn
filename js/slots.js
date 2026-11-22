/* Sentence slots: the positions a word can take (who / does / what / when-where / how).
   Same colour = words that can replace each other. The teacher can rename, recolour,
   add or remove slots in Settings. Words without a slot are "helper words" (outlined). */
(function () {
  const SL = App.slots = {};
  const KEY = 'zika.slots';

  SL.DEFAULTS = [
    { id: 'who',  name: 'who',                   zh: '谁',       color: '#BFDDF9', mark: '●', pos: ['pronoun'] },
    { id: 'does', name: 'does',                  zh: '做什么',   color: '#FFCDB8', mark: '▲', pos: ['verb'] },
    { id: 'what', name: 'what',                  zh: '什么',     color: '#BDEBD9', mark: '■', pos: ['noun'] },
    { id: 'when', name: 'when, where',           zh: '时间地点', color: '#DCD3F7', mark: '◆', pos: ['time'] },
    { id: 'how',  name: 'how, how many, what kind', zh: '怎么样', color: '#FDE7A3', mark: '★', pos: ['adj', 'adv', 'number', 'measure'] },
  ];

  SL.list = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) && v.length ? v : SL.DEFAULTS; } catch { return SL.DEFAULTS; } };
  SL.save = list => localStorage.setItem(KEY, JSON.stringify(list));
  SL.reset = () => localStorage.removeItem(KEY);
  SL.get = id => SL.list().find(s => s.id === id) || null;
  SL.forPos = pos => { const p = App.posNorm(pos); return SL.list().find(s => (s.pos || []).includes(p)) || null; };

  /* ---------- colour helpers: a pastel fill gets a matching border and dark text ---------- */
  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h * 360, s * 100, l * 100];
  }
  const hsl = (h, s, l) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
  const cache = {};
  SL.colors = function (slot) {
    if (!slot) return { bg: '#FFFFFF', border: '#B4B2A9', fg: '#4B5A66', dashed: true };
    if (cache[slot.color]) return cache[slot.color];
    const [h, s] = hexToHsl(slot.color);
    return (cache[slot.color] = { bg: slot.color, border: hsl(h, Math.min(70, s), 58), fg: hsl(h, Math.min(65, s * .8 + 20), 22), dashed: false });
  };
  /* Set --pbg/--pfg/--pbd on an element for a slot (or null = helper word). */
  SL.vars = function (el, slot) {
    const c = SL.colors(slot);
    el.style.setProperty('--pbg', c.bg); el.style.setProperty('--pfg', c.fg); el.style.setProperty('--pbd', c.border);
    el.classList.toggle('helper', !slot);
    return el;
  };

  /* ---------- guessing slots for a sentence ----------
     The first verb is "does"; nouns/pronouns before it are "who", after it "what".
     Other words go to the slot of their word type. The teacher can change any of it. */
  SL.guess = function (words, deck) {
    const posOf = w => App.posNorm((deck && deck.cards.find(c => c.hz === w.w) || w).pos);
    const list = SL.list();
    const has = id => list.some(s => s.id === id);
    const v = words.findIndex(w => posOf(w) === 'verb');
    return words.map((w, i) => {
      const p = posOf(w);
      if (p === 'noun' || p === 'pronoun') {
        if (v >= 0 && i > v && has('what')) return 'what';
        if (has('who') && (v < 0 || i < v)) return 'who';
      }
      if (i === v && has('does')) return 'does';
      const s = SL.forPos(p);
      return s ? s.id : null;
    });
  };
  /* Slot object for word i of a sentence: stored choice first, otherwise the guess. */
  SL.ofSentence = function (s, deck) {
    const g = SL.guess(s.words, deck);
    return s.words.map((w, i) => (w.slot !== undefined ? (w.slot ? SL.get(w.slot) : null) : (g[i] ? SL.get(g[i]) : null)));
  };
})();
