import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

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
const viewButtons = [...document.querySelectorAll('[data-view]')];
const captureMode = new URLSearchParams(location.search).has('capture');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
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

scene.add(new THREE.HemisphereLight(0xe7f0ec, 0x29251f, 1.2));

const keyLight = new THREE.DirectionalLight(0xffedda, 3.1);
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

const rimLight = new THREE.DirectionalLight(0xa9c8c0, 2.2);
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
let target = new THREE.Vector3(0, 1.4, 0);
let viewDistance = 6;
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
  target = new THREE.Vector3(0, size.y * 0.51, 0);
  controls.target.copy(target);

  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const heightDistance = size.y / (2 * Math.tan(verticalFov / 2));
  const widthDistance = size.x / (2 * Math.tan(verticalFov / 2) * camera.aspect);
  viewDistance = Math.max(heightDistance, widthDistance) * 1.38;
  controls.minDistance = viewDistance * 0.48;
  controls.maxDistance = viewDistance * 1.8;

  const ringScale = Math.max(0.85, size.x * 0.43);
  ring.scale.setScalar(ringScale);
  renderer.shadowMap.needsUpdate = true;
  setView('front', true);
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
      if ('envMapIntensity' in material) material.envMapIntensity = 0.85;
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
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (ready && captureMode) renderer.render(scene, camera);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setAutoRotate(false);
});

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
