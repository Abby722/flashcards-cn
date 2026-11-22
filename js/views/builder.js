/* Sentence builder: tap the word tiles in the right order.
   "Green as you go": every right tile turns green at once, a wrong tile shakes and goes back.
   "Check at the end": place everything, then press Check. */
(function () {
  const U = App.util, { h } = U;
  App.views = App.views || {};

  App.ui.sentenceBuilder = function (s, deck, opts) {
    const o = { mode: 'instant', hint: false, onSolved: () => {}, ...opts };
    const slots = App.slots.ofSentence(s, deck);
    const accepted = [s.words.map(w => w.w), ...(s.alts || [])];
    const tiles = s.words.map((w, i) => ({ i, ...w }));
    let bank = U.shuffle(tiles);
    for (let t = 0; t < 8 && bank.length > 1 && bank.every((x, k) => x.w === s.words[k].w); t++) bank = U.shuffle(tiles);
    let placed = [], mistakes = 0, solved = false;
    const marks = {};

    const answer = h('div.answer', { 'aria-label': 'Your sentence', lang: 'zh-CN' });
    const bankEl = h('div.bank', { 'aria-label': 'Word tiles', lang: 'zh-CN' });
    const after = h('div.solved-line', { 'aria-live': 'polite' });
    const checkBtn = h('button.btn.primary', { onclick: check, hidden: o.mode !== 'check' }, 'Check');

    const words = arr => arr.map(t => t.w);
    const isPrefix = arr => accepted.some(a => words(arr).every((w, k) => a[k] === w));

    function tileEl(t, where) {
      const b = App.ui.slotVars(h('button.tile', { type: 'button', 'aria-label': t.w }, App.ui.mark(slots[t.i]), App.ui.py(t.py), h('span.hz', t.w)), slots[t.i]);
      if (marks[t.i]) b.classList.add(marks[t.i]);
      b.onclick = () => (where === 'bank' ? take(t, b) : giveBack(t));
      b.disabled = solved;
      return b;
    }
    function paint() {
      const remaining = s.words.slice(placed.length);
      answer.replaceChildren(
        ...placed.map(t => tileEl(t, 'answer')),
        ...remaining.map((w, k) => o.hint ? App.ui.slotVars(h('div.slot.hint', { 'aria-hidden': 'true' }, App.ui.mark(slots[placed.length + k])), slots[placed.length + k]) : h('div.slot', { 'aria-hidden': 'true' })),
        s.punct ? h('span.punct', s.punct) : null);
      bankEl.replaceChildren(...bank.map(t => tileEl(t, 'bank')));
      checkBtn.disabled = bank.length > 0 || solved;
    }
    function take(t, el) {
      if (solved) return;
      if (o.mode === 'instant') {
        const next = placed.concat(t);
        if (!isPrefix(next)) {
          mistakes++;
          el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong');
          setTimeout(() => el.classList.remove('wrong'), 600);
          return;
        }
        marks[t.i] = 'ok';
      }
      placed = placed.concat(t); bank = bank.filter(x => x !== t);
      paint();
      if (o.mode === 'instant' && !bank.length) win();
    }
    function giveBack(t) {
      if (solved) return;
      const k = placed.indexOf(t);
      const back = o.mode === 'instant' ? placed.slice(k) : [t];
      placed.slice(k).forEach(x => delete marks[x.i]); // later tiles shift, so their old marks no longer apply
      placed = placed.filter(x => !back.includes(x));
      bank = bank.concat(back);
      paint();
    }
    function check() {
      if (accepted.some(a => a.join('|') === words(placed).join('|'))) { placed.forEach(t => marks[t.i] = 'ok'); return win(); }
      mistakes++;
      const best = accepted.map(a => [a.filter((w, k) => placed[k] && placed[k].w === w).length, a]).sort((x, y) => y[0] - x[0])[0][1];
      placed.forEach((t, k) => marks[t.i] = best[k] === t.w ? 'ok' : 'wrong');
      paint();
      U.toast('Not yet. Tap a red tile to send it back, then try again.');
    }
    function win() {
      solved = true; paint();
      answer.classList.add('correct');
      App.speech.sentence(s);
      after.replaceChildren(
        h('div', App.ui.seal(mistakes ? '对了' : '真棒')),
        App.ui.py(placed.map(t => t.py).join(' '), 'div'),
        h('div.muted', App.ui.meaning(s)));
      o.onSolved(mistakes === 0);
    }
    paint();
    return h('div.builder', answer, bankEl, checkBtn, after);
  };

  App.views.build = function (root, deck) {
    App.ui.modes(deck.id, 'build');
    if (!deck.sentences.length) return root.append(App.ui.emptyDeck(deck, 'This deck has no sentences yet. Add a few on the Edit page, for example 我喜欢猫。'));
    const st = { idx: 0, mode: localStorage.getItem('zika.bmode') || 'instant', hint: localStorage.getItem('zika.bhint') === '1' };
    let order = deck.sentences.map((_, i) => i);
    const stage = h('div');
    const counter = h('span.counter');
    const nextBtn = h('button.btn', { onclick: () => go(1) }, 'Next sentence');

    const seg = (opts, cur, set) => h('div.seg', { role: 'group' }, opts.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(cur() === v), onclick: e => { set(v); U.$$('button', e.target.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === e.target))); paint(); } }, label)));
    const controls = h('div.study-bar',
      seg([['instant', 'Green as you go'], ['check', 'Check at the end']], () => st.mode, v => { st.mode = v; localStorage.setItem('zika.bmode', v); }),
      h('label.check', h('input', { type: 'checkbox', checked: st.hint, onchange: e => { st.hint = e.target.checked; localStorage.setItem('zika.bhint', st.hint ? '1' : '0'); paint(); } }), 'Show the colour pattern'));

    function go(d) { st.idx = (st.idx + d + order.length) % order.length; paint(); }
    function paint() {
      const s = deck.sentences[order[st.idx]];
      counter.textContent = `${st.idx + 1} / ${order.length}`;
      const meaning = App.ui.meaning(s);
      stage.replaceChildren(
        h('div.prompt',
          h('div.muted', meaning ? 'Make this sentence in Chinese:' : 'Put the words in the right order:'),
          meaning ? h('div.big', meaning) : null,
          h('div.row', { style: { justifyContent: 'center' } }, h('button.btn.small.quiet', { onclick: () => App.speech.sentence(s) }, '🔊 Hear it'))),
        App.ui.sentenceBuilder(s, deck, { mode: st.mode, hint: st.hint }));
    }
    root.append(h('div.builder',
      controls,
      App.ui.legend(),
      stage,
      h('div.study-bar',
        h('button.btn', { onclick: () => go(-1), 'aria-label': 'Previous sentence' }, '←'), counter, nextBtn,
        h('button.btn.quiet', { onclick: () => { order = U.shuffle(order); st.idx = 0; paint(); } }, 'Shuffle'))));
    paint();
  };
})();
