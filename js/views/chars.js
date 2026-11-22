/* 字表: every single character from the cards of all lessons, with its stroke order (笔顺).
   Words and phrases on the cards are split into characters; each character appears once,
   in the order it was first learned. */
(function () {
  const U = App.util, { h } = U;
  App.views = App.views || {};

  function collect(deckFilter) {
    const decks = App.store.decks().slice().sort((a, b) => (a.created || 0) - (b.created || 0));
    const map = new Map();
    for (const d of decks) {
      if (deckFilter && d.id !== deckFilter) continue;
      for (const c of d.cards) {
        for (const ch of Array.from(c.hz)) {
          if (!U.isHan(ch)) continue;
          if (!map.has(ch)) map.set(ch, { ch, card: null, words: new Set(), decks: new Set() });
          const e = map.get(ch);
          if (c.hz === ch && !e.card) e.card = c;
          if (c.hz !== ch) e.words.add(c.hz);
          e.decks.add(d.name);
        }
      }
    }
    return [...map.values()];
  }

  App.views.chars = async function (root, params) {
    App.ui.modes(params.get('deck') || null, 'chars');
    const deckId = params.get('deck') || '';
    const list = collect(deckId);
    const head = h('div.home-head',
      h('div', h('h1', '字表 Characters'), h('p', 'Every character from the cards, each once, in the order it was learned. Tap ▶ to watch it being written.')),
      h('div.row',
        h('select', { 'aria-label': 'Lesson', style: { width: 'auto' }, onchange: e => { location.hash = '#/chars' + (e.target.value ? '?deck=' + e.target.value : ''); } },
          h('option', { value: '' }, 'All lessons'),
          App.store.decks().map(d => h('option', { value: d.id, selected: d.id === deckId }, d.name))),
        h('button.btn', { onclick: () => window.print() }, 'Print')));
    if (!list.length) { root.append(head, h('div.empty', h('p', 'No characters yet. Add words to a deck first.'))); return; }

    await App.lex.ready().catch(() => {});
    const lex = ch => (window.ZH_LEX || {})[ch];
    const meaningOf = e => e.card ? App.ui.meaning(e.card) : (lex(e.ch) ? App.ui.meaning({ en: lex(e.ch)[2], de: lex(e.ch)[3] }) : '');
    const pinyinOf = e => e.card ? e.card.py : (lex(e.ch) ? lex(e.ch)[0] : '');

    const rows = list.map((e, i) => {
      const seq = h('div.seq-cell', h('span.muted', '…'));
      const count = h('span.stroke-count');
      const row = h('div.ch-row',
        h('span.ch-n', i + 1),
        h('button.ch-big', { type: 'button', lang: 'zh-CN', title: 'Listen', onclick: () => App.speech.say(e.ch) }, e.ch),
        h('div.ch-py', App.ui.py(pinyinOf(e))),
        h('div.ch-mean', meaningOf(e)),
        h('div.ch-words', { lang: 'zh-CN' }, [...e.words].slice(0, 6).join('、')),
        count,
        h('div.ch-strokes', seq, h('button.btn.small.quiet.anim-btn', { title: 'Watch it being written', 'aria-label': 'Animate ' + e.ch, onclick: () => App.strokes.animate(e.ch, pinyinOf(e)) }, '▶')));
      row._load = () => App.strokes.load(e.ch).then(d => { seq.replaceChildren(App.strokes.sequence(d)); count.textContent = d.strokes.length; },
        () => { seq.replaceChildren(h('span.muted', 'Stroke order not available offline yet.')); });
      return row;
    });

    const io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); en.target._load(); } }), { rootMargin: '400px' });
    rows.forEach(r => io.observe(r));
    window.addEventListener('beforeprint', () => rows.forEach(r => { io.unobserve(r); r._load(); }), { once: true });

    root.append(head,
      h('p.muted', `${list.length} characters`),
      h('div.ch-table',
        h('div.ch-row.ch-head', h('span', '#'), h('span', '字'), h('span', 'Pinyin'), h('span', 'Meaning'), h('span', 'In words'), h('span', 'Strokes'), h('span', '笔顺 Stroke order')),
        rows));
  };
})();
