import { NodeIO, getBounds } from '@gltf-transform/core';
const [inp, out, targetH] = process.argv.slice(2);
const io = new NodeIO();
const doc = await io.read(inp);
const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
const node = scene.listChildren()[0];
const b = getBounds(scene);
const h = b.max[1] - b.min[1];
const s = Number(targetH) / h;
const c = [(b.min[0]+b.max[0])/2, (b.min[2]+b.max[2])/2];
// Rotation -90° autour de Y : le visage (+X) regarde +Z, sens attendu par les visionneuses AR.
// Composée avec la rotation éventuelle du nœud (modèle source déjà tourné vers +X).
const [qx, qy, qz, qw] = node.getRotation();
const [rx, ry, rz, rw] = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];
node.setRotation([
  rw * qx + rx * qw + ry * qz - rz * qy,
  rw * qy - rx * qz + ry * qw + rz * qx,
  rw * qz + rx * qy - ry * qx + rz * qw,
  rw * qw - rx * qx - ry * qy - rz * qz,
]);
node.setScale([s, s, s]);
// Après rotation : x' = -z, z' = x. On centre et on pose la base à y = 0.
node.setTranslation([c[1]*s, -b.min[1]*s, -c[0]*s]);
await io.write(out, doc);
const nb = getBounds(scene);
console.log('hauteur', h.toFixed(3), '-> echelle', s.toFixed(3), 'bornes', nb.min.map(v=>v.toFixed(3)), nb.max.map(v=>v.toFixed(3)));
