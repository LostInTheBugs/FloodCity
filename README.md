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

## 📝 Repo

https://github.com/LostInTheBugs/FloodCity
