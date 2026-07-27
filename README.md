# 🌊 Flood City

Jeu 3D de protection contre les inondations — construisez des murs pour protéger votre ville des vagues destructrices.

## 🎮 Comment jouer

- **Clic gauche** sur le terrain : placer un mur de sacs de sable (coût : 10 ressources)
- **Clic droit + glisser** : pivoter la caméra
- **Molette** : zoomer
- **R** : recommencer la partie

## ⚙️ Mécaniques

- Les ressources se régénèrent lentement (0.3/s)
- Les vagues arrivent par intervalles de 14-22s
- La difficulté augmente avec le score
- Chaque bâtiment survivant = 1 point
- Game over si ≤ 5 bâtiments restent debout

## 🛠️ Tech

- [Three.js](https://threejs.org/) (CDN)
- Single-file HTML — ouvrez `index.html` dans votre navigateur

## 🚀 Lancer

```bash
# Option 1 : ouvrir directement
open index.html

# Option 2 : servir en local
python3 -m http.server 8080
# Puis ouvrir http://localhost:8080
```
