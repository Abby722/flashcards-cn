/* Characters for dialogues. They live in a library on this device, so every deck (class) can use them.
   Built-in: Andy the cat, Wangwang the dog, Peter the rabbit. The teacher can add, rename, re-picture
   or remove any of them. A character's voice is the computer voice with its own pitch and speed. */
(function () {
  const CH = App.chars = {};
  const KEY = 'zika.chars';
  CH.BUILTIN = [
    { id: 'andy', name: 'Andy', img: 'assets/characters/andy.png', pitch: 1.6, rate: 1.05, color: '#FFCDB8' },
    { id: 'wangwang', name: 'Wangwang', img: 'assets/characters/wangwang.png', pitch: 0.7, rate: 0.95, color: '#BFDDF9' },
    { id: 'peter', name: 'Peter', img: 'assets/characters/peter.png', pitch: 1.3, rate: 1.15, color: '#DCD3F7' },
  ];
  CH.list = () => {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch {}
    return JSON.parse(JSON.stringify(CH.BUILTIN));
  };
  CH.save = list => localStorage.setItem(KEY, JSON.stringify(list));
  CH.get = id => CH.list().find(c => c.id === id) || null;
  CH.byName = name => { const n = (name || '').trim().toLowerCase(); return CH.list().find(c => c.name.trim().toLowerCase() === n) || null; };
  CH.put = ch => { const l = CH.list(); const i = l.findIndex(c => c.id === ch.id); if (i >= 0) l[i] = ch; else l.push(ch); CH.save(l); };
  CH.remove = id => { const ch = CH.get(id); CH.save(CH.list().filter(c => c.id !== id)); if (ch && ch.img && !ch.img.startsWith('assets/')) App.media.remove(ch.img); };
  CH.isBuiltinImg = img => typeof img === 'string' && img.startsWith('assets/');
  CH.imgUrl = async ch => !ch || !ch.img ? null : CH.isBuiltinImg(ch.img) ? ch.img : App.media.url(ch.img);

  /* Round picture with a soft colour behind it; falls back to the first letter of the name. */
  CH.avatar = function (ch, size = 72) {
    const { h } = App.util;
    const el = h('div.avatar', { style: { width: size + 'px', height: size + 'px', background: (ch && ch.color) || '#E6ECDF' }, 'aria-hidden': 'true' });
    const letter = h('span', ((ch && ch.name) || '?').slice(0, 1).toUpperCase());
    el.append(letter);
    CH.imgUrl(ch).then(u => { if (u) el.replaceChildren(h('img', { src: u, alt: '' })); });
    return el;
  };
  /* Full-body picture for the stage. */
  CH.figure = function (ch) {
    const { h } = App.util;
    const el = h('div.figure-img');
    CH.imgUrl(ch).then(u => el.replaceChildren(u ? h('img', { src: u, alt: ch.name }) : CH.avatar(ch, 120)));
    return el;
  };

  /* Characters used by a deck's dialogues (for sharing). */
  CH.usedBy = deck => { const ids = new Set((deck.dialogues || []).flatMap(d => d.lines.map(l => l.who).filter(Boolean))); return CH.list().filter(c => ids.has(c.id)); };
  /* Merge characters arriving with a shared deck: keep a picture already on this device if none came along. */
  CH.merge = incoming => {
    const l = CH.list();
    for (const c of incoming || []) {
      const i = l.findIndex(o => o.id === c.id);
      if (i >= 0) l[i] = { ...l[i], ...c, img: c.img || l[i].img };
      else l.push(c);
    }
    CH.save(l);
  };
})();
