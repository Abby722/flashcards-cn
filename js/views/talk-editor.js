/* Edit page, "Talk" part: the character library and this deck's dialogues.
   A dialogue is written like a play, one line each:  Andy: 你好！ | Hello! | Hallo!  */
(function () {
  const U = App.util, { h } = U;

  /* ---------- character sheet (new or edit) ---------- */
  App.ui.characterSheet = function (ch, done) {
    const isNew = !ch;
    const c = ch ? { ...ch } : { id: U.uid(), name: '', img: null, pitch: 1.2, rate: 1, color: '#FDE7A3' };
    let newBlob = null;
    App.ui.modal(close => {
      const pic = h('div.char-pic');
      const paintPic = () => {
        if (newBlob) pic.replaceChildren(h('img', { src: URL.createObjectURL(newBlob), alt: '' }));
        else pic.replaceChildren(App.chars.figure(c));
      };
      paintPic();
      const removeWhite = h('input', { type: 'checkbox', checked: true });
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try { newBlob = await App.media.cutoutFromFile(f, removeWhite.checked); paintPic(); } catch (err) { U.toast(err.message); }
        e.target.value = '';
      } });
      const name = h('input', { type: 'text', value: c.name, placeholder: 'Andy', 'aria-label': 'Name' });
      const pitch = h('input', { type: 'range', min: '0.3', max: '2', step: '0.05', value: c.pitch });
      const rate = h('input', { type: 'range', min: '0.6', max: '1.5', step: '0.05', value: c.rate });
      const colour = h('input', { type: 'color', value: c.color || '#FDE7A3' });
      const test = () => App.speech.say('你好！我们一起学中文吧。', +rate.value, true, +pitch.value);
      const save = async () => {
        c.name = name.value.trim(); if (!c.name) { U.toast('Give the character a name.'); name.focus(); return; }
        const other = App.chars.byName(c.name); if (other && other.id !== c.id) { U.toast('Another character already has this name.'); return; }
        c.pitch = +pitch.value; c.rate = +rate.value; c.color = colour.value;
        if (newBlob) { if (c.img && !App.chars.isBuiltinImg(c.img)) await App.media.remove(c.img); c.img = await App.media.put(newBlob); }
        App.chars.put(c); close(); done && done(c);
      };
      setTimeout(() => (isNew ? name : null)?.focus(), 40);
      return [
        h('h2', isNew ? 'New character' : c.name),
        h('div.char-sheet',
          h('div', pic,
            h('div.row', { style: { marginTop: '8px' } }, h('button.btn.small', { onclick: () => file.click() }, 'Upload a picture'), file),
            h('label.check', { style: { fontSize: '.85rem' } }, removeWhite, 'Remove white background')),
          h('div', { style: { display: 'grid', gap: '12px' } },
            h('label.field', 'Name', name),
            h('label.field', 'Voice: low ↔ high', pitch),
            h('label.field', 'Voice: slow ↔ fast', rate),
            h('label.field', 'Colour behind the picture', colour),
            h('div.row', h('button.btn.small', { onclick: test }, '🔊 Hear the voice')))),
        h('div.sheet-actions',
          !isNew ? h('button.btn.quiet.danger', { onclick: async () => {
            if (await App.ui.confirm(`Remove ${c.name} from your characters? Dialogue lines with ${c.name} will show without a picture.`, 'Remove')) { App.chars.remove(c.id); done && done(null); }
          } }, 'Remove') : null,
          h('span.spacer'),
          h('button.btn.quiet', { onclick: close }, 'Cancel'),
          h('button.btn.primary', { onclick: save }, isNew ? 'Add character' : 'Save'))];
    });
  };

  /* ---------- parsing a dialogue script ---------- */
  async function parseScript(script, deck, oldLines) {
    const lines = [];
    let last = null;
    for (const raw of script.split('\n')) {
      const t = raw.trim(); if (!t) continue;
      const m = t.match(/^([^:：|]{1,30})[:：]\s*(.*)$/);
      let name = m ? m[1].trim() : '', rest = m ? m[2] : t;
      if (!m && last) name = last; // a line without a name continues the previous speaker
      const [zh, en, de] = rest.split('|').map(x => (x || '').trim());
      if (!zh) continue;
      const ch = name ? App.chars.byName(name) : null;
      const old = oldLines.find(o => o.text === zh && o.name === name);
      lines.push({ id: old ? old.id : U.uid(), name, who: ch ? ch.id : null, text: zh, en: en || '', de: de || '', audio: old ? old.audio || null : null, words: await App.lex.tokens(zh, deck) });
      last = name;
    }
    // recordings of lines that were deleted
    for (const o of oldLines) if (o.audio && !lines.some(l => l.audio === o.audio)) App.media.remove(o.audio);
    return lines;
  }

  /* ---------- the section on the Edit page ---------- */
  App.ui.talkSection = function (deck, save) {
    deck.dialogues = deck.dialogues || [];
    const charsBox = h('div.char-strip');
    const list = h('div.dialogues');

    function paintChars() {
      charsBox.replaceChildren(...App.chars.list().map(c => h('button.char-card', { type: 'button', title: 'Edit ' + c.name, onclick: () => App.ui.characterSheet(c, () => { paintChars(); paintDialogues(); }) },
        App.chars.avatar(c, 64), h('span', c.name))),
        h('button.char-card.add', { type: 'button', onclick: () => App.ui.characterSheet(null, () => { paintChars(); paintDialogues(); }) }, h('span.avatar', { style: { width: '64px', height: '64px' } }, '+'), h('span', 'New character')));
    }

    function dialogueBox(d) {
      const status = h('div.muted', { role: 'status' });
      const rows = h('div.d-lines');
      const title = h('input', { type: 'text', value: d.title || '', placeholder: 'At the park', 'aria-label': 'Dialogue title', oninput: e => { d.title = e.target.value; save(); } });
      const script = h('textarea.script', { lang: 'zh-CN', value: d.script || '', placeholder: 'Andy: 你好！你喜欢狗吗？ | Hi! Do you like dogs? | Hallo! Magst du Hunde?\nWangwang: 我很喜欢！ | I really do! | Sehr!' });
      const reparse = U.debounce(async () => {
        d.script = script.value;
        status.textContent = 'Reading the lines…';
        d.lines = await parseScript(d.script, deck, d.lines || []);
        save(); paintRows();
      }, 700);
      script.addEventListener('input', reparse);

      function paintRows() {
        const unknown = [...new Set(d.lines.filter(l => l.name && !l.who).map(l => l.name))];
        status.replaceChildren(
          d.lines.length ? `${d.lines.length} line${d.lines.length > 1 ? 's' : ''}.` : 'Write one line per row: name, colon, the Chinese. English and German after | are optional.',
          ...unknown.map(n => h('button.btn.small', { style: { marginLeft: '8px' }, onclick: () => App.ui.characterSheet({ id: U.uid(), name: n, img: null, pitch: 1.2, rate: 1, color: '#FDE7A3' }, async () => { paintChars(); d.lines = await parseScript(d.script, deck, d.lines); save(); paintRows(); }) }, `+ Make “${n}” a character`)));
        rows.replaceChildren(...d.lines.map(l => {
          const c = l.who ? App.chars.get(l.who) : null;
          const tools = h('div.w-tools');
          const paintTools = () => tools.replaceChildren(
            h('button.btn.small.quiet', { title: 'Listen', 'aria-label': 'Listen', onclick: () => App.speech.line(l, c) }, '🔊'),
            recordLine(l, () => { save(); paintTools(); }),
            l.audio ? h('button.btn.small.quiet', { title: 'Remove my recording (use the character voice)', 'aria-label': 'Remove recording', onclick: () => { App.media.remove(l.audio); l.audio = null; save(); paintTools(); } }, '↺') : null);
          paintTools();
          return h('div.d-line', c ? App.chars.avatar(c, 40) : h('div.avatar', { style: { width: '40px', height: '40px' } }, '?'),
            h('div', h('div.t-name', l.name || 'Narrator'), h('div.hz', { style: { fontSize: '1.2rem' } }, l.text), (l.en || l.de) ? h('div.muted', { style: { fontSize: '.85rem' } }, [l.en, l.de].filter(Boolean).join(' / ')) : null),
            tools);
        }));
      }
      paintRows();
      return h('div.d-box',
        h('div.row', title,
          h('button.btn.small', { onclick: () => recordingSession(d, deck, save, paintRows), disabled: !d.lines.length, title: 'Record the lines one after another' }, '🎙 Recording session'),
          h('a.btn.small', { href: `#/deck/${deck.id}/talk?d=${d.id}` }, 'Play'),
          h('button.btn.small.quiet.danger', { onclick: async () => {
            if (await App.ui.confirm(`Delete the dialogue “${d.title || 'Untitled'}”?`)) { (d.lines || []).forEach(l => l.audio && App.media.remove(l.audio)); deck.dialogues = deck.dialogues.filter(x => x !== d); save(); paintDialogues(); }
          } }, 'Delete')),
        script, status, rows);
    }

    function paintDialogues() { list.replaceChildren(...deck.dialogues.map(dialogueBox)); }

    paintChars(); paintDialogues();
    return h('section.ed-section',
      h('h2', 'Talk'),
      h('p', 'Your characters are shared by all decks. Tap one to change its picture, name or voice.'),
      charsBox,
      h('p', { style: { marginTop: '6px' } }, 'Dialogues for this deck. Write one line per row, like a play:', h('br'), h('code.hz', 'Andy: 你好！你喜欢狗吗？ | Hi! Do you like dogs? | Hallo! Magst du Hunde?')),
      list,
      h('div.row', h('button.btn.primary', { onclick: () => { const d = { id: U.uid(), title: 'Dialogue ' + (deck.dialogues.length + 1), script: '', lines: [] }; deck.dialogues.push(d); save(); paintDialogues(); U.$$('.d-box textarea', list).pop()?.focus(); } }, '+ New dialogue')));
  };

  /* ---------- recording session ----------
     Choose a character (or everyone), then go through the lines without a recording:
     space starts, space stops and moves on. ← goes back to redo a line, → skips one. */
  function recordingSession(d, deck, save, repaint) {
    if (!App.speech.canRecord()) { U.toast('Recording needs a browser with microphone support, on an https page.'); return; }
    const castIds = [...new Set(d.lines.map(l => l.who || '§' + (l.name || '')))];
    let who = 'all', onlyMissing = true, queue = [], k = 0, mic = null, recording = false, last = null, stage = 'setup';
    const body = h('div.rec-session');
    const charName = l => (l.who && App.chars.get(l.who) || { name: l.name || 'Narrator' }).name;

    function paintSetup() {
      const sel = h('select', { onchange: e => who = e.target.value },
        h('option', { value: 'all' }, 'Everyone, in order'),
        castIds.map(id => { const l = d.lines.find(x => (x.who || '§' + (x.name || '')) === id); return h('option', { value: id }, charName(l)); }));
      const cb = h('input', { type: 'checkbox', checked: onlyMissing, onchange: e => onlyMissing = e.target.checked });
      body.replaceChildren(
        h('h2', '🎙 Recording session'),
        h('p.muted', 'Press space to start recording a line and space again to stop. The next line comes up straight away.'),
        h('label.field', 'Whose lines?', sel),
        h('label.check', cb, 'Only lines without a recording yet'),
        h('div.sheet-actions', h('button.btn.quiet', { onclick: () => closeFn() }, 'Cancel'), h('button.btn.primary', { onclick: begin }, 'Start')));
    }

    async function begin() {
      queue = d.lines.filter(l => (who === 'all' || (l.who || '§' + (l.name || '')) === who) && (!onlyMissing || !l.audio));
      if (!queue.length) { U.toast(onlyMissing ? 'Every one of these lines already has a recording.' : 'No lines to record.'); return; }
      for (const l of queue) if (!l.words) l.words = await App.lex.tokens(l.text, deck);
      try { mic = await App.speech.micSession(); }
      catch { U.toast('The microphone is blocked. Allow it in the browser and try again.'); return; }
      k = 0; stage = 'rec'; paintLine();
    }

    function paintLine() {
      if (k >= queue.length) return paintDone();
      const l = queue[k]; const c = l.who ? App.chars.get(l.who) : null;
      const btn = h('button.btn.rec-big' + (recording ? '.recording' : ''), { onclick: toggle }, recording ? '■ Stop (space)' : '● Record (space)');
      body.replaceChildren(
        h('div.row', h('strong', `Line ${k + 1} of ${queue.length}`), h('span.spacer'), l.audio ? h('span.has-audio', '✓ has a recording') : null),
        h('div.rec-line', c ? App.chars.avatar(c, 72) : h('div.avatar', { style: { width: '72px', height: '72px' } }, '?'),
          h('div', h('div.t-name', charName(l)),
            h('div.line-text', { lang: 'zh-CN' }, (l.words || [{ w: l.text, py: '' }]).map(t => h('span.tok', h('span.py', t.py || ''), h('span.hz', t.w)))),
            (l.en || l.de) ? h('div.muted', [l.en, l.de].filter(Boolean).join(' / ')) : null)),
        h('div.rec-controls',
          h('button.btn', { onclick: () => move(-1), disabled: k === 0 || recording, title: 'Back to the previous line (←)' }, '← Redo previous'),
          btn,
          h('button.btn', { onclick: () => move(1), disabled: recording, title: 'Skip this line (→)' }, 'Skip →')),
        h('div.row', { style: { justifyContent: 'center' } },
          last ? h('button.btn.small.quiet', { onclick: () => App.speech.playBlob(last) }, '▶ Listen to the last recording') : null,
          h('button.btn.small.quiet', { onclick: () => App.speech.line(l, c) }, '🔊 Hear this line now'),
          h('button.btn.small.quiet', { onclick: () => closeFn() }, 'Finish')));
    }

    async function toggle() {
      if (stage !== 'rec' || k >= queue.length) return;
      if (!recording) { App.speech.stop(); mic.start(); recording = true; paintLine(); return; }
      recording = false;
      const blob = await mic.stop();
      if (blob && blob.size) {
        const l = queue[k];
        if (l.audio) await App.media.remove(l.audio);
        l.audio = await App.media.put(blob);
        last = blob; save();
      }
      k++; paintLine();
    }
    function move(step) { if (recording) return; k = Math.max(0, Math.min(queue.length, k + step)); paintLine(); }

    function paintDone() {
      stage = 'done';
      body.replaceChildren(h('div.result', App.ui.seal('录好'), h('p', 'All done. The lines now play with your voice.'),
        h('div.row', { style: { justifyContent: 'center' } },
          last ? h('button.btn.quiet', { onclick: () => App.speech.playBlob(last) }, '▶ Listen to the last one') : null,
          h('button.btn.primary', { onclick: () => closeFn() }, 'Close'))));
    }

    const onKey = e => {
      if (stage !== 'rec' || e.target.matches('select, input')) return;
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    };
    document.addEventListener('keydown', onKey, true);
    const closeFn = App.ui.modal(() => [body], () => {
      document.removeEventListener('keydown', onKey, true);
      if (mic) mic.close();
      repaint();
    });
    paintSetup();
  }

  function recordLine(line, done) {
    let rec = null;
    const b = h('button.btn.small.quiet.rec-btn', { title: line.audio ? 'Record again' : 'Record this line yourself', 'aria-label': 'Record this line' }, line.audio ? h('span.has-audio', '🎙') : '🎙');
    b.onclick = async () => {
      if (!App.speech.canRecord()) { U.toast('Recording needs a browser with microphone support, on an https page.'); return; }
      if (!rec) {
        if (App.speech.isRecording()) { U.toast('Stop the other recording first (the red ■ button).'); return; }
        try { rec = await App.speech.record(); b.classList.add('recording'); b.textContent = '■'; b.title = 'Stop recording'; }
        catch (e) { if (e.message !== 'busy') U.toast('The microphone is blocked. Allow it in the browser and try again.'); rec = null; }
      } else {
        const blob = await rec.stop(); rec = null;
        if (line.audio) await App.media.remove(line.audio);
        line.audio = await App.media.put(blob);
        done(); App.speech.line(line, null);
      }
    };
    return b;
  }
})();
