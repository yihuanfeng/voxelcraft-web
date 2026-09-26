import * as THREE from 'three';
import { SIZE, HEIGHT, CHUNK, CHUNKS, AIR, WATER, GLASS, BLOCKS, atlas } from './constants.js';
import { world, widx, surfaceY, getBlock } from './world.js';
import { raycastVoxel } from './world.js';

/* ================================================================
   渲染器 / 场景 / 光照
================================================================ */
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
camera.rotation.order = 'YXZ';

const DAY_SKY = new THREE.Color(0x87ceeb), NIGHT_SKY = new THREE.Color(0x0b1026);
scene.fog = new THREE.Fog(DAY_SKY.getHex(), 45, 130);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6b5335, 0.8);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 1.0);
scene.add(sun);
scene.add(sun.target);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ================================================================
   区块化网格 —— 每个 16x16 区块一个不透明 + 一个水面网格
================================================================ */
const FACES = [
  { dir:[-1,0,0], kind:'side',   corners:[[0,1,0],[0,0,0],[0,1,1],[0,0,1]], uv:[[0,0],[0,1],[1,0],[1,1]] },
  { dir:[ 1,0,0], kind:'side',   corners:[[1,1,1],[1,0,1],[1,1,0],[1,0,0]], uv:[[0,0],[0,1],[1,0],[1,1]] },
  { dir:[0,-1,0], kind:'bottom', corners:[[1,0,1],[0,0,1],[1,0,0],[0,0,0]], uv:[[0,1],[1,1],[0,0],[1,0]] },
  { dir:[0, 1,0], kind:'top',    corners:[[0,1,1],[1,1,1],[0,1,0],[1,1,0]], uv:[[0,1],[1,1],[0,0],[1,0]] },
  { dir:[0,0,-1], kind:'side',   corners:[[1,0,0],[0,0,0],[1,1,0],[0,1,0]], uv:[[0,1],[1,1],[0,0],[1,0]] },
  { dir:[0,0, 1], kind:'side',   corners:[[0,0,1],[1,0,1],[0,1,1],[1,1,1]], uv:[[0,1],[1,1],[0,0],[1,0]] },
];
const UE = 0.002;

function tileFor(id, face) {
  const t = BLOCKS[id].tiles;
  if (face.kind === 'top') return t.top ?? t.all;
  if (face.kind === 'bottom') return t.bottom ?? t.all;
  return t.side ?? t.all;
}
function meshBlock(x, y, z) {
  if (y < 0) return 8;                       // BEDROCK
  if (y >= HEIGHT || x < 0 || x >= SIZE || z < 0 || z >= SIZE) return AIR;
  return getBlock(x, y, z);
}

const opaqueMat = new THREE.MeshLambertMaterial({ map: atlas.tex });
const waterMat  = new THREE.MeshLambertMaterial({ map: atlas.tex, transparent: true, opacity: 0.72,
                                                  depthWrite: false, side: THREE.DoubleSide });
const glassMat  = new THREE.MeshLambertMaterial({ map: atlas.tex, transparent: true, opacity: 0.45,
                                                  depthWrite: false, side: THREE.DoubleSide });

const chunkMeshes = new Array(CHUNKS * CHUNKS).fill(null).map(() => ({ opaque: null, water: null, glass: null }));

