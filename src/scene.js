import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';

const stage = document.getElementById('stage');
const loading = document.getElementById('loading');
const loadingDetail = document.getElementById('loading-detail');
const progressBar = document.getElementById('progress-bar');
const errorOverlay = document.getElementById('error');
const poster = document.getElementById('poster');
const statusText = document.getElementById('status-text');
const autoRotateButton = document.getElementById('auto-rotate');
const resetButton = document.getElementById('reset-view');
const fullscreenButton = document.getElementById('fullscreen');
const arButton = document.getElementById('view-ar');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const captureMode = new URLSearchParams(location.search).has('capture');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchDevice = matchMedia('(pointer: coarse)').matches;

// Sur écran tactile, pas de molette : on adapte l'indication.
if (touchDevice) {
  document.getElementById('gesture-hint').textContent = 'Glissez pour tourner à 360° · Pincez pour zoomer';
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: captureMode,
    powerPreference: 'high-performance',
  });
} catch (error) {
  showError('WebGL est indisponible sur cet appareil.');
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, captureMode ? 1.5 : 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('role', 'application');
renderer.domElement.setAttribute('aria-label', 'Avatar 3D interactif. Faites glisser pour le faire pivoter.');
renderer.domElement.setAttribute('aria-describedby', 'keyboard-help');
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, stage.clientWidth / stage.clientHeight, 0.01, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !captureMode && !reducedMotion;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.rotateSpeed = 0.65;
controls.zoomSpeed = 0.8;
controls.autoRotateSpeed = 1.15;
controls.minPolarAngle = 0.18;
// Légèrement sous l'horizontale, jamais assez pour voir le dessous ouvert du buste.
controls.maxPolarAngle = Math.PI / 2 + 0.15;

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environmentTarget = pmrem.fromScene(room, 0.04);
scene.environment = environmentTarget.texture;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xe7f0ec, 0x29251f, 0.8));

