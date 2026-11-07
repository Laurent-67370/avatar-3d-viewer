# Avatar 3D — Visionneuse interactive

Visionneuse web d'un avatar 3D (buste) créé à partir d'une photo : rotation à 360°, zoom, vues guidées (face, profil, dos), rotation automatique, plein écran et navigation au clavier.

Construite avec [Three.js](https://threejs.org/) et [Vite](https://vite.dev/).

## En ligne

https://laurent-67370.github.io/avatar-3d-viewer/

La page est republiée automatiquement à chaque modification de la branche `main` (workflow `.github/workflows/deploy.yml`).

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
| `public/avatar.glb` | Affiché dans la page | ~1,5 Mo | 50 000 | WebP 2048, compression Meshopt |
| `public/avatar-standard.glb` | Bouton « Télécharger le 3D » et réalité augmentée Android | ~7,6 Mo | 100 000 | JPEG/PNG 2048, sans compression |

- `avatar.glb` est compressé pour un chargement rapide : le chargeur de la page utilise `MeshoptDecoder`, indispensable pour le lire.
- `avatar-standard.glb` n'utilise aucune extension : il s'ouvre dans la plupart des logiciels et visionneuses 3D. Il est tourné face à l'axe +Z, posé à y = 0 et mis à l'échelle à 60 cm de haut, comme l'attendent les visionneuses de réalité augmentée.

Fichiers produits avec [glTF-Transform](https://gltf-transform.dev/) à partir du modèle d'origine (11,8 Mo) :

```bash
gltf-transform weld source.glb a.glb

# Version web
gltf-transform simplify a.glb b.glb --ratio 0.25 --error 0.0005
gltf-transform resize b.glb c.glb --width 2048 --height 2048
gltf-transform webp c.glb d.glb --quality 88
gltf-transform meshopt d.glb avatar.glb

# Version standard
gltf-transform simplify a.glb s1.glb --ratio 0.5 --error 0.0005
gltf-transform resize s1.glb s2.glb --width 2048 --height 2048
gltf-transform jpeg s2.glb s3.glb --quality 90
node scripts/place-for-ar.mjs s3.glb avatar-standard.glb 0.6   # orientation, sol, échelle
```

## Réalité augmentée

Le bouton « Voir chez moi (AR) » n'apparaît que sur smartphone ou tablette :

- **Android** : ouvre la visionneuse 3D intégrée de Google (Scene Viewer) avec `avatar-standard.glb`. En réalité augmentée si le téléphone le permet, sinon en 3D plein écran.
- **iPhone / iPad** : génère un fichier USDZ dans la page (`USDZExporter` de Three.js) et l'ouvre avec AR Quick Look.

## Commandes clavier

Sur le modèle : flèches pour tourner, `+` / `-` pour zoomer, `R` pour recentrer, `Espace` pour la rotation automatique.