function buildArrays(cx, cz) {
  const pos=[], nrm=[], uv=[], idx=[], wpos=[], wnrm=[], wuv=[], widxa=[], gpos=[], gnrm=[], guv=[], gidxa=[];
  for (let x = cx * CHUNK; x < cx * CHUNK + CHUNK; x++)
  for (let z = cz * CHUNK; z < cz * CHUNK + CHUNK; z++)
  for (let y = 0; y < HEIGHT; y++) {
    const id = getBlock(x, y, z);
    if (id === AIR) continue;
    const isWater = id === WATER, isGlass = id === GLASS;
    for (const f of FACES) {
      const nid = meshBlock(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
      const show = isWater ? (nid === AIR)
                 : isGlass ? (nid === AIR || nid === WATER)
                 : (nid === AIR || nid === WATER);
      if (!show) continue;
      const tile = tileFor(id, f);
      const col = tile % 16, row = Math.floor(tile / 16);
      const u0 = col / 16 + UE, u1 = (col + 1) / 16 - UE;
      const vT = row / 16 + UE, vB = (row + 1) / 16 - UE;
      const P = isGlass ? gpos : (isWater ? wpos : pos),
            Nn = isGlass ? gnrm : (isWater ? wnrm : nrm),
            U = isGlass ? guv : (isWater ? wuv : uv),
            I = isGlass ? gidxa : (isWater ? widxa : idx);
      const base = P.length / 3;
      for (let i = 0; i < 4; i++) {
        const c = f.corners[i];
        let cy = c[1];
        if (isWater && f.dir[1] === 1 && c[1] === 1) cy = 0.875;
        P.push(x + c[0], y + cy, z + c[2]);
        Nn.push(f.dir[0], f.dir[1], f.dir[2]);
        U.push(f.uv[i][0] ? u1 : u0, f.uv[i][1] ? vB : vT);
      }
      I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  return { pos, nrm, uv, idx, wpos, wnrm, wuv, widxa, gpos, gnrm, guv, gidxa };
}
function toGeometry(pos, nrm, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
export function rebuildChunk(cx, cz) {
  if (cx < 0 || cx >= CHUNKS || cz < 0 || cz >= CHUNKS) return;
  const ch = chunkMeshes[cx + cz * CHUNKS];
  const a = buildArrays(cx, cz);
  if (ch.opaque) { ch.opaque.geometry.dispose(); scene.remove(ch.opaque); ch.opaque = null; }
  if (ch.water)  { ch.water.geometry.dispose();  scene.remove(ch.water);  ch.water = null; }
  if (ch.glass)  { ch.glass.geometry.dispose();  scene.remove(ch.glass);  ch.glass = null; }
  if (a.pos.length) {
    ch.opaque = new THREE.Mesh(toGeometry(a.pos, a.nrm, a.uv, a.idx), opaqueMat);
    scene.add(ch.opaque);
  }
  if (a.wpos.length) {
    ch.water = new THREE.Mesh(toGeometry(a.wpos, a.wnrm, a.wuv, a.widxa), waterMat);
    ch.water.renderOrder = 1;
    scene.add(ch.water);
  }
  if (a.gpos.length) {
    ch.glass = new THREE.Mesh(toGeometry(a.gpos, a.gnrm, a.guv, a.gidxa), glassMat);
    ch.glass.renderOrder = 2;
    scene.add(ch.glass);
  }
}
export function rebuildAround(x, z) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  rebuildChunk(cx, cz);
  if (x % CHUNK === 0) rebuildChunk(cx - 1, cz);
  if (x % CHUNK === CHUNK - 1) rebuildChunk(cx + 1, cz);
  if (z % CHUNK === 0) rebuildChunk(cx, cz - 1);
  if (z % CHUNK === CHUNK - 1) rebuildChunk(cx, cz + 1);
}
export function rebuildAll() {
  for (let cx = 0; cx < CHUNKS; cx++) for (let cz = 0; cz < CHUNKS; cz++) rebuildChunk(cx, cz);
}
// —— 大世界分帧构建（优先玩家附近）——
const buildQueue = [];
const buildPerFrame = 5;
export function scheduleRebuildAll(px, pz) {
  buildQueue.length = 0;
  const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
  for (let cx = 0; cx < CHUNKS; cx++) for (let cz = 0; cz < CHUNKS; cz++) buildQueue.push([cx, cz]);
  buildQueue.sort((a, b) => {
    const da = Math.max(Math.abs(a[0] - pcx), Math.abs(a[1] - pcz));
    const db = Math.max(Math.abs(b[0] - pcx), Math.abs(b[1] - pcz));
    return da - db;
  });
}
export function updateBuildQueue() {
  for (let i = 0; i < buildPerFrame && buildQueue.length; i++) {
    const [cx, cz] = buildQueue.shift();
    rebuildChunk(cx, cz);
  }
  return buildQueue.length;
}

/* ================================================================
   准星射线（瞄准方块）
================================================================ */
export function aimBlock() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  return raycastVoxel(camera.position, dir, 5.5);
}

/* ================================================================
   粒子
================================================================ */
const particles = [];
const particleGeo = new THREE.BoxGeometry(1, 1, 1);
const particleMats = new Map();
function pmat(color) {
  if (!particleMats.has(color)) particleMats.set(color, new THREE.MeshBasicMaterial({ color }));
  return particleMats.get(color);
}
export function burst(x, y, z, color, n = 10, spread = 3, up = 3, size = 0.09, life = 0.55) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(particleGeo, pmat(color));
    m.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z + (Math.random() - 0.5) * 0.4);
    m.scale.setScalar(size);
    scene.add(m);
    particles.push({
      mesh: m, life: life * (0.6 + Math.random() * 0.8), max: life, size,
      vel: new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread),
    });
  }
}
export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
    p.vel.y -= 14 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.setScalar(Math.max(0.01, p.size * (p.life / p.max)));
  }
}

/* ================================================================
   掉落物（僵尸掉的心 + 玩家丢弃的物品，可捡回）
================================================================ */
export const pickups = [];
const heartSprite = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#e0245e'; c.strokeStyle = '#7a0f2c'; c.lineWidth = 4;
  c.beginPath();
  c.moveTo(32, 54);
  c.bezierCurveTo(4, 32, 6, 12, 20, 12);
  c.bezierCurveTo(27, 12, 32, 18, 32, 24);
  c.bezierCurveTo(32, 18, 37, 12, 44, 12);
  c.bezierCurveTo(58, 12, 60, 32, 32, 54);
  c.fill(); c.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
