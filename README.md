# 字卡 Zìkǎ: Chinese flashcards for class

Flashcards, a sentence builder and quizzes for a beginners' Chinese class. Type the characters you taught; pinyin, part-of-speech colour, a picture and English/German translations fill in by themselves, and you correct anything that is off.

It is a static web page: no server, no accounts, no build step. Everything a student does is saved in their own browser.

## What's inside

| Mode | What it does |
|---|---|
| **Cards 卡片** | Flip cards. The front shows the word in 田字格 practice squares (or the picture, or the pinyin). The back shows the picture, pinyin, the characters and translations, and plays the pronunciation. “Again / Got it” schedule the word for review. |
| **Word wall 词墙** | Every word of the lesson at once. Good on the projector. Tap a word to hear it. |
| **Sentences 造句** | Word tiles to put in order, coloured by **position in the sentence** (who / does / what / when-where / how). *Green as you go* or *Check at the end*. Optional colour-pattern hint. |
| **Talk 对话** | Dialogues between animal characters (Andy the cat, Wangwang the dog, Peter the rabbit, or your own). One line at a time with Next / Replay; each character has its own voice, or your recording. Tap a word to hear it; the meaning shows on request. |
| **Network 词网** | A blank board for building word networks live in class: type words, drag them, link them with a solid line (grow: 我 → 我的) or a dashed line (swap: 我 ↔ 你), colour them if you like. Saved in the deck. |
| **Characters 字表** | Every single character from the cards of all lessons (words and phrases are split into characters), each once, in the order learned: pinyin, meaning, the words it appears in, stroke count, and the stroke order (笔顺) as a row of 米字格 boxes. ▶ animates the writing. Filter by lesson, or print it as a worksheet. Stroke data loads from the internet the first time and is then kept on the device. |
| **Quiz 测验** | Pick the pinyin (wrong options differ only in tones), listen → character, picture → character, meaning, word order. |
| **Edit 编辑** | Words, sentences, characters and dialogues. |

**Pinyin switch** (top bar): *Show*, *Tap* (hidden until tapped; the default) or *Hide*. It applies everywhere except the Edit page.

**Colours** (⚙ → *Edit colours and positions*): five pastel colours, one per position in a sentence. Words with the same colour can replace each other; uncoloured, outlined words are helper words (吗, 了, 的…). You can rename, recolour, add or remove positions, and choose which word types get each colour on their flashcard. On the Edit page, tap a sentence tile to change its colour in that sentence.

## Teaching workflow

1. **Edit → Words**: type the lesson's characters, e.g. `猫 狗 你 我 喜欢`, and press *Add words*. Check each row; tap the picture to change it; press 🎙 to record your own pronunciation (otherwise the device's Chinese voice is used).
2. **Edit → Sentences**: one sentence per line, e.g. `我喜欢猫。`. Add the English/German so the student knows what to build. Tap a tile to fix its pinyin. If two orders are both right (`今天我很好` / `我今天很好`), put the other one under *Also correct*.
3. **Edit → Talk**: tap a character to change its picture, name or voice, or add a new one (pictures with a white background get it removed). Write a dialogue like a play, one line per row:
   ```
   Andy: 你好！你喜欢猫吗？ | Hi! Do you like cats? | Hallo! Magst du Katzen?
   Wangwang: 我不喜欢猫。
   ```
   English and German after `|` are optional. Record any line yourself with 🎙, or press **🎙 Recording session** to record a character's lines one after another: space starts, space stops and moves on, ← redoes the previous line.
4. In class: use **⛶** for full screen on the projector, *Word wall* to introduce, *Cards* to drill, *Network* to build word families together, *Talk*, *Sentences* and *Quiz*.
5. **Share with the family** (Edit page):
   - **Class link** (best, with your recordings): on the Edit page press *Download deck file*, then publish it with the app:
     ```
     node tools/publish-deck.js ~/Downloads/Christmas-holidays.zika.json
     git add class && git commit -m "Publish Christmas holidays" && git push
     ```
     The family gets a short link like `https://<your-user>.github.io/flashcards-cn/#/class/christmas-holidays` (also shown on the Edit page's share sheet). It brings the deck with recordings and photos, and every time they open the app it fetches your newest published version; their review progress is kept. To update, download the deck file again and publish it again. **Published decks, recordings included, are public.** Remove one with `node tools/publish-deck.js --remove <name>`.
   - **Link**: opening it adds the deck on their phone/tablet, with its dialogues, characters and your colours. Send it again after a lesson and the deck updates (their review progress is kept). Links don't carry recordings, uploaded pictures or network boards.
   - **Deck file**: includes everything: recordings, photos, your own characters' pictures and the network boards. They open it with *Open a deck file* on the home page.

Settings (⚙): English/German/both, Chinese voice and speed, auto-play on flip, handwriting-style characters (楷体; uses Kaiti on Mac/Windows when installed).

## Planned

Next up is a **“Write it” handwriting mode** with tracing on the Characters page. See [ROADMAP.md](ROADMAP.md) for details and parked ideas.

## Putting it online (GitHub Pages) — needed for share links

1. Commit and push this folder to GitHub.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, choose `main` and `/ (root)`, save.
3. After a minute the app is at `https://<your-user>.github.io/flashcards-cn/`. Use the app from that address when you make decks, so the share links point there.

Recording your voice needs that https address (or `localhost`). Each browser keeps its own decks: decks made on your laptop at `localhost` are not visible at the GitHub Pages address, so move them with *Download deck file* → *Open a deck file*.

## Running it on your computer

```sh
cd flashcards-cn
python3 -m http.server 8000
# open http://localhost:8000
```

Double-clicking `index.html` also works for practising, but share links and recording won't.

## Files

```
index.html            page shell
css/app.css           all styles
assets/characters/    pictures of Andy, Wangwang and Peter
js/                   app code (plain JavaScript, no framework)
  slots.js            the five sentence positions and their colours
  characters.js       the character library
  views/              home, editor, cards + word wall, sentence builder, talk, network, quiz
  vendor/             pinyin-pro (MIT), lz-string (MIT)
data/lexicon.js       ~11,500 words (HSK 1–9 + hand-checked beginner words): pinyin, part of speech, EN, DE, emoji
data/lexicon-extra.js ~97,000 more words, loaded only when a typed word isn't in the main list
data/emoji.js         emoji search keywords
decks/sample.js       the starter deck and sample dialogue shown on first visit
tools/                script that rebuilds the data files
```

## Improving the dictionary

The most common beginner words are hand-checked in `tools/curated.txt` (`word|pos|english|german|emoji`), with corrections for other HSK 1 words in `tools/overrides.txt`. To add or fix words for every future deck, edit those files and rebuild:

```sh
cd tools
npm install
./fetch-sources.sh
node build-lex.js
```

## Credits and licences

- English definitions: [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (CC BY-SA 4.0), via [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT) and the `cc-cedict` npm package.
- German definitions: [HanDeDict](https://github.com/gugray/HanDeDict) (CC BY-SA 2.0).
- Pinyin: [pinyin-pro](https://github.com/zh-lx/pinyin-pro) (MIT). Emoji keywords: [emojilib](https://github.com/muan/emojilib) (MIT). Stroke order: [Hanzi Writer](https://hanziwriter.org) (MIT) with hanzi-writer-data from [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) (Arphic Public License). Link compression: [lz-string](https://github.com/pieroxy/lz-string) (MIT). Font: [Andika](https://software.sil.org/andika/) (OFL), a font designed for beginning readers.
- The generated `data/` files are derived from CC BY-SA dictionaries and are shared under the same licence.
