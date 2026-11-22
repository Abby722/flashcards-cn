/* Pronunciation: the teacher's own recording if there is one, otherwise the device's Chinese voice. */
(function () {
  const Sp = App.speech = {};
  const synth = window.speechSynthesis;
  let voices = [];
  const PREFERRED = /Tingting|Ting-Ting|Xiaoxiao|Xiaoyi|Yunxi|Google 普通话|Google 普通話|Meijia|Lili|Yu-shu|Huihui|Yaoyao|Kangkang/i;

  function load() { voices = synth ? synth.getVoices().filter(v => /^zh([-_]CN|[-_]Hans|$)/i.test(v.lang) || /^cmn/i.test(v.lang)) : []; }
  if (synth) { load(); synth.onvoiceschanged = () => { load(); Sp.onvoices && Sp.onvoices(); }; }
  Sp.voices = () => voices;
  Sp.available = () => !!synth && voices.length > 0;

  function pickVoice() {
    const want = App.store.settings().voice;
    return voices.find(v => v.name === want) || voices.find(v => PREFERRED.test(v.name) && /CN/i.test(v.lang)) || voices.find(v => /CN/i.test(v.lang)) || voices[0];
  }

  let current = null, keep = null, helpShown = false;
  /* Only cancel when something is actually playing: in Chrome, cancel() followed
     straight away by speak() can silently swallow the new utterance. */
  Sp.stop = () => {
    let busy = false;
    if (synth && (synth.speaking || synth.pending)) { synth.cancel(); busy = true; }
    if (current) { releasePlayer(); busy = true; }
    return busy;
  };
  /* Fully let go of the audio player so Chrome's "playing audio" speaker icon clears. */
  function releasePlayer() {
    if (!current) return;
    current.pause(); current.removeAttribute('src'); current.load(); current = null;
  }

  const waitVoices = () => new Promise(res => {
    load(); if (voices.length || !synth) return res();
    const t = setTimeout(res, 1200);
    synth.addEventListener('voiceschanged', () => { clearTimeout(t); load(); res(); }, { once: true });
  });

  function platformHelp() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'Settings → Accessibility → Spoken Content → Voices → Chinese (China mainland) → download a voice. Also check the silent switch and volume.';
    if (/Mac/.test(ua)) return 'System Settings → Accessibility → Spoken Content → System voice → Manage Voices… → Chinese (China mainland) → download e.g. Tingting. Then quit and reopen the browser.';
    if (/Android/.test(ua)) return 'Settings → Google Text-to-speech → Install voice data → Chinese (Mandarin, China).';
    if (/Windows/.test(ua)) return 'Settings → Time & language → Speech → Add voices → Chinese (Simplified, China). Then restart the browser.';
    return 'Install a Chinese (China mainland) voice in the system\'s text-to-speech settings, then restart the browser.';
  }
  Sp.explain = function (reason) {
    App.ui.modal(close => [
      App.util.h('h2', 'No sound?'),
      App.util.h('p', reason),
      App.util.h('p', App.util.h('strong', 'To add a Chinese voice: '), platformHelp()),
      App.util.h('p.muted', 'Chrome and Safari work best. Words you record yourself on the Edit page always play, even without a Chinese voice.'),
      App.util.h('div.sheet-actions',
        App.util.h('button.btn.quiet', { onclick: close }, 'Close'),
        App.util.h('button.btn.primary', { onclick: () => { close(); Sp.say('你好', 1, true); } }, 'Try again'))]);
  };
  const help = (reason, force) => { if (force || !helpShown) { helpShown = true; Sp.explain(reason); } };

  Sp.say = async function (text, rateMul = 1, verbose = false, pitch = 1) {
    const wasBusy = Sp.stop();
    if (!synth) return help('This browser cannot speak. Try Chrome or Safari.', verbose);
    await waitVoices();
    if (!voices.length) return help('This browser did not find a Chinese voice on this device.', verbose);
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(); u.voice = v; u.lang = v.lang;
    u.rate = Math.min(2, App.store.settings().rate * rateMul);
    u.pitch = Math.max(0, Math.min(2, pitch));
    let started = false;
    u.onstart = () => { started = true; };
    u.onerror = e => { if (!['interrupted', 'canceled'].includes(e.error)) help(`The voice “${v.name}” could not play (${e.error}).`, verbose); };
    keep = u; // hold a reference: Chrome may otherwise drop the utterance before it plays
    const go = () => { synth.resume(); synth.speak(u); };
    if (wasBusy) setTimeout(go, 80); else go();
    setTimeout(() => { if (!started && keep === u && !synth.speaking) help(`The voice “${v.name}” did not start. The voice data may not be downloaded yet, or the sound is muted.`, verbose); }, 2500);
  };

  /* Play a card: recording first, synthetic voice as fallback. */
  Sp.card = async function (card) {
    if (card.audio) {
      const url = await App.media.url(card.audio);
      if (url) {
        Sp.stop();
        const a = current = new Audio(url);
        a.onended = () => { if (current === a) releasePlayer(); };
        a.play().catch(() => { if (current === a) releasePlayer(); Sp.say(card.hz); });
        return;
      }
    }
    Sp.say(card.hz);
  };
  /* A dialogue line: the teacher's recording, or the computer voice tuned to the character. */
  Sp.line = async function (line, ch) {
    if (line.audio) {
      const url = await App.media.url(line.audio);
      if (url) { Sp.stop(); const a = current = new Audio(url); a.onended = () => { if (current === a) releasePlayer(); }; a.play().catch(() => {}); return; }
    }
    Sp.say(line.text, ch ? ch.rate || 1 : 1, false, ch ? ch.pitch || 1 : 1);
  };
  Sp.voiceOf = (text, ch) => Sp.say(text, ch ? ch.rate || 1 : 1, false, ch ? ch.pitch || 1 : 1);
  Sp.sentence = s => Sp.say(s.words.map(w => w.w).join('') + (s.punct || ''), 0.95);

  /* ---------- recording ----------
     Only one recording at a time, and the microphone is switched off as soon as
     it stops, or when the page changes, so Chrome's red recording dot goes away. */
  let rec = null, stream = null, starting = false;
  const micOff = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
  Sp.canRecord = () => !!(navigator.mediaDevices && window.MediaRecorder);
  Sp.isRecording = () => !!rec || starting;
  Sp.record = async function () {
    if (starting) throw new Error('busy');
    Sp.cancelRecording();
    starting = true;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    finally { starting = false; }
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const r = rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    r.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(res => r.onstop = () => { micOff(); if (rec === r) rec = null; res(new Blob(chunks, { type: r.mimeType || 'audio/webm' })); });
    r.start();
    return { stop: () => { if (r.state !== 'inactive') r.stop(); else micOff(); return done; } };
  };
  /* Recording session: the microphone stays open (no delay before each line), one clip per start/stop. */
  Sp.micSession = async function () {
    Sp.cancelRecording();
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const s = stream;
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    let r = null, chunks = [];
    return {
      start() { chunks = []; r = rec = new MediaRecorder(s, type ? { mimeType: type } : undefined); r.ondataavailable = e => e.data.size && chunks.push(e.data); r.start(); },
      stop() {
        return new Promise(res => {
          if (!r || r.state === 'inactive') return res(null);
          const cur = r;
          cur.onstop = () => { if (rec === cur) rec = null; if (r === cur) r = null; res(new Blob(chunks, { type: cur.mimeType || 'audio/webm' })); };
          cur.stop();
        });
      },
      recording: () => !!r && r.state === 'recording',
      close() { if (r && r.state !== 'inactive') { r.ondataavailable = null; r.onstop = null; r.stop(); } r = null; rec = null; if (stream === s) micOff(); else s.getTracks().forEach(t => t.stop()); },
    };
  };
  Sp.playBlob = function (blob) { Sp.stop(); const a = current = new Audio(URL.createObjectURL(blob)); a.onended = () => { URL.revokeObjectURL(a.src); if (current === a) releasePlayer(); }; a.play().catch(() => {}); };

  /* Abandon a recording without saving it (page change, tab hidden). */
  Sp.cancelRecording = function () {
    if (rec && rec.state !== 'inactive') { rec.ondataavailable = null; rec.stop(); }
    rec = null; micOff();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { Sp.cancelRecording(); Sp.stop(); } });
  window.addEventListener('pagehide', () => { Sp.cancelRecording(); Sp.stop(); });
})();
