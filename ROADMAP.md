# Roadmap

Features agreed on but not built yet.

## Next: "Write it" (handwriting practice with tracing)

On the 字表 Characters page, add a ✍️ button next to ▶ for each character.

**What the student does:** writes the character inside a large 米字格 with a finger (tablet/phone) or the mouse, stroke by stroke.

**What the app does:**
- Checks each stroke as it is drawn. A correct stroke snaps into place in ink.
- A stroke in the wrong place or wrong order is rejected, and after a mistake or two the app hints at the next stroke (it flashes where it goes).
- When the character is finished, shows how many strokes needed a hint, plays the sound, and offers "Again" / "Next character".

**Options to include:**
- **Tracing mode:** the pale outline of the whole character is visible, so the student traces over it. Good for new characters.
- **From memory:** no outline; only hints after mistakes. Good for review.
- A short practice round from the Characters page: "Practise these 5 characters", optionally the ones due for review.

**How to build it:** Hanzi Writer (already in `js/vendor/hanzi-writer.min.js`) has a built-in quiz mode (`writer.quiz({ onMistake, onCorrectStroke, onComplete, showHintAfterMisses })`) using the same stroke data the Characters page already loads and caches (`App.strokes.load`). Reuse the 米字格 background from `App.strokes.mizige` and the modal from `App.strokes.animate`.

## Parked ideas (discussed, on hold)

- **Garden background:** a flat cartoon garden around the edges of the app (draft: tree with owl and birdhouse, bamboo with panda, pond with frog and ducks). Painterly versions (watercolour, oil, crayon) were also tried. Decided to keep the app without a background for now.
- **Natural cloud voices** for characters (e.g. Microsoft Azure Speech or Google Cloud Text-to-Speech), generated once per dialogue line and stored like a recording. Needs an account and API key; check current pricing before building.
- **Word recordings reused everywhere:** a word recorded on its flashcard would also play when tapped in dialogues, sentence tiles and the network board.
