# 🐦 Flappy Bird — Web Edition

A browser-based Flappy Bird game built with vanilla HTML5 Canvas and JavaScript. No frameworks, no build tools — just pure code.

## 🎮 Play Now

**[https://ianrmenezes.github.io/flappy-bird/](https://ianrmenezes.github.io/flappy-bird/)**

## Controls

| Input | Action |
|---|---|
| `Space` / `↑` | Jump |
| Click / Tap | Jump (mobile friendly) |
| `R` | Restart after game over |

## Features

- Smooth 60fps gameplay with delta-time physics (works on any refresh rate)
- Pixel-art sprite scaling
- Wing flap animation and tilt physics
- Score tracking with high score saved to localStorage
- Medals for scores 10+ / 20+ / 40+
- Mobile / touch support
- Start screen and game over screen
- Zero dependencies — runs in any modern browser

## Run Locally

```bash
# Any local server works, e.g.:
python3 -m http.server 8080
# Then open http://localhost:8080
```

Or just open `index.html` directly in your browser.

## Project Structure

```
├── index.html    # Entry point
├── style.css     # Responsive canvas styling
├── game.js       # Game engine (~560 lines)
└── imgs/         # Sprite assets
    ├── bird1.png
    ├── bird2.png
    ├── bird3.png
    ├── pipe.png
    ├── bg.png
    └── base.png
```


