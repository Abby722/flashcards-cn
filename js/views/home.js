/* Home: all decks, plus creating and importing decks. */
(function () {
  const { h } = App.util;
  App.views = App.views || {};

  App.views.home = function (root) {
    App.ui.modes(null);
    const decks = App.store.decks();
    const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const r = await App.share.importFile(f); App.util.toast(r.updated ? 'Deck updated.' : 'Deck added.'); location.hash = `#/deck/${r.id}/cards`; }
      catch (err) { App.util.toast(err.message || 'Could not open that file.'); }
      e.target.value = '';
    } });

    root.append(
      h('div.home-head',
        h('div', h('h1', 'Your decks'), h('p', 'One deck per lesson works well. Open a deck to practise, build sentences or take a quiz.')),
        h('div.row',
          h('a.btn', { href: '#/chars' }, '字表 All characters'),
          h('button.btn', { onclick: () => fileInput.click() }, 'Open a deck file'),
          h('button.btn.primary', { onclick: () => { const d = App.store.newDeck('Lesson ' + (decks.length + 1)); App.store.saveDeck(d); location.hash = `#/deck/${d.id}/edit`; } }, '+ New deck'),
          fileInput)),
      decks.length ? h('div.decks', decks.map(deckCard)) : h('div.empty', h('p', 'No decks yet. Make one for today\'s lesson.'))
    );
  };

  function deckCard(d) {
    const due = App.store.dueCards(d).length;
    const counts = new Map();
    for (const c of d.cards) { const s = App.slots.forPos(c.pos); counts.set(s, (counts.get(s) || 0) + 1); }
    const strip = h('div.deck-strip', { 'aria-hidden': 'true' }, [...counts].map(([s, n]) => h('i', { style: { background: App.slots.colors(s).border, flex: n } })));
    return h('article.deck',
      strip,
      h('h3', d.name),
      h('div.deck-words', { lang: 'zh-CN' }, d.cards.slice(0, 14).map(c => c.hz).join(' ') || '—'),
      h('div.deck-meta', `${d.cards.length} words, ${d.sentences.length} sentences`, due && d.cards.length ? [', ', h('span.due-badge', `${due} to review`)] : null),
      h('div.deck-actions',
        h('a.btn.small.primary', { href: `#/deck/${d.id}/cards` }, 'Cards'),
        h('a.btn.small', { href: `#/deck/${d.id}/build` }, 'Sentences'),
        h('a.btn.small', { href: `#/deck/${d.id}/quiz` }, 'Quiz'),
        h('span.spacer'),
        h('a.btn.small.quiet', { href: `#/deck/${d.id}/edit` }, 'Edit')));
  }
})();
