/* Talk: dialogues between the animal characters, one line at a time.
   Text flows normally (no coloured frames); pinyin follows the show / tap / hide switch. */
(function () {
  const U = App.util, { h } = U;
  App.views = App.views || {};
  let keyHandler = null;

  App.views.talk = function (root, deck, params) {
    App.ui.modes(deck.id, 'talk');
    const dialogues = (deck.dialogues || []).filter(d => d.lines.length);
    if (!dialogues.length) return root.append(App.ui.emptyDeck(deck, 'No dialogues yet. Write one on the Edit page, for example:\nAndy: 你好！你喜欢猫吗？'));

    let d = dialogues.find(x => x.id === params.get('d')) || dialogues[0];
    const ensureWords = async () => {
      let changed = false;
      for (const x of dialogues) for (const l of x.lines) if (!l.words) { l.words = await App.lex.tokens(l.text, deck); changed = true; }
      if (changed) App.store.saveDeck(deck);
    };
    let i = 0, showAll = false, showMeaning = false;
    const charOf = line => line.who ? App.chars.get(line.who) : null;

    const picker = dialogues.length > 1 ? h('div.seg', { role: 'group', 'aria-label': 'Dialogue' }, dialogues.map(x => h('button', { type: 'button', 'aria-pressed': String(x === d), onclick: e => {
      d = x; i = 0; U.$$('button', e.target.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === e.target))); build(); play();
    } }, x.title || 'Dialogue'))) : h('h2', { style: { margin: 0 } }, d.title || '');

    const stage = h('div.stage');
    const counter = h('span.counter');
    const backBtn = h('button.btn', { onclick: () => go(-1), 'aria-label': 'Previous line' }, '← Back');
    const nextBtn = h('button.btn.primary', { onclick: () => go(1) }, 'Next →');
    const transcript = h('div.transcript');
    const allBtn = h('button.btn.quiet.small', { onclick: () => { showAll = !showAll; paintTranscript(); } });
    const meanBtn = h('button.btn.quiet.small', { onclick: () => { showMeaning = !showMeaning; paint(); } });

    let cast = [];
    function build() {
      const seen = new Map();
      d.lines.forEach(l => { const c = charOf(l); if (c && !seen.has(c.id)) seen.set(c.id, c); });
      cast = [...seen.values()];
      paint();
    }

    function lineText(line, cls = '') {
      const ch = charOf(line);
      return h('p.line-text' + cls, { lang: 'zh-CN' }, (line.words && line.words.length ? line.words : [{ w: line.text, py: '' }]).map(t =>
        t.py ? h('span.tok', { role: 'button', tabindex: '0', title: 'Listen', onclick: () => App.speech.voiceOf(t.w, ch), onkeydown: e => { if (e.key === 'Enter') App.speech.voiceOf(t.w, ch); } }, App.ui.py(t.py), h('span.hz', t.w))
          : h('span.tok.punct', h('span.py'), h('span.hz', t.w))));
    }

    function paint() {
      const line = d.lines[i]; const ch = charOf(line);
      counter.textContent = `${i + 1} / ${d.lines.length}`;
      backBtn.disabled = i === 0;
      nextBtn.textContent = i === d.lines.length - 1 ? 'The end' : 'Next →';
      meanBtn.textContent = showMeaning ? 'Hide meaning' : 'Show meaning';
      allBtn.textContent = showAll ? 'Hide the whole conversation' : 'Show the whole conversation';
      const meaning = App.ui.meaning(line);
      const bubble = h('div.bubble' + (ch ? '' : '.narration'),
        ch ? h('div.bubble-name', ch.name) : null,
        lineText(line),
        meaning ? (showMeaning ? h('p.bubble-meaning', meaning) : null) : null);
      const figures = h('div.cast', cast.map(c => h('button.figure' + (ch && c.id === ch.id ? '.speaking' : ''), { type: 'button', 'aria-label': c.name, onclick: () => { if (ch && c.id === ch.id) App.speech.line(line, ch); } },
        App.chars.figure(c), h('span.figure-name', c.name))));
      stage.replaceChildren(bubble, figures);
      // point the bubble's tail at the speaker
      requestAnimationFrame(() => {
        const sp = figures.querySelector('.speaking');
        if (sp) { const r = stage.getBoundingClientRect(), f = sp.getBoundingClientRect(); bubble.style.setProperty('--tail-x', Math.max(30, Math.min(r.width - 30, f.left - r.left + f.width / 2)) + 'px'); }
      });
      paintTranscript();
    }

    function paintTranscript() {
      allBtn.textContent = showAll ? 'Hide the whole conversation' : 'Show the whole conversation';
      if (!showAll) return transcript.replaceChildren();
      transcript.replaceChildren(...d.lines.map((l, k) => {
        const c = charOf(l);
        return h('div.t-row' + (k === i ? '.now' : '') + (k > i ? '.later' : ''), { onclick: () => { i = k; paint(); play(); } },
          c ? App.chars.avatar(c, 44) : h('div.avatar', { style: { width: '44px', height: '44px' } }),
          h('div', c ? h('div.t-name', c.name) : null, lineText(l, '.small'), showMeaning && App.ui.meaning(l) ? h('div.t-meaning', App.ui.meaning(l)) : null));
      }));
    }

    function play() { const l = d.lines[i]; App.speech.line(l, charOf(l)); }
    function go(step) {
      if (step > 0 && i === d.lines.length - 1) {
        stage.replaceChildren(h('div.the-end', App.ui.seal('完'), h('p', 'The end.'), h('button.btn.primary', { onclick: () => { i = 0; paint(); play(); } }, 'Start again')));
        return;
      }
      i = Math.max(0, Math.min(d.lines.length - 1, i + step));
      paint(); play();
    }

    keyHandler && document.removeEventListener('keydown', keyHandler);
    keyHandler = e => {
      if (!location.hash.includes('/talk') || e.target.matches('input, textarea, select') || document.querySelector('dialog[open]')) return;
      if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === ' ') { e.preventDefault(); play(); }
    };
    document.addEventListener('keydown', keyHandler);

    root.append(h('div.talk',
      h('div.study-bar', picker),
      stage,
      h('div.study-bar', backBtn, h('button.btn', { onclick: play, 'aria-label': 'Play this line again' }, '🔊 Replay'), counter, nextBtn),
      h('div.study-bar', meanBtn, allBtn),
      transcript,
      h('p.muted', { style: { fontSize: '.85rem', textAlign: 'center' } }, 'Tap a word to hear it. Keys: → next line, ← back, space replays.')));
    if (dialogues.some(x => x.lines.some(l => !l.words))) {
      stage.replaceChildren(h('p.muted', 'Getting the dialogue ready…'));
      ensureWords().then(() => { build(); play(); });
    } else { build(); setTimeout(play, 250); }
  };
})();
