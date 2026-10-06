import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
const modelUrl = `${import.meta.env.BASE_URL}models/artifact-fast.glb`;
import './style.css';
import './celestial-theme.css';

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const stage = $('stage');
const state = { ready: false, mode: 'points', scattered: false, rotating: !reducedMotion.matches, progress: 0, spread: 0, sequence: null, phase: '', start: performance.now(), frames: 0 };
let renderer, controls, camera, cloud, glow, dragonStreams, normalizedModel, occluder, uniforms;
const surfaceMaterials = [];
let rendered = false;
let previousTime = performance.now();
const scene = new THREE.Scene();
const artifact = new THREE.Group();
scene.add(artifact);

function announce(text) { $('announcement').textContent = text; }
function setLoading(percent, text) {
  $('loading-percent').textContent = `已载入 ${Math.round(percent)}`;
  $('loading-bar').style.width = `${percent}%`;
  if (text) $('loading-label').textContent = text;
}
function showError(error) {
  console.error('Gallery:', error);
  $('loading').hidden = true;
  $('error').hidden = false;
  $('error-text').textContent = error.message || '载入遇到问题 请重新尝试';
  $('replay-label').textContent = '暂时无法载入';
  announce('藏品载入失败 可点击重新载入');
}

function initializeRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, stage.clientWidth < 450 ? 1.35 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  $('canvas-mount').appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '数字赏石三维展示');
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 4.7;
  controls.maxDistance = 13;
  controls.minPolarAngle = Math.PI * 0.24;
  controls.maxPolarAngle = Math.PI * 0.74;
  controls.rotateSpeed = 0.55;
  controls.autoRotate = state.rotating;
  controls.autoRotateSpeed = 0.32;
  controls.addEventListener('start', () => { stage.classList.add('interacting'); });
  controls.addEventListener('end', () => { stage.classList.remove('interacting'); });
  const ambient = new THREE.HemisphereLight(0xf8f0e3, 0x444936, 1.8);
  const key = new THREE.DirectionalLight(0xffedd2, 2.5);
  key.position.set(-3, 4, 5);
  const rim = new THREE.DirectionalLight(0xdce0c5, 2.2);
  rim.position.set(4, 3, -4);
  const fill = new THREE.DirectionalLight(0xd0ceac, 0.7);
  fill.position.set(3, -1, 4);
  scene.add(ambient, key, rim, fill);
  buildPedestal();
  resetCamera();
  new ResizeObserver(resize).observe(stage);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    state.ready = false;
    showError(new Error('三维画面已中断 请重新载入'));
  });
  updateRotateButton();
  renderer.setAnimationLoop(animate);
}

