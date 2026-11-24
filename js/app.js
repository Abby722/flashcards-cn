/* Router and settings. Routes: #/  #/deck/<id>/<cards|wall|build|quiz|edit>  #/import/<code> */
(function () {
  const U = App.util, { h } = U;
  const view = document.getElementById('view');

  async function route() {
    App.speech.stop();
    App.speech.cancelRecording();
    const [path, query] = location.hash.replace(/^#/, '').split('?');
    const params = new URLSearchParams(query || '');
    const parts = path.split('/').filter(Boolean);
    view.replaceChildren();
    window.scrollTo(0, 0);

    if (parts[0] === 'import' && parts[1]) {
      try {
        const r = await App.share.importCode(parts[1]);
        U.toast(r.updated ? 'Deck updated with the latest words.' : 'Deck added. Have fun practising!');
        location.replace(`#/deck/${r.id}/cards`);
      } catch (e) { view.append(h('div.empty', h('p', e.message), h('a.btn', { href: '#/' }, 'Go to your decks'))); }
      return;
    }
    if (parts[0] === 'class' && parts[1]) {
      view.append(h('div.empty', h('p', 'Getting the deck with its recordings…')));
      try {
        const r = await App.share.importClass(decodeURIComponent(parts[1]));
        U.toast(r.updated ? 'Deck updated.' : 'Deck added. Have fun practising!');
        location.replace(`#/deck/${r.id}/cards`);
      } catch (e) { view.replaceChildren(h('div.empty', h('p', e.message), h('a.btn', { href: '#/' }, 'Go to your decks'))); }
      return;
    }
    if (parts[0] === 'chars') { document.title = '字表 Characters · 字卡 Zìkǎ'; App.views.chars(view, params); return; }
    if (parts[0] === 'deck') {
      const deck = App.store.deck(parts[1]);
      if (!deck) { App.ui.modes(null); view.append(h('div.empty', h('p', 'This deck is not on this device.'), h('a.btn', { href: '#/' }, 'Go to your decks'))); return; }
      const mode = App.views[parts[2]] ? parts[2] : 'cards';
      document.title = `${deck.name} · 字卡 Zìkǎ`;
      App.views[mode](view, deck, params);
      return;
    }
    document.title = '字卡 Zìkǎ · Chinese flashcards';
    App.views.home(view);
  }

  /* ---------- settings sheet ---------- */
  const dlg = document.getElementById('settings-dialog');
  const form = document.getElementById('settings-form');
  const voiceSel = document.getElementById('voice-select');
  function fillVoices() {
    const s = App.store.settings();
    const vs = App.speech.voices();
    voiceSel.replaceChildren(h('option', { value: '' }, vs.length ? 'Best available' : 'No Chinese voice on this device'),
      ...vs.map(v => h('option', { value: v.name, selected: v.name === s.voice }, `${v.name} (${v.lang})`)));
    document.getElementById('voice-status').textContent = vs.length ? `${vs.length} Chinese voice${vs.length > 1 ? 's' : ''} found` : 'No Chinese voice found';
  }
  App.speech.onvoices = fillVoices;
  document.getElementById('btn-test-sound').onclick = () => App.speech.say('你好，我是你的中文老师。', 1, true);
  document.getElementById('btn-settings').onclick = () => {
    const s = App.store.settings();
    form.trans.value = s.trans; form.rate.value = s.rate; form.autoSpeak.checked = s.autoSpeak; form.kai.checked = s.kai;
    document.getElementById('rate-out').textContent = s.rate + '×';
    fillVoices();
    dlg.showModal();
  };
  form.addEventListener('input', e => {
    const s = { trans: form.trans.value, voice: voiceSel.value, rate: +form.rate.value, autoSpeak: form.autoSpeak.checked, kai: form.kai.checked };
    document.getElementById('rate-out').textContent = s.rate + '×';
    App.store.saveSettings(s);
    if (e.target.name === 'voice' || e.target.name === 'rate') App.speech.say('你好');
  });
  dlg.addEventListener('close', () => route());

  /* ---------- pinyin switch: show / tap to reveal / hide ---------- */
  const pySwitch = document.getElementById('py-switch');
  const paintPy = () => { const m = App.store.settings().pinyin; U.$$('button', pySwitch).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.py === m))); };
  pySwitch.addEventListener('click', e => {
    const b = e.target.closest('button[data-py]'); if (!b) return;
    App.store.saveSettings({ pinyin: b.dataset.py });
    U.$$('.pyx.rev').forEach(x => x.classList.remove('rev'));
    paintPy();
  });
  paintPy();
  /* In "tap" mode, tapping hidden pinyin reveals it and does nothing else (no card flip, no tile move). */
  document.addEventListener('click', e => {
    if (!document.body.classList.contains('py-tap')) return;
    const p = e.target.closest && e.target.closest('.pyx:not(.rev)');
    if (!p) return;
    e.preventDefault(); e.stopPropagation();
    p.classList.add('rev');
  }, true);

  /* ---------- colours and positions (slots) ---------- */
  document.getElementById('btn-colours').onclick = () => { dlg.close(); slotEditor(); };
  function slotEditor() {
    let list = JSON.parse(JSON.stringify(App.slots.list()));
    const commit = () => { App.slots.save(list); paint(); };
    const box = h('div.slot-editor');
    const PRESETS = ['#BFDDF9', '#FFCDB8', '#BDEBD9', '#DCD3F7', '#FDE7A3', '#F9C6DD', '#C9EEF5', '#E3E8C2', '#F2D3BE'];
    function paint() {
      box.replaceChildren(...list.map((sl, i) => {
        const row = App.slots.vars(h('div.slot-row'), sl);
        const set = (k, v) => { sl[k] = v; commit(); };
        row.append(
          h('div.slot-preview', h('span.slot-mark', sl.mark || ''), h('span.hz', '猫')),
          h('div.slot-fields',
            h('div.row',
              h('input', { type: 'text', value: sl.name, 'aria-label': 'Name', placeholder: 'who', onchange: e => set('name', e.target.value.trim() || sl.name) }),
              h('input', { type: 'text', value: sl.zh || '', 'aria-label': 'Chinese name', placeholder: '谁', className: 'hz', style: { maxWidth: '7em' }, onchange: e => set('zh', e.target.value.trim()) }),
              h('input', { type: 'text', value: sl.mark || '', 'aria-label': 'Symbol', title: 'Small symbol in the corner (helps colour-blind students)', maxLength: 2, style: { maxWidth: '3.2em', textAlign: 'center' }, onchange: e => set('mark', e.target.value.trim()) })),
            h('div.row.presets',
              h('input', { type: 'color', value: sl.color, 'aria-label': 'Colour', oninput: e => { sl.color = e.target.value.toUpperCase(); App.slots.vars(row, sl); }, onchange: commit }),
              PRESETS.map(c => h('button.preset', { type: 'button', style: { background: c }, 'aria-label': 'Use colour ' + c, onclick: () => set('color', c) }))),
            h('div.row.pos-checks', h('span.muted', 'Words on their own:'),
              App.POS.filter(p => p.key !== 'other').map(p => h('label.check', h('input', { type: 'checkbox', checked: (sl.pos || []).includes(p.key), onchange: e => {
                list.forEach(o => o.pos = (o.pos || []).filter(k => k !== p.key));
                if (e.target.checked) sl.pos.push(p.key);
                commit();
              } }), p.en)))),
          h('button.btn.small.quiet', { 'aria-label': 'Remove ' + sl.name, title: 'Remove this colour', onclick: () => { list.splice(i, 1); commit(); } }, '✕'));
        return row;
      }));
    }
    paint();
    App.ui.modal(close => [
      h('h2', 'Colours and positions'),
      h('p.muted', 'Each colour is a position in the sentence. Words with the same colour can replace each other. “Words on their own” decides the colour a word gets on its flashcard and its first guess in a new sentence.'),
      box,
      h('div.row',
        h('button.btn.small', { onclick: () => { list.push({ id: U.uid(), name: 'new', zh: '', color: PRESETS[list.length % PRESETS.length], mark: '♥', pos: [] }); commit(); } }, '+ Add a colour'),
        h('button.btn.small.quiet', { onclick: async () => { if (await App.ui.confirm('Go back to the original five colours?', 'Reset')) { App.slots.reset(); list = JSON.parse(JSON.stringify(App.slots.DEFAULTS)); paint(); route(); slotEditor(); } } }, 'Reset to the original five')),
      h('div.sheet-actions', h('button.btn.primary', { onclick: () => { close(); route(); } }, 'Done'))]);
  }

  document.getElementById('btn-fullscreen').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  };

  App.store.saveSettings(App.store.settings());
  App.store.ensureSample();
  window.addEventListener('hashchange', route);
  route();
  // class decks: fetch newer versions the teacher published; redraw only the home page
  App.share.refreshClassDecks().then(changed => { if (changed && !/^#\/(deck|class|import)\//.test(location.hash)) route(); });
})();
