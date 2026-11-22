/* Quiz: mixed questions made from the deck. Words due for review are asked first. */
(function () {
  const U = App.util, { h } = U;
  App.views = App.views || {};

  const TYPES = [
    ['py', 'Pick the pinyin', 'See 汉字, choose the right pinyin and tones'],
    ['listen', 'Listen', 'Hear a word, choose the 汉字'],
    ['pic', 'Picture', 'See the picture, choose the 汉字'],
    ['meaning', 'Meaning', 'See 汉字, choose what it means'],
    ['order', 'Word order', 'Put a sentence in order'],
  ];

  App.views.quiz = function (root, deck) {
    App.ui.modes(deck.id, 'quiz');
    if (deck.cards.length < 2 && !deck.sentences.length) return root.append(App.ui.emptyDeck(deck, 'A quiz needs at least two words or one sentence.'));
    setup(root, deck);
  };

  function setup(root, deck) {
    const saved = JSON.parse(localStorage.getItem('zika.quiz') || 'null') || { n: 10, types: ['py', 'listen', 'pic', 'meaning', 'order'] };
    const can = {
      py: deck.cards.length >= 2, listen: deck.cards.length >= 2, meaning: deck.cards.filter(c => c.en || c.de).length >= 2,
      pic: deck.cards.filter(App.ui.hasPicture).length >= 1 && deck.cards.length >= 2, order: deck.sentences.length > 0,
    };
    let n = saved.n;
    const boxes = TYPES.map(([k, label, desc]) => h('label.check', h('input', { type: 'checkbox', value: k, checked: can[k] && saved.types.includes(k), disabled: !can[k] }), h('span', h('strong', label), h('br'), h('span.muted', can[k] ? desc : 'Needs ' + (k === 'order' ? 'sentences in the deck' : k === 'pic' ? 'pictures on the cards' : 'more words')))));
    const start = () => {
      const types = boxes.map(b => b.querySelector('input')).filter(i => i.checked).map(i => i.value);
      if (!types.length) return U.toast('Choose at least one kind of question.');
      localStorage.setItem('zika.quiz', JSON.stringify({ n, types }));
      run(root, deck, makeQuestions(deck, n, types));
    };
    root.replaceChildren(h('div.quiz', h('div.setup',
      h('h2', 'Quiz: ' + deck.name),
      h('fieldset', h('legend', 'Questions'), h('div.seg', { role: 'group' }, [5, 10, 20].map(v => h('button', { type: 'button', 'aria-pressed': String(v === n), onclick: e => { n = v; U.$$('button', e.target.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === e.target))); } }, String(v))))),
      h('fieldset', h('legend', 'Kinds of question'), boxes),
      h('div.row', h('button.btn.primary', { onclick: start }, 'Start quiz')))));
  }

  function makeQuestions(deck, n, types) {
    const due = new Set(App.store.dueCards(deck).map(c => c.id));
    const cards = U.shuffle(deck.cards).sort((a, b) => due.has(b.id) - due.has(a.id));
    const wordTypes = types.filter(t => t !== 'order');
    const nOrder = types.includes('order') ? (wordTypes.length ? Math.min(deck.sentences.length, Math.max(1, Math.round(n / 4))) : Math.min(n, deck.sentences.length)) : 0;
    const qs = U.sample(deck.sentences, nOrder).map(s => ({ type: 'order', s }));
    let k = 0;
    while (qs.length < n && wordTypes.length && cards.length >= 2) {
      const c = cards[k++ % cards.length];
      const ok = wordTypes.filter(t => (t !== 'pic' || App.ui.hasPicture(c)) && (t !== 'meaning' || c.en || c.de));
      if (!ok.length) { if (k > cards.length * 3) break; continue; }
      qs.push({ type: ok[Math.floor(Math.random() * ok.length)], c });
      if (k > n * 4) break;
    }
    return U.shuffle(qs);
  }

  const others = (deck, c) => U.shuffle(deck.cards.filter(x => x.id !== c.id && x.hz !== c.hz));
  function options(deck, q) {
    const c = q.c; let opts;
    if (q.type === 'py') {
      const set = new Set([c.py]);
      U.toneVariants(c.py, 2).forEach(v => set.add(v));
      for (const o of others(deck, c)) { if (set.size >= 4) break; set.add(o.py); }
      U.toneVariants(c.py, 4).forEach(v => set.size < 4 && set.add(v));
      opts = [...set].slice(0, 4).map(p => ({ label: h('span.py', p), right: p === c.py }));
    } else if (q.type === 'meaning') {
      const m = App.ui.meaning(c); const set = new Set([m]);
      for (const o of others(deck, c)) { if (set.size >= 4) break; const om = App.ui.meaning(o); if (om) set.add(om); }
      opts = [...set].map(x => ({ label: x, right: x === m }));
    } else {
      const pick = [c, ...others(deck, c).slice(0, 3)];
      opts = pick.map(x => ({ label: h('span.hz', { lang: 'zh-CN' }, x.hz), right: x.id === c.id }));
    }
    return U.shuffle(opts);
  }

  function run(root, deck, qs) {
    let i = 0; const results = [];
    const bar = h('i'); const progress = h('div.qprogress', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': qs.length }, bar);
    const box = h('div.quiz');
    root.replaceChildren(box);

    function next() {
      if (i >= qs.length) return finish();
      const q = qs[i];
      bar.style.width = (i / qs.length * 100) + '%'; progress.setAttribute('aria-valuenow', i);
      const feedback = h('div.qfeedback', { role: 'status' });
      const nextBtn = h('button.btn.primary', { hidden: true, onclick: () => { i++; next(); } }, i === qs.length - 1 ? 'See results' : 'Next');
      const record = ok => { results.push({ q, ok }); if (q.c) App.store.mark(deck.id, q.c.id, ok); };

      if (q.type === 'order') {
        const meaning = App.ui.meaning(q.s);
        box.replaceChildren(progress, h('div.qcard', { style: { width: 'min(900px, 100%)' } },
          h('div.qask', meaning ? 'Make this sentence: ' + meaning : 'Put the words in order'),
          App.ui.sentenceBuilder(q.s, deck, { mode: 'check', onSolved: first => { record(first); nextBtn.hidden = false; nextBtn.focus(); } }),
          nextBtn));
        return;
      }

      const c = q.c;
      let ask, stim;
      if (q.type === 'py') { ask = 'Which pinyin is right?'; stim = h('div.qstim', h('div.hz', { lang: 'zh-CN' }, c.hz)); }
      else if (q.type === 'meaning') { ask = 'What does it mean?'; stim = h('div.qstim', h('div.hz', { lang: 'zh-CN' }, c.hz)); }
      else if (q.type === 'pic') { ask = 'Which word is this?'; stim = h('div.qstim', App.ui.picture(c)); }
      else { ask = 'Which word do you hear?'; stim = h('div.qstim', h('button.listen-btn', { type: 'button', 'aria-label': 'Play the word again', onclick: () => App.speech.card(c) }, '🔊')); setTimeout(() => App.speech.card(c), 300); }

      const opts = options(deck, q);
      const btns = opts.map(o => h('button.opt', { type: 'button' }, o.label));
      btns.forEach((b, k) => b.onclick = () => {
        const ok = opts[k].right;
        btns.forEach((x, j) => { x.disabled = true; if (opts[j].right) x.classList.add('right'); });
        if (!ok) b.classList.add('picked-wrong');
        record(ok);
        feedback.className = 'qfeedback ' + (ok ? 'good' : 'bad');
        feedback.replaceChildren(ok ? '对！Right.' : 'Not quite. The answer is ', ok ? '' : h('span', h('span.hz', c.hz), ' ', h('span.py', c.py)));
        if (q.type !== 'listen') App.speech.card(c);
        if (ok) setTimeout(() => { if (results.length === i + 1 && qs[i] === q) { i++; next(); } }, 1300);
        else { nextBtn.hidden = false; nextBtn.focus(); }
      });
      box.replaceChildren(progress, h('div.qcard', h('div.qask', ask), stim, h('div.options', btns), feedback, nextBtn));
    }

    function finish() {
      bar.style.width = '100%';
      const right = results.filter(r => r.ok).length;
      const missed = [...new Map(results.filter(r => !r.ok && r.q.c).map(r => [r.q.c.id, r.q.c])).values()];
      const pct = results.length ? right / results.length : 0;
      box.replaceChildren(progress, h('div.qcard.result',
        pct >= .8 ? App.ui.seal('真棒') : pct >= .5 ? App.ui.seal('不错') : App.ui.seal('加油'),
        h('div.score', `${right} / ${results.length}`),
        missed.length ? [h('p', 'Words to practise:'), h('div.missed', missed.map(c => App.ui.posVars(h('span', h('span.hz', c.hz), ' ', h('span.py', c.py)), c.pos)))] : h('p', 'Every word right.'),
        h('div.row', { style: { justifyContent: 'center' } },
          missed.length ? h('a.btn.primary', { href: `#/deck/${deck.id}/cards?ids=${missed.map(c => c.id).join(',')}` }, 'Practise these cards') : null,
          h('button.btn', { onclick: () => run(root, deck, U.shuffle(qs)) }, 'Same quiz again'),
          h('button.btn.quiet', { onclick: () => setup(root, deck) }, 'New quiz'))));
    }
    next();
  }
})();
