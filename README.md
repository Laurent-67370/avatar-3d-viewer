# Avatar 3D — Visionneuse interactive

Visionneuse web d'un avatar 3D (buste) créé à partir d'une photo : rotation à 360°, zoom, vues guidées (face, profil, dos), rotation automatique, plein écran et navigation au clavier.

Construite avec [Three.js](https://threejs.org/) et [Vite](https://vite.dev/).

## En ligne

https://laurent-67370.github.io/avatar-3d-viewer/

La page est republiée automatiquement à chaque modification de la branche `main` (workflow `.github/workflows/deploy.yml`).

## Deuxième avatar

Une page séparée présente un deuxième avatar : https://laurent-67370.github.io/avatar-3d-viewer/avatar-2/

- `avatar-2/index.html` : copie de la page principale (même `src/scene.js`) ;
- `public/avatar-2/` : ses fichiers `avatar.glb` (web, ~3,1 Mo, 48 000 triangles), `avatar-ar.glb` (~3,4 Mo), `avatar-standard.glb` (~7,6 Mo, 104 000 triangles) et `avatar-preview.png`, produits avec la même chaîne que ci-dessous ;
- `vite.config.js` déclare les deux pages (`rollupOptions.input`). Pour un avatar de plus : copier `avatar-2/`, ajouter ses fichiers dans `public/<dossier>/` et une entrée dans `vite.config.js`.

## Statue en bronze

Page séparée (sans lien depuis les avatars) : https://laurent-67370.github.io/avatar-3d-viewer/statue/

- `statue/index.html` : même visionneuse ; `public/statue/` : `avatar.glb` (web, 62 000 triangles, ~2,5 Mo), `avatar-ar.glb` (~4 Mo, textures 2048 pour garder la plaque lisible), `avatar-standard.glb` (124 000 triangles, ~6,4 Mo), `avatar-preview.png`.
- Plaque gravée « SÉBASTIEN HUSSER / Mr. Husser 2026 » directement dans la texture (projection de face du socle, texte dessiné, puis report dans la texture).
- Réglages par page sur `<main>` : `data-ar-height` (hauteur réelle en réalité augmentée, 0,45 m), `data-fit` (recul de la caméra, 1,3 pour un modèle en pied), `data-env-intensity` (reflets, 0,85 pour le bronze ; 0,3 par défaut pour la peau).

## Démarrer

```bash
npm install
npm run dev       # serveur de développement
npm run build     # version de production dans dist/
npm run preview   # prévisualiser dist/
```

## Fichiers du modèle

| Fichier | Usage | Poids | Triangles | Textures |
|---|---|---|---|---|
| `public/avatar.glb` | Affiché dans la page | ~2,7 Mo | 50 000 | WebP 2048, compression Meshopt |
| `public/avatar-ar.glb` | Réalité augmentée Android (Scene Viewer) | ~2,9 Mo | 50 000 | JPEG 1024, sans compression |
| `public/avatar-standard.glb` | Bouton « Télécharger le 3D » | ~6,9 Mo | 103 000 | JPEG 2048, sans compression |

- `avatar.glb` est compressé pour un chargement rapide : le chargeur de la page utilise `MeshoptDecoder`, indispensable pour le lire.
- `avatar-standard.glb` n'utilise aucune extension : il s'ouvre dans la plupart des logiciels et visionneuses 3D. Il est tourné face à l'axe +Z, posé à y = 0 et mis à l'échelle à 60 cm de haut, comme l'attendent les visionneuses de réalité augmentée.

Avatar généré à partir d'une photo (portrait stylisé, puis conversion image → 3D). Le modèle brut (16 Mo, 103 000 triangles, textures 2048) regarde +Z : il est d'abord tourné vers +X (sens attendu par la visionneuse) et sa texture émissive, entièrement noire, est supprimée. Fichiers produits ensuite avec [glTF-Transform](https://gltf-transform.dev/) :

```bash
gltf-transform weld source.glb a.glb

# Version web
gltf-transform simplify a.glb b.glb --ratio 0.3 --error 0.001
gltf-transform resize b.glb c.glb --width 2048 --height 2048
gltf-transform webp c.glb d.glb --quality 88
gltf-transform meshopt d.glb avatar.glb

# Version standard (maillage complet)
gltf-transform resize a.glb s2.glb --width 2048 --height 2048
gltf-transform jpeg s2.glb s3.glb --quality 90 --slots "*"   # puis normal map PNG → JPEG
node scripts/place-for-ar.mjs s3.glb avatar-standard.glb 0.6   # orientation, sol, échelle

# Version réalité augmentée (à partir de b.glb, 50 000 triangles)
gltf-transform resize b.glb r1.glb --width 1024 --height 1024
gltf-transform jpeg r1.glb r2.glb --quality 85 --slots "*"
node scripts/place-for-ar.mjs r2.glb avatar-ar.glb 0.6
```

## Réalité augmentée

Le bouton « Voir chez moi (AR) » n'apparaît que sur smartphone ou tablette :

- **Android** : réalité augmentée directement dans la page (WebXR, via « Google Play Services pour la RA ») : on vise une surface, on touche l'écran pour poser l'avatar, boutons ↺ / ↻ pour le tourner. Si WebXR est indisponible ou refusé, la page ouvre Scene Viewer avec `avatar-ar.glb` (via ARCore) ; certaines versions de l'application Google font planter Scene Viewer (`StackOverflowError` dans `ViewerActivity`), d'où cette priorité.
- **iPhone / iPad** : génère un fichier USDZ dans la page (`USDZExporter` de Three.js) et l'ouvre avec AR Quick Look.

Diagnostic : ajouter `?debug` à l'adresse affiche les dimensions vues par la page et, sur Android, l'état de WebXR et des boutons de test pour Scene Viewer (modèle de référence de Google, avatar en 3D seul, avatar standard).

## Commandes clavier

Sur le modèle : flèches pour tourner, `+` / `-` pour zoomer, `R` pour recentrer, `Espace` pour la rotation automatique.