function buildPedestal() {
  const ringMaterial = new THREE.LineBasicMaterial({ color: 0x8c8059, transparent: true, opacity: 0.19 });
  for (const radius of [1.18, 1.48]) {
    const positions = [];
    for (let i = 0; i <= 128; i++) {
      const theta = i / 128 * Math.PI * 2;
      positions.push(Math.cos(theta) * radius, -2.12, Math.sin(theta) * radius);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    scene.add(new THREE.Line(geometry, ringMaterial));
  }
  const dustPositions = [], dustColors = [];
  const rng = seededRandom(67);
  for (let i = 0; i < 180; i++) {
    dustPositions.push((rng() - 0.5) * 7.5, (rng() - 0.5) * 5.8, (rng() - 0.5) * 4);
    dustColors.push(0.24, 0.20, 0.12);
  }
  const dust = new THREE.BufferGeometry();
  dust.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  dust.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
  scene.add(new THREE.Points(dust, new THREE.PointsMaterial({ size: 0.013, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false })));
}

function seededRandom(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function buildDragonStreams() {
  const count = stage.clientWidth < 450 ? 3600 : 6400;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const paths = new Float32Array(count), lanes = new Float32Array(count), offsets = new Float32Array(count);
  const rng = seededRandom(8806);
  for (let i = 0; i < count; i++) { paths[i] = rng(); lanes[i] = i % 2; offsets[i] = rng(); }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPath', new THREE.BufferAttribute(paths, 1));
  geometry.setAttribute('aLane', new THREE.BufferAttribute(lanes, 1));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uEnergy: { value: 0 }, uPixelRatio: uniforms.uPixelRatio },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aPath;
      attribute float aLane;
      attribute float aOffset;
      uniform float uTime;
      uniform float uEnergy;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float theta = aPath * 11.5 + uTime * 1.1 + aLane * 3.14159;
        float radius = 1.45 + sin(aPath * 18.0 + uTime) * 0.13 + (aOffset - 0.5) * 0.13;
        vec3 p = vec3(cos(theta) * radius, (aPath - 0.5) * 4.2, sin(theta) * radius);
        p.y += sin(theta * 2.0) * 0.1;
        float trail = exp(-fract(uTime * 0.19 - aPath + aLane * 0.5) * 8.0);
        vColor = mix(vec3(1.7, 0.73, 0.12), vec3(0.13, 1.15, 0.82), aLane);
        vAlpha = uEnergy * (0.13 + trail * 0.75);
        vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp((1.1 + trail * 3.0) * uPixelRatio * (7.7 / -viewPosition.z), 1.0, 9.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        if (radius > 0.5) discard;
        gl_FragColor = vec4(vColor, exp(-radius * radius * 20.0) * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  dragonStreams = new THREE.Points(geometry, material);
  dragonStreams.frustumCulled = false;
  dragonStreams.renderOrder = 3;
  artifact.add(dragonStreams);
}

function resize() {
  if (!renderer) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (uniforms) {
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
    uniforms.uFieldWidth.value = Math.min(1, w / h / 1.05);
  }
}
function resetCamera() {
  camera.position.set(0, 0.22, stage.clientWidth < 450 ? 10.2 : 7.7);
  controls.target.set(0, -0.05, 0);
  controls.update();
  resize();
}

function getTexturePixels(texture) {
  if (!texture?.image) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(texture.image, 0, 0, 1024, 1024);
    return { pixels: context.getImageData(0, 0, 1024, 1024).data, size: 1024, flipY: texture.flipY };
  } catch { return null; }
}

async function loadArtifact() {
  setLoading(3, '载入数字赏石');
  const model = await new GLTFLoader().loadAsync(modelUrl, (event) => {
    if (event.total) setLoading(3 + event.loaded / event.total * 64);
  });
  const root = model.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 4 / Math.max(size.y, 0.001);
  normalizedModel = new THREE.Group();
  normalizedModel.add(root);
  normalizedModel.scale.setScalar(scale);
  normalizedModel.position.copy(center).multiplyScalar(-scale);
  artifact.add(normalizedModel);
  artifact.updateMatrixWorld(true);
  // A depth-only surface prevents rear particles from showing through the object.
  occluder = normalizedModel.clone(true);
  const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  occluder.traverse(mesh => { if (mesh.isMesh) { mesh.material = depthMaterial; mesh.renderOrder = -1; } });
  occluder.visible = false;
  artifact.add(occluder);
  setLoading(72, '描摹表面的微光');
  await new Promise(requestAnimationFrame);

  const surfaces = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const surface = new THREE.Mesh(geometry, mesh.material);
    const positions = geometry.attributes.position;
    const index = geometry.index;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let area = 0;
    for (let i = 0; i < (index?.count || positions.count); i += 3) {
      a.fromBufferAttribute(positions, index ? index.getX(i) : i);
      b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1);
      c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2);
      area += b.sub(a).cross(c.sub(a)).length() * 0.5;
    }
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material) {
      material.metalness = Math.min(material.metalness ?? 0, 0.3);
      material.roughness = Math.max(material.roughness ?? 1, 0.65);
      material.specularColor?.setRGB(1, 1, 1);
      material.transparent = true;
      material.opacity = 0;
      material.depthWrite = false;
      surfaceMaterials.push(material);
    }
    surfaces.push({ sampler: new MeshSurfaceSampler(surface).build(), area, texture: getTexturePixels(material?.map), geometry });
  });
  if (!surfaces.length) throw new Error('模型内没有可展示的几何表面');
  const totalArea = surfaces.reduce((sum, s) => sum + s.area, 0);
  const count = stage.clientWidth < 450 ? 65000 : 120000;
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3), scatter = new Float32Array(count * 3), seeds = new Float32Array(count), kinds = new Float32Array(count);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), color = new THREE.Color(), uv = new THREE.Vector2();
  const rng = seededRandom(1826);
  for (const surface of surfaces) surface.sampler.setRandomGenerator(rng);
  for (let i = 0; i < count; i++) {
    let target = rng() * totalArea;
    let surface = surfaces[surfaces.length - 1];
    for (const candidate of surfaces) { target -= candidate.area; if (target <= 0) { surface = candidate; break; } }
    surface.sampler.sample(p, n, color, uv);
    p.toArray(positions, i * 3);
    n.toArray(normals, i * 3);
    color.setRGB(0.4, 0.35, 0.25);
    if (surface.texture) {
      const { pixels, size, flipY } = surface.texture;
      const x = Math.min(size - 1, Math.floor(((uv.x % 1 + 1) % 1) * size));
      const v = (uv.y % 1 + 1) % 1;
      const y = Math.min(size - 1, Math.floor((flipY ? 1 - v : v) * size));
      const offset = (y * size + x) * 4;
      color.setRGB(pixels[offset] / 255, pixels[offset + 1] / 255, pixels[offset + 2] / 255, THREE.SRGBColorSpace);
    }
    color.toArray(colors, i * 3);
    const x = (rng() - 0.5) * 5.4;
    const ribbon = Math.floor(rng() * 4);
    const y = Math.sin(x * 1.1 + ribbon * 1.3) * 0.65 + (ribbon - 1.5) * 0.36 + (rng() - 0.5) * 0.42;
    scatter.set([x, y, (rng() - 0.5) * 1.9], i * 3);
    seeds[i] = rng();
    kinds[i] = Math.floor(rng() * 6);
    if (i && i % 20000 === 0) {
      setLoading(72 + i / count * 25);
      await new Promise(requestAnimationFrame);
    }
  }
  for (const surface of surfaces) surface.geometry.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  uniforms = {
    uTime: { value: 0 }, uProgress: { value: reducedMotion.matches ? 1 : 0 },
    uPixelRatio: { value: renderer.getPixelRatio() }, uSize: { value: 0.058 },
    uScan: { value: reducedMotion.matches ? 0 : 1 },
    uSpread: { value: 0 }, uReveal: { value: 0 }, uHalo: { value: 0 },
    uFieldWidth: { value: Math.min(1, stage.clientWidth / stage.clientHeight / 1.05) }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: true,
    vertexShader: `
      attribute vec3 aScatter;
      attribute vec3 color;
      attribute float aSeed;
      attribute float aKind;
      uniform float uTime;
      uniform float uProgress;
      uniform float uPixelRatio;
      uniform float uSize;
      uniform float uScan;
      uniform float uSpread;
      uniform float uReveal;
      uniform float uHalo;
      uniform float uFieldWidth;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vKind;
      varying float vAngle;
      varying float vAssembled;
      void main() {
        float delay = (position.y + 2.0) * 0.045 + aSeed * 0.13;
        float progress = smoothstep(delay, 0.74 + delay, uProgress);
        vec3 field = aScatter * mix(0.34, 1.0, uSpread);
        field.x *= uFieldWidth;
        field.y += sin(field.x * 1.4 + uTime * 0.75 + aSeed * 6.28) * 0.18;
        field.z += cos(uTime * 0.6 + aSeed * 12.0) * 0.22;
        float angle = sin(progress * 3.14159) * (3.4 + aSeed * 2.2) + sin(uTime * 0.25) * 0.12 * (1.0 - progress);
        mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        field.xy = turn * field.xy;
        vec3 p = mix(field, position, progress);
        float arc = sin(progress * 3.14159);
        p.y += arc * sin(aSeed * 20.0 + uTime * 0.7) * 0.38;
        p.z += arc * cos(aSeed * 12.0 + progress * 4.0) * 0.7;
        float pulse = sin(aSeed * 31.0 + uTime * 2.0);
        p += normal * arc * pulse * pulse * pulse * 0.16;
        p += normal * (0.008 + sin(uTime * 0.75 + aSeed * 12.0) * 0.002) * progress;
        vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        float front = smoothstep(-0.25, 0.3, dot(viewNormal, normalize(-viewPosition.xyz)));
        float light = 0.55 + 0.8 * max(dot(viewNormal, normalize(vec3(-0.6, 0.8, 1.0))), 0.0);
        float scanY = mod(uTime * 0.45, 7.0) - 3.5;
        float scan = exp(-pow((position.y - scanY) * 11.0, 2.0)) * uScan;
        float spark = step(0.994, aSeed);
        vec3 palette = aKind < 2.0 ? vec3(0.65, 0.26, 0.045) : aKind < 4.0 ? vec3(0.08, 0.51, 0.36) : vec3(0.38, 0.57, 0.72);
        vec3 fieldColor = mix(palette, vec3(1.6, 0.9, 0.28), spark);
        vColor = mix(fieldColor, color * light + vec3(0.06, 0.035, 0.012) * scan, progress);
        float fieldDensity = mix(step(0.62, aSeed), 1.0, progress);
        float fieldAlpha = 0.19 + spark * 0.64;
        float formedAlpha = mix(0.12, 0.93, front) * mix(1.0, 0.44, uReveal);
        vAlpha = mix(fieldAlpha, formedAlpha, progress) * fieldDensity;
        vSeed = aSeed;
        vKind = aKind;
        vAngle = aSeed * 6.28 + uTime * mix(0.25, 0.0, progress);
        vAssembled = progress;
        gl_Position = projectionMatrix * viewPosition;
        float varietySize = aSeed > 0.965 ? 4.3 : 1.5;
        float pointScale = mix(varietySize + spark * 1.5, 0.95, progress);
        gl_PointSize = clamp(uSize * uPixelRatio * (260.0 / -viewPosition.z) * (0.75 + aSeed * 0.5) * pointScale * mix(1.0, 6.0, uHalo), 0.7, 30.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vKind;
      varying float vAngle;
      varying float vAssembled;
      uniform float uHalo;
      uniform float uProgress;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        if (radius > 0.5) discard;
        vec2 centered = gl_PointCoord - vec2(0.5);
        mat2 rotate = mat2(cos(vAngle), -sin(vAngle), sin(vAngle), cos(vAngle));
        vec2 q = rotate * centered;
        float roundShape = 1.0 - smoothstep(0.10, 0.5, radius);
        float shape = roundShape;
        if (vKind > 0.5 && vKind < 1.5) {
          shape = 1.0 - smoothstep(0.26, 0.44, abs(q.x) + abs(q.y));
        } else if (vKind < 2.5 && vKind > 1.5) {
          shape = exp(-abs(q.x) * 28.0 - abs(q.y) * 3.5) + exp(-abs(q.y) * 28.0 - abs(q.x) * 3.5);
        } else if (vKind < 3.5 && vKind > 2.5) {
          float ring = abs(length(q + vec2(0.0, 0.09)) - 0.29);
          shape = (1.0 - smoothstep(0.025, 0.065, ring)) * smoothstep(-0.25, 0.12, q.y);
        } else if (vKind < 4.5 && vKind > 3.5) {
          shape = exp(-q.x * q.x * 230.0 - q.y * q.y * 12.0) * (0.8 + q.y);
        } else if (vKind > 4.5) {
          shape = (1.0 - smoothstep(0.02, 0.05, abs(radius - 0.31))) * 0.9 + exp(-radius * radius * 85.0) * 0.4;
        }
        shape = mix(shape, roundShape, smoothstep(0.55, 0.97, vAssembled));
        float alpha = shape * vAlpha;
        if (uHalo > 0.5) {
          alpha = exp(-radius * radius * 24.0) * vAlpha * mix(0.3, 0.05, uProgress);
        }
        gl_FragColor = vec4(vColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  cloud = new THREE.Points(geometry, material);
  cloud.renderOrder = 1;
  cloud.frustumCulled = false;
  artifact.add(cloud);
  const glowGeometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) glowGeometry.setAttribute(name, attribute);
  const glowIndices = [];
  for (let i = 0; i < count; i++) if (seeds[i] > 0.994) glowIndices.push(i);
  glowGeometry.setIndex(glowIndices);
  const glowMaterial = material.clone();
  glowMaterial.uniforms = { ...uniforms, uHalo: { value: 1 } };
  glowMaterial.blending = THREE.AdditiveBlending;
  glowMaterial.depthWrite = false;
  glow = new THREE.Points(glowGeometry, glowMaterial);
  glow.renderOrder = 2;
  glow.frustumCulled = false;
  artifact.add(glow);
  buildDragonStreams();
  normalizedModel.visible = false;
  artifact.rotation.y = -0.14;
  state.ready = true;
  const arrival = $('arrival-particles');
  if (arrival) {
    arrival.style.transition = 'opacity 300ms';
    arrival.style.opacity = '0';
    setTimeout(() => { arrival.dataset.complete = 'true'; }, 300);
  }
  state.progress = reducedMotion.matches ? 1 : 0;
  state.start = performance.now();
  startSequence('intro');
  $('point-count').textContent = `${count / 1000}K`;
  setLoading(100, '微光已就绪');
  $('loading').classList.add('complete');
  setTimeout(() => { $('loading').hidden = true; }, 650);
  document.querySelectorAll('.mode, .stage-tools button, #replay').forEach(button => { button.disabled = false; });
  $('replay-label').textContent = '重演光粒成形';
  announce('藏品载入完成 可拖动旋转 切换点云和原貌');
}

function ease(value) { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); }
function setPhase(phase, completion) {
  if (state.phase !== phase) {
    state.phase = phase;
    $('formation-phase').textContent = phase;
  }
  $('formation-progress').style.width = `${completion * 100}%`;
}
function startSequence(kind) {
  if (reducedMotion.matches) {
    state.sequence = null;
    state.progress = kind === 'scatter' ? 0 : 1;
    state.spread = 1;
    state.scattered = kind === 'scatter';
    updateScatterButton();
    return;
  }
  state.sequence = { kind, time: kind === 'intro' ? -0.65 : 0, from: state.progress };
  state.scattered = kind === 'scatter';
  updateScatterButton();
}
function updateSequence(delta) {
  const sequence = state.sequence;
  if (!sequence) {
    setPhase(state.progress > 0.99 ? '三 赏石成形' : '一 光粒漫游', state.progress);
    return;
  }
  sequence.time += delta;
  const t = Math.max(0, sequence.time);
  let duration;
  if (sequence.kind === 'intro') {
    duration = 8;
    state.spread = ease(t / 1.6);
    state.progress = ease((t - 2.1) / 5.9);
    setPhase(t < 2.1 ? '一 万点启光' : t < 6.4 ? '二 星流汇聚' : '三 细节浮现', t / duration);
  } else if (sequence.kind === 'replay') {
    duration = 9.8;
    state.spread = 1;
    state.progress = t < 1.8 ? sequence.from * (1 - ease(t / 1.8)) : ease((t - 3.2) / 6.6);
    setPhase(t < 3.2 ? '一 万点启光' : t < 8.1 ? '二 星流汇聚' : '三 细节浮现', t / duration);
  } else if (sequence.kind === 'scatter') {
    duration = 2.2;
    state.spread = 1;
    state.progress = sequence.from * (1 - ease(t / duration));
    setPhase('一 光粒散开', 1 - t / duration);
  } else {
    duration = 6;
    state.spread = 1;
    state.progress = THREE.MathUtils.lerp(sequence.from, 1, ease(t / duration));
    setPhase(t < 4.6 ? '二 星流汇聚' : '三 细节浮现', t / duration);
  }
  if (t >= duration) {
    state.progress = sequence.kind === 'scatter' ? 0 : 1;
    state.sequence = null;
    setPhase(state.progress ? '三 赏石成形' : '一 光粒漫游', state.progress);
  }
}
function updatePresentation() {
  const reveal = ease((state.progress - 0.78) / 0.22);
  const solidMode = state.mode === 'solid';
  normalizedModel.visible = solidMode || reveal > 0.001;
  const opacity = solidMode ? 1 : reveal * 0.94;
  for (const material of surfaceMaterials) { material.opacity = opacity; material.depthWrite = solidMode; }
  cloud.visible = !solidMode;
  glow.visible = !solidMode;
  const energy = !solidMode && !reducedMotion.matches ? Math.pow(Math.sin(state.progress * Math.PI), 0.8) : 0;
  dragonStreams.visible = energy > 0.001;
  dragonStreams.material.uniforms.uEnergy.value = energy;
  dragonStreams.material.uniforms.uTime.value = uniforms.uTime.value;
  occluder.visible = !solidMode && state.progress > 0.996;
  uniforms.uReveal.value = reveal;
  uniforms.uProgress.value = state.progress;
  uniforms.uSpread.value = state.spread;
  stage.style.setProperty('--field-opacity', String((1 - state.progress) * 0.65));
  stage.style.setProperty('--gather-energy', String(energy));
  controls.autoRotate = state.rotating && (solidMode || (!state.sequence && state.progress > 0.99));
}
function animate(now) {
  if (!renderer || !camera) return;
  const delta = Math.min((now - previousTime) / 1000, 0.1);
  previousTime = now;
  if (document.hidden) return;
  if (state.ready && uniforms) {
    const elapsed = (now - state.start) / 1000;
    if (state.mode === 'points') updateSequence(delta);
    uniforms.uTime.value = reducedMotion.matches ? 0 : elapsed;
    uniforms.uScan.value = reducedMotion.matches ? 0 : 1;
    updatePresentation();
    state.frames++;
  }
  controls.update(delta);
  renderer.render(scene, camera);
  rendered = true;
}

function setMode(mode) {
  if (!state.ready) return;
  state.mode = mode;
  updatePresentation();
  document.querySelectorAll('.mode').forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('scatter').disabled = mode !== 'points';
  announce(mode === 'points' ? '已切换到点云之形' : '已切换到模型原貌');
}
function updateRotateButton() {
  $('rotate').setAttribute('aria-pressed', String(state.rotating));
  const label = state.rotating ? '暂停自动旋转' : '开启自动旋转';
  $('rotate').setAttribute('aria-label', label);
  $('rotate').title = label;
  $('rotate').innerHTML = state.rotating ? '<svg viewBox="0 0 24 24"><path d="M8 6v12M16 6v12"/></svg>' : '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg>';
}
function updateScatterButton() {
  const label = state.scattered ? '聚合粒子' : '散开粒子';
  $('scatter').setAttribute('aria-label', label);
  $('scatter').title = label;
  $('scatter').setAttribute('aria-pressed', String(state.scattered));
}
document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('rotate').addEventListener('click', () => {
  state.rotating = !state.rotating;
  controls.autoRotate = state.rotating;
  updateRotateButton();
});
$('scatter').addEventListener('click', () => {
  startSequence(state.scattered ? 'gather' : 'scatter');
  announce(state.scattered ? '粒子正在散开' : '粒子正在聚合');
});
$('replay').addEventListener('click', () => {
  setMode('points');
  resetCamera();
  startSequence('replay');
  announce('正在重新唤醒微光');
});
$('reset').addEventListener('click', () => { resetCamera(); announce('已重置视角'); });
$('retry').addEventListener('click', () => location.reload());
document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => $(button.dataset.dialog).showModal()));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
});
reducedMotion.addEventListener('change', () => {
  state.rotating = !reducedMotion.matches;
  if (reducedMotion.matches) { state.sequence = null; state.progress = state.scattered ? 0 : 1; state.spread = 1; }
  if (controls) controls.autoRotate = state.rotating;
  updateRotateButton();
});

// Compact diagnostics for preview verification; contains no user model data.
window.galleryStatus = () => ({ ready: state.ready, mode: state.mode, scattered: state.scattered, rotating: state.rotating, progress: Number(state.progress.toFixed(3)), phase: state.phase, sequence: state.sequence ? { kind: state.sequence.kind, time: Number(state.sequence.time.toFixed(2)) } : null, surfaceOpacity: Number((surfaceMaterials[0]?.opacity ?? 0).toFixed(3)), pointCount: cloud?.geometry.attributes.position.count ?? 0, particleKinds: 6, dragonEnergy: Number((dragonStreams?.material.uniforms.uEnergy.value ?? 0).toFixed(3)), frames: state.frames, rendered, renderer: renderer?.info.render, camera: camera?.position.toArray() });
try { initializeRenderer(); loadArtifact().catch(showError); } catch (error) { showError(new Error('无法启动三维展示 请重新载入')); console.error(error); }
