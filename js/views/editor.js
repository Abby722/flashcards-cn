/* Deck editor: type characters, everything else is filled in and can be corrected. */
(function () {
  const U = App.util, { h } = U;
  App.views = App.views || {};

  App.views.edit = function (root, deck) {
    App.ui.modes(deck.id, 'edit');
    const save = () => App.store.saveDeck(deck);
    const saveSoon = U.debounce(save, 400);

    /* ---------- header: name, sharing ---------- */
    const nameInput = h('input.deck-name', { type: 'text', value: deck.name, 'aria-label': 'Deck name', oninput: e => { deck.name = e.target.value.trim() || 'Untitled deck'; saveSoon(); } });
    const header = h('section.ed-section',
      nameInput,
      h('div.row',
        h('button.btn.primary', { onclick: () => shareSheet(deck) }, 'Share with the family'),
        h('a.btn', { href: `#/deck/${deck.id}/cards` }, 'Practise this deck'),
        h('span.spacer'),
        h('button.btn.quiet.danger', { onclick: async () => {
          if (await App.ui.confirm(`Delete “${deck.name}” and its recordings from this device?`)) { App.store.deleteDeck(deck.id); location.hash = '#/'; }
        } }, 'Delete deck')));

    /* ---------- words ---------- */
    const wordInput = h('textarea', { placeholder: '猫 狗 你 我 喜欢', 'aria-label': 'New words in Chinese characters', lang: 'zh-CN' });
    const status = h('div.muted', { role: 'status' });
    const legendBox = h('div');
    const rows = h('div.wordrows');
    const addBtn = h('button.btn.primary', { onclick: addWords }, 'Add words');
    wordInput.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addWords(); });

    async function addWords() {
      const text = wordInput.value.trim(); if (!text) return;
      addBtn.disabled = true; status.textContent = 'Looking up the words…';
      try {
        const words = await App.lex.splitWordList(text);
        let added = 0, skipped = 0;
        for (const w of words) {
          if (!U.isHan(w)) { skipped++; continue; }
          if (deck.cards.some(c => c.hz === w)) { skipped++; continue; }
          const r = await App.lex.lookup(w);
          deck.cards.push({ id: U.uid(), hz: w, py: r.py, pos: r.pos, en: r.en, de: r.de, emoji: r.emoji, img: null, audio: null });
          added++;
        }
        save(); wordInput.value = '';
        status.textContent = added ? `Added ${added} word${added > 1 ? 's' : ''}. Check the pinyin, colour and translation, and change anything that is off.` : '';
        if (skipped) status.textContent += ` ${skipped} skipped (already in the deck, or not Chinese characters).`;
        renderWords();
      } catch (err) { status.textContent = 'Could not look up the words: ' + err.message; }
      addBtn.disabled = false;
    }

    function renderWords() {
      legendBox.replaceChildren(deck.cards.length ? App.ui.legend(App.POS.map(p => p.key)) : '');
      rows.replaceChildren(...deck.cards.map(wordRow));
    }

    function wordRow(card) {
      const row = App.ui.posVars(h('div.wordrow'), card.pos);
      const picBtn = h('button.pic-btn', { type: 'button', title: 'Change picture', 'aria-label': 'Change picture for ' + card.hz, onclick: () => picturePicker(card, () => { save(); paintPic(); }) });
      const paintPic = () => {
        picBtn.replaceChildren();
        if (card.img) App.media.url(card.img).then(u => u && picBtn.replaceChildren(h('img', { src: u, alt: '' })));
        else picBtn.textContent = card.emoji || '＋';
      };
      paintPic();
      const field = (key, label, extra = {}) => h('input', { type: 'text', value: card[key] || '', 'aria-label': label + ' for ' + card.hz, placeholder: label, oninput: e => { card[key] = e.target.value; saveSoon(); }, ...extra });
      const posSel = h('select.pos-select', { 'aria-label': 'Part of speech for ' + card.hz, onchange: e => { card.pos = e.target.value; App.ui.posVars(row, card.pos); App.ui.posVars(posSel, card.pos); save(); } },
        App.POS.map(p => h('option', { value: p.key, selected: App.posNorm(card.pos) === p.key }, `${p.en} ${p.zh}`)));
      App.ui.posVars(posSel, card.pos);

      const tools = h('div.w-tools');
      const paintTools = () => {
        tools.replaceChildren(
          h('button.btn.small.quiet', { title: 'Listen', 'aria-label': 'Listen to ' + card.hz, onclick: () => App.speech.card(card) }, '🔊'),
          recordButton(card, () => { save(); paintTools(); }),
          card.audio ? h('button.btn.small.quiet', { title: 'Remove my recording (use the computer voice)', 'aria-label': 'Remove recording', onclick: () => { App.media.remove(card.audio); card.audio = null; save(); paintTools(); } }, '↺') : null,
          h('button.btn.small.quiet', { title: 'Remove word', 'aria-label': 'Remove ' + card.hz, onclick: () => { deck.cards = deck.cards.filter(c => c !== card); App.store.saveDeck(deck); if (card.img) App.media.remove(card.img); if (card.audio) App.media.remove(card.audio); renderWords(); } }, '✕'));
      };
      paintTools();

      row.append(picBtn,
        h('div.w-hz', { lang: 'zh-CN' }, card.hz),
        h('div.fields', field('py', 'Pinyin', { className: 'py' }), posSel, field('en', 'English'), field('de', 'German'), tools));
      return row;
    }

    /* ---------- sentences ---------- */
    const sentInput = h('textarea', { placeholder: '我喜欢猫。\n你喜欢狗吗？', 'aria-label': 'New sentences, one per line', lang: 'zh-CN' });
    const sentStatus = h('div.muted', { role: 'status' });
    const sentRows = h('div.wordrows');
    const sentBtn = h('button.btn.primary', { onclick: addSentences }, 'Add sentences');

    async function parseSentence(line) {
      const m = line.trim().match(/^(.*?)([。？！?!.…]*)$/);
      const body = m[1], punct = (m[2] || '').replace('?', '？').replace('!', '！').replace(/\.$/, '。');
      const out = await App.lex.analyse(body, deck);
      const g = App.slots.guess(out, deck);
      out.forEach((w, i) => w.slot = g[i]);
      return { words: out, punct };
    }

    async function addSentences() {
      const lines = sentInput.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) return;
      sentBtn.disabled = true; sentStatus.textContent = 'Splitting into words…';
      for (const line of lines) {
        const p = await parseSentence(line);
        if (p.words.length < 2) continue;
        deck.sentences.push({ id: U.uid(), words: p.words, punct: p.punct, en: '', de: '', alts: [] });
      }
      save(); sentInput.value = ''; sentBtn.disabled = false;
      sentStatus.textContent = 'Added. Each coloured block becomes one tile. To split differently, edit the words with spaces between them. Add a translation so the student knows what to build.';
      renderSentences();
    }

    function renderSentences() { sentRows.replaceChildren(...deck.sentences.map(sentRow)); }

    function sentRow(s) {
      const tiles = h('div.sent-tiles', { lang: 'zh-CN' });
      const editWord = (w, i) => App.ui.modal(close => {
        const cur = App.slots.ofSentence(s, deck)[i];
        let chosen = cur ? cur.id : null;
        const inp = h('input.py', { type: 'text', value: w.py });
        const swatches = h('div.swatches', [...App.slots.list(), null].map(sl => {
          const b = App.ui.slotVars(h('button.swatch', { type: 'button', 'aria-pressed': String((sl ? sl.id : null) === chosen) }, App.ui.mark(sl), sl ? sl.name : 'helper word'), sl);
          b.onclick = () => { chosen = sl ? sl.id : null; swatches.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
          return b;
        }));
        const ok = () => { w.py = inp.value.trim() || w.py; w.slot = chosen; save(); paint(); close(); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
        setTimeout(() => inp.focus(), 30);
        return [h('h2', h('span.hz', w.w)),
          h('label.field', 'Pinyin', inp),
          h('div.field', 'Position in this sentence', swatches),
          h('div.sheet-actions', h('button.btn.quiet', { onclick: close }, 'Cancel'), h('button.btn.primary', { onclick: ok }, 'Save'))];
      });
      const paint = () => { const sl = App.slots.ofSentence(s, deck); tiles.replaceChildren(...s.words.map((w, i) => App.ui.slotVars(h('button.mini-tile', { type: 'button', title: 'Change pinyin or colour', onclick: () => editWord(w, i) }, h('span.py', w.py), h('span.hz', w.w)), sl[i])), h('span.hz', { style: { fontSize: '1.4rem' } }, s.punct || ''),
        h('button.btn.small.quiet', { title: 'Listen', 'aria-label': 'Listen to the sentence', onclick: () => App.speech.sentence(s) }, '🔊')); };
      paint();
      const wordsInput = h('input', { type: 'text', value: s.words.map(w => w.w).join(' ') + (s.punct || ''), lang: 'zh-CN', className: 'hz',
        onchange: async e => {
          const p = await parseSentence(e.target.value.trim());
          if (p.words.length < 2) { U.toast('A sentence needs at least two words.'); return; }
          s.words = p.words; s.punct = p.punct; s.alts = []; altInput.value = ''; save(); paint();
        } });
      const altInput = h('input', { type: 'text', value: (s.alts || []).map(a => a.join(' ')).join(' / '), lang: 'zh-CN', className: 'hz', placeholder: 'e.g. 我 今天 很 好',
        onchange: e => {
          const base = s.words.map(w => w.w).sort().join('|');
          const alts = e.target.value.split('/').map(a => a.trim().replace(/[。？！?!.]+$/, '')).filter(Boolean).map(a => a.split(/\s+/));
          const bad = alts.filter(a => a.slice().sort().join('|') !== base);
          if (bad.length) { U.toast('Each other order must use exactly the same words, separated by spaces.'); return; }
          s.alts = alts; save(); U.toast('Saved. Both orders now count as correct.');
        } });
      const tr = (key, label) => h('label', label, h('input', { type: 'text', value: s[key] || '', placeholder: key === 'en' ? 'English translation' : 'German translation', oninput: e => { s[key] = e.target.value; saveSoon(); } }));
      return h('div.sent-row',
        h('div.row', tiles, h('span.spacer'), h('button.btn.small.quiet', { 'aria-label': 'Remove sentence', title: 'Remove sentence', onclick: () => { deck.sentences = deck.sentences.filter(x => x !== s); save(); renderSentences(); } }, '✕')),
        h('div.sent-fields',
          h('label', 'Words (spaces between tiles)', wordsInput),
          tr('en', 'English'), tr('de', 'German'),
          h('label', 'Also correct (optional)', altInput)));
    }

    root.append(h('div.editor',
      header,
      h('section.ed-section',
        h('h2', 'Words'),
        h('p', 'Type the characters you learned, separated by spaces or new lines. Pinyin, colour, picture and translations fill in by themselves.'),
        h('div.add-words', wordInput, addBtn), status, legendBox, rows),
      h('section.ed-section',
        h('h2', 'Sentences'),
        h('p', 'One sentence per line. They become word tiles to put in order, coloured by position (who, does, what…). Tap a tile to change its colour or pinyin. If a sentence can be said in two orders, add the other one under “Also correct”.'),
        h('div.add-words', sentInput, sentBtn), sentStatus, sentRows),
      App.ui.talkSection(deck, save)));

    renderWords(); renderSentences();
    App.lex.ready().catch(() => status.textContent = 'The dictionary did not load. Check the internet connection.');
    if (!deck.cards.length) wordInput.focus();
  };

  /* ---------- recording button ---------- */
  function recordButton(card, done) {
    let rec = null;
    const b = h('button.btn.small.quiet.rec-btn', { title: card.audio ? 'Record again' : 'Record your voice', 'aria-label': 'Record your voice for ' + card.hz }, card.audio ? h('span.has-audio', '🎙') : '🎙');
    b.onclick = async () => {
      if (!App.speech.canRecord()) { U.toast('Recording needs a browser with microphone support, on an https page.'); return; }
      if (!rec) {
        if (App.speech.isRecording()) { U.toast('Stop the other recording first (the red ■ button).'); return; }
        try { rec = await App.speech.record(); b.classList.add('recording'); b.textContent = '■'; b.title = 'Stop recording'; }
        catch (e) { if (e.message !== 'busy') U.toast('The microphone is blocked. Allow it in the browser and try again.'); rec = null; }
      } else {
        const blob = await rec.stop(); rec = null;
        if (card.audio) await App.media.remove(card.audio);
        card.audio = await App.media.put(blob);
        done(); App.speech.card(card);
      }
    };
    return b;
  }

  /* ---------- picture picker ---------- */
  async function picturePicker(card, done) {
    await App.lex.readyEmoji().catch(() => {});
    App.ui.modal(close => {
      const grid = h('div.emoji-grid');
      const show = q => grid.replaceChildren(...App.lex.searchEmoji(q, 90).map(e => h('button', { type: 'button', onclick: () => { if (card.img) App.media.remove(card.img); card.img = null; card.emoji = e; close(); done(); } }, e)));
      const search = h('input', { type: 'search', placeholder: 'Search pictures in English: cat, apple, run…', value: App.lex.headword(card.en), oninput: e => show(e.target.value) });
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try { const blob = await App.media.imageFromFile(f); if (card.img) await App.media.remove(card.img); card.img = await App.media.put(blob); close(); done(); }
        catch (err) { U.toast(err.message); }
      } });
      show(search.value);
      setTimeout(() => search.focus(), 50);
      return [
        h('h2', h('span.hz', card.hz), ' picture'),
        search, grid,
        h('div.sheet-actions',
          h('button.btn.quiet', { onclick: () => { if (card.img) App.media.remove(card.img); card.img = null; card.emoji = ''; close(); done(); } }, 'No picture'),
          h('button.btn', { onclick: () => file.click() }, 'Upload a photo'), file,
          h('button.btn.primary', { onclick: close }, 'Done'))];
    });
  }

  /* ---------- sharing ---------- */
  function shareSheet(deck) {
    App.ui.modal(close => {
      const link = App.share.link(deck);
      const linkInput = h('input', { type: 'text', value: link, readOnly: true, onfocus: e => e.target.select() });
      const lost = App.share.linkHasLostMedia(deck);
      return [
        h('h2', 'Share with the family'),
        h('div.share-box',
          h('strong', 'Option 1: a link'),
          location.protocol === 'file:' ? h('p', { style: { color: 'var(--seal)' } }, 'This copy of the app is opened from a file on your computer, so the link will not work on other devices. Put the app online first (see the README: GitHub Pages), then share from there.') : null,
          h('p.muted', 'Opening the link adds this deck to their phone or tablet. Send it again after you add words, and it updates.' + (lost ? ' The link carries emoji and the computer voice, but not your recordings or photos; use the file for those.' : '')),
          linkInput,
          h('div.row',
            h('button.btn.primary', { onclick: async () => { try { await navigator.clipboard.writeText(link); U.toast('Link copied.'); } catch { linkInput.select(); U.toast('Press Ctrl+C / ⌘C to copy.'); } } }, 'Copy link'),
            navigator.share ? h('button.btn', { onclick: () => navigator.share({ title: deck.name, url: link }).catch(() => {}) }, 'Send…') : null)),
        h('div.share-box',
          h('strong', 'Option 2: a deck file'),
          h('p.muted', 'Includes your recordings and photos. They open it with “Open a deck file” on the home page.'),
          h('div.row', h('button.btn', { onclick: () => App.share.downloadFile(deck) }, 'Download deck file'))),
        h('div.sheet-actions', h('button.btn.quiet', { onclick: close }, 'Close'))];
    });
  }
})();
