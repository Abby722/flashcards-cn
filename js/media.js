/* Pictures and voice recordings, stored as Blobs in IndexedDB. */
(function () {
  const M = App.media = {};
  let dbp = null;
  const urls = {};
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('zika', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('media');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('media', mode); const st = t.objectStore('media'); const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };

  /* Stored as {type, data: ArrayBuffer}: Safari cannot store Blobs in IndexedDB in private browsing.
     Blobs saved by earlier versions are still read as they are. */
  M.put = async (blob, id = App.util.uid()) => {
    const v = { type: blob.type, data: await blob.arrayBuffer() };
    await tx('readwrite', st => st.put(v, id)); delete urls[id]; return id;
  };
  M.get = id => tx('readonly', st => st.get(id)).then(v => v && !(v instanceof Blob) && v.data ? new Blob([v.data], { type: v.type }) : v);
  M.remove = id => { if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } return tx('readwrite', st => st.delete(id)); };
  M.removeMany = ids => Promise.all(ids.map(M.remove)).catch(() => {});
  M.url = async id => {
    if (!id) return null;
    if (urls[id]) return urls[id];
    const b = await M.get(id).catch(() => null);
    if (!b) return null;
    return (urls[id] = URL.createObjectURL(b));
  };

  /* Shrink a photo to max 520px so decks stay light. */
  M.imageFromFile = file => new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const max = 520, s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      c.toBlob(b => b ? res(b) : rej(new Error('Could not read that picture')), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Could not read that picture')); };
    img.src = u;
  });

  /* Character pictures: keep transparency, optionally remove a plain white background
     (flood fill from the edges, so white inside the drawing stays). */
  M.cutoutFromFile = (file, removeWhite = true) => new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const max = 520, s = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * s)), hgt = Math.max(1, Math.round(img.height * s));
      const c = document.createElement('canvas'); c.width = w; c.height = hgt;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, hgt); URL.revokeObjectURL(u);
      if (removeWhite) {
        const d = ctx.getImageData(0, 0, w, hgt), px = d.data, seen = new Uint8Array(w * hgt), stack = [];
        const white = i => px[i * 4 + 3] < 20 || (px[i * 4] > 235 && px[i * 4 + 1] > 235 && px[i * 4 + 2] > 235);
        for (let x = 0; x < w; x++) stack.push(x, (hgt - 1) * w + x);
        for (let y = 0; y < hgt; y++) stack.push(y * w, y * w + w - 1);
        while (stack.length) {
          const i = stack.pop(); if (seen[i]) continue; seen[i] = 1;
          if (!white(i)) continue;
          px[i * 4 + 3] = 0;
          const x = i % w;
          if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
          if (i >= w) stack.push(i - w); if (i < w * (hgt - 1)) stack.push(i + w);
        }
        ctx.putImageData(d, 0, 0);
      }
      c.toBlob(b => b ? res(b) : rej(new Error('Could not read that picture')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Could not read that picture')); };
    img.src = u;
  });

  M.toDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  M.fromDataURL = async d => (await fetch(d)).blob();
})();