const keyLight = new THREE.DirectionalLight(0xffedda, 2.3);
keyLight.position.set(3.5, 5.5, 4.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 5;
keyLight.shadow.camera.bottom = -2;
keyLight.shadow.bias = -0.0003;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xa9c8c0, 1.6);
rimLight.position.set(-4, 3.5, -4);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xdde7e2, 0.7);
fillLight.position.set(-3, 1.5, 4);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 64),
  new THREE.ShadowMaterial({ color: 0x050807, opacity: 0.25 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.025;
ground.receiveShadow = true;
scene.add(ground);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(1.05, 1.065, 96),
  new THREE.MeshBasicMaterial({ color: 0xd8a85f, transparent: true, opacity: 0.48, side: THREE.DoubleSide }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = -0.012;
scene.add(ring);

const avatar = new THREE.Group();
scene.add(avatar);

let model = null;
let sourceScene = null;
let target = new THREE.Vector3(0, 1.4, 0);
let viewDistance = 6;
let avatarSize = null;
let cameraTransition = null;
let ready = false;
let activeView = 'front';
let needsRender = true;
let lastFrameTime = null;

function showError(message) {
  loading.hidden = true;
  errorOverlay.hidden = false;
  statusText.textContent = 'Affichage 3D indisponible';
  const detail = errorOverlay.querySelector('p:not(.loader-title)');
  if (message && detail) detail.textContent = `${message} Vous pouvez réessayer ou télécharger directement le modèle.`;
  window.__SCENE_ERROR__ = message || 'Erreur de chargement';
}

function markActiveView(name) {
  activeView = name;
  viewButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  });
}

function positionForView(name) {
  const y = target.y + viewDistance * 0.025;
  // Le modèle généré est orienté vers +X : la caméra de face doit donc être sur cet axe.
  if (name === 'side') return new THREE.Vector3(0, y, viewDistance);
  if (name === 'back') return new THREE.Vector3(-viewDistance, y, 0);
  return new THREE.Vector3(viewDistance, y, 0);
}

function setView(name, immediate = false) {
  const destination = positionForView(name);
  markActiveView(name);
  if (immediate || captureMode || reducedMotion) {
    cameraTransition = null;
    camera.position.copy(destination);
    controls.target.copy(target);
    controls.update();
    renderer.render(scene, camera);
    return;
  }
  cameraTransition = {
    from: camera.position.clone(),
    to: destination,
    start: performance.now(),
    duration: 260,
  };
}

function setAutoRotate(enabled) {
  controls.autoRotate = enabled;
  autoRotateButton.setAttribute('aria-pressed', String(enabled));
  autoRotateButton.textContent = enabled ? 'Pause rotation' : 'Rotation auto';
  if (enabled) {
    cameraTransition = null;
    markActiveView('');
  }
}

function resetView() {
  setAutoRotate(false);
  setView('front');
}

function fitModel() {
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const initialCenter = initialBox.getCenter(new THREE.Vector3());
  const scale = 2.8 / Math.max(initialSize.y, 0.001);

  model.scale.setScalar(scale);
  model.position.set(
    -initialCenter.x * scale,
    -initialBox.min.y * scale + 0.02,
    -initialCenter.z * scale,
  );
  avatar.add(model);
  avatar.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(avatar);
  const size = box.getSize(new THREE.Vector3());
  avatarSize = size;
  target = new THREE.Vector3(0, size.y * 0.51, 0);
  controls.target.copy(target);
  updateFraming(false);

  const ringScale = Math.max(0.85, size.x * 0.43);
  ring.scale.setScalar(ringScale);
  renderer.shadowMap.needsUpdate = true;
  setView('front', true);
}

// Cadrage selon le format de l'écran. Sur un téléphone en portrait, l'avatar est un peu
// plus petit et remonté pour ne pas passer sous les boutons du bas.
function updateFraming(keepCamera = true) {
  if (!avatarSize) { camera.updateProjectionMatrix(); return; }
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const portrait = camera.aspect < 0.8;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const heightDistance = avatarSize.y / (2 * Math.tan(verticalFov / 2));
  const widthDistance = avatarSize.x / (2 * Math.tan(verticalFov / 2) * camera.aspect);
  const distance = Math.max(heightDistance, widthDistance) * (portrait ? 1.5 : 1.38);

  if (keepCamera) {
    // Conserve l'angle et le zoom relatif choisis par l'utilisateur.
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(distance / viewDistance);
    camera.position.copy(controls.target).add(offset);
  }
  viewDistance = distance;
  controls.minDistance = viewDistance * 0.48;
  controls.maxDistance = viewDistance * 1.8;

  if (portrait) camera.setViewOffset(width, height, 0, height * 0.09, width, height);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  controls.update();
}

function prepareMaterials() {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      if ('envMapIntensity' in material) material.envMapIntensity = 0.3;
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach((key) => {
        if (material[key]) material[key].anisotropy = Math.min(8, maxAnisotropy);
      });
      material.needsUpdate = true;
    });
  });
}

// Modèle compressé (Meshopt + textures WebP) : le décodeur est requis.
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.load(
  './avatar.glb',
  (gltf) => {
    model = gltf.scene;
    sourceScene = gltf.scene.clone();
    prepareMaterials();
    fitModel();
    ready = true;
    loading.hidden = true;
    poster.classList.add('loaded');
    statusText.textContent = 'Prêt · rotation 360°';

    controls.update();
    renderer.render(scene, camera);
    window.__SCENE_READY__ = true;

    if (!captureMode) {
      renderer.setAnimationLoop(animate);
    }
  },
  (event) => {
    if (event.lengthComputable && event.total > 0) {
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      progressBar.style.width = `${Math.max(8, percent)}%`;
      loadingDetail.textContent = `Chargement du modèle 3D texturé… ${percent} %`;
    } else {
      progressBar.style.width = '45%';
      loadingDetail.textContent = 'Chargement du modèle 3D texturé…';
    }
  },
  () => showError('Le fichier 3D n’a pas pu être chargé.'),
);

function animate(time) {
  const delta = lastFrameTime === null ? 0 : Math.min((time - lastFrameTime) / 1000, 0.1);
  lastFrameTime = time;
  if (cameraTransition) {
    const raw = Math.min(1, (time - cameraTransition.start) / cameraTransition.duration);
    const eased = 1 - Math.pow(1 - raw, 3);
    camera.position.lerpVectors(cameraTransition.from, cameraTransition.to, eased);
    if (raw >= 1) cameraTransition = null;
    needsRender = true;
  }
  controls.update(delta);
  // Rendu à la demande : aucune charge GPU lorsque la scène est immobile.
  if (needsRender) {
    renderer.render(scene, camera);
    needsRender = false;
  }
}

