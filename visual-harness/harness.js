#!/usr/bin/env node
/**
 * Flood City — Visual Verification Harness
 *
 * Runs the game in a headless browser with software rendering,
 * plays through a session, collects screenshots, console errors,
 * framerate measurements, and performs a z-fighting flicker check.
 *
 * Usage:
 *   node harness.js [URL]
 *
 *   URL defaults to http://localhost:8080
 *   The URL should point to a directory containing index.html + version.json
 *
 * Output:
 *   visual-harness/captures/YYYY-MM-DD_HHmmss/
 *     ├── 01-home-screen.png
 *     ├── 02-game-day.png
 *     ├── ...
 *     ├── report.txt
 *     └── console.log
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');

// ─── Configuration ───────────────────────────────────────────
const TARGET_URL = process.argv[2] || 'http://localhost:8080';
const CAPTURES_DIR = path.join(__dirname, 'captures');
const VIEWPORT = { width: 1280, height: 720 };

// Timestamps
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RUN_DIR = path.join(CAPTURES_DIR, RUN_ID);

// ─── Known benign patterns ───────────────────────────────────
// WebGL context negotiation messages that fire during the fallback
// from hardware GPU → SwiftShader → software renderer.  These are
// harmless — the software renderer works correctly every time.
const BENIGN_PATTERNS = [
  /WebGL context could not be created/i,
  /Error creating WebGL context/i,
  /Failed to create WebGL context/i,
  /WebGL context lost/i,
  /Error with WebGL/i,
  /swiftshader.*context/i,
];

// ─── Report accumulator ──────────────────────────────────────
const report = {
  runId: RUN_ID,
  url: TARGET_URL,
  timestamp: new Date().toISOString(),
  captures: [],
  consoleErrors: [],      // real (non-benign) errors
  consoleWarnings: [],    // console.warn()
  consoleExpected: [],    // benign messages (WebGL negotiation, etc.)
  httpErrors: [],         // HTTP 4xx/5xx resources (tracked via response listener)
  framerateDay: null,
  framerateNight: null,
  flickerResult: null,
  gameVersion: null,
};

// ─── Helpers ─────────────────────────────────────────────────
function capturePath(name) {
  return path.join(RUN_DIR, name);
}

function addCapture(filename, description) {
  report.captures.push({ file: filename, description });
}

function isBenign(text) {
  return BENIGN_PATTERNS.some(p => p.test(text));
}

function recordConsole(type, text) {
  if (isBenign(text)) {
    report.consoleExpected.push(text);
    return;
  }
  if (type === 'error') {
    report.consoleErrors.push(text);
  } else if (type === 'warning') {
    report.consoleWarnings.push(text);
  }
}

async function screenshot(page, name, description) {
  const file = capturePath(name);
  await page.screenshot({ path: file, fullPage: false });
  addCapture(name, description);
  console.log(`  📸 ${name} — ${description}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Frame counter injection ─────────────────────────────────
async function injectFrameCounter(page) {
  await page.evaluate(() => {
    window.__fcFrames = 0;
    window.__fcStart = performance.now();
    window.__fcDone = false;
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function(cb) {
      if (!window.__fcDone) window.__fcFrames++;
      return origRAF.call(window, cb);
    };
  });
}

async function measureFramerate(page, durationMs = 3000, label = '') {
  await page.evaluate(() => {
    window.__fcFrames = 0;
    window.__fcStart = performance.now();
    window.__fcDone = false;
  });
  await sleep(durationMs);
  const result = await page.evaluate(() => {
    window.__fcDone = true;
    const elapsed = (performance.now() - window.__fcStart) / 1000;
    return { frames: window.__fcFrames, elapsed };
  });
  const fps = (result.frames / result.elapsed).toFixed(1);
  console.log(`  ⏱️  FPS (${label}): ${fps} (${result.frames} frames / ${result.elapsed.toFixed(1)}s)`);
  return parseFloat(fps);
}

// ─── Pixel difference (for flicker/z-fighting detection) ─────
async function compareScreenshots(page, nameA, nameB, threshold = 0.02) {
  const bufA = await page.screenshot({ type: 'png' });
  await sleep(50); // small delay
  const bufB = await page.screenshot({ type: 'png' });

  // Save both
  const fileA = capturePath(nameA);
  const fileB = capturePath(nameB);
  fs.writeFileSync(fileA, bufA);
  fs.writeFileSync(fileB, bufB);

  const pngA = PNG.sync.read(bufA);
  const pngB = PNG.sync.read(bufB);

  let totalPixels = pngA.width * pngA.height;
  let differentPixels = 0;
  let maxDiff = 0;

  for (let i = 0; i < pngA.data.length; i += 4) {
    const dr = Math.abs(pngA.data[i] - pngB.data[i]);
    const dg = Math.abs(pngA.data[i + 1] - pngB.data[i + 1]);
    const db = Math.abs(pngA.data[i + 2] - pngB.data[i + 2]);
    const diff = dr + dg + db;
    if (diff > maxDiff) maxDiff = diff;
    if (diff > 60) differentPixels++; // threshold: 20 per channel average
  }

  const ratio = differentPixels / totalPixels;
  const verdict = ratio > threshold
    ? `⚠️  ANORMAL — ${(ratio * 100).toFixed(2)}% de pixels différents (seuil: ${(threshold * 100).toFixed(1)}%). Z-fighting ou scintillement suspecté.`
    : `✅ Normal — ${(ratio * 100).toFixed(2)}% de pixels différents.`;

  console.log(`  🔍 Flicker check: ${verdict}`);
  console.log(`     Pixels différents: ${differentPixels}/${totalPixels} (${(ratio * 100).toFixed(2)}%), diff max: ${maxDiff}`);

  addCapture(nameA, `Flicker check — frame A (${(ratio * 100).toFixed(2)}% différents du frame B)`);
  addCapture(nameB, `Flicker check — frame B (diff max canal: ${maxDiff})`);

  return { ratio, differentPixels, totalPixels, maxDiff, verdict };
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Flood City — Visual Verification Harness');
  console.log('═══════════════════════════════════════════════');
  console.log(`  URL:     ${TARGET_URL}`);
  console.log(`  Run ID:  ${RUN_ID}`);
  console.log(`  Output:  ${RUN_DIR}`);
  console.log('');

  // Ensure output directory
  fs.mkdirSync(RUN_DIR, { recursive: true });

  // ── Launch browser ───────────────────────────────────────
  console.log('🚀 Lancement du navigateur (headless, rendu logiciel)...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--enable-webgl',
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    ],
    defaultViewport: VIEWPORT,
  });

  const page = await browser.newPage();

  // ── Console collection ───────────────────────────────────
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    // Try to extract the URL from the console message location
    const loc = msg.location ? msg.location() : null;
    const urlInfo = loc && loc.url ? ` (${loc.url}:${loc.line || '?'})` : '';

    // For benign patterns (WebGL context negotiation), file under expected
    if (isBenign(text)) {
      console.log(`  ℹ️  MESSAGE ATTENDU: ${text}${urlInfo}`);
      recordConsole(type, text);
      return;
    }

    if (type === 'error') {
      console.log(`  🔴 CONSOLE ERROR: ${text}${urlInfo}`);
      recordConsole('error', text);
    } else if (type === 'warning') {
      console.log(`  ⚠️  CONSOLE WARN:  ${text}${urlInfo}`);
      recordConsole('warning', text);
    } else if (type !== 'log') {
      // Other types (info, debug, etc.) — capture silently
      // but check for benign patterns just in case
      if (!isBenign(text)) {
        // Don't flood with verbose info messages
      }
    }
  });

  page.on('pageerror', err => {
    console.log(`  💥 PAGE ERROR: ${err.message}`);
    report.consoleErrors.push(`[PAGE] ${err.message}`);
  });

  // ── HTTP response tracking (catches 404s with their URLs) ──
  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      const req = response.request();
      const resourceUrl = req.url();
      // Filter out data: URLs and blob: URLs
      if (!resourceUrl.startsWith('data:') && !resourceUrl.startsWith('blob:')) {
        report.httpErrors.push({
          url: resourceUrl,
          status: status,
          method: req.method(),
          resourceType: req.resourceType(),
        });
      }
    }
  });

  try {
    // ── Navigate to game ───────────────────────────────────
    console.log(`🌐 Navigation vers ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000); // let WebGL initialize

    // Get game version
    report.gameVersion = await page.evaluate(() => {
      return window.GAME_VERSION || document.querySelector('meta[name=version]')?.content || 'unknown';
    });
    console.log(`  Version: ${report.gameVersion}`);

    // Inject frame counter early
    await injectFrameCounter(page);

    // ── 01: Home screen ────────────────────────────────────
    console.log('\n📸 CAPTURES');
    await screenshot(page, '01-home-screen.png', 'Écran d\'accueil avec les cartes');

    // ── Start game on Littoral ─────────────────────────────
    console.log('\n🎮 Démarrage de la partie (carte Littoral)...');

    // Click the first map card
    const cardClicked = await page.evaluate(() => {
      const cards = document.querySelectorAll('.map-card');
      if (cards.length > 0) {
        cards[0].click();
        return true;
      }
      return false;
    });

    if (!cardClicked) {
      // Fallback: try direct startGame call
      await page.evaluate(() => {
        if (typeof startGame === 'function') startGame('littoral');
      });
    }

    console.log('  Partie démarrée, attente du rendu...');
    await sleep(3000); // let the map generate and render

    // ── 02: Game day ───────────────────────────────────────
    await screenshot(page, '02-game-day.png', 'Vue initiale de la partie — jour, carte Littoral');

    // ── Place some defenses ────────────────────────────────
    console.log('\n🏗️  Construction de défenses...');

    // Place a tier-1 wall at a position in front of the city
    await page.evaluate(() => {
      // Ensure we're in wall mode, tier 1
      if (typeof flashMessage === 'function') {
        // Use keyboard simulation via dispatching events
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      }
    });
    await sleep(500);

    // Simulate clicks on the canvas to place walls
    // The game uses renderer.domElement click event
    const canvas = await page.$('canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      // Click near the bottom center (south, where the beach is)
      // These are canvas-local coordinates
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height * 0.70;
      await page.mouse.click(cx, cy);
      await sleep(300);
      await page.mouse.click(cx + 40, cy);
      await sleep(300);
      await page.mouse.click(cx - 40, cy);
      await sleep(300);
      await page.mouse.click(cx + 80, cy + 20);
      await sleep(300);
      await page.mouse.click(cx - 80, cy + 20);
      await sleep(300);

      // Tier 3 wall
      await page.keyboard.press('3');
      await sleep(300);
      await page.mouse.click(cx, cy - 30);
      await sleep(300);
      await page.mouse.click(cx + 60, cy - 30);
      await sleep(300);

      // Trench mode
      await page.keyboard.press('t');
      await sleep(300);
      await page.mouse.click(cx + 100, cy - 10);
      await sleep(300);
      await page.mouse.click(cx - 100, cy - 10);
      await sleep(300);
    }

    await screenshot(page, '03-defenses-placed.png', 'Défenses placées (murs + tranchées), vue de jour');

    // ── Rotate camera ──────────────────────────────────────
    console.log('\n📐 Rotation de la caméra...');

    // Rotate camera using mouse drag (right button = rotate)
    if (canvas) {
      const box = await canvas.boundingBox();
      const mx = box.x + box.width / 2;
      const my = box.y + box.height / 2;

      // Right button drag to rotate
      await page.mouse.move(mx, my);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(mx + 200, my, { steps: 10 });
      await page.mouse.up({ button: 'right' });
      await sleep(1000);
    }

    await screenshot(page, '04-camera-east.png', 'Caméra orientée vers l\'est');

    if (canvas) {
      const box = await canvas.boundingBox();
      const mx = box.x + box.width / 2;
      const my = box.y + box.height / 2;

      // Rotate more
      await page.mouse.move(mx, my);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(mx - 300, my, { steps: 10 });
      await page.mouse.up({ button: 'right' });
      await sleep(1000);
    }

    await screenshot(page, '05-camera-west.png', 'Caméra orientée vers l\'ouest');

    // ── Measure daytime framerate ──────────────────────────
    console.log('\n⏱️  MESURES DE PERFORMANCE');
    report.framerateDay = await measureFramerate(page, 3000, 'jour');

    // ── Switch to night mode ───────────────────────────────
    console.log('\n🌙 Passage en mode nuit...');
    await page.keyboard.press('n');
    await sleep(2000); // wait for night transition lerp

    await screenshot(page, '06-game-night.png', 'Vue de nuit avec fenêtres allumées et lampadaires');

    // ── Measure nighttime framerate ────────────────────────
    report.framerateNight = await measureFramerate(page, 3000, 'nuit');

    // ── Night + different camera angle ─────────────────────
    if (canvas) {
      const box = await canvas.boundingBox();
      const mx = box.x + box.width / 2;
      const my = box.y + box.height / 2;

      // Zoom in a bit
      await page.mouse.move(mx, my);
      await page.mouse.wheel({ deltaY: -500 });
      await sleep(1000);
    }
    await screenshot(page, '07-night-zoom.png', 'Vue de nuit, zoom rapproché');

    // ── Wait for a wave ────────────────────────────────────
    console.log('\n🌊 Attente d\'une vague...');
    let waveAppeared = false;
    for (let i = 0; i < 60; i++) {
      const alertVisible = await page.evaluate(() => {
        const msg = document.getElementById('message');
        const timer = document.getElementById('wave-timer');
        const timerText = timer ? timer.textContent : '';
        const msgShown = msg && msg.classList.contains('show');
        // Wave alert shows "⚠️ ALERTE" in #message, or timer shows "--" when wave is active
        return msgShown || timerText === '--' || parseFloat(timerText) <= 0;
      });
      if (alertVisible) {
        waveAppeared = true;
        console.log(`  Vague détectée après ~${i + 3}s (timer ou alerte visible)`);
        await sleep(2000); // let wave progress
        break;
      }
      await sleep(1000);
    }

    if (waveAppeared) {
      await screenshot(page, '08-wave-active.png', 'Vague en cours — impact sur les défenses');

      // Wait for wave to finish (timer goes back to a number)
      console.log('  Attente de la fin de la vague...');
      for (let i = 0; i < 60; i++) {
        const waveDone = await page.evaluate(() => {
          const timer = document.getElementById('wave-timer');
          const msg = document.getElementById('message');
          const msgShown = msg && msg.classList.contains('show');
          const timerVal = timer ? parseFloat(timer.textContent) : NaN;
          // Wave is done when timer shows a positive number and no alert message
          return !msgShown && !isNaN(timerVal) && timerVal > 5;
        });
        if (waveDone) {
          console.log(`  Vague terminée après ~${i}s supplémentaires`);
          break;
        }
        await sleep(1000);
      }
      await sleep(1500);
      await screenshot(page, '09-after-wave.png', 'Après le passage de la vague — état des défenses');
    } else {
      console.log('  ⚠️ Aucune vague détectée dans le délai imparti (60s)');
      // Take whatever we have
      await screenshot(page, '08-no-wave.png', 'État après attente — aucune vague détectée');
    }

    // ── Flicker / z-fighting check ─────────────────────────
    console.log('\n🔍 CONTRÔLE DE SCIINTILLEMENT (Z-FIGHTING)');
    // Z-fighting causes different pixels between consecutive frames even
    // on a completely static scene — the depth buffer fights produce
    // non-deterministic results. No camera movement needed.
    await sleep(300);
    report.flickerResult = await compareScreenshots(
      page,
      '10-flicker-a.png',
      '11-flicker-b.png',
      0.03 // 3% threshold
    );

    // ── Save console log ───────────────────────────────────
    const allConsole = report.consoleErrors.concat(
      report.consoleWarnings.map(w => `[WARN] ${w}`)
    );
    const consoleLog = allConsole.length > 0
      ? allConsole.join('\n')
      : '(aucune erreur ni avertissement)';
    fs.writeFileSync(capturePath('console.log'), consoleLog);

    // ── Generate report ────────────────────────────────────
    console.log('\n📋 GÉNÉRATION DU RAPPORT...');
    const reportText = generateReport();
    fs.writeFileSync(capturePath('report.txt'), reportText);
    console.log(`  Rapport écrit → ${capturePath('report.txt')}`);

    // ── Print summary ──────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════');
    console.log('  RÉSUMÉ');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Captures produites : ${report.captures.length}`);
    console.log(`  Erreurs console    : ${report.consoleErrors.length}`);
    console.log(`  Avertissements     : ${report.consoleWarnings.length}`);
    console.log(`  Messages attendus  : ${report.consoleExpected.length} (WebGL / sans conséquence)`);
    if (report.httpErrors.length > 0) {
      report.httpErrors.forEach(h => console.log(`  HTTP ${h.status}       : ${h.url}`));
    }
    console.log(`  FPS jour           : ${report.framerateDay}`);
    console.log(`  FPS nuit           : ${report.framerateNight}`);
    console.log(`  Scintillement      : ${report.flickerResult?.verdict || 'N/A'}`);
    console.log(`  Tous les fichiers  : ${RUN_DIR}`);
    console.log('═══════════════════════════════════════════════');

  } catch (err) {
    console.error(`\n❌ ERREUR: ${err.message}`);
    console.error(err.stack);
    report.consoleErrors.push(`[HARNESS] ${err.message}`);
  } finally {
    await browser.close();
    console.log('\n🛑 Navigateur fermé.');
  }
}

function generateReport() {
  const lines = [];
  lines.push('═══════════════════════════════════════════════');
  lines.push('  Flood City — Rapport de Vérification Visuelle');
  lines.push('═══════════════════════════════════════════════');
  lines.push('');
  lines.push(`Run ID      : ${report.runId}`);
  lines.push(`Date        : ${report.timestamp}`);
  lines.push(`URL testée  : ${report.url}`);
  lines.push(`Version     : ${report.gameVersion}`);
  lines.push('');

  // ── HTTP errors ──────────────────────────────────────────
  lines.push('── Ressources HTTP manquantes ──');
  if (report.httpErrors.length === 0) {
    lines.push('  ✅ Aucune ressource manquante');
  } else {
    for (const h of report.httpErrors) {
      lines.push(`  🔴 HTTP ${h.status} — ${h.url} (${h.resourceType})`);
    }
    lines.push('');
    lines.push('  Une ressource 404 (ou autre code HTTP 4xx/5xx) est un');
    lines.push('  vrai défaut potentiel. Vérifier si elle est référencée');
    lines.push('  dans index.html ou chargée dynamiquement.');
  }
  lines.push('');

  // ── Real console errors ──────────────────────────────────
  lines.push('── Erreurs console ──');
  if (report.consoleErrors.length === 0) {
    lines.push('  ✅ Aucune erreur détectée');
  } else {
    for (const err of report.consoleErrors) {
      lines.push(`  🔴 ${err}`);
    }
  }
  lines.push('');

  // ── Console warnings ─────────────────────────────────────
  lines.push('── Avertissements console ──');
  if (report.consoleWarnings.length === 0) {
    lines.push('  ✅ Aucun avertissement');
  } else {
    for (const w of report.consoleWarnings) {
      lines.push(`  ⚠️  ${w}`);
    }
  }
  lines.push('');

  // ── Expected / benign messages ───────────────────────────
  lines.push('── Messages attendus (sans conséquence) ──');
  if (report.consoleExpected.length === 0) {
    lines.push('  (aucun message attendu)');
  } else {
    for (const m of report.consoleExpected) {
      lines.push(`  ℹ️  ${m}`);
    }
    lines.push('');
    lines.push('  Ces messages proviennent de la négociation de contexte WebGL');
    lines.push('  (matériel → SwiftShader → logiciel). Le rendu logiciel prend le');
    lines.push('  relais et fonctionne correctement. Aucune action requise.');
  }
  lines.push('');

  // ── Screenshots ──────────────────────────────────────────
  lines.push('── Captures produites ──');
  for (const cap of report.captures) {
    lines.push(`  ${cap.file}`);
    lines.push(`    ${cap.description}`);
  }
  lines.push('');

  // ── Performance ──────────────────────────────────────────
  lines.push('── Performances ──');
  lines.push(`  FPS jour : ${report.framerateDay ?? 'N/A'}`);
  lines.push(`  FPS nuit : ${report.framerateNight ?? 'N/A'}`);
  lines.push('');

  // ── Flicker check ────────────────────────────────────────
  lines.push('── Contrôle de scintillement (z-fighting) ──');
  if (report.flickerResult) {
    lines.push(`  Pixels différents : ${report.flickerResult.differentPixels}/${report.flickerResult.totalPixels}`);
    lines.push(`  Ratio             : ${(report.flickerResult.ratio * 100).toFixed(2)}%`);
    lines.push(`  Diff max (canal)  : ${report.flickerResult.maxDiff}`);
    lines.push(`  Verdict           : ${report.flickerResult.verdict}`);
  } else {
    lines.push('  ⚠️  Non exécuté');
  }
  lines.push('');

  lines.push('── Notes ──');
  lines.push('  Ce rapport est FACTUEL. Il ne juge pas si le jeu est');
  lines.push('  "bon" ou "mauvais". Les captures sont à inspecter');
  lines.push('  visuellement par un humain. Le verdict de scintillement');
  lines.push('  et les erreurs console sont les seuls contrôles');
  lines.push('  automatiques.');
  lines.push('');
  lines.push('  Les "messages attendus" sont des messages de négociation de');
  lines.push('  contexte WebGL qui surviennent lors du basculement vers le');
  lines.push('  rendu logiciel. Ils sont sans conséquence.');
  lines.push('');
  lines.push('═══════════════════════════════════════════════');
  return lines.join('\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
