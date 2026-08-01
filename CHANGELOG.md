# Changelog

All notable changes to Flood City are documented in this file.

## [2026.08.002] — 2026-08-01

### Changed
- Île entièrement refaite : bien plus grande, littoral irrégulier, campagne dominante autour de la ville
- Correction de l'affichage du sol de l'île, qui pouvait ne pas apparaître
- Possibilité de rejouer exactement la même carte avec le paramètre `?seed=`

### Added
- Harnais de vérification visuelle (18 assertions de pixels, captures, rapport)
- Banc d'essai d'équilibrage (`sim-balance.mjs`)

## [2026.08.001] — 2026-08-01

### Changed
- Port d'écoute par défaut passé de 8080 à 8002 (README, visual-harness)
- Version du jeu mise à jour dans index.html (GAME_VERSION), version.json et visual-harness/package.json
- README enrichi : section configuration, lien vers les releases GitHub

### Added
- Fichier VERSION à la racine (2026.08.001)
- CHANGELOG.md
- Section configuration dans le README

### Fixed
- Alignement des versions entre index.html, version.json et package.json

## [2026.07.013] — 2026-07-29

### Changed
- Île élargie au littoral irrégulier
- Génération déterministe par graine (?seed=)

### Fixed
- Corrections d'affichage du sol
