# Consignes pour Claude

## Langue

Répondre et rédiger (commits, pull requests, commentaires du code) en français.

## Fusion des modifications

Le propriétaire du dépôt autorise Claude à fusionner lui-même ses pull requests dans `main`, sans attendre de validation :

1. Travailler sur une branche dédiée, puis ouvrir une pull request.
2. Avant de fusionner, vérifier que `npm run build` passe et que la pull request ne présente ni conflit ni commentaire en attente.
3. Fusionner, puis vérifier que le workflow « Publier sur GitHub Pages » réussit.
4. Signaler le résultat et l'adresse : https://laurent-67370.github.io/avatar-3d-viewer/

Si le build échoue, si un conflit apparaît ou si une modification est importante ou ambiguë, demander avant de fusionner.

## Projet

- Visionneuse Three.js + Vite : `index.html`, `src/scene.js`.
- Modèles : `public/avatar.glb` (version web, compressée Meshopt + WebP, nécessite `MeshoptDecoder`) et `public/avatar-standard.glb` (GLB standard sans compression pour le téléchargement ; orienté +Z, posé à y = 0, 60 cm de haut, voir `scripts/place-for-ar.mjs`) et `public/avatar-ar.glb` (version allégée pour Scene Viewer).
- Réalité augmentée : WebXR dans la page sur Android (Scene Viewer en secours), USDZ généré à la volée pour AR Quick Look sur iPhone (`src/scene.js`).
- Deuxième avatar sur une page séparée : `avatar-2/index.html`, fichiers dans `public/avatar-2/`, page déclarée dans `vite.config.js` (https://laurent-67370.github.io/avatar-3d-viewer/avatar-2/).
- Publication automatique sur GitHub Pages à chaque modification de `main` (`.github/workflows/deploy.yml`).
