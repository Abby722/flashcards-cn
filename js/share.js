/* Sharing a deck with a student's family:
   - a link (words, colours, emoji and sentences; no recordings or photos), or
   - a deck file (.json) that carries everything, recordings and photos included. */
(function () {
  const Sh = App.share = {};
  const U = App.util;

  /* For the link: no recordings, photos or boards (too big for a link). Words of dialogue lines are rebuilt on the other device. */
  const stripDeck = deck => ({
    ...deck,
    cards: deck.cards.map(c => ({ ...c, img: null, audio: null })),
    dialogues: (deck.dialogues || []).map(d => ({ ...d, lines: d.lines.map(l => ({ ...l, audio: null, words: null })) })),
    boards: [],
    _chars: App.chars.usedBy(deck).map(c => ({ ...c, img: App.chars.isBuiltinImg(c.img) ? c.img : null })),
    _slots: App.slots.list(),
  });

  Sh.link = function (deck) {
    const code = LZString.compressToEncodedURIComponent(JSON.stringify(stripDeck(deck)));
    return location.href.split('#')[0] + '#/import/' + code;
  };
  Sh.linkHasLostMedia = deck => deck.cards.some(c => c.img || c.audio) || App.chars.usedBy(deck).some(c => c.img && !App.chars.isBuiltinImg(c.img)) || (deck.dialogues || []).some(d => d.lines.some(l => l.audio));

  Sh.fileText = async function (deck) {
    const media = {};
    const chars = App.chars.usedBy(deck);
    for (const id of [...App.store.mediaIds(deck), ...chars.map(c => c.img).filter(i => i && !App.chars.isBuiltinImg(i))]) {
      const b = await App.media.get(id).catch(() => null);
      if (b) media[id] = await App.media.toDataURL(b);
    }
    return JSON.stringify({ format: 'zika-deck', version: 2, deck, media, chars, slots: App.slots.list() });
  };
  Sh.downloadFile = async function (deck) {
    const text = await Sh.fileText(deck);
    U.download(deck.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') + '.zika.json', text);
  };

  /* Returns the imported deck id. If the same deck is already here, it is updated in place. */
  Sh.importDeck = async function (deck, media = {}, chars = null, slots = null) {
    if (!deck || !Array.isArray(deck.cards)) throw new Error('This is not a Zìkǎ deck.');
    deck.sentences = deck.sentences || [];
    chars = chars || deck._chars; slots = slots || deck._slots;
    delete deck._chars; delete deck._slots;
    if (Array.isArray(slots) && slots.length) App.slots.save(slots);
    const existing = App.store.deck(deck.id);
    if (existing) {
      // keep recordings/photos already on this device when the incoming deck has none
      for (const c of deck.cards) {
        const old = existing.cards.find(o => o.id === c.id);
        if (old) { if (!c.audio && old.audio) c.audio = old.audio; if (!c.img && old.img) c.img = old.img; }
      }
      // keep line recordings and boards already on this device
      for (const d of deck.dialogues || []) {
        const od = (existing.dialogues || []).find(o => o.id === d.id);
        if (od) for (const l of d.lines) { const ol = od.lines.find(o => o.id === l.id); if (ol && !l.audio && ol.audio) l.audio = ol.audio; }
      }
      if (!(deck.boards || []).length && (existing.boards || []).length) deck.boards = existing.boards;
      if (!deck.source && existing.source) deck.source = existing.source; // stay a class deck
    }
    for (const [id, dataUrl] of Object.entries(media)) await App.media.put(await App.media.fromDataURL(dataUrl), id);
    if (Array.isArray(chars)) App.chars.merge(chars);
    App.store.saveDeck(deck);
    return { id: deck.id, updated: !!existing };
  };
  Sh.importCode = function (code) {
    // Some apps (e.g. WhatsApp on iPhone) percent-encode characters of the link, such as + → %2B.
    try { code = decodeURIComponent(code); } catch {}
    const json = LZString.decompressFromEncodedURIComponent(code);
    if (!json) throw new Error(`This link is incomplete (${code.length} characters arrived). Ask for the link again, or for the deck file.`);
    return Sh.importDeck(JSON.parse(json));
  };
  /* ---------- class decks: published with the app in class/ (see tools/publish-deck.js) ---------- */
  const fetchJSON = async url => { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return r.json(); };
  Sh.classIndex = () => fetchJSON('class/index.json').catch(() => []);
  Sh.classLink = slug => location.href.split('#')[0] + '#/class/' + slug;

  /* Adds or updates a class deck with its recordings and pictures. Review progress is kept. */
  Sh.importClass = async function (slug) {
    let data;
    try { data = await fetchJSON(`class/${encodeURIComponent(slug)}/deck.json`); }
    catch { throw new Error(navigator.onLine === false ? 'You are offline. Connect to the internet and open the link again.' : 'This class deck was not found. Ask for the link again.'); }
    const have = new Set();
    for (const id of Object.keys(data.media || {})) if (await App.media.get(id).catch(() => null)) have.add(id);
    // recordings and pictures never change under the same id, so only new ones are downloaded
    await Promise.all(Object.entries(data.media || {}).filter(([id]) => !have.has(id)).map(async ([id, m]) => {
      const r = await fetch(`class/${encodeURIComponent(slug)}/${m.file}`);
      if (!r.ok) return;
      await App.media.put(new Blob([await r.arrayBuffer()], { type: m.type }), id);
    }));
    data.deck.source = { class: slug, published: data.published };
    return Sh.importDeck(data.deck, {}, data.chars, data.slots);
  };

  /* Once per visit: bring class decks on this device up to date. Returns true if any changed. */
  Sh.refreshClassDecks = async function () {
    const mine = App.store.decks().filter(d => d.source && d.source.class);
    if (!mine.length) return false;
    const index = await Sh.classIndex();
    let changed = false;
    for (const d of mine) {
      const e = index.find(x => x.slug === d.source.class);
      if (e && e.published > (d.source.published || 0)) { try { await Sh.importClass(e.slug); changed = true; } catch {} }
    }
    return changed;
  };

  Sh.importFile = async function (file) {
    const data = JSON.parse(await file.text());
    if (data.format === 'zika-deck') return Sh.importDeck(data.deck, data.media, data.chars, data.slots);
    return Sh.importDeck(data);
  };
})();
