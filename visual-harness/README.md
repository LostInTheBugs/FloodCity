# 🌊 Flood City — Visual Verification Harness

Harnais de vérification visuelle pour Flood City. Lance le jeu dans un navigateur
headless, le pilote, et produit des captures d'écran, des mesures de performance
et un contrôle de scintillement.

## Principe

Le harnais ne juge pas. Il **produit des preuves** : des captures qu'un humain
regarde, des chiffres qu'il lit. La seule exception : les erreurs console et
le contrôle de scintillement, qui donnent un verdict automatique.

## Dépendances

- Node.js ≥ 22
- npm

Le harnais installe Puppeteer (navigateur Chromium headless) et pngjs dans
son propre `node_modules/`, isolé du jeu.

## Installation

```bash
cd visual-harness
npm install
```

## Utilisation

```bash
# 1. Servir le jeu (dans un autre terminal)
cd /home/administrator/floodcity
python3 -m http.server 8080

# 2. Lancer le harnais
cd visual-harness
node harness.js [URL]

# URL par défaut : http://localhost:8080
```

### Tester la production

```bash
node harness.js https://games.cloudfr.net/floodcity/
```

## Ce que le harnais fait

1. Lance Chromium en headless avec rendu logiciel (SwiftShader)
2. Navigue vers le jeu
3. Capture l'écran d'accueil
4. Sélectionne la carte "Littoral"
5. Place des défenses : murs tiers 1 et 3, tranchées
6. Capture la vue de jour
7. Fait pivoter la caméra (vue est, vue ouest)
8. Mesure le framerate de jour
9. Passe en mode nuit et capture
10. Mesure le framerate de nuit
11. Attend le passage d'une vague et capture
12. Effectue le contrôle de scintillement (deux captures très proches comparées pixel par pixel)
13. Génère un rapport `report.txt`

## Sorties

Toutes les sorties vont dans `captures/YYYY-MM-DD_HHmmss/` :

```
captures/2026-07-28_14-30-00/
├── 01-home-screen.png      Écran d'accueil
├── 02-game-day.png          Vue initiale de la partie
├── 03-defenses-placed.png   Défenses placées
├── 04-camera-east.png       Caméra vers l'est
├── 05-camera-west.png       Caméra vers l'ouest
├── 06-game-night.png        Mode nuit
├── 07-night-zoom.png        Nuit, zoom rapproché
├── 08-wave-active.png       Vague en cours
├── 09-after-wave.png        Après la vague
├── 10-flicker-a.png         Contrôle scintillement A
├── 11-flicker-b.png         Contrôle scintillement B
├── console.log              Erreurs et avertissements
└── report.txt               Rapport complet
```

## Interprétation des résultats

- **Captures** : à regarder une par une. La caméra est-elle bien orientée ?
  Les défenses sont-elles visibles ? La nuit est-elle correcte ?
- **FPS** : en dessous de 30 FPS → problème de performance. En dessous de 15 → critique.
- **Console** : le rapport distingue trois catégories :
  - **Erreurs réelles** (🔴) — à investiguer
  - **Avertissements** (⚠️) — à surveiller
  - **Messages attendus** (ℹ️) — messages de négociation WebGL sans conséquence, rangés séparément pour ne pas polluer les vraies erreurs
- **Ressources HTTP manquantes** : codes 4xx/5xx détectés, avec URL complète.
- **Scintillement** : si le ratio de pixels différents dépasse 3%, il y a
  probablement du z-fighting. Regarder `10-flicker-a.png` et `11-flicker-b.png`
  côte à côte.

## Versionnement

Les captures sont dans `.gitignore`, elles ne seront jamais commitées.
Le harnais lui-même est versionné normalement.
