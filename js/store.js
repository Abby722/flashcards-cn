/* Decks, settings and review progress live in this browser's localStorage.
   Pictures and voice recordings are larger, so they live in IndexedDB (see media.js). */
(function () {
  const S = App.store = {};
  const KEY = { decks: 'zika.decks', settings: 'zika.settings', progress: 'zika.progress' };
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { App.util.toast('Could not save: this browser\'s storage is full.'); return false; } };

  /* ---------- settings ---------- */
  const DEFAULTS = { trans: 'both', voice: '', rate: 0.8, autoSpeak: true, kai: true, pinyin: 'tap' };
  S.settings = () => ({ ...DEFAULTS, ...read(KEY.settings, {}) });
  S.saveSettings = s => {
    s = { ...S.settings(), ...s };
    write(KEY.settings, s);
    document.body.classList.toggle('kai', !!s.kai);
    document.body.classList.remove('py-show', 'py-tap', 'py-hide');
    document.body.classList.add('py-' + (s.pinyin || 'tap'));
  };

  /* ---------- decks ---------- */
  S.decks = () => read(KEY.decks, []);
  S.deck = id => S.decks().find(d => d.id === id);
  S.saveDeck = function (deck) {
    deck.updated = Date.now();
    const all = S.decks(); const i = all.findIndex(d => d.id === deck.id);
    if (i >= 0) all[i] = deck; else all.unshift(deck);
    return write(KEY.decks, all);
  };
  S.deleteDeck = function (id) {
    const deck = S.deck(id);
    write(KEY.decks, S.decks().filter(d => d.id !== id));
    if (deck) App.media.removeMany(S.mediaIds(deck));
    const p = read(KEY.progress, {}); for (const k of Object.keys(p)) if (k.startsWith(id + ':')) delete p[k]; write(KEY.progress, p);
  };
  S.newDeck = name => ({ id: App.util.uid(), name: name || 'New deck', created: Date.now(), updated: Date.now(), cards: [], sentences: [] });
  S.mediaIds = deck => [...deck.cards.flatMap(c => [c.img, c.audio]), ...(deck.dialogues || []).flatMap(d => d.lines.map(l => l.audio))].filter(Boolean);

  /* ---------- review progress (Leitner boxes 1–5) ---------- */
  const GAP_DAYS = [0, 0, 1, 3, 7, 14];
  S.progress = () => read(KEY.progress, {});
  S.cardState = (deckId, cardId) => S.progress()[deckId + ':' + cardId] || { box: 1, due: 0 };
  S.mark = function (deckId, cardId, correct) {
    const p = S.progress(); const k = deckId + ':' + cardId; const st = p[k] || { box: 1, due: 0 };
    st.box = correct ? Math.min(5, st.box + 1) : 1;
    st.due = Date.now() + GAP_DAYS[st.box] * 864e5;
    st.seen = (st.seen || 0) + 1;
    p[k] = st; write(KEY.progress, p);
  };
  S.dueCards = function (deck) {
    const p = S.progress(); const now = Date.now();
    return deck.cards.filter(c => { const st = p[deck.id + ':' + c.id]; return !st || st.due <= now; });
  };

  S.ensureSample = function () {
    // decks made before dialogues existed: give the sample deck its sample dialogue once
    if (!localStorage.getItem('zika.sampleTalk')) {
      localStorage.setItem('zika.sampleTalk', '1');
      const d = S.deck('sample-animals');
      if (d && !(d.dialogues || []).length && App.SAMPLE_DIALOGUE) { d.dialogues = [JSON.parse(JSON.stringify(App.SAMPLE_DIALOGUE))]; S.saveDeck(d); }
    }
    if (localStorage.getItem('zika.seeded')) return;
    localStorage.setItem('zika.seeded', '1');
    if (!S.decks().length && App.SAMPLE_DECK) S.saveDeck(JSON.parse(JSON.stringify(App.SAMPLE_DECK)));
  };
})();
