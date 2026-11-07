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
| `public/avatar.glb` | Affiché dans la page | ~1,5 Mo | 50 000 | WebP 2048 |
| `public/avatar-hd.glb` | Bouton « Télécharger le 3D (HD) » | ~4,3 Mo | 200 000 | WebP 4096 |

Les deux fichiers sont compressés avec Meshopt et des textures WebP (fichier d'origine : 11,8 Mo). Ils ont été produits avec [glTF-Transform](https://gltf-transform.dev/) :

```bash
# Version web
gltf-transform weld source.glb a.glb
gltf-transform simplify a.glb b.glb --ratio 0.25 --error 0.0005
gltf-transform resize b.glb c.glb --width 2048 --height 2048
gltf-transform webp c.glb d.glb --quality 88
gltf-transform meshopt d.glb avatar.glb

# Version HD
gltf-transform webp source.glb h.glb --quality 92
gltf-transform meshopt h.glb avatar-hd.glb
```

Le chargeur utilise `MeshoptDecoder` : il est indispensable pour lire ces fichiers.

## Commandes clavier

Sur le modèle : flèches pour tourner, `+` / `-` pour zoomer, `R` pour recentrer, `Espace` pour la rotation automatique.
