/* Flashcards (flip one at a time) and the word wall (all words at once, for class). */
(function () {
  const U = App.util, { h } = U;
  App.views = App.views || {};
  let keyHandler = null;

  App.views.cards = function (root, deck, params) {
    App.ui.modes(deck.id, 'cards');
    if (!deck.cards.length) return root.append(App.ui.emptyDeck(deck, 'This deck has no words yet.'));

    const st = { front: sessionStorage.getItem('zika.front') || 'hz', idx: 0, flipped: false, set: 'all' };
    const only = params.get('ids') ? params.get('ids').split(',') : null;
    let order = [];
    const build = () => {
      let pool = only ? deck.cards.filter(c => only.includes(c.id)) : st.set === 'due' ? App.store.dueCards(deck) : deck.cards;
      if (!pool.length) pool = deck.cards;
      order = pool.map(c => c.id); st.idx = 0; st.flipped = false;
    };
    build();
    const card = () => deck.cards.find(c => c.id === order[st.idx]);

    const seg = (opts, cur, set) => h('div.seg', { role: 'group' }, opts.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(cur() === v), onclick: e => { set(v); U.$$('button', e.target.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === e.target))); } }, label)));
    const due = App.store.dueCards(deck).length;
    const bar = h('div.study-bar',
      h('span.muted', 'Front shows'),
      seg([['hz', '汉字'], ['pic', 'Picture'], ['py', 'Pinyin']], () => st.front, v => { st.front = v; sessionStorage.setItem('zika.front', v); st.flipped = false; paint(); }),
      only ? h('a.btn.small', { href: `#/deck/${deck.id}/cards` }, 'Show all words') :
        seg([['all', `All ${deck.cards.length}`], ['due', `To review ${due}`]], () => st.set, v => { st.set = v; build(); paint(); }),
      h('button.btn.small', { onclick: () => { order = U.shuffle(order); st.idx = 0; st.flipped = false; paint(); } }, 'Shuffle'));

    const flip = h('div.flip', { role: 'button', tabindex: '0', 'aria-label': 'Flashcard. Press space to turn it over.' });
    const counter = h('span.counter');
    const nav = h('div.study-bar',
      h('button.btn', { onclick: () => go(-1), 'aria-label': 'Previous card' }, '←'),
      counter,
      h('button.btn', { onclick: () => go(1), 'aria-label': 'Next card' }, '→'));
    const judge = h('div.judge',
      h('button.btn', { onclick: () => grade(false) }, 'Again'),
      h('button.btn.go', { onclick: () => grade(true) }, 'Got it'));

    function go(d) { st.idx = (st.idx + d + order.length) % order.length; st.flipped = false; paint(); }
    function grade(ok) { App.store.mark(deck.id, card().id, ok); U.toast(ok ? 'Nice. This one comes back later.' : 'It will come back soon.', 1400); go(1); }
    function turn() {
      st.flipped = !st.flipped; flip.classList.toggle('flipped', st.flipped);
      if (st.flipped && App.store.settings().autoSpeak) App.speech.card(card());
    }
    flip.onclick = turn;

    function front(c) {
      const f = App.ui.posVars(h('div.face.front'), c.pos);
      f.append(App.ui.posChip(c.pos));
      if (st.front === 'hz') f.append(App.ui.tzg(c.hz));
      else if (st.front === 'pic') f.append(App.ui.hasPicture(c) ? h('div.back-stack', App.ui.picture(c), App.ui.trans(c)) : h('div.back-stack', h('div.back-py', { style: { fontSize: '2rem' } }, App.ui.meaning(c) || '?')));
      else f.append(h('div.back-stack', h('div.back-py.py', c.py), App.ui.speakBtn(() => App.speech.card(c))));
      f.append(h('div.face-hint', 'Tap to turn over'));
      return f;
    }
    function back(c) {
      const b = App.ui.posVars(h('div.face.back'), c.pos);
      b.append(App.ui.posChip(c.pos), App.ui.speakBtn(() => App.speech.card(c), 'Listen to ' + c.hz),
        h('div.back-stack',
          App.ui.picture(c),
          h('div.back-py.py.pyx', c.py),
          h('div.back-hz.hz', { lang: 'zh-CN' }, c.hz),
          App.ui.trans(c)));
      return b;
    }
    function paint() {
      const c = card();
      flip.classList.toggle('flipped', st.flipped);
      flip.replaceChildren(h('div.flip-inner', front(c), back(c)));
      counter.textContent = `${st.idx + 1} / ${order.length}`;
    }

    keyHandler && document.removeEventListener('keydown', keyHandler);
    keyHandler = e => {
      if (!location.hash.includes('/cards') || e.target.matches('input, textarea, select') || document.querySelector('dialog[open]')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); turn(); }
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 's') App.speech.card(card());
    };
    document.addEventListener('keydown', keyHandler);

    root.append(h('div.study', bar, flip, nav, judge, h('p.muted', { style: { fontSize: '.85rem' } }, 'Keys: space turns the card, ← → move, S speaks.')));
    paint();
  };

  App.views.wall = function (root, deck) {
    App.ui.modes(deck.id, 'wall');
    if (!deck.cards.length) return root.append(App.ui.emptyDeck(deck, 'This deck has no words yet.'));
    let showPy = sessionStorage.getItem('zika.wallmean') !== '0';
    const grid = h('div.wall');
    const paint = () => grid.replaceChildren(...deck.cards.map(c => App.ui.posVars(h('button.wall-item', { type: 'button', onclick: () => App.speech.card(c), 'aria-label': `${c.hz} ${c.py} ${c.en}` },
      h('span.e', { 'aria-hidden': 'true' }, c.emoji || ''),
      h('span.hz', { lang: 'zh-CN' }, c.hz),
      App.ui.py(c.py),
      showPy ? h('span.t', App.ui.meaning(c)) : null), c.pos)));
    root.append(
      h('div.row', { style: { marginBottom: '6px' } },
        h('h2', { style: { margin: 0 } }, deck.name),
        h('span.spacer'),
        h('label.check', h('input', { type: 'checkbox', checked: showPy, onchange: e => { showPy = e.target.checked; sessionStorage.setItem('zika.wallmean', showPy ? '1' : '0'); paint(); } }), 'Show meaning')),
      App.ui.legend(deck.cards.map(c => c.pos)),
      grid,
      h('p.muted', { style: { marginTop: '14px' } }, 'Tap a word to hear it.'));
    paint();
  };
})();
