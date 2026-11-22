/* Stroke order (笔顺), drawn in 米字格 boxes.
   Stroke data: Hanzi Writer data (Make Me a Hanzi, Arphic Public License), loaded per character
   from the jsDelivr CDN the first time it is needed, then kept on this device for offline use. */
(function () {
  const ST = App.strokes = {};
  const { h } = App.util;
  const NS = 'http://www.w3.org/2000/svg';
  const CDN = ch => `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(ch)}.json`;
  const mem = {};

  ST.load = async function (ch) {
    if (mem[ch]) return mem[ch];
    const key = 'stroke:' + ch;
    try { const b = await App.media.get(key); if (b) return (mem[ch] = JSON.parse(await b.text())); } catch {}
    const res = await fetch(CDN(ch));
    if (!res.ok) throw new Error('No stroke data for ' + ch);
    const txt = await res.text();
    App.media.put(new Blob([txt], { type: 'application/json' }), key).catch(() => {});
    return (mem[ch] = JSON.parse(txt));
  };

  /* An empty 米字格 (square with a dashed cross and dashed diagonals) as SVG, 1024 units. */
  function grid(svg) {
    const add = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
    add('rect', { x: 8, y: 8, width: 1008, height: 1008, fill: '#fff', stroke: '#C0392B', 'stroke-width': 16, 'stroke-opacity': .55 });
    const dash = { stroke: '#C0392B', 'stroke-opacity': .35, 'stroke-width': 8, 'stroke-dasharray': '36 28' };
    add('line', { x1: 512, y1: 8, x2: 512, y2: 1016, ...dash });
    add('line', { x1: 8, y1: 512, x2: 1016, y2: 512, ...dash });
    add('line', { x1: 8, y1: 8, x2: 1016, y2: 1016, ...dash });
    add('line', { x1: 1016, y1: 8, x2: 8, y2: 1016, ...dash });
    return add;
  }
  ST.mizige = function (size, cls = '') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1024 1024'); svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('class', 'mzg ' + cls); grid(svg);
    return svg;
  };

  /* One box per stroke: earlier strokes in ink, the new stroke in red, the rest as a pale outline. */
  ST.sequence = function (data, size = 40) {
    const wrap = h('div.stroke-seq');
    data.strokes.forEach((_, i) => {
      const svg = ST.mizige(size);
      const g = document.createElementNS(NS, 'g'); g.setAttribute('transform', 'translate(0, 900) scale(1, -1)');
      data.strokes.forEach((d, j) => {
        const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d);
        p.setAttribute('fill', j < i ? '#22303C' : j === i ? '#D7263D' : '#E4E7EA');
        g.append(p);
      });
      svg.append(g);
      svg.setAttribute('aria-label', `stroke ${i + 1}`);
      wrap.append(svg);
    });
    return wrap;
  };

  /* Big animated version in a sheet. */
  ST.animate = function (ch, meta) {
    App.ui.modal(close => {
      const box = h('div.anim-box');
      const svgBg = ST.mizige(280, 'anim-grid');
      const target = h('div.anim-target');
      box.append(svgBg, target);
      let writer = null;
      const play = () => writer && writer.animateCharacter();
      setTimeout(() => {
        writer = HanziWriter.create(target, ch, {
          width: 280, height: 280, padding: 14,
          strokeColor: '#22303C', radicalColor: '#22303C', outlineColor: '#E4E7EA', highlightColor: '#D7263D',
          strokeAnimationSpeed: 0.9, delayBetweenStrokes: 350, showCharacter: false, showOutline: true,
          charDataLoader: (c, onLoad, onErr) => ST.load(c).then(onLoad, onErr),
          onLoadCharDataError: () => { target.replaceChildren(h('p.muted', 'Stroke data could not load. Check the internet connection.')); },
        });
        play();
      }, 30);
      return [
        h('div.row', h('h2', { style: { margin: 0 } }, h('span.hz', ch)), meta ? h('span.muted', meta) : null),
        box,
        h('div.sheet-actions',
          h('button.btn.quiet', { onclick: () => App.speech.say(ch) }, '🔊 Hear it'),
          h('button.btn', { onclick: play }, '▶ Play again'),
          h('button.btn.primary', { onclick: close }, 'Close'))];
    });
  };
})();
