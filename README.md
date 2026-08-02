# 🌊 Flood City

Jeu 3D de protection contre les inondations — construisez des murs, creusez des tranchées et protégez votre ville des vagues destructrices.

## 🎮 Comment jouer

| Contrôle | Action |
|---|---|
| 🖱️ **Clic gauche** | Placer la structure courante (mur ou tranchée) |
| 🖱️ **Clic droit + glisser** | Pivoter la caméra |
| 🖱️ **Molette** | Zoomer |
| ⌨️ **1 / 2 / 3** | Choisir le tier de mur |
| ⌨️ **T** | Basculer mode tranchée |
| ⌨️ **R** | Recommencer la partie |

Un **ghost vert** apparaît à l'emplacement visé — rouge si le placement est invalide (bâtiment, mur existant, ressources insuffisantes).

## ⚙️ Mécaniques

### Défenses
| Type | Coût | HP | Touche |
|---|---|---|---|
| 🧱 Sac de sable | 10☼ | 100 | `1` |
| 🛡️ Renforcé | 25☼ | 300 | `2` |
| 🏗️ Béton | 50☼ | 600 | `3` |
| 🕳️ Tranchée | 5☼ | 40 | `T` |

Les tranchées infligent 8 dégâts/seconde aux vagues mais s'épuisent au contact. Les murs bloquent les segments de vague adjacents — une digue continue arrête tout, un mur isolé ouvre une brèche.

### Vagues
- Arrivent toutes les 8-22 secondes à des positions horizontales aléatoires
- Segmentées en tronçons de 1 mètre — chaque segment peut être arrêté indépendamment
- Difficulté progressive sur 5 vagues (largeur, hauteur, vitesse, HP)
- Alerte visuelle 10 secondes avant l'impact

### Économie
- **150 ressources** au départ
- Régénération passive : **1.0☼/seconde** (cap : 300)
- Bonus par vague survécue : **15-25☼** + **10-30 points**
- Score cumulatif — ne fait que monter si vous défendez bien

### Game over
- Si ≤ 5 bâtiments survivants

## 🛠️ Tech

