# 🌊 Flood City

3D flood-defense game — build walls, dig trenches and protect your city from destructive waves.

## 🎮 How to play

| Control | Action |
|---|---|
| 🖱️ **Left click** | Place the current structure (wall or trench) |
| 🖱️ **Right click + drag** | Rotate the camera |
| 🖱️ **Mouse wheel** | Zoom |
| ⌨️ **1 / 2 / 3** | Choose the wall tier |
| ⌨️ **T** | Toggle trench mode |
| ⌨️ **R** | Restart the game |

A **green ghost** appears at the targeted location — red if the placement is invalid (building, existing wall, insufficient resources).

## ⚙️ Mechanics

### Defenses
| Type | Cost | HP | Key |
|---|---|---|---|
| 🧱 Sandbag | 10☼ | 100 | `1` |
| 🛡️ Reinforced | 25☼ | 300 | `2` |
| 🏗️ Concrete | 50☼ | 600 | `3` |
| 🕳️ Trench | 5☼ | 40 | `T` |

Trenches deal 8 damage/second to waves but wear out on contact. Walls block adjacent wave segments — a continuous levee stops everything, an isolated wall opens a breach.

### Waves
- Arrive every 8–22 seconds at random horizontal positions
- Split into 1-meter segments — each segment can be stopped independently
- Progressive difficulty over 5 waves (width, height, speed, HP)
- Visual alert 10 seconds before impact

### Economy
- **150 resources** at the start
- Passive regeneration: **1.0☼/second** (cap: 300)
- Bonus per survived wave: **15–25☼** + **10–30 points**
- Cumulative score — only goes up if you defend well

### Game over
- If ≤ 5 buildings survive

## 🛠️ Tech

