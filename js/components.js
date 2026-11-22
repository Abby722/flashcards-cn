/* Pieces of UI used by several views. */
(function () {
  const C = App.ui = {};
  const { h } = App.util;

  /* Word colours: a word on its own takes the colour of its usual slot (set in Settings → Colours). */
  C.posVars = (el, key) => App.slots.vars(el, App.slots.forPos(key));
  C.slotVars = (el, slot) => App.slots.vars(el, slot);
  C.posChip = key => { const p = App.pos(key); return C.posVars(h('span.pos-chip', p.en, h('span.hz', p.zh)), key); };
  C.slotChip = slot => App.slots.vars(h('span.pos-chip', slot ? [h('span.mark', { 'aria-hidden': 'true' }, slot.mark || ''), slot.name] : 'helper words'), slot);
  C.legend = () => h('div.legend', { 'aria-label': 'Colour key' }, [...App.slots.list().map(C.slotChip), C.slotChip(null)]);
  C.mark = slot => slot && slot.mark ? h('span.slot-mark', { 'aria-hidden': 'true' }, slot.mark) : null;
  /* Pinyin that follows the show / tap / hide switch. */
  C.py = (text, tag = 'span') => h(tag + '.py.pyx', text);

  /* Characters written in 田字格 squares, one square per character. */
  C.tzg = function (text, cell) {
    const chars = Array.from(text);
    const size = cell || (chars.length <= 1 ? 200 : chars.length === 2 ? 170 : chars.length === 3 ? 140 : Math.max(80, Math.floor(520 / chars.length)));
    return h('div.tzg', { style: { '--cell': `min(${size}px, ${Math.floor(84 / chars.length)}vw)` }, lang: 'zh-CN' },
      chars.map(ch => h('div.tzg-cell', h('span', ch))));
  };

  /* A card's picture: uploaded photo if any, otherwise its emoji. */
  C.picture = function (card, cls = '') {
    const box = h('div.pic' + cls);
    if (card.img) {
      const img = h('img', { alt: card.en || card.hz });
      App.media.url(card.img).then(u => { if (u) img.src = u; else box.replaceChildren(h('span.emoji', card.emoji || '')); });
      box.append(img);
    } else if (card.emoji) box.append(h('span.emoji', { 'aria-hidden': 'true' }, card.emoji));
    return box;
  };
  C.hasPicture = card => !!(card.img || card.emoji);

  C.trans = function (card) {
    const t = App.store.settings().trans;
    const lines = [];
    if ((t === 'both' || t === 'en') && card.en) lines.push(h('div', h('span.lang', 'EN'), card.en));
    if ((t === 'both' || t === 'de') && card.de) lines.push(h('div', h('span.lang', 'DE'), card.de));
    return h('div.trans', lines);
  };
  C.meaning = function (x) {
    const t = App.store.settings().trans;
    if (t === 'de') return x.de || x.en || '';
    if (t === 'en') return x.en || x.de || '';
    return [x.en, x.de].filter(Boolean).join(' / ');
  };

  C.modes = function (deckId, active) {
    const nav = document.getElementById('modes');
    nav.replaceChildren();
    if (!deckId) return;
    const items = [['cards', 'Cards', '卡片'], ['wall', 'Word wall', '词墙'], ['chars', 'Characters', '字表'], ['build', 'Sentences', '造句'], ['talk', 'Talk', '对话'], ['net', 'Network', '词网'], ['quiz', 'Quiz', '测验'], ['edit', 'Edit', '编辑']];
    for (const [k, label, zh] of items) nav.append(h('a', { href: k === 'chars' ? `#/chars?deck=${deckId}` : `#/deck/${deckId}/${k}`, 'aria-current': k === active ? 'page' : null }, label, h('span.hz', zh)));
  };

  /* Modal sheet: build(close) returns the content. */
  C.modal = function (build, onClose) {
    const d = document.getElementById('modal');
    const close = () => { if (d.open) d.close(); d.replaceChildren(); };
    d.onclose = () => { d.onclose = null; onClose && onClose(); };
    d.replaceChildren(h('div.sheet-body', build(close)));
    d.onclick = e => { if (e.target === d) close(); };
    d.showModal();
    return close;
  };
  C.confirm = (text, okLabel = 'Delete') => new Promise(res => {
    C.modal(close => [h('p', text), h('div.sheet-actions',
      h('button.btn.quiet', { onclick: () => { close(); res(false); } }, 'Cancel'),
      h('button.btn.danger', { onclick: () => { close(); res(true); } }, okLabel))]);
  });

  C.seal = (text = '真棒') => h('div.seal', { 'aria-label': 'Well done' }, text);

  C.speakBtn = (fn, label = 'Listen') => h('button.speak-btn', { type: 'button', title: label, 'aria-label': label, onclick: e => { e.stopPropagation(); fn(); } }, '🔊');

  C.emptyDeck = (deck, what) => h('div.empty',
    h('p', what),
    h('a.btn.primary', { href: `#/deck/${deck.id}/edit` }, 'Add words'));
})();
