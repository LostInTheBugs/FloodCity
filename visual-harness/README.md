# 🌊 Flood City — Visual Verification Harness

Visual verification harness for Flood City. Runs the game in a headless
browser, drives it, and produces screenshots, performance measurements and
a flicker check.

## Principle

The harness does not judge. It **produces evidence**: screenshots a human
looks at, numbers a human reads. The only exceptions: console errors and the
flicker check, which give an automatic verdict.

## Dependencies

- Node.js ≥ 22
- npm

The harness installs Puppeteer (headless Chromium browser) and pngjs in its
own `node_modules/`, isolated from the game.

## Installation

```bash
cd visual-harness
npm install
```

## Usage

```bash
# 1. Serve the game (in another terminal)
cd /home/administrator/floodcity
python3 -m http.server 8002

# 2. Run the harness
cd visual-harness
node harness.js [URL] [seed]

# Default URL: http://localhost:8002/index.html
# Default seed: 42
```

### Generation seed

The harness **always uses a seed** to guarantee reproducible pixel
assertions. Without it, two runs on different cities would give different
verdicts, which is a trap.

- If the provided URL already contains `?seed=...`, that seed is used.
- Otherwise, the harness automatically appends `?seed=N` to the URL, with
  `N = 42` by default.
- The seed is printed at the start of the run and recorded in the report.

```bash
# Examples:
node harness.js                                    # seed=42 (default)
node harness.js http://127.0.0.1:8099/index.html   # seed=42 (injected)
node harness.js http://127.0.0.1:8099/index.html 99 # seed=99
node harness.js http://localhost:8002/index.html?seed=7  # seed=7 (respected)
```

### Testing production

```bash
node harness.js https://games.cloudfr.net/floodcity/
```

## What the harness does

1. Launches headless Chromium with software rendering (SwiftShader)
2. Navigates to the game
3. Captures the home screen
4. Selects the "Shoreline" map
5. Places defenses: tier 1 and 3 walls, trenches
6. Captures the day view
7. Rotates the camera (east view, west view)
8. Measures day framerate
9. Switches to night mode and captures
10. Measures night framerate
11. Waits for a wave to pass and captures
12. Performs the flicker check (two very close captures compared pixel by pixel)
13. Generates a `report.txt` report

## Outputs

All outputs go to `captures/YYYY-MM-DD_HHmmss/`:

```
captures/2026-07-28_14-30-00/
├── 01-home-screen.png      Home screen
├── 02-game-day.png         Initial game view
├── 03-defenses-placed.png  Defenses placed
├── 04-camera-east.png      Camera facing east
├── 05-camera-west.png      Camera facing west
├── 06-game-night.png       Night mode
├── 07-night-zoom.png       Night, zoomed in
├── 08-wave-active.png      Wave in progress
├── 09-after-wave.png       After the wave
├── 10-flicker-a.png        Flicker check A
├── 11-flicker-b.png        Flicker check B
├── console.log             Errors and warnings
└── report.txt              Full report
```

## Interpreting results

- **Screenshots**: look at them one by one. Is the camera well oriented?
  Are the defenses visible? Is night mode correct?
- **FPS**: below 30 FPS → performance issue. Below 15 → critical.
- **Console**: the report distinguishes three categories:
  - **Real errors** (🔴) — to investigate
  - **Warnings** (⚠️) — to monitor
  - **Expected messages** (ℹ️) — harmless WebGL negotiation messages, filed
    separately so they don't pollute real errors
- **Missing HTTP resources**: 4xx/5xx codes detected, with full URL.
- **Flicker**: if the ratio of different pixels exceeds 3%, there is probably
  z-fighting. Look at `10-flicker-a.png` and `11-flicker-b.png`
  side by side.

## Versioning

Captures are in `.gitignore`, they will never be committed.
The harness itself is versioned normally.