export function dropHeart(x, y, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartSprite, transparent: true }));
  s.scale.setScalar(0.45);
  s.position.set(x, y, z);
  scene.add(s);
  pickups.push({ sprite: s, baseY: y, t: Math.random() * 6, life: 30, kind: 'heart' });
}
export function updatePickups(dt, px, py, pz, onPickup) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t += dt; p.life -= dt;
    p.sprite.position.y = p.baseY + Math.sin(p.t * 3) * 0.12;
    if (p.life <= 0) { scene.remove(p.sprite); pickups.splice(i, 1); continue; }
    if (p.sprite.position.distanceTo(new THREE.Vector3(px, py, pz)) < 1.5) {
      onPickup(p);
      scene.remove(p.sprite); pickups.splice(i, 1);
    }
  }
}

// 玩家丢弃的物品掉落物（小方块）
export const droppedItems = [];
const dropGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const dropMats = new Map();
function dropMat(color) {
  if (!dropMats.has(color)) dropMats.set(color, new THREE.MeshBasicMaterial({ color }));
  return dropMats.get(color);
}
export function spawnDropped(id, x, y, z) {
  const m = new THREE.Mesh(dropGeo, dropMat(BLOCKS[id].color));
  m.position.set(x, y, z);
  scene.add(m);
  droppedItems.push({ mesh: m, id, x, vy: 0, t: Math.random() * 6, life: 120, onGround: false });
}
export function updateDropped(dt, px, py, pz, onPickup) {
  for (let i = droppedItems.length - 1; i >= 0; i--) {
    const d = droppedItems[i];
    d.t += dt; d.life -= dt;
    if (d.life <= 0) { scene.remove(d.mesh); droppedItems.splice(i, 1); continue; }
    if (!d.onGround) {
      d.vy -= 24 * dt;
      d.vy = Math.max(d.vy, -20);
      d.mesh.position.y += d.vy * dt;
      const gy = surfaceY(Math.floor(d.mesh.position.x), Math.floor(d.mesh.position.z)) + 0.35;
      if (d.mesh.position.y <= gy) { d.mesh.position.y = gy; d.vy = 0; d.onGround = true; }
    }
    if (Math.hypot(d.mesh.position.x - px, d.mesh.position.z - pz) < 1.4 &&
        Math.abs(d.mesh.position.y - (py + 1)) < 2.2) {
      onPickup(d);
      scene.remove(d.mesh); droppedItems.splice(i, 1);
    }
  }
}

/* ================================================================
   日夜循环
================================================================ */
export const DAY_LEN = 240, NIGHT_LEN = 150, CYCLE = DAY_LEN + NIGHT_LEN;
export let worldTime = DAY_LEN * 0.15;   // 从上午开始
export let isDay = true;
export function setWorldTime(t) { worldTime = t; }
let daylight = 1;

export function updateDayNight(dt, px, py, pz, dim = 'over') {
  if (dim === 'nether') {
    // 下界：无日夜，固定暗红天空
    daylight = 0.1;
    isDay = false;
    sun.position.set(px + 40, py + 60, pz - 30);
    sun.color.setHex(0xff6a3a);
    sun.intensity = 0.55;
    sun.target.position.set(px, py, pz);
    hemi.intensity = 0.35;
    const sky = new THREE.Color(0x4a0f0f);
    scene.fog.color.copy(sky);
    scene.fog.near = 45; scene.fog.far = 140;
    renderer.setClearColor(sky);
    return;
  }
  worldTime = (worldTime + dt) % CYCLE;
  let sunA;
  if (worldTime < DAY_LEN) {
    sunA = (worldTime / DAY_LEN) * Math.PI;
    daylight = Math.max(0.07, Math.sin(sunA));
    isDay = Math.sin(sunA) > 0.03;
  } else {
    const nt = (worldTime - DAY_LEN) / NIGHT_LEN;
    sunA = Math.PI + nt * Math.PI;
    daylight = 0.07;
    isDay = false;
  }
  if (isDay) {
    sun.position.set(px + Math.cos(Math.PI - sunA) * 70, Math.max(12, Math.sin(sunA) * 90), pz + 25);
    sun.color.setHex(0xffffff);
    sun.intensity = 0.25 + daylight * 0.85;
  } else {
    const nt = (worldTime - DAY_LEN) / NIGHT_LEN;
    sun.position.set(px + Math.cos(nt * Math.PI) * 60, Math.max(20, Math.sin(nt * Math.PI) * 70), pz - 25);
    sun.color.setHex(0x8fa8ff);
    sun.intensity = 0.22;
  }
  sun.target.position.set(px, py, pz);
  hemi.intensity = 0.25 + daylight * 0.6;
  const sky = NIGHT_SKY.clone().lerp(DAY_SKY, daylight);
  scene.fog.color.copy(sky);
  renderer.setClearColor(sky);
}

/* ================================================================
   准星方块高亮框
================================================================ */
export const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
);
highlight.visible = false;
scene.add(highlight);