controls.addEventListener('change', () => { needsRender = true; });
controls.addEventListener('start', () => {
  cameraTransition = null;
  markActiveView('');
});

autoRotateButton.addEventListener('click', () => setAutoRotate(!controls.autoRotate));
resetButton.addEventListener('click', resetView);
viewButtons.forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

document.getElementById('retry').addEventListener('click', () => location.reload());

// --- Réalité augmentée -------------------------------------------------------
// Android : réalité augmentée dans la page (WebXR, via ARCore) en priorité ; à défaut,
// visionneuse de Google (Scene Viewer), dont certaines versions plantent sur certains téléphones.
// iPhone / iPad : AR Quick Look, qui exige un fichier USDZ généré ici à la volée.
const AR_HEIGHT = 0.6; // hauteur du buste posé sur la table, en mètres
const isAndroid = /android/i.test(navigator.userAgent);
const supportsQuickLook = document.createElement('a').relList?.supports?.('ar') === true;
let usdzUrl = null;

// Fichier allégé dédié à Scene Viewer (50 000 triangles, textures 1024) : chargement rapide.
// Par défaut, Scene Viewer est lancé via « Google Play Services pour la RA » (ARCore, mode ar_only) :
// certains téléphones (Xiaomi notamment) bloquent sur l'écran de chargement quand il passe par l'application Google.
const ARCORE = 'com.google.ar.core';
const GOOGLE_APP = 'com.google.android.googlequicksearchbox';

function openSceneViewer(file = new URL('./avatar-ar.glb', location.href).href, mode = 'ar_only', pkg = ARCORE) {
  const params = new URLSearchParams({ file, mode, title: 'Mon avatar 3D' });
  const fallback = encodeURIComponent(location.href);
  location.href = `intent://arvr.google.com/scene-viewer/1.0?${params}`
    + `#Intent;scheme=https;package=${pkg};`
    + `action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`;
}

// Copie du modèle d'origine, tournée vers +Z, base à y = 0, centrée et à l'échelle réelle.
function createArModel() {
  const inner = sourceScene.clone();
  inner.rotation.y = -Math.PI / 2;
  inner.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
  inner.scale.setScalar(AR_HEIGHT / size.y);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const center = box.getCenter(new THREE.Vector3());
  inner.position.set(-center.x, -box.min.y, -center.z);
  const root = new THREE.Group();
  root.add(inner);
  root.updateMatrixWorld(true);
  return root;
}

async function buildUsdz() {
  const root = createArModel();
  const data = await new USDZExporter().parseAsync(root, { quickLookCompatible: true, maxTextureSize: 1024 });
  return URL.createObjectURL(new Blob([data], { type: 'model/vnd.usdz+zip' }));
}

async function openQuickLook() {
  if (!usdzUrl) {
    arButton.setAttribute('aria-busy', 'true');
    arButton.textContent = 'Préparation…';
    try {
      usdzUrl = await buildUsdz();
    } finally {
      arButton.removeAttribute('aria-busy');
      arButton.textContent = 'Voir chez moi (AR)';
    }
  }
  const link = document.createElement('a');
  link.rel = 'ar';
  link.href = usdzUrl;
  link.appendChild(document.createElement('img')); // AR Quick Look exige une image dans le lien
  link.click();
}

// --- Réalité augmentée dans la page (WebXR) ----------------------------------
// La caméra s'affiche dans Chrome, on vise une surface et on touche l'écran pour poser l'avatar.
const arOverlay = document.getElementById('ar-overlay');
const arMessage = document.getElementById('ar-message');
let xrSession = null;
let xrModel = null;
let xrReticle = null;
let xrShadow = null;
let xrHitSource = null;
let xrRefSpace = null;

async function webXrAvailable() {
  try {
    return Boolean(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'));
  } catch {
    return false;
  }
}

function createXrObjects() {
  xrModel = new THREE.Group();
  xrModel.add(createArModel());
  // Ombre douce sous le buste pour l'ancrer visuellement sur la surface.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  xrShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.75, 0.55).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  xrShadow.position.y = 0.002;
  xrModel.add(xrShadow);
  xrModel.visible = false;

  xrReticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.09, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf2c46d }),
  );
  xrReticle.matrixAutoUpdate = false;
  xrReticle.visible = false;
}