- [Three.js](https://threejs.org/) r160 (CDN importmap)
- Single-file HTML (~1400 lignes)
- Desktop uniquement (WebGL + souris recommandés)

## 🚀 Lancer

```bash
# Direct
open index.html

# Ou servir en local
python3 -m http.server 8002
# → http://localhost:8002
```

Déployé sur https://games.cloudfr.net/floodcity/

## ⚙️ Configuration

Le projet est un fichier HTML statique servi avec Three.js en CDN. Aucune dépendance à installer.

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `8002` | Port d'écoute du serveur HTTP local (surchargeable) |

Dépendances : navigateur récent avec WebGL, [Three.js](https://threejs.org/) r160 (CDN importmap).

## ⚠️ Cohérence au déploiement

Le fichier `version.json` (servi à côté de `index.html`) doit être déployé **en même temps** que `index.html` et porter la même version que `GAME_VERSION`. Si les deux divergent, le bandeau de mise à jour s'affichera en boucle.

Avant chaque déploiement, vérifier :
```bash
# Affiche les deux versions côte à côte
grep "const GAME_VERSION" index.html && cat version.json
```

Les champs `version` (dans `version.json`) et `GAME_VERSION` (dans `index.html`) doivent être identiques.

## 🔬 Harnais de vérification visuelle

Le projet inclut un harnais de test automatisé dans `visual-harness/`. Il lance le jeu dans un navigateur headless, place des défenses, capture des écrans de jour et de nuit, mesure les performances et détecte le scintillement (z-fighting). Consulter [`visual-harness/README.md`](visual-harness/README.md) pour l'installation et l'utilisation.

### Interface de vérification exposée dans `index.html`

Le fichier livré expose volontairement un petit bloc d'API destiné exclusivement au harnais. Ces fonctions sont regroupées sous un commentaire explicite dans le code source, avec le préfixe `harness_` :

| Fonction | Rôle | Lecture / Écriture |
|---|---|---|
| `harness_camTopdown(maxDist, phi)` | Positionne la caméra en vue quasi-verticale | ✏️ Écrit la position de la caméra uniquement |
| `harness_camState()` | Retourne position + cible de la caméra | 📖 Lecture seule |
| `harness_unprojectScreen(sx, sy, worldY)` | Projette des coordonnées écran → monde | 📖 Lecture seule |
| `harness_projectWorld(wx, wy, wz)` | Projette des coordonnées monde → écran | 📖 Lecture seule |
| Balise `<meta name="map-data">` | Données d'échelle de carte (terrainHalf, camMaxDist...) | 📖 Lecture seule |

**Périmètre :** positionnement de caméra, projection de coordonnées, lecture d'échelle de carte. Aucune de ces fonctions ne modifie l'état de jeu (bâtiments, ressources, vagues, score, etc.).

Ce bloc est accepté dans le fichier livré parce qu'il est nécessaire au fonctionnement du harnais de vérification et qu'il est strictement cantonné à son rôle — pas de dérive possible vers l'accès à l'état de jeu.

Pour contrôler qu'aucune autre interface de test ne s'est glissée :
```bash
grep -c "harness_" index.html    # doit donner le nombre de fonctions (4)
grep -c "window.__" index.html   # doit être à 0 (réservé au harnais en Puppeteer)
```

## 🌱 Graine déterministe

Ajoutez `?seed=` suivi d'un nombre à l'URL pour rejouer **exactement** la même carte :

```
https://games.cloudfr.net/floodcity/?seed=42
```

La graine contrôle la disposition de la ville, des bâtiments, du mobilier urbain et de la plage. Même graine = même carte, à chaque fois. Sans le paramètre, une carte aléatoire est générée comme avant. Pratique pour comparer des stratégies, partager une configuration ou reproduire un bug.

## 📋 Notes de version

### 2026.08.002
- Île entièrement refaite : bien plus grande, littoral irrégulier, campagne autour de la ville
- Correction de l'affichage du sol de l'île, qui pouvait ne pas apparaître
- Possibilité de rejouer exactement la même carte avec le paramètre `?seed=`
- Outillage interne : harnais de vérification visuelle et banc d'essai d'équilibrage

### 2026.08.001
- Mise en conformité : port par défaut 8002, création de VERSION et CHANGELOG, documentation enrichie

### 2026.07.013
- L'île est nettement plus grande, avec un littoral irrégulier, une vraie campagne autour de la ville et des rues moins envahissantes
- Il est possible de rejouer exactement la même carte en ajoutant `?seed=` suivi d'un nombre à l'adresse du jeu
- Corrections d'affichage sur l'île, dont le sol qui pouvait ne pas apparaître
- La génération est déterministe : même graine, même résultat à chaque chargement

### 2026.07.012
- Les habitants menacés se réfugient réellement dans les immeubles et en ressortent progressivement une fois le danger passé ; ceux dont l'immeuble est détruit ne reviennent pas
- Un parking en front de mer fait son apparition, sur lequel on peut construire
- Les vagues emportent désormais tout ce qui est posé : lampadaires et leurs halos, feux tricolores, parasols, transats, ballons — une zone dévastée s'éteint la nuit
- Les baigneurs allongés se lèvent et fuient à l'alerte, puis reviennent se rallonger une fois le danger passé
- Les revêtements — chaussée, trottoirs, marquages, parking — restent en place après le passage d'une vague

### 2026.07.011
- L'éclairage nocturne des lampadaires est adouci : les halos ne saturent plus la chaussée en blanc et l'ambiance bleutée de la nuit redevient dominante, pour une atmosphère plus naturelle
- Amélioration de la lisibilité du décor en mode nuit

### 2026.07.010
- **Changement de jeu majeur** : il est désormais possible de construire murs et tranchées sur toute la bande entre la ville et la mer, plage comprise — cette zone était bloquée par erreur alors qu'elle est le cœur de la défense en profondeur
- Un front de mer aménagé fait son apparition : promenade, garde-corps le long du sable, palmiers, mobilier — le tout traversable, on peut bâtir par-dessus
- Le décor de plage et les défenses cohabitent naturellement, sans plus jamais se bloquer mutuellement

### 2026.07.009
- Correction d'un scintillement des routes en mode nuit — la grille routière ne clignote plus lorsqu'on déplace la caméra
- Amélioration de la stabilité d'affichage des éléments au sol en conditions de faible luminosité

### 2026.07.008
- L'intervalle entre les vagues est allongé, laissant davantage de temps pour reconstruire et observer la ville respirer entre deux alertes
- Un mode jour/nuit activable avec la touche N : nuit claire de lune avec fenêtres allumées, lampadaires, phares et feux de camp sur la plage
- Le mobilier urbain s'enrichit : lampadaires le long des rues et feux tricolores de part et d'autre des carrefours
- Le réseau de rues est réorganisé en îlots plus grands, rendant les déplacements plus fluides et la ville plus lisible
- La forme des vagues est retravaillée — moins anguleuse, plus organique

### 2026.07.007
- La difficulté progresse sans plafond et les seuils de défaite s'adaptent à la taille de chaque carte — plus besoin de redémarrer après 5 vagues
- Les meilleurs scores sont conservés par carte et affichés au menu, pour suivre sa progression d'une session à l'autre
- La ville réagit aux alertes : voitures et piétons fuient la zone menacée, puis la vie reprend une fois le danger passé
- La plage prend vie — baigneurs, promeneurs, joueurs de ballon et marchands ambulants qui abandonnent leur chariot quand la sirène retentit
- Une boussole indique le nord et le front d'où arrive la prochaine vague, pour mieux anticiper ses défenses
- Décor à l'échelle et placement revu — aucun bâtiment ne se construit plus sur la chaussée, les trottoirs restent dégagés

### 2026.07.006
- Correction interne : la balise `<meta name="version">` n'est plus écrite en dur dans le HTML ; elle est remplie dynamiquement par le JavaScript depuis `GAME_VERSION`, rendant structurellement impossible la désynchronisation constatée entre les deux sources

### 2026.07.005
- Correction d'un bug d'affichage : un immeuble détruit par une vague ne restait plus visible à l'écran
- Détection automatique de nouvelle version : un bandeau discret propose de recharger quand une mise à jour est disponible, sans jamais interrompre la partie
- Bandeau de mise à jour non bloquant — le jeu continue pendant que la notification est affichée
- Échelle du décor unifiée — piétons, arbres, parasols, transats et baigneurs ramenés à des proportions réalistes
- Plage élargie avec davantage de mobilier, horizon marin sans bord visible sur les deux cartes
- Zone de frappe des vagues reculée, laissant plus de temps pour construire
- Trait de côte corrigé — le mobilier de plage ne se retrouve plus dans l'eau
- Feux tricolores, parasols et transats redimensionnés à des proportions réalistes
- Passages piétons alignés sur la largeur réelle de la chaussée

### 2026.07.002
- Écran d'accueil avec choix entre deux cartes : Littoral (ville en retrait de la plage) et Île (vagues alternant nord-sud)
- Numéro de version affiché dans le menu et le HUD

### 2026.07.001
- Vagues segmentées en tronçons indépendants, décentrées, avec difficulté progressive
- Trois tiers de murs (sac de sable, renforcé, béton) et tranchées qui ralentissent les vagues
- Ghost de prévisualisation, score progressif, économie à régénération passive
- Ville générée avec routes, trottoirs, voitures, piétons, plage et mobilier de plage
- Corrections : écran noir au démarrage, fuite mémoire au restart

> **Rappel :** le fichier `version.json` doit être déployé avec `index.html` et porter la même version que `GAME_VERSION`.

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
