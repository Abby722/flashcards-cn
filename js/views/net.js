/* Word network: a blank board the teacher builds live in class.
   Type a word to add it, drag words around, tap one word then another to link them:
   "grow" (solid line, the word gets longer) or "swap" (dashed line, same position).
   Everything is saved in the deck. */
(function () {
  const U = App.util, { h } = U;
  App.views = App.views || {};
  let keyHandler = null;

  App.views.net = function (root, deck, params) {
    App.ui.modes(deck.id, 'net');
    deck.boards = deck.boards || [];
    const save = () => App.store.saveDeck(deck);
    let board = deck.boards.find(b => b.id === params.get('b')) || deck.boards[0] || null;
    let selected = null, linkType = 'grow', pending = null; // pending: 'grow' | 'swap' while waiting for the second word
    const history = [];
    const snapshot = () => { history.push(JSON.stringify(board)); if (history.length > 60) history.shift(); };
    const undo = () => {
      if (!history.length) return U.toast('Nothing to undo.');
      const prev = JSON.parse(history.pop()); Object.assign(board, prev); selected = null; save(); paint();
    };

    const top = h('div.net-top');
    const area = h('div.board', { tabindex: '-1' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('board-lines');
    const panel = h('div.node-panel');

    /* ---------- top bar: boards, add word, link type, undo ---------- */
    function paintTop() {
      if (!board) {
        top.replaceChildren();
        area.replaceChildren(h('div.board-empty', h('p', 'A board is a blank page for a word network. Make one for a word, like 我, then build it with the class.'),
          h('button.btn.primary', { onclick: newBoard }, '+ New board')));
        return;
      }
      const input = h('input', { type: 'text', lang: 'zh-CN', className: 'hz', placeholder: '我的', 'aria-label': 'Add a word' });
      const add = async () => { const t = input.value.trim(); if (!t) return; input.value = ''; await addNode(t); input.focus(); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      const seg = (opts, cur, set) => h('div.seg', { role: 'group' }, opts.map(([v, label, title]) => h('button', { type: 'button', title, 'aria-pressed': String(cur() === v), onclick: e => { set(v); U.$$('button', e.target.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === e.target))); } }, label)));
      top.replaceChildren(
        h('div.row',
          h('select', { 'aria-label': 'Board', style: { width: 'auto', minWidth: '9em' }, onchange: e => { board = deck.boards.find(b => b.id === e.target.value); selected = null; history.length = 0; paint(); } },
            deck.boards.map(b => h('option', { value: b.id, selected: b === board }, b.title || 'Board'))),
          h('button.btn.small', { onclick: newBoard }, '+ New board'),
          h('button.btn.small.quiet', { onclick: renameBoard }, 'Rename'),
          h('button.btn.small.quiet.danger', { onclick: deleteBoard }, 'Delete board'),
          h('span.spacer'),
          h('button.btn.small', { onclick: undo, title: 'Undo (Ctrl/⌘ Z)' }, '↶ Undo')),
        h('div.row',
          h('div.add-node', input, h('button.btn.primary', { onclick: add }, 'Add')),
          h('span.muted', 'New words link to the selected word as'),
          seg([['grow', '── grow', 'Solid line: the word grows (我 → 我的)'], ['swap', '┄┄ swap', 'Dashed line: same position (我 ↔ 你)']], () => linkType, v => linkType = v)));
    }

    function newBoard() {
      prompt_('Name of the new board', 'e.g. 我', b => {
        board = { id: U.uid(), title: b || 'Board', nodes: [], links: [] };
        deck.boards.push(board); selected = null; history.length = 0; save(); paint();
      });
    }
    function renameBoard() { prompt_('Board name', board.title, t => { board.title = t || board.title; save(); paintTop(); }); }
    async function deleteBoard() {
      if (!(await App.ui.confirm(`Delete the board “${board.title}”?`))) return;
      deck.boards = deck.boards.filter(b => b !== board); board = deck.boards[0] || null; selected = null; history.length = 0; save(); paint();
    }
    function prompt_(label, value, ok) {
      App.ui.modal(close => {
        const inp = h('input', { type: 'text', value: value && !value.startsWith('e.g.') ? value : '', placeholder: value && value.startsWith('e.g.') ? value.slice(5) : '', lang: 'zh-CN' });
        const go = () => { close(); ok(inp.value.trim()); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        setTimeout(() => inp.focus(), 30);
        return [h('h2', label), inp, h('div.sheet-actions', h('button.btn.quiet', { onclick: close }, 'Cancel'), h('button.btn.primary', { onclick: go }, 'OK'))];
      });
    }

    /* ---------- nodes and links ---------- */
    async function pinyinOf(text) {
      await App.lex.ready();
      return (await App.lex.tokens(text, deck)).map(t => t.py).filter(Boolean).join(' ');
    }
    async function addNode(text) {
      snapshot();
      const from = selected && board.nodes.find(n => n.id === selected);
      const pos = freeSpot(from);
      const node = { id: U.uid(), text, py: await pinyinOf(text), x: pos.x, y: pos.y, slot: null };
      board.nodes.push(node);
      if (from) board.links.push({ id: U.uid(), a: from.id, b: node.id, type: linkType });
      // the selected word stays selected, so several words can be added around it
      save(); paint();
      App.speech.say(text);
    }
    /* A spot near the source word (or the middle) that is as far as possible from other words. */
    function freeSpot(from) {
      const r = area.getBoundingClientRect(), W = r.width || 900, H = r.height || 600;
      const cx = from ? from.x : .5, cy = from ? from.y : .5;
      let best = { x: cx, y: cy }, bestD = -1;
      for (const dist of from ? [170, 240, 320] : [0, 140, 220, 300]) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2 + (from ? 0 : .3);
        const x = Math.min(.93, Math.max(.07, cx + Math.cos(a) * dist / W)), y = Math.min(.9, Math.max(.1, cy + Math.sin(a) * dist * .8 / H));
        const d = Math.min(...board.nodes.map(n => Math.hypot((n.x - x) * W, (n.y - y) * H)), 1e9);
        if (d > bestD + 1) { bestD = d; best = { x, y }; }
        if (d > 150 && dist > 0) return best;
      }
      return best;
    }
    function toggleLink(a, b) {
      snapshot();
      const ex = board.links.find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
      if (ex) {
        if (ex.type === linkType) board.links = board.links.filter(l => l !== ex); else ex.type = linkType;
      } else board.links.push({ id: U.uid(), a, b, type: linkType });
      save();
    }
    /* Tapping only selects (and speaks). Linking is explicit: choose "Link ──/┄┄" first, then tap the other word. */
    function tapNode(n) {
      App.speech.say(n.text);
      if (pending && selected && selected !== n.id) {
        const t = linkType; linkType = pending; toggleLink(selected, n.id); linkType = t;
        pending = null; selected = n.id; paint(); return;
      }
      pending = null;
      selected = selected === n.id ? null : n.id;
      paint();
    }

    function paintPanel() {
      const n = selected && board.nodes.find(x => x.id === selected);
      if (!n) { panel.replaceChildren(h('span.muted', 'Tap a word to select it. New words you type are then linked to it.')); return; }
      if (pending) { panel.replaceChildren(h('strong', `Now tap the word to ${pending === 'grow' ? 'grow' : 'swap'} “${n.text}” with.`), h('button.btn.small.quiet', { onclick: () => { pending = null; paint(); } }, 'Cancel')); return; }
      panel.replaceChildren(
        h('strong.hz', n.text),
        h('button.btn.small', { title: 'Then tap another word (tap again to remove the line)', onclick: () => { pending = 'grow'; paint(); } }, '── Link'),
        h('button.btn.small', { title: 'Then tap another word (tap again to remove the line)', onclick: () => { pending = 'swap'; paint(); } }, '┄┄ Link'),
        h('div.swatches', [null, ...App.slots.list()].map(sl => {
          const b = sl ? App.ui.slotVars(h('button.swatch', { type: 'button', title: sl.name, 'aria-pressed': String(n.slot === sl.id) }, App.ui.mark(sl), sl.name), sl)
            : h('button.swatch.plain', { type: 'button', 'aria-pressed': String(!n.slot) }, 'plain');
          b.onclick = () => { snapshot(); n.slot = sl ? sl.id : null; save(); paint(); };
          return b;
        })),
        h('button.btn.small.quiet', { onclick: () => prompt_('Change the word', n.text, async t => { if (!t) return; snapshot(); n.text = t; n.py = await pinyinOf(t); save(); paint(); }) }, 'Edit'),
        h('button.btn.small.quiet', { onclick: () => prompt_('Pinyin for ' + n.text, n.py, t => { snapshot(); n.py = t; save(); paint(); }) }, 'Pinyin'),
        h('button.btn.small.quiet.danger', { onclick: () => { snapshot(); board.nodes = board.nodes.filter(x => x !== n); board.links = board.links.filter(l => l.a !== n.id && l.b !== n.id); selected = null; save(); paint(); } }, 'Remove'));
    }

    function paintLines() {
      const r = area.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
      svg.replaceChildren();
      for (const l of board.links) {
        const a = board.nodes.find(n => n.id === l.a), b = board.nodes.find(n => n.id === l.b);
        if (!a || !b) continue;
        const mk = (cls, extra) => {
          const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          ln.setAttribute('x1', a.x * r.width); ln.setAttribute('y1', a.y * r.height);
          ln.setAttribute('x2', b.x * r.width); ln.setAttribute('y2', b.y * r.height);
          ln.setAttribute('class', cls); if (extra) extra(ln); svg.append(ln); return ln;
        };
        mk('link ' + l.type);
        mk('link-hit', ln => {
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'title'); t.textContent = 'Tap to remove this line'; ln.append(t);
          ln.addEventListener('click', e => { e.stopPropagation(); snapshot(); board.links = board.links.filter(x => x !== l); save(); paint(); U.toast('Line removed. Undo brings it back.'); });
        });
      }
    }

    function nodeEl(n) {
      const sl = n.slot ? App.slots.get(n.slot) : null;
      const el = h('div.node' + (n.id === selected ? '.selected' : '') + (sl ? '' : '.plain'), { style: { left: (n.x * 100) + '%', top: (n.y * 100) + '%' }, role: 'button', tabindex: '0', 'aria-label': n.text, lang: 'zh-CN' },
        sl ? App.ui.mark(sl) : null, n.py ? App.ui.py(n.py) : null, h('span.hz', n.text));
      if (sl) App.ui.slotVars(el, sl);
      let sx, sy, ox, oy, moved = false, rect;
      el.addEventListener('pointerdown', e => {
        if (e.target.closest('.pyx:not(.rev)') && document.body.classList.contains('py-tap')) return;
        e.preventDefault(); el.setPointerCapture(e.pointerId);
        rect = area.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = n.x; oy = n.y; moved = false;
      });
      el.addEventListener('pointermove', e => {
        if (sx == null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        if (!moved) { snapshot(); moved = true; el.classList.add('dragging'); }
        n.x = Math.min(.97, Math.max(.03, ox + dx / rect.width)); n.y = Math.min(.96, Math.max(.04, oy + dy / rect.height));
        el.style.left = (n.x * 100) + '%'; el.style.top = (n.y * 100) + '%';
        paintLines();
      });
      const end = () => { if (sx == null) return; sx = null; el.classList.remove('dragging'); if (moved) save(); else tapNode(n); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', () => { sx = null; el.classList.remove('dragging'); });
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapNode(n); } });
      return el;
    }

    function paint() {
      paintTop();
      if (!board) { panel.replaceChildren(); return; }
      history.boardId = board.id;
      area.replaceChildren(svg, ...board.nodes.map(nodeEl));
      if (!board.nodes.length) area.append(h('div.board-hint', 'Type a word above and press Enter.'));
      paintPanel();
      requestAnimationFrame(paintLines);
    }

    area.addEventListener('click', e => { if (e.target === area || e.target === svg) { selected = null; pending = null; paint(); } });
    const ro = new ResizeObserver(() => board && paintLines()); ro.observe(area);

    keyHandler && document.removeEventListener('keydown', keyHandler);
    keyHandler = e => {
      if (!location.hash.includes('/net') || document.querySelector('dialog[open]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.target.matches('input, textarea')) { e.preventDefault(); undo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !e.target.matches('input, textarea')) { e.preventDefault(); U.$$('.node-panel .danger').pop()?.click(); }
      if (e.key === 'Escape') { selected = null; pending = null; paint(); }
    };
    document.addEventListener('keydown', keyHandler);

    root.append(h('div.net', top, panel, area,
      h('p.muted', { style: { fontSize: '.85rem' } }, 'Drag words to move them. To link two words, select one, press “── Link” (grow) or “┄┄ Link” (swap), then tap the other. Tap a line to remove it. ⛶ makes the board fill the screen.')));
    paint();
  };
})();