function rotateXrModel(angle) {
  if (xrModel?.visible) xrModel.rotation.y += angle;
}

function onXrSelect() {
  if (!xrReticle.visible) return;
  xrModel.position.setFromMatrixPosition(xrReticle.matrix);
  // Le buste se tourne vers la personne qui tient le téléphone.
  const viewer = new THREE.Vector3().setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);
  xrModel.rotation.y = Math.atan2(viewer.x - xrModel.position.x, viewer.z - xrModel.position.z);
  xrModel.visible = true;
  arMessage.textContent = 'Touchez ailleurs pour le déplacer';
}

function xrFrame(time, frame) {
  if (frame && xrHitSource) {
    const hits = frame.getHitTestResults(xrHitSource);
    const pose = hits.length ? hits[0].getPose(renderer.xr.getReferenceSpace()) : null;
    xrReticle.visible = Boolean(pose);
    if (pose) xrReticle.matrix.fromArray(pose.transform.matrix);
    if (!xrModel.visible) {
      arMessage.textContent = pose ? 'Touchez l’écran pour poser l’avatar' : 'Visez une table ou le sol en bougeant lentement le téléphone';
    }
  }
  renderer.render(scene, camera);
}

function endXr() {
  xrHitSource?.cancel?.();
  xrHitSource = null;
  xrSession = null;
  scene.remove(xrModel, xrReticle);
  avatar.visible = ground.visible = ring.visible = true;
  arOverlay.hidden = true;
  renderer.xr.enabled = false;
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  needsRender = true;
  renderer.setAnimationLoop(captureMode ? null : animate);
  statusText.textContent = 'Prêt · rotation 360°';
}

async function startXr() {
  if (!xrModel) createXrObjects();
  // La superposition doit être affichable avant l'ouverture de la session (dom-overlay).
  arOverlay.hidden = false;
  arMessage.textContent = 'Ouverture de la caméra…';
  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: arOverlay },
    });
  } catch (error) {
    arOverlay.hidden = true;
    throw error;
  }
  xrSession = session;
  // Restaure la page quelle que soit la façon dont la session se termine (bouton, retour, erreur).
  session.addEventListener('end', endXr, { once: true });
  arMessage.textContent = 'Visez une table ou le sol en bougeant lentement le téléphone';
  avatar.visible = ground.visible = ring.visible = false;
  xrModel.visible = false;
  scene.add(xrModel, xrReticle);

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  const viewerSpace = await session.requestReferenceSpace('viewer');
  xrHitSource = await session.requestHitTestSource({ space: viewerSpace });
  session.addEventListener('select', onXrSelect);
  renderer.setAnimationLoop(xrFrame);
}

// Les touches sur les boutons de la superposition ne doivent pas déplacer l'avatar.
arOverlay.addEventListener('beforexrselect', (event) => {
  if (event.target.closest('button')) event.preventDefault();
});
document.getElementById('ar-close').addEventListener('click', () => xrSession?.end());
document.getElementById('ar-left').addEventListener('click', () => rotateXrModel(Math.PI / 6));
document.getElementById('ar-right').addEventListener('click', () => rotateXrModel(-Math.PI / 6));

// Avec ?debug sur Android : boutons de test pour isoler un problème de Scene Viewer.
if (isAndroid && new URLSearchParams(location.search).has('debug')) {
  const astronaut = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';
  const avatarAr = new URL('./avatar-ar.glb', location.href).href;
  const tests = [
    ['Test : modèle Google (RA)', astronaut, 'ar_only', ARCORE],
    ['Test : modèle Google (appli Google)', astronaut, 'ar_preferred', GOOGLE_APP],
    ['Test : avatar 3D seul (appli Google)', avatarAr, '3d_only', GOOGLE_APP],
    ['Test : avatar standard (RA)', new URL('./avatar-standard.glb', location.href).href, 'ar_only', ARCORE],
  ];
  const controls = document.querySelector('.controls');
  webXrAvailable().then((ok) => {
    const info = document.createElement('p');
    info.className = 'gesture-hint';
    info.textContent = `RA dans la page (WebXR) : ${ok ? 'disponible' : 'non disponible'}`;
    controls.before(info);
  });
  for (const [label, file, mode, pkg] of tests) {
    const button = document.createElement('button');
    button.className = 'control-button';
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => openSceneViewer(file, mode, pkg));
    controls.appendChild(button);
  }
}

