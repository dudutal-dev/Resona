# Figure originals

The full-resolution sources for the television stage's artwork. They are kept
here rather than in `src/` because nothing in this directory is bundled: the app
ships the encoded copies in `src/assets/figures`, and these are what those are
encoded *from*.

**Nothing here is currently in the app.** The eleven renders below shipped for a
while and were pulled out to make room for better ones — they are kept so that
decision stays reversible, and so a replacement can be compared against what it
replaces.

## Putting artwork into the app

1. Drop the images in this directory. PNG or JPG, any size — the encoder handles
   the rest. Name them `<n>-<name>.png` so the order is obvious.
2. `npm run pack-figures` — encodes each one into `src/assets/figures` as WebP.
   See the header of `scripts/pack-figures.mjs` for what it does to them and why.
3. Add a line per figure in `src/data/figures.ts`, importing the encoded file and
   naming it with a `figure.*` key.

The `figure.*` keys for the set below are still in `src/lib/i18n.ts`, so
restoring any of them is one import and one line rather than a translation pass.

## What is here

| file | what it is |
| --- | --- |
| `1-starlight.png` | figure against a starfield |
| `2-violet.png` | violet figure |
| `3-spectrum.png` | full-spectrum figure |
| `4-chakras.png` | chakra column |
| `5-temple.png` | couple, temple garden |
| `6-cosmos.png` | couple, cosmos |
| `7-crimson.png` | crimson couple |
| `8-forest.png` | forest |
| `9-jupiter.jpg` | figure against Jupiter |
| `10-emerald.png` | emerald |
| `11-amber.png` | amber |