- [Three.js](https://threejs.org/) r160 (CDN importmap)
- Single-file HTML (~1400 lines)
- Desktop only (WebGL + mouse recommended)

## 🚀 Run

```bash
# Direct
open index.html

# Or serve locally
python3 -m http.server 8002
# → http://localhost:8002
```

Deployed at https://games.cloudfr.net/floodcity/

## ⚙️ Configuration

The project is a static HTML file served with Three.js from CDN. No dependency to install.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8002` | Local HTTP server listen port (overridable) |

Dependencies: a recent browser with WebGL, [Three.js](https://threejs.org/) r160 (CDN importmap).

## ⚠️ Deployment consistency

The `version.json` file (served next to `index.html`) must be deployed **at the same time** as `index.html` and carry the same version as `GAME_VERSION`. If they diverge, the update banner loops forever.

Before each deployment, check:
```bash
# Shows both versions side by side
grep "const GAME_VERSION" index.html && cat version.json
```

The `version` field (in `version.json`) and `GAME_VERSION` (in `index.html`) must be identical.

## 🔬 Visual verification harness

The project includes an automated test harness in `visual-harness/`. It runs the game in a headless browser, places defenses, captures day and night screenshots, measures performance and detects z-fighting flicker. See [`visual-harness/README.md`](visual-harness/README.md) for installation and usage.

### Verification interface exposed in `index.html`

The shipped file deliberately exposes a small API block intended exclusively for the harness. These functions are grouped under an explicit comment in the source code, with the `harness_` prefix:

| Function | Role | Read / Write |
|---|---|---|
| `harness_camTopdown(maxDist, phi)` | Positions the camera in near-top-down view | ✏️ Writes camera position only |
| `harness_camState()` | Returns camera position + target | 📖 Read-only |
| `harness_unprojectScreen(sx, sy, worldY)` | Projects screen → world coordinates | 📖 Read-only |
| `harness_projectWorld(wx, wy, wz)` | Projects world → screen coordinates | 📖 Read-only |
| `<meta name="map-data">` tag | Map scale data (terrainHalf, camMaxDist...) | 📖 Read-only |

**Scope:** camera positioning, coordinate projection, map scale reading. None of these functions modify the game state (buildings, resources, waves, score, etc.).

This block is accepted in the shipped file because it is required for the verification harness to work and is strictly confined to its role — no possible drift toward game-state access.

To check that no other test interface slipped in:
```bash
grep -c "harness_" index.html    # must return the number of functions (4)
grep -c "window.__" index.html   # must be 0 (reserved for the Puppeteer harness)
```

## 🌱 Deterministic seed

Add `?seed=` followed by a number to the URL to replay **exactly** the same map:

```
https://games.cloudfr.net/floodcity/?seed=42
```

The seed controls the layout of the city, buildings, street furniture and beach. Same seed = same map, every time. Without the parameter, a random map is generated as before. Handy for comparing strategies, sharing a configuration or reproducing a bug.

## 📋 Release notes

### 2026.08.002
- Island completely reworked: much larger, irregular coastline, countryside around the city
- Fixed island ground rendering, which could fail to appear
- Ability to replay exactly the same map with the `?seed=` parameter
- Internal tooling: visual verification harness and balancing test bench

### 2026.08.001
- Compliance pass: default port 8002, VERSION and CHANGELOG creation, enriched documentation

### 2026.07.013
- The island is noticeably larger, with an irregular coastline, real countryside around the city and less intrusive streets
- It is possible to replay exactly the same map by adding `?seed=` followed by a number to the game URL
- Display fixes on the island, including the ground which could fail to appear
- Generation is deterministic: same seed, same result on every load

### 2026.07.012
- Threatened residents actually take shelter in buildings and gradually come back out once the danger is over; those whose building was destroyed do not return
- A seaside parking lot appears, on which you can build
- Waves now wash away anything placed: streetlights and their halos, traffic lights, parasols, sun loungers, balls — a devastated area goes dark at night
- Lying sunbathers stand up and flee at the alert, then come back to lie down once the danger is over
- Surfaces — roadway, sidewalks, markings, parking — stay in place after a wave passes

### 2026.07.011
- Night streetlight glow softened: halos no longer blow out the roadway to white and the blue nighttime atmosphere regains dominance, for a more natural feel
- Improved scenery legibility in night mode

### 2026.07.010
- **Major gameplay change**: walls and trenches can now be built on the whole strip between the city and the sea, beach included — this area was wrongly blocked even though it is the core of defense-in-depth
- A developed waterfront appears: promenade, railings along the sand, palm trees, street furniture — all traversable, you can build on top
- Beach scenery and defenses now coexist naturally, never blocking each other again

### 2026.07.009
- Fixed road flicker in night mode — the road grid no longer flashes when moving the camera
- Improved on-ground element display stability in low-light conditions

### 2026.07.008
- Longer intervals between waves, leaving more time to rebuild and watch the city breathe between two alerts
- A day/night mode toggleable with the N key: clear moonlit night with lit windows, streetlights, lighthouses and beach bonfires
- Richer street furniture: streetlights along the roads and traffic lights on both sides of intersections
- The street network is reorganized into larger blocks, making movement smoother and the city more legible
- Wave shape reworked — less angular, more organic

### 2026.07.007
- Difficulty scales without a cap and defeat thresholds adapt to each map's size — no more restarts after 5 waves
- Best scores are kept per map and shown in the menu, to track progress from one session to the next
- The city reacts to alerts: cars and pedestrians flee the threatened area, then life resumes once the danger is over
- The beach comes to life — sunbathers, strollers, ball players and roving vendors who abandon their cart when the siren sounds
- A compass indicates north and the front where the next wave will come from, to better anticipate your defenses
- Scaled scenery and revised placement — no building can be constructed on the roadway anymore, sidewalks stay clear

### 2026.07.006
- Internal fix: the `<meta name="version">` tag is no longer hardcoded in the HTML; it is filled dynamically by JavaScript from `GAME_VERSION`, making the previously observed desynchronization between the two sources structurally impossible

### 2026.07.005
- Fixed a display bug: a building destroyed by a wave no longer stayed visible on screen
- Automatic new-version detection: a discreet banner offers to reload when an update is available, without ever interrupting the game
- Non-blocking update banner — the game keeps running while the notification is shown
- Unified scenery scale — pedestrians, trees, parasols, sun loungers and sunbathers brought back to realistic proportions
- Wider beach with more furniture, sea horizon without a visible edge on both maps
- Wave strike zone pushed back, leaving more time to build
- Fixed coastline — beach furniture no longer ends up in the water
- Traffic lights, parasols and sun loungers resized to realistic proportions
- Crosswalks aligned with the real roadway width

### 2026.07.002
- Home screen with a choice between two maps: Shoreline (city set back from the beach) and Island (waves alternating north-south)
- Version number shown in the menu and the HUD

### 2026.07.001
- Waves split into independent, off-center segments with progressive difficulty
- Three wall tiers (sandbag, reinforced, concrete) and trenches that slow the waves
- Preview ghost, progressive score, passive regeneration economy
- Generated city with roads, sidewalks, cars, pedestrians, beach and beach furniture
- Fixes: black screen at startup, memory leak on restart

> **Reminder:** the `version.json` file must be deployed with `index.html` and carry the same version as `GAME_VERSION`.

## Development cost (LLM)

This project was built entirely through AI-assisted sessions (Hermes Agent, deepseek-v4-pro / deepseek-v4-flash). Usage so far (cumulative as of 2026-08-02):

| Metric | Value |
|---|---|
| Input tokens | 4 171 727 |
| Output tokens | 2 057 197 |
| **Total (input + output)** | **6 228 924** |
| Cache read (reused at reduced price) | 358 662 144 |
| API calls | 4 206 |
| **Estimated cost** | **≈ 4.26 USD** |

Full breakdown: [TOKENS.md](TOKENS.md).

## 📝 Repo

https://github.com/LostInTheBugs/FloodCity — [Releases](https://github.com/LostInTheBugs/FloodCity/releases)
