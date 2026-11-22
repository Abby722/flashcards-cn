/* Small helpers shared by every view. */
(function () {
  const U = App.util = {};

  /* Let views pass null/false for "nothing here" when filling elements. */
  for (const m of ['append', 'replaceChildren']) {
    const orig = Element.prototype[m];
    Element.prototype[m] = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter(k => k != null && k !== false)); };
  }

  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* h('div.card#x', {onclick}, children...) — tiny DOM builder */
  U.h = function (tag, attrs, ...kids) {
    const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv); }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = k => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return el;
  };

  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  U.sample = (a, n) => U.shuffle(a).slice(0, n);
  U.isHan = s => /[㐀-鿿豈-﫿]/.test(s);
  U.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.toast = function (msg, ms = 2600) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(U.toast._t); U.toast._t = setTimeout(() => t.classList.remove('show'), ms);
  };

  /* Pinyin tone helpers. A syllable's tone is read from its combining mark. */
  const MARKS = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
  const TONE_CHARS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
  U.splitTone = function (syl) {
    const d = syl.normalize('NFD'); let tone = 5, base = '';
    for (const ch of d) { if (MARKS[ch]) tone = MARKS[ch]; else base += ch; }
    return { base: base.normalize('NFC'), tone };
  };
  U.withTone = function (base, tone) {
    if (tone < 1 || tone > 4) return base;
    const low = base.toLowerCase(); let idx = -1;
    if (low.includes('a')) idx = low.indexOf('a');
    else if (low.includes('e')) idx = low.indexOf('e');
    else if (low.includes('ou')) idx = low.indexOf('o');
    else for (let i = low.length - 1; i >= 0; i--) if ('iouü'.includes(low[i])) { idx = i; break; }
    if (idx < 0) return base;
    const ch = low[idx]; let mk = TONE_CHARS[ch][tone - 1];
    if (base[idx] !== low[idx]) mk = mk.toUpperCase();
    return base.slice(0, idx) + mk + base.slice(idx + 1);
  };
  U.tonesOf = py => py.split(/\s+/).filter(Boolean).map(s => U.splitTone(s).tone);
  /* Plausible wrong pinyin: same syllables, other tones. Great distractors for tone practice. */
  U.toneVariants = function (py, n) {
    const syls = py.split(/\s+/).filter(Boolean).map(U.splitTone);
    const seen = new Set([py]); const out = [];
    for (let tries = 0; tries < 60 && out.length < n; tries++) {
      const v = syls.map(s => ({ ...s }));
      const k = Math.floor(Math.random() * v.length);
      if (v[k].tone === 5 && Math.random() < .5) continue;
      let t; do { t = 1 + Math.floor(Math.random() * 4); } while (t === v[k].tone);
      v[k].tone = t;
      if (v.length > 1 && Math.random() < .35) { const j = (k + 1) % v.length; v[j].tone = 1 + Math.floor(Math.random() * 4); }
      const s = v.map(x => U.withTone(x.base, x.tone)).join(' ');
      if (!seen.has(s)) { seen.add(s); out.push(s); }
    }
    return out;
  };

  U.debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  U.loadScript = (src) => new Promise((res, rej) => {
    if (U.loadScript.done[src]) return res();
    const s = document.createElement('script'); s.src = src;
    s.onload = () => { U.loadScript.done[src] = 1; res(); };
    s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.append(s);
  });
  U.loadScript.done = {};

  U.download = (filename, text) => {
    const a = U.h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: filename });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
