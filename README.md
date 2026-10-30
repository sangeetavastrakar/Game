# Pocket Arcade — Snake

A complete browser Snake game built with HTML, CSS, and vanilla JavaScript. No installation, build step, external fonts, libraries, or network assets are needed.

## Play

Open `index.html` in a current browser, or serve this directory:

```sh
python3 -m http.server 8000
```

Open the local server in your browser. The game works offline once its files are available. Best scores and preferences are stored on your device when browser storage is available; private browsing, blocked storage, or moving between file and server origins may affect persistence.

## Features

- **Classic:** avoid walls and your tail.
- **No walls:** cross an edge to emerge on the opposite side.
- **The maze:** weave through fixed obstacles.
- **Chill, Classic, and Turbo** speeds, with separate best scores for all nine combinations.
- Earn 10 points per bite (20 in Turbo). Every five ordinary bites increases your level and speed, and spawns a golden bite worth three times the points. Golden bites last 6.5 seconds of active game time.
- Smooth movement, buffered turns, high-resolution canvas rendering, bite particles, optional synthesized sound, light/dark themes, and fullscreen where supported.
- Automatic pause when you switch tabs or windows; reduced-motion support; touch controls, keyboard focus indicators, and status announcements.
- End-of-run statistics and a win state when the board is filled.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | Arrow keys or WASD | Swipe the board or tap direction buttons |
| Start / pause / resume | Space (when a button or settings control is not focused) | Play / pause buttons |
| Pause | Escape | Pause button |
| Restart | R | Restart button |

Choose mode and pace before a run or after game over. During a run, these settings are locked so its rules and score category remain consistent. Sound starts muted. In fullscreen, use Escape to return to the regular layout.

## Development

- `index.html`: semantic page, controls, and game overlays.
- `style.css`: responsive layout and themes; no external assets.
- `engine.js`: deterministic game rules with injectable randomness.
- `game.js`: browser input, rendering, audio, and persistence.
- `tests/engine.test.cjs`: gameplay regression checks.

Run the rule tests with Node.js 20 or later:

```sh
node tests/engine.test.cjs
```

The renderer uses `requestAnimationFrame` with a fixed simulation timestep, a cached grid, and a device-pixel ratio capped at 2. It stops the animation loop while paused or on menu screens. No server-side component is required.
