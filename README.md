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
python3 -m http.server 8080
# → http://localhost:8080
```

Déployé sur https://games.cloudfr.net/floodcity/

## ⚠️ Cohérence au déploiement

Le fichier `version.json` (servi à côté de `index.html`) doit être déployé **en même temps** que `index.html` et porter la même version que `GAME_VERSION`. Si les deux divergent, le bandeau de mise à jour s'affichera en boucle.

Avant chaque déploiement, vérifier :
```bash
# Affiche les deux versions côte à côte
grep "const GAME_VERSION" index.html && cat version.json
```

Les champs `version` (dans `version.json`) et `GAME_VERSION` (dans `index.html`) doivent être identiques.

## 📋 Notes de version

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

## 📝 Repo

https://github.com/LostInTheBugs/FloodCity
