# Skyharbor Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/aribal-ssu/skyharbor-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/aribal-ssu/skyharbor-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original browser flight game. Take off from a harbour-side strip, thread a
course of eight glowing rings out over the bay, and bring the aeroplane home
to a gentle landing — all in a pseudo-3D world of mountains, farmland, a
winding river and a little harbour town, rendered live on a 2D canvas with
no libraries and no network requests. The world is alive underneath you:
boats cross the bay leaving wakes, gulls circle the harbour, another
aeroplane flies a distant circuit, and the water sparkles in the sun. A
slow-varying wind pushes you off the centreline if you let it — the
compass ribbon and wind readout at the top and bottom of the screen,
alongside the classic ALT / SPD / HDG instruments, tell you by how much.

## The mission

1. Throttle up and take off from the Skyharbor strip.
2. Fly through the rings in order — the gold ring is next; teal rings are
   still to come. Each ring is worth 250 points.
3. Return to the runway and land: slow, shallow, lined up, wings level.
   A clean landing pays a bonus — a feather-soft touchdown right on the
   centreline is a "greaser" and pays extra — and every unit of fuel left
   in the tanks pays two more. Correct for the wind on final, or it will
   drift you off the strip.
4. Mind the stall, and mind the fuel — at zero the engine quits and the
   sortie becomes a glide.

## Controls

| Input | Action |
| --- | --- |
| W / S | Throttle up / down |
| ↑ / ↓ or mouse height | Pitch |
| A / D or ← / → | Bank and turn |
| Enter / click | Start the sortie |
| P | Pause |
| M | Mute |
| R | Fly again (after landing or crashing) |

## Run it locally

The game is static files under `game/` — serve that folder with any static
file server and open it in a desktop browser:

```sh
python3 -m http.server -d game 8080
# then visit http://localhost:8080
```

Add `?shot=play&seed=1` to the URL to see the frozen frame the screenshots
were taken from (the `start`, `play`, `approach` and `end` scenes live in
`game/src/shots.js`; the fourth screenshot is the `approach` frame — all
rings done, on final for the strip).

## Hand it in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
into the output directory and writes the `dossier.json` summary with the
vendored make.fun library:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `main.ts` — the hand-in program
- `vendor/makefun-game.ts` — the make.fun dossier library (vendored, unchanged)
- `game/index.html` — page shell and canvas
- `game/src/config.js` — world, plane and mission constants
- `game/src/random.js` — seeded RNG and value noise
- `game/src/input.js` — keyboard/mouse state
- `game/src/world.js` — terrain, ring course, runway, scenery
- `game/src/physics.js` — flight model and mission logic
- `game/src/render.js` — pseudo-3D world rendering
- `game/src/hud.js` — instruments, title and end screens
- `game/src/audio.js` — synthesized engine and wind sound
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — game loop and state machine
- `screenshots/` — renders of the game itself
