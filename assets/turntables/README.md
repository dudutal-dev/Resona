# Turntable originals

The footage the television stage's turning figure is encoded from. Kept here
rather than in `src/` because nothing in this directory is bundled: the app
ships the encoded copies in `src/assets/turntables`.

A turntable is one full revolution of a figure against a locked camera. Two
cuts of the same performance are expected, named for the shape of the screen
they are for:

    figure-portrait.mp4    a phone held upright
    figure-wide.mp4        a phone turned, or a television

Which one plays is decided by the shape of the stage at the moment, not by a
setting — a page cannot be told that a television is attached, so the only
honest signal is the surface it is actually drawing on. See `TvStage`.

## Replacing the footage

1. Drop the two clips in here under those names. Any size; audio is fine, it is
   stripped. One revolution per clip — the app derives its rotation speed from
   the clip's own length, so a clip that turns twice will turn twice as fast.
2. `npm i -D ffmpeg-static` if the machine has no ffmpeg. It is deliberately not
   a saved dependency: the encoded files are committed, so a normal install
   should not be fetching a video encoder for a script that runs once a year.
3. `node scripts/pack-turntables.mjs`. Read the header of that script first —
   the interesting part is that it synthesises intermediate frames, and why.
4. Nothing to change in `src/`: `figures.ts` imports these two names.