if (isAndroid || supportsQuickLook) {
  arButton.hidden = false;
  arButton.addEventListener('click', async () => {
    if (arButton.getAttribute('aria-busy') === 'true') return;
    if (!ready || xrSession) return;
    try {
      if (isAndroid) {
        if (await webXrAvailable()) {
          try {
            await startXr();
            return;
          } catch (error) {
            // Caméra refusée ou session impossible : on tente la visionneuse de Google.
            console.error(error);
            if (xrSession) await xrSession.end().catch(() => {});
          }
        }
        openSceneViewer();
      } else {
        await openQuickLook();
      }
    } catch (error) {
      console.error(error);
      statusText.textContent = 'Réalité augmentée indisponible';
    }
  });
}

if (!document.documentElement.requestFullscreen) {
  fullscreenButton.hidden = true;
} else {
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      statusText.textContent = 'Plein écran non autorisé';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran';
  });
}

renderer.domElement.addEventListener('keydown', (event) => {
  if (!ready) return;
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  let handled = true;

  switch (event.key) {
    case 'ArrowLeft': spherical.theta -= Math.PI / 12; break;
    case 'ArrowRight': spherical.theta += Math.PI / 12; break;
    case 'ArrowUp': spherical.phi = Math.max(controls.minPolarAngle, spherical.phi - Math.PI / 18); break;
    case 'ArrowDown': spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + Math.PI / 18); break;
    case '+':
    case '=': spherical.radius = Math.max(controls.minDistance, spherical.radius * 0.9); break;
    case '-': spherical.radius = Math.min(controls.maxDistance, spherical.radius * 1.1); break;
    case 'r':
    case 'R': resetView(); event.preventDefault(); return;
    case ' ': setAutoRotate(!controls.autoRotate); event.preventDefault(); return;
    default: handled = false;
  }

  if (handled) {
    event.preventDefault();
    cameraTransition = null;
    markActiveView('');
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    if (captureMode) renderer.render(scene, camera);
  }
});

window.addEventListener('resize', () => {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  camera.aspect = width / height;
  renderer.setSize(width, height);
  updateFraming();
  needsRender = true;
  if (ready && captureMode) renderer.render(scene, camera);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setAutoRotate(false);
});

// Diagnostic d'affichage : ajouter ?debug à l'adresse pour lire les dimensions
// réellement vues par la page (utile si la mise en page mobile ne s'applique pas).
if (new URLSearchParams(location.search).has('debug')) {
  const showDebug = () => {
    const vv = window.visualViewport;
    statusText.textContent = `page ${innerWidth}×${innerHeight} · écran ${screen.width}×${screen.height}`
      + ` · ratio ${devicePixelRatio.toFixed(2)} · zoom ${vv ? vv.scale.toFixed(2) : '?'}`
      + ` · tactile ${touchDevice ? 'oui' : 'non'}`;
    document.querySelector('.status').style.cssText = 'display:flex;max-width:none;position:fixed;top:40px;left:8px;right:8px;z-index:9;font-size:14px;';
  };
  showDebug();
  addEventListener('resize', showDebug);
  window.visualViewport?.addEventListener('resize', showDebug);
  loader.manager.onLoad = showDebug;
}

window.__avatarViewer = {
  setView: (name) => {
    setView(name, true);
    renderer.render(scene, camera);
  },
  setAutoRotate,
  reset: () => {
    resetView();
    if (captureMode) {
      setView('front', true);
      renderer.render(scene, camera);
    }
  },
  getState: () => ({
    ready,
    activeView,
    autoRotate: controls.autoRotate,
    camera: camera.position.toArray(),
    target: controls.target.toArray(),
    triangles: renderer.info.render.triangles,
    drawCalls: renderer.info.render.calls,
  }),
};

window.__seek = (seconds) => {
  if (!ready) return;
  setAutoRotate(false);
  const angle = (Number(seconds) || 0) / 12 * Math.PI * 2;
  camera.position.set(Math.cos(angle) * viewDistance, target.y + viewDistance * 0.025, Math.sin(angle) * viewDistance);
  controls.target.copy(target);
  controls.update();
  renderer.render(scene, camera);
};
window.__play = () => {
  if (!captureMode && !renderer.getAnimationLoop()) renderer.setAnimationLoop(animate);
};
