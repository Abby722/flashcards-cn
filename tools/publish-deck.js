#!/usr/bin/env node
/* Publish a deck file (.zika.json, from Edit → Share → Download deck file) as a class deck.
   Families then open a short link, e.g. https://<you>.github.io/flashcards-cn/#/class/christmas-holidays,
   and get the deck with recordings and photos. Publishing it again updates it on their devices.

   Usage:  node tools/publish-deck.js ~/Downloads/Christmas-holidays.zika.json [slug]
           node tools/publish-deck.js --remove <slug>
   Then commit and push. Everything published here is public. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'class');
const INDEX = path.join(ROOT, 'index.json');
const EXT = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

const readIndex = () => { try { return JSON.parse(fs.readFileSync(INDEX, 'utf8')); } catch { return []; } };
const writeIndex = list => { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(INDEX, JSON.stringify(list, null, 1) + '\n'); };
const slugify = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const args = process.argv.slice(2);
if (!args.length) { console.error('Usage: node tools/publish-deck.js <deck file .zika.json> [slug]   |   --remove <slug>'); process.exit(1); }

if (args[0] === '--remove') {
  const slug = args[1];
  fs.rmSync(path.join(ROOT, slug), { recursive: true, force: true });
  writeIndex(readIndex().filter(e => e.slug !== slug));
  console.log(`Removed class deck "${slug}".`);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(args[0], 'utf8'));
if (data.format !== 'zika-deck' || !data.deck || !Array.isArray(data.deck.cards)) { console.error('That is not a Zìkǎ deck file.'); process.exit(1); }
const deck = data.deck;
const index = readIndex();
const slug = args[1] || (index.find(e => e.id === deck.id) || {}).slug || slugify(deck.name) || deck.id;
const other = index.find(e => e.slug === slug && e.id !== deck.id);
if (other) { console.error(`"${slug}" is already used by the deck "${other.name}". Pass another name: node tools/publish-deck.js <file> <slug>`); process.exit(1); }

const dir = path.join(ROOT, slug);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'media'), { recursive: true });

const media = {};
let bytes = 0;
for (const [id, dataUrl] of Object.entries(data.media || {})) {
  const m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s.exec(dataUrl);
  if (!m) { console.warn(`Skipped media ${id}: not a data URL.`); continue; }
  const type = m[1], buf = Buffer.from(m[2], 'base64');
  const file = `media/${id.replace(/[^\w-]/g, '_')}.${EXT[type] || 'bin'}`;
  fs.writeFileSync(path.join(dir, file), buf);
  media[id] = { file, type };
  bytes += buf.length;
}

const published = Date.now();
fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({ format: 'zika-class', version: 1, slug, published, deck, chars: data.chars || null, slots: data.slots || null, media }));
const entry = { slug, id: deck.id, name: deck.name, words: deck.cards.length, published };
writeIndex([entry, ...index.filter(e => e.slug !== slug && e.id !== deck.id)]);

const audio = Object.values(media).filter(m => m.type.startsWith('audio/')).length;
console.log(`Published "${deck.name}" as class/${slug}: ${deck.cards.length} words, ${audio} recordings, ${Object.keys(media).length - audio} pictures (${(bytes / 1048576).toFixed(1)} MB).`);
console.log(`Link after pushing: <app address>#/class/${slug}`);
