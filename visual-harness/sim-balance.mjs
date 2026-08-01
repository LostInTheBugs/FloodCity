#!/usr/bin/env node
/**
 * Flood City — Pure Simulation Balance Harness
 *
 * Replicates the exact game logic without any rendering.
 * Ultra-fast: thousands of games per second.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'balance-results');
const GAMES_PER_STRATEGY = 20;

// ─── Game Constants (mirrored from index.html) ────────────────
const RESOURCE_REGEN = 0.7;
const RESOURCE_CAP = 200;
const WAVE_INTERVAL_MIN = 14;
const WAVE_INTERVAL_MAX = 22;
const WALL_COST = 10; // unused in game, kept for reference

const WALL_TIERS = {
  1: { name: 'Sac de sable', cost: 12, hp: 100 },
  2: { name: 'Renforcé',  cost: 28, hp: 350 },
  3: { name: 'Béton',      cost: 52, hp: 750 },
};

const TRENCH_COST = 6;
const TRENCH_DAMAGE = 10;
const TRENCH_HP = 40;

// ─── Map definitions (relevant parts) ────────────────────────
const MAPS = {
  littoral: {
    name: 'Littoral',
    terrainHalf: 17,
    waveDirections: ['south'],
    waveSpawnZ: { south: -20 },
    buildZMin: -3,
    // Beach spans from z ≈ -18.75 to -12.25
    islandRadius: null,
    coastFn: null,
  },
  ile: {
    name: 'Île',
    terrainHalf: 34,
    islandRadius: 26.6,   // mean reference
    waveDirections: ['north', 'south'],
    waveSpawnZ: { south: -36, north: 36 },
    coastFn: function(angle) {
      // ⚠️ MUST match index.html MAPS.ile.coastFn exactly — see comment there.
      const a = angle;
      return 25.2
        - Math.sin(a) * 3.0
        + Math.cos(a * 2 - 0.4) * 1.3
        + Math.sin(a * 3) * 1.0
        + Math.cos(a * 5 + 1.2) * 0.6
        + Math.cos(a + 2.5) * 0.75;
    },
  },
};

// Helper: check if a point is on the island (matches index.html isOnIsland)
function isOnIslandSim(px, pz, map) {
  if (!map.islandRadius) return true;
  if (map.coastFn) {
    const angle = Math.atan2(pz, px);
    return Math.sqrt(px * px + pz * pz) <= map.coastFn(angle);
  }
  return (px * px + pz * pz) <= map.islandRadius * map.islandRadius;
}

// ─── Helpers ─────────────────────────────────────────────────
const avg = a => Math.round(a.reduce((s, v) => s + v, 0) / a.length);
const med = a => {
  if (a.length === 0) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Simple seeded random for reproducibility
function createRNG(seed) {
  let s = seed || Math.floor(Math.random() * 2147483647);
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Game State ──────────────────────────────────────────────
function createGameState(mapId, rng) {
  const map = MAPS[mapId];
  // Generate building count based on map
  // For littoral: ~43-46 buildings, for ile: ~30-36
  let numBuildings;
  if (mapId === 'littoral') {
    numBuildings = 40 + Math.floor(rng() * 10); // 40-49
  } else {
    numBuildings = 55 + Math.floor(rng() * 16); // 55-70
  }

  const defeatFrac = 0.15; // default
  const defeatThreshold = Math.max(3, Math.floor(numBuildings * defeatFrac));

  // Buildings have positions and HP
  const buildings = [];
  for (let i = 0; i < numBuildings; i++) {
    let x, z, w, d, h;
    if (mapId === 'littoral') {
      x = (rng() - 0.5) * (map.terrainHalf * 2 - 4);
      z = map.buildZMin + rng() * (map.terrainHalf - map.buildZMin);
      w = 1.5 + rng() * 3;
      d = 1.5 + rng() * 3;
      h = 2 + rng() * 6;
    } else {
      // Île: place buildings on the island using irregular coastline
      const angle = rng() * Math.PI * 2;
      const maxR = map.coastFn ? map.coastFn(angle) - 2 : (map.islandRadius - 2);
      const r = rng() * maxR;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      w = 1.5 + rng() * 3;
      d = 1.5 + rng() * 3;
      h = 2 + rng() * 6;
    }
    buildings.push({ x, z, w, d, h, alive: true });
  }

  return {
    mapId,
    map,
    resources: 150,
    score: 0,
    waveCountdown: 20,
    waveNumber: 0,
    gameOver: false,
    walls: [],
    trenches: [],
    waves: [],
    buildings,
    totalBuildingsInitial: numBuildings,
    defeatThreshold,
    rng,
    alertTriggered: false,
    nextWaveDir: map.waveDirections[0],
  };
}

// ─── Wall Placement ──────────────────────────────────────────
function placeWall(state, x, z, tier) {
  const t = WALL_TIERS[tier] || WALL_TIERS[1];
  if (state.resources < t.cost) return false;
  const map = state.map;
  if (Math.abs(x) > map.terrainHalf || Math.abs(z) > map.terrainHalf) return false;

  // Check island bounds
  if (map.islandRadius) {
    if (!isOnIslandSim(x, z, map)) return false;
  }

  // Check collisions with buildings
  for (const b of state.buildings) {
    if (!b.alive) continue;
    if (Math.abs(b.x - x) < b.w / 2 + 0.7 && Math.abs(b.z - z) < b.d / 2 + 0.7) return false;
  }

  // Check collisions with existing walls
  for (const w of state.walls) {
    if (Math.abs(w.x - x) < 0.8 && Math.abs(w.z - z) < 0.8) return false;
  }

  // Check collisions with trenches
  for (const tr of state.trenches) {
    if (Math.abs(tr.x - x) < 0.8 && Math.abs(tr.z - z) < 0.8) return false;
  }

  state.walls.push({ x, z, hp: t.hp, maxHp: t.hp, tier });
  state.resources -= t.cost;
  return true;
}

// ─── Trench Placement ────────────────────────────────────────
function placeTrench(state, x, z) {
  if (state.resources < TRENCH_COST) return false;
  const map = state.map;
  if (Math.abs(x) > map.terrainHalf || Math.abs(z) > map.terrainHalf) return false;

  if (map.islandRadius) {
    if (!isOnIslandSim(x, z, map)) return false;
  }

  // Check collisions with buildings
  for (const b of state.buildings) {
    if (!b.alive) continue;
    if (Math.abs(b.x - x) < b.w / 2 + 0.7 && Math.abs(b.z - z) < b.d / 2 + 0.7) return false;
  }

  // Check collisions with existing walls
  for (const w of state.walls) {
    if (Math.abs(w.x - x) < 0.8 && Math.abs(w.z - z) < 0.8) return false;
  }

  // Check collisions with existing trenches
  for (const tr of state.trenches) {
    if (Math.abs(tr.x - x) < 0.8 && Math.abs(tr.z - z) < 0.8) return false;
  }

  state.trenches.push({ x, z, hp: TRENCH_HP, maxHp: TRENCH_HP });
  state.resources -= TRENCH_COST;
  return true;
}

// ─── Wave Spawning ──────────────────────────────────────────
function spawnWave(state) {
  state.waveNumber++;
  const map = state.map;
  const dir = state.nextWaveDir;
  const dirSign = dir === 'north' ? -1 : 1;

  const difficulty = state.waveNumber <= 5
    ? state.waveNumber / 5
    : 1 + Math.log2(state.waveNumber / 5) * 0.8;

  const rawWidth = 6 + state.rng() * (8 + difficulty * 18);
  const waveWidth = Math.min(rawWidth, map.terrainHalf * 2 - 2);
  const waveH = 1.5 + difficulty * 5;
  const speed = 3 + difficulty * 4;
  const maxOffset = Math.max(0, map.terrainHalf - waveWidth / 2);
  const waveX = (state.rng() * 2 - 1) * maxOffset;

  const SEG_W = 1.0;
  const n = Math.max(1, Math.ceil(waveWidth / SEG_W));
  const segHp = (80 + difficulty * 200) / n;
  const segments = [];
  const segWidth = waveWidth / n;

  for (let i = 0; i < n; i++) {
    const sx = waveX - waveWidth / 2 + (i + 0.5) * segWidth;
    segments.push({ x: sx, hp: segHp, maxHp: segHp, alive: true });
  }

  const spawnZ = map.waveSpawnZ[dir];

  state.waves.push({
    segments,
    speed,
    z: spawnZ,
    x: waveX,
    width: waveWidth,
    height: waveH,
    destroyedBuildings: 0,
    dirSign,
    dir,
  });
}

// ─── Wave Update ────────────────────────────────────────────
function updateWaves(state, dt) {
  const map = state.map;

  for (let wi = state.waves.length - 1; wi >= 0; wi--) {
    const wave = state.waves[wi];

    // Sub-step anti-tunneling
    const maxStep = 0.4 / wave.speed;
    const steps = Math.max(1, Math.ceil(dt / maxStep));
    const subDt = dt / steps;

    for (let step = 0; step < steps; step++) {
      wave.z += wave.speed * wave.dirSign * subDt;

      // Trenches vs segments
      for (let ti = state.trenches.length - 1; ti >= 0; ti--) {
        const trench = state.trenches[ti];
        if (Math.abs(trench.z - wave.z) > 1.2) continue;
        for (const seg of wave.segments) {
          if (!seg.alive) continue;
          if (Math.abs(trench.x - seg.x) < 0.8) {
            const dmg = TRENCH_DAMAGE * subDt;
            seg.hp -= dmg;
            trench.hp -= dmg;
            if (seg.hp <= 0) seg.alive = false;
          }
        }
        if (trench.hp <= 0) {
          state.trenches.splice(ti, 1);
        }
      }

      // Walls vs segments
      for (let i = state.walls.length - 1; i >= 0; i--) {
        const wall = state.walls[i];
        if (Math.abs(wall.z - wave.z) > 1.5) continue;
        for (const seg of wave.segments) {
          if (!seg.alive) continue;
          if (Math.abs(wall.x - seg.x) < 0.7) {
            const dmg = 30 * subDt;
            seg.hp -= dmg;
            wall.hp -= dmg * 0.5;
            if (seg.hp <= 0) seg.alive = false;
          }
        }
        if (wall.hp <= 0) {
          state.walls.splice(i, 1);
        }
      }

      // Buildings vs segments
      for (const building of state.buildings) {
        if (!building.alive) continue;
        if (Math.abs(building.z - wave.z) > 2) continue;
        for (const seg of wave.segments) {
          if (!seg.alive) continue;
          if (Math.abs(building.x - seg.x) < building.w / 2 + 0.5) {
            seg.hp -= building.h * 8;
            if (seg.hp <= 0) seg.alive = false;
            building.alive = false;
            wave.destroyedBuildings++;
            break;
          }
        }
      }
    }

    // Wave removal
    const pastNorth = wave.dirSign === -1 && wave.z < -map.terrainHalf - 5;
    const pastSouth = wave.dirSign === 1 && wave.z > map.terrainHalf + 5;
    const allDead = !wave.segments.some(s => s.alive);

    if (pastNorth || pastSouth || allDead) {
      const diffFactor = state.waveNumber <= 5
        ? state.waveNumber / 5
        : 1 + Math.log2(state.waveNumber / 5) * 0.8;
      const diffBonus = Math.floor(diffFactor * 8);

      if (pastNorth || pastSouth) {
        const alive = state.buildings.filter(b => b.alive).length;
        state.score += 10 + state.waveNumber * 2 + alive + diffBonus * 2;
        state.resources = Math.min(RESOURCE_CAP, state.resources + 15 + state.waveNumber * 2 + diffBonus);
      } else {
        state.score += 20 + state.waveNumber * 3 + diffBonus * 2;
        state.resources = Math.min(RESOURCE_CAP, state.resources + 25 + state.waveNumber * 3 + diffBonus);
      }
      state.waves.splice(wi, 1);
    }
  }
}

// ─── Game Tick ───────────────────────────────────────────────
function gameTick(state, dt) {
  if (state.gameOver) return;

  state.resources = Math.min(RESOURCE_CAP, state.resources + RESOURCE_REGEN * dt);
  state.waveCountdown -= dt;

  // Alert
  const map = state.map;
  if (!state.alertTriggered && state.waveCountdown <= 10 && state.waveCountdown > 0) {
    state.alertTriggered = true;
    const dirs = map.waveDirections;
    state.nextWaveDir = dirs[Math.floor(state.rng() * dirs.length)];
  }

  if (state.waveCountdown <= 0) {
    spawnWave(state);
    state.alertTriggered = false;
    const baseInterval = WAVE_INTERVAL_MIN + state.rng() * (WAVE_INTERVAL_MAX - WAVE_INTERVAL_MIN);
    state.waveCountdown = Math.max(20, baseInterval - state.waveNumber * 0.15);
  }

  updateWaves(state, dt);

  const alive = state.buildings.filter(b => b.alive).length;
  if (alive <= state.defeatThreshold) {
    state.gameOver = true;
  }
}

// ─── Strategies ──────────────────────────────────────────────
const STRATEGIES = {
  passive: {
    name: 'Passive',
    getActions(state) { return []; },
  },

  naive: {
    name: 'Naïve',
    getActions(state) {
      const actions = [];
      if (state.resources >= 10) {
        const count = Math.min(Math.floor(state.resources / 10), 5);
        for (let i = 0; i < count; i++) {
          let x, z;
          const mapId = state.mapId;
          if (mapId === 'ile') {
            const angle = state.rng() * Math.PI * 2;
            const r = state.rng() * 25;
            x = Math.cos(angle) * r;
            z = Math.sin(angle) * r;
          } else {
            x = (state.rng() - 0.5) * 24;
            z = -13 + (state.rng() - 0.5) * 4;
          }
          actions.push({ x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2, tier: 1 });
        }
      }
      return actions;
    },
  },

  competente: {
    name: 'Compétente',
    _state: null,

    getActions(state) {
      const actions = [];
      const map = state.map;
      const mapId = state.mapId;
      const alertActive = state.alertTriggered;
      const dir = state.nextWaveDir;
      const resources = state.resources;

      // ── Tier selection ──
      let tier = 1;
      if (resources >= RESOURCE_CAP - 5 && state.waveNumber >= 8) tier = 3;
      else if (resources >= 150 && state.waveNumber >= 10) tier = 2;
      const cost = WALL_TIERS[tier].cost;
      if (resources < cost) return actions;

      const trenchBudget = Math.floor(resources * 0.12);
      const wallBudget = resources - trenchBudget;

      if (!this._state || this._state.mapId !== mapId) {
        this._state = { mapId, pos: 0, linePos: 0, northPos: 0, southPos: 0, northLine: 0, southLine: 0 };
      }
      const st = this._state;

      const maxWallActions = Math.min(Math.floor(wallBudget / cost), 12);

      for (let i = 0; i < maxWallActions; i++) {
        if (mapId === 'littoral') {
          const pass = Math.floor(st.pos / 2);
          const tight = pass >= 2;
          const spacing = tight ? 0.7 : 1.5;
          const z = pass % 2 === 0 ? -13.0 : -10.5;
          const startX = tight ? -16 : -15.5;
          const slots = tight ? 46 : 21;
          const slot = st.linePos % slots;
          const x = startX + slot * spacing;
          actions.push({ x: Math.round(x * 2) / 2, z, tier });
          if (i === 0) {
            st.linePos++;
            if (st.linePos >= slots) { st.linePos = 0; st.pos++; }
          }
        } else {
          // Île: defend BOTH fronts but prioritise south first
          // (first waves always come from south). Once south has
          // 2 full layers, start building north too.
          const southReady = st.southPos >= 2;

          let buildNorth;
          if (!southReady) {
            // South not ready yet: all-in on south
            buildNorth = false;
          } else if (alertActive && dir === 'north') {
            // North wave incoming: focus north, 3:1 ratio
            buildNorth = st.northLine <= st.southLine + 3;
          } else if (alertActive && dir === 'south') {
            // South wave incoming: focus south, 3:1 ratio
            buildNorth = st.northLine > st.southLine + 3;
          } else {
            // No alert: alternate evenly
            buildNorth = st.northLine <= st.southLine;
          }

          if (buildNorth) {
            const a0 = Math.PI / 2 - Math.PI / 3.5;
            const a1 = Math.PI / 2 + Math.PI / 3.5;
            const layerOff = 0.3 + (st.northPos % 2) * 1.8;
            const totalSteps = 24;
            const step = st.northLine;
            const frac = step / (totalSteps - 1);
            const angle = a0 + frac * (a1 - a0);
            const r = map.coastFn(angle) - layerOff;
            if (r > 1.5) {
              actions.push({
                x: Math.round(Math.cos(angle) * r * 2) / 2,
                z: Math.round(Math.sin(angle) * r * 2) / 2,
                tier
              });
            }
            if (i === 0) {
              st.northLine++;
              if (st.northLine >= totalSteps) { st.northLine = 0; st.northPos++; }
            }
          } else {
            const a0 = -Math.PI / 2 - Math.PI / 3.5;
            const a1 = -Math.PI / 2 + Math.PI / 3.5;
            const layerOff = 0.3 + (st.southPos % 2) * 1.8;
            const totalSteps = 24;
            const step = st.southLine;
            const frac = step / (totalSteps - 1);
            const angle = a0 + frac * (a1 - a0);
            const r = map.coastFn(angle) - layerOff;
            if (r > 1.5) {
              actions.push({
                x: Math.round(Math.cos(angle) * r * 2) / 2,
                z: Math.round(Math.sin(angle) * r * 2) / 2,
                tier
              });
            }
            if (i === 0) {
              st.southLine++;
              if (st.southLine >= totalSteps) { st.southLine = 0; st.southPos++; }
            }
          }
        }
      }

      // Trenches: a few in front of the threatened side
      const maxTrench = Math.min(Math.floor(trenchBudget / TRENCH_COST), 3);
      for (let i = 0; i < maxTrench; i++) {
        if (mapId === 'littoral') {
          const tx = -14 + i * 4;
          actions.push({ x: Math.round(tx * 2) / 2, z: -14, type: 'trench' });
        } else {
          const front = alertActive ? dir : 'south';
          const ctr = front === 'north' ? Math.PI / 2 : -Math.PI / 2;
          const angle = ctr + (i - 1) * 0.3;
          const r = map.coastFn(angle) + 0.3;
          actions.push({
            x: Math.round(Math.cos(angle) * r * 2) / 2,
            z: Math.round(Math.sin(angle) * r * 2) / 2,
            type: 'trench'
          });
        }
      }

      return actions;
    },
  },

  experte: {
    name: 'Experte',
    _state: null,

    getActions(state) {
      const actions = [];
      const mapId = state.mapId;
      const map = state.map;
      const alertActive = state.alertTriggered;
      const dir = state.nextWaveDir;
      const resources = state.resources;
      const waveNum = state.waveNumber;

      // ── Tier selection ──
      // More aggressive tier-up than compétente: T2 once we have
      // reasonable front coverage (wave 5+ with surplus resources).
      let tier = 1;
      if (resources >= RESOURCE_CAP - 5 && waveNum >= 6) tier = 3;
      else if (resources >= 130 && waveNum >= 5) tier = 2;
      const cost = WALL_TIERS[tier].cost;
      if (resources < cost) return actions;

      // Trench budget: modest, declining over time.
      const trenchRatio = waveNum <= 6 ? 0.15 : (waveNum <= 12 ? 0.08 : 0.03);
      const trenchBudget = Math.floor(resources * trenchRatio);
      const wallBudget = resources - trenchBudget;

      if (!this._state || this._state.mapId !== mapId) {
        this._state = { mapId, southPos: 0, northPos: 0, southLine: 0, northLine: 0 };
      }
      const st = this._state;

      const maxWallActions = Math.min(Math.floor(wallBudget / cost), 14);

      for (let i = 0; i < maxWallActions; i++) {
        if (mapId === 'littoral') {
          // 3-layer defense, wider spacing then dense fill
          const pass = Math.floor(st.southPos / 2);
          const tight = pass >= 3;
          const spacing = tight ? 0.5 : 1.5;
          const zIdx = pass % 3;
          const z = zIdx === 0 ? -13.5 : (zIdx === 1 ? -11.0 : -9.0);
          const startX = tight ? -16.2 : -15.5;
          const slots = tight ? 65 : 21;
          const slot = st.southLine % slots;
          const x = startX + slot * spacing;
          actions.push({ x: Math.round(x * 2) / 2, z, tier });

          if (i === 0) {
            st.southLine++;
            if (st.southLine >= slots) { st.southLine = 0; st.southPos++; }
          }
        } else {
          // Île: pre-position on BOTH fronts because the wave direction
          // alternates. Build the more-urgent front first (based on alert),
          // then the other front so both are defended.
          const urgentFront = alertActive ? dir : 'south';
          const buildNorth = urgentFront === 'north'
            ? (st.northPos <= st.southPos + 1)
            : (st.southPos > st.northPos + 1 ? false : (st.northPos <= st.southPos));

          if (buildNorth) {
            const a0 = Math.PI / 2 - Math.PI / 3.5;
            const a1 = Math.PI / 2 + Math.PI / 3.5;
            const layerOff = 0.3 + (st.northPos % 2) * 1.8;
            const totalSteps = 28;
            const step = st.northLine;
            const frac = step / (totalSteps - 1);
            const angle = a0 + frac * (a1 - a0);
            const r = map.coastFn(angle) - layerOff;
            if (r > 1.0) {
              actions.push({
                x: Math.round(Math.cos(angle) * r * 2) / 2,
                z: Math.round(Math.sin(angle) * r * 2) / 2,
                tier
              });
            }
            if (i === 0) {
              st.northLine++;
              if (st.northLine >= totalSteps) { st.northLine = 0; st.northPos++; }
            }
          } else {
            const a0 = -Math.PI / 2 - Math.PI / 3.5;
            const a1 = -Math.PI / 2 + Math.PI / 3.5;
            const layerOff = 0.3 + (st.southPos % 2) * 1.8;
            const totalSteps = 28;
            const step = st.southLine;
            const frac = step / (totalSteps - 1);
            const angle = a0 + frac * (a1 - a0);
            const r = map.coastFn(angle) - layerOff;
            if (r > 1.0) {
              actions.push({
                x: Math.round(Math.cos(angle) * r * 2) / 2,
                z: Math.round(Math.sin(angle) * r * 2) / 2,
                tier
              });
            }
            if (i === 0) {
              st.southLine++;
              if (st.southLine >= totalSteps) { st.southLine = 0; st.southPos++; }
            }
          }
        }
      }

      // Trenches: sparse, only on the threatened front
      const maxTrench = Math.min(Math.floor(trenchBudget / TRENCH_COST), 4);
      for (let i = 0; i < maxTrench; i++) {
        if (mapId === 'littoral') {
          const tx = -14 + i * 3;
          actions.push({ x: Math.round(tx * 2) / 2, z: -14.5, type: 'trench' });
        } else {
          const front = alertActive ? dir : 'south';
          const ctr = front === 'north' ? Math.PI / 2 : -Math.PI / 2;
          const angle = ctr + (i - 1.5) * 0.25;
          const r = map.coastFn(angle) + 0.5;
          actions.push({
            x: Math.round(Math.cos(angle) * r * 2) / 2,
            z: Math.round(Math.sin(angle) * r * 2) / 2,
            type: 'trench'
          });
        }
      }

      return actions;
    },
  },
};

// ─── Run a single game ──────────────────────────────────────
function runGame(mapId, strategyId, seed) {
  const rng = createRNG(seed);
  const state = createGameState(mapId, rng);
  const strat = STRATEGIES[strategyId];

  // Reset strategy state
  if (strat._state) strat._state = null;

  const MAX_TICKS = 50000;
  const DT = 0.2; // 0.2s per tick

  for (let tick = 0; tick < MAX_TICKS && !state.gameOver; tick++) {
    const actions = strat.getActions(state);
    if (actions && actions.length > 0) {
      for (const a of actions) {
        if (a.type === 'trench') {
          placeTrench(state, a.x, a.z);
        } else {
          placeWall(state, a.x, a.z, a.tier || 1);
        }
      }
    }
    gameTick(state, DT);
  }

  return {
    mapId,
    strategy: strategyId,
    score: state.score,
    waveNumber: state.waveNumber,
    buildingsAlive: state.buildings.filter(b => b.alive).length,
    buildingsTotal: state.totalBuildingsInitial,
    resourcesUnused: Math.floor(state.resources),
    walls: state.walls.length,
    trenches: state.trenches.length,
  };
}

// ─── Main ────────────────────────────────────────────────────
function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Flood City — Pure Simulation Balance');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Games/strat:  ${GAMES_PER_STRATEGY}`);
  console.log('');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const allResults = {};

  for (const mapId of ['littoral', 'ile']) {
    console.log(`\n🗺️  MAP: ${mapId.toUpperCase()}`);
    console.log('───────────────────────────────────────────────');

    for (const [stratId, strat] of Object.entries(STRATEGIES)) {
      console.log(`  🎯 ${strat.name}...`);

      const scores = [], waves = [], bld = [], res = [];

      for (let g = 0; g < GAMES_PER_STRATEGY; g++) {
        const seed = (mapId === 'ile' ? 1000 : 0) + g * 100 + Object.keys(STRATEGIES).indexOf(stratId);
        const r = runGame(mapId, stratId, seed);
        scores.push(r.score);
        waves.push(r.waveNumber);
        bld.push(r.buildingsAlive);
        res.push(r.resourcesUnused);
        process.stdout.write(`    #${g+1}: s=${r.score} w=${r.waveNumber} b=${r.buildingsAlive}/${r.buildingsTotal} r=${r.resourcesUnused} walls=${r.walls}   \r`);
      }
      console.log('');

      scores.sort((a, b) => a - b);
      waves.sort((a, b) => a - b);
      bld.sort((a, b) => a - b);
      res.sort((a, b) => a - b);

      const result = {
        strategy: strat.name, mapId, games: GAMES_PER_STRATEGY,
        score: { avg: avg(scores), min: scores[0], max: scores[scores.length - 1], median: med(scores) },
        waveNumber: { avg: avg(waves), min: waves[0], max: waves[waves.length - 1], median: med(waves) },
        buildingsRemaining: { avg: avg(bld), min: bld[0], max: bld[bld.length - 1] },
        resourcesUnused: { avg: avg(res), min: res[0], max: res[res.length - 1] },
      };

      allResults[`${mapId}_${stratId}`] = result;

      console.log(`    📊 ${strat.name}:`);
      console.log(`       Score:      avg=${result.score.avg}  min=${result.score.min}  max=${result.score.max}  med=${result.score.median}`);
      console.log(`       Vague:      avg=${result.waveNumber.avg}  min=${result.waveNumber.min}  max=${result.waveNumber.max}`);
      console.log(`       Bâtiments:  avg=${result.buildingsRemaining.avg}  min=${result.buildingsRemaining.min}  max=${result.buildingsRemaining.max}`);
      console.log(`       Ressources:  avg=${result.resourcesUnused.avg}  min=${result.resourcesUnused.min}  max=${result.resourcesUnused.max}`);
    }
  }

  // Save
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(OUTPUT_DIR, `sim-balance-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\n📁 Results: ${outFile}`);

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  COMPARATIVE TABLE (Simulation)');
  console.log('═══════════════════════════════════════════════\n');
  for (const mapId of ['littoral', 'ile']) {
    console.log(`  ${mapId.toUpperCase()}:`);
    console.log('  Strategy        | Score (avg/min/max) | Wave    | Bld left     | Res unused');
    console.log('  ───────────────┼─────────────────────┼─────────┼──────────────┼───────────');
    for (const sid of Object.keys(STRATEGIES)) {
      const r = allResults[`${mapId}_${sid}`];
      if (r) {
        console.log(`  ${r.strategy.padEnd(15)} | ${String(r.score.avg).padStart(4)} ${String(r.score.min).padStart(4)} ${String(r.score.max).padStart(4)} | ${String(r.waveNumber.avg).padStart(4)} (${String(r.waveNumber.min).padStart(2)}-${String(r.waveNumber.max).padStart(2)}) | ${String(r.buildingsRemaining.avg).padStart(4)} (${String(r.buildingsRemaining.min).padStart(2)}-${String(r.buildingsRemaining.max).padStart(2)}) | ${String(r.resourcesUnused.avg).padStart(5)}`);
      }
    }
    console.log('');
  }

  console.log('🛑 Done.');
}

main();
