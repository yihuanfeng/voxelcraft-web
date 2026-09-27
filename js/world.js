import { HEIGHT, CHUNK, SEA, AIR, BEDROCK, STONE, SAND, DIRT, GRASS, WATER, LOG, LEAVES, PLANK,
         COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, LAVA, OBSIDIAN, PORTAL, CRAFT_TABLE,
         NETHERRACK, GLOWSTONE, ANCIENT_DEBRIS, FURNACE, CHEST } from './constants.js';
import { fbm, fbm3, hash2 } from './noise.js';

/* ================================================================
   无限世界：区块化惰性生成
   - 主世界 / 下界各为一个区块 Map（key: "cx,cz" → Uint8Array(CHUNK²·HEIGHT)）
   - getBlock/setBlock 任意坐标；未生成的区块按确定性噪声即时生成
   - 世界原点 (256,256) 附近为出生区域（村庄/传送门固定布局，与旧版本一致）
================================================================ */
const CH = CHUNK, CHH = HEIGHT;
const ckey = (cx, cz) => cx + ',' + cz;
const windex = (lx, y, lz) => (y * CH + lz) * CH + lx;

export const chunks = new Map();        // 主世界区块
export const netherChunks = new Map();  // 下界区块
export const world = chunks;            // 兼容旧引用（调试用）
export let dim = 'over';                // 'over' | 'nether'
export function setDim(d) { dim = d; }

export const inWorld = (x, y, z) => y >= 0 && y < HEIGHT;   // x/z 无限

/* ---------------- 确定性区块生成 ---------------- */
const generating = new Set();

// 区块内写入（越界忽略；用于地形列与树）
function put(arr, lx, y, lz, id) {
  if (lx < 0 || lx >= CH || lz < 0 || lz >= CH || y < 0 || y >= CHH) return;
  arr[windex(lx, y, lz)] = id;
}

function fillColumn(arr, cx, cz, lx, lz, isNether) {
  const x = cx * CH + lx, z = cz * CH + lz;
  if (isNether) {
    const h = 30 + Math.floor(fbm(x * 0.03 + 1000, z * 0.03 + 1000, 3) * 18);
    for (let y = 0; y < HEIGHT; y++) {
      let id;
      if (y === 0) id = BEDROCK;
      else if (y === HEIGHT - 1) id = hash2(x, z) < 0.18 ? BEDROCK : NETHERRACK;
      else if (y <= 10) id = LAVA;
      else if (y <= h) id = NETHERRACK;
      else id = AIR;
      arr[windex(lx, y, lz)] = id;
    }
    // 洞穴
    for (let y = 14; y < HEIGHT - 3; y += 2) {
      if (fbm3(x * 0.07, y * 0.11, z * 0.07, 2) > 0.74) {
        for (let dy = 0; dy < 2; dy++) {
          const yy = y + dy;
          if (yy > 12 && arr[windex(lx, yy, lz)] === NETHERRACK) arr[windex(lx, yy, lz)] = AIR;
        }
      }
    }
    // 荧石团簇
    if (hash2(x * 41, z * 41) < 0.01) {
      const gy = HEIGHT - 2 - Math.floor(hash2(x, z) * 12);
      if (arr[windex(lx, gy, lz)] === NETHERRACK) arr[windex(lx, gy, lz)] = GLOWSTONE;
    }
    // 远古残骸（深层稀有）
    for (let y = 8; y <= 24; y++) {
      if (arr[windex(lx, y, lz)] === NETHERRACK && hash2(x * 53 + y * 3, z * 53) < 0.0022) {
        arr[windex(lx, y, lz)] = ANCIENT_DEBRIS;
      }
    }
  } else {
    const n = fbm(x * 0.014, z * 0.014, 4);
    const detail = fbm(x * 0.06 + 500, z * 0.06 + 500, 2);
    const h = Math.floor(15 + n * 32 + detail * 6);
    for (let y = 0; y <= h; y++) {
      let id;
      if (y === 0) id = BEDROCK;
      else if (y < h - 3) id = STONE;
      else if (y < h) id = (h <= SEA + 1 ? SAND : DIRT);
      else id = (h <= SEA + 1 ? SAND : GRASS);
      arr[windex(lx, y, lz)] = id;
    }
    for (let y = h + 1; y <= SEA; y++) arr[windex(lx, y, lz)] = WATER;
    // 洞穴（更深的矿洞）
    for (let y = 4; y < h - 1; y += 2) {
      if (fbm3(x * 0.055, y * 0.09, z * 0.055, 2) > 0.68) {
        for (let dy = 0; dy < 2; dy++) {
          const yy = y + dy;
          if (yy > 2 && yy < h - 1 && arr[windex(lx, yy, lz)] === STONE) arr[windex(lx, yy, lz)] = AIR;
        }
      }
    }
    // 矿物团簇（按深度分布）
    for (let y = 2; y < h - 1; y++) {
      if (arr[windex(lx, y, lz)] !== STONE) continue;
      const r = hash2(x * 31 + y * 7, z * 31 + y * 13);
      if (y <= 16 && r < 0.0032)      arr[windex(lx, y, lz)] = DIAMOND_ORE;
      else if (y <= 30 && r < 0.005)  arr[windex(lx, y, lz)] = GOLD_ORE;
      else if (y <= 52 && r < 0.012)  arr[windex(lx, y, lz)] = IRON_ORE;
      else if (y <= 80 && r < 0.022)  arr[windex(lx, y, lz)] = COAL_ORE;
    }
    // 深层岩浆池
    for (let y = 3; y <= 7; y++) {
      if (arr[windex(lx, y, lz)] === STONE && hash2(x * 17 + y, z * 17) < 0.004) {
        arr[windex(lx, y, lz)] = LAVA;
        if (arr[windex(lx, y + 1, lz)] === STONE) arr[windex(lx, y + 1, lz)] = LAVA;
      }
    }
    // 树（写本区块内；边界树叶由相邻区块自行生成）
    if (arr[windex(lx, h, lz)] === GRASS && hash2(x + 9000, z + 9000) <= 0.014) {
      const th = 4 + Math.floor(hash2(x * 3 + 7, z * 3 + 7) * 3);
      for (let i = 1; i <= th; i++) put(arr, lx, h + i, lz, LOG);
      for (let dy = th - 2; dy <= th + 1; dy++) {
        const r = dy <= th - 1 ? 2 : 1;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy <= th) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r && hash2(x + dx * 31 + dy, z + dz * 31) < 0.5) continue;
          if (dy > 0) put(arr, lx + dx, h + dy, lz + dz, LEAVES);
        }
      }
    }
  }
}

// 世界级写入（任意坐标，自动生成目标区块）
function wset(x, y, z, id) {
  if (y < 0 || y >= HEIGHT) return;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  const arr = getOrCreate(cx, cz, false);
  arr[windex(x - cx * CH, y, z - cz * CH)] = id;
}

function genChunk(cx, cz, isNether) {
  const key = ckey(cx, cz);
  const arr = new Uint8Array(CH * CH * CHH);
  (isNether ? netherChunks : chunks).set(key, arr);
  generating.add(key);
  for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) fillColumn(arr, cx, cz, lx, lz, isNether);
  if (!isNether) placeStructures(cx, cz);
  else placeNetherStructures(cx, cz);
  generating.delete(key);
  return arr;
}

function getOrCreate(cx, cz, isNether) {
  const map = isNether ? netherChunks : chunks;
  const key = ckey(cx, cz);
  let arr = map.get(key);
  if (!arr) arr = genChunk(cx, cz, isNether);
  return arr;
}

export function getBlock(x, y, z) {
  if (y < 0) return BEDROCK;
  if (y >= HEIGHT) return AIR;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  const arr = getOrCreate(cx, cz, dim === 'nether');
  return arr[windex(x - cx * CH, y, z - cz * CH)];
}
export function setBlock(x, y, z, id) {
  if (y < 0 || y >= HEIGHT) return false;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  const arr = getOrCreate(cx, cz, dim === 'nether');
  arr[windex(x - cx * CH, y, z - cz * CH)] = id;
  return true;
}
// 碰撞实心判定
export function isSolid(x, y, z) {
  if (y < 0) return true;
  if (y >= HEIGHT) return false;
  const id = getBlock(x, y, z);
  return id !== AIR && id !== WATER && id !== LAVA;
}
export function surfaceY(x, z) {
  for (let y = HEIGHT - 1; y > 0; y--) {
    const id = getBlock(x, y, z);
    if (id !== AIR && id !== WATER) return y;
  }
  return 0;
}

/* ================================================================
   方块差异记录（存档用，主世界；任意坐标）
================================================================ */
export const pendingDiffs = new Map();
export let saveDirty = false;
export function markDirty(x, y, z) {
  if (dim !== 'over' || y < 0 || y >= HEIGHT) return;
  pendingDiffs.set(x + ',' + y + ',' + z, getBlock(x, y, z));
  saveDirty = true;
}

/* ================================================================
   村庄 / 传送门（固定布局，位于世界原点附近，与旧版本一致）
================================================================ */
export const villages = [];       // {x, y, z} 村庄中心（主世界）
export const overworldPortals = []; // {x, y, z} 主世界传送门
export const netherPortals = [];    // {x, y, z} 下界传送门

// 旧算法村庄候选（SIZE=512 世界内的 5 处，位置固定）
const VILLAGE_SPOTS = [];
(function () {
  let placed = 0;
  for (let tries = 0; tries < 180 && placed < 5; tries++) {
    const vx = 30 + Math.floor(hash2(tries * 7 + 1, 99) * (512 - 60));
    const vz = 30 + Math.floor(hash2(tries * 13 + 5, 55) * (512 - 60));
    if (Math.abs(vx - 256) < 24 && Math.abs(vz - 256) < 24) continue;
    VILLAGE_SPOTS.push([vx, vz]);
    placed++;
  }
})();
const PORTAL_SPOTS = [[96, 92], [228, 40]];

function pget(x, y, z, isNether) {
  if (y < 0) return BEDROCK;
  if (y >= HEIGHT) return AIR;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  const arr = getOrCreate(cx, cz, isNether);
  return arr[windex(x - cx * CH, y, z - cz * CH)];
}
function placePortalStructure(px, pz, isNether) {
  let y = -1;
  for (let yy = HEIGHT - 1; yy > 2; yy--) {
    const id = pget(px, yy, pz, isNether);
    if (id !== AIR && id !== WATER && id !== BEDROCK) { y = yy + 1; break; }
  }
  if (y <= 2 || y >= HEIGHT - 7) return;
  for (let yy = y - 1; yy <= y + 5; yy++) {
    if (pget(px, yy, pz, isNether) === WATER || pget(px + 1, yy, pz, isNether) === WATER) return;
  }
  for (let yy = y; yy <= y + 5; yy++) {
    wset(px, yy, pz, (yy === y || yy === y + 5) ? OBSIDIAN : PORTAL);
    wset(px + 1, yy, pz, (yy === y || yy === y + 5) ? OBSIDIAN : PORTAL);
  }
  wset(px, y + 6, pz, OBSIDIAN);
  wset(px + 1, y + 6, pz, OBSIDIAN);
  const portalY = y + 2.5;
  if (isNether) netherPortals.push({ x: px + 0.5, y: portalY, z: pz + 0.5 });
  else overworldPortals.push({ x: px + 0.5, y: portalY, z: pz + 0.5 });
}

// 村庄建筑（与旧算法一致；世界级写入，可跨区块）
function placeVillage(vx, vz) {
  const vy = surfaceY(vx, vz);
  if (vy < SEA + 2 || vy > 42) return;
  const houses = 3 + Math.floor(hash2(vx, vz) * 3);
  const dirs = [];
  for (let i = 0; i < houses; i++) {
    const a = i * (Math.PI * 2 / houses);
    dirs.push([Math.floor(Math.cos(a) * 7), Math.floor(Math.sin(a) * 7)]);
  }
  for (const [dx, dz] of dirs) {
    const hx = vx + dx, hz = vz + dz, hy = surfaceY(hx, hz);
    if (hy < SEA + 2 || hy > 42) continue;
    for (let yy = hy + 1; yy <= hy + 3; yy++) {
      for (let xx = hx - 2; xx <= hx + 2; xx++) wset(xx, yy, hz - 2, LOG);
      for (let xx = hx - 2; xx <= hx + 2; xx++) {
        if (xx === hx && yy <= hy + 2) continue;
        wset(xx, yy, hz + 2, LOG);
      }
    }
    for (let yy = hy + 1; yy <= hy + 3; yy++) {
      wset(hx - 2, yy, hz - 1, LOG);
      wset(hx - 2, yy, hz + 1, LOG);
      wset(hx + 2, yy, hz - 1, LOG);
      wset(hx + 2, yy, hz + 1, LOG);
    }
    for (let xx = hx - 1; xx <= hx + 1; xx++) for (let zz = hz - 1; zz <= hz + 1; zz++) {
      wset(xx, hy + 3, zz, LOG);
      if (xx === hx && zz === hz) continue;
      wset(xx, hy + 1, zz, PLANK);
      wset(xx, hy + 2, zz, AIR);
    }
    wset(hx, hy + 1, hz, CRAFT_TABLE);
    wset(hx - 1, hy + 1, hz, FURNACE);
    wset(hx + 1, hy + 1, hz, CHEST);
  }
  villages.push({ x: vx + 0.5, y: vy + 1.2, z: vz + 0.5 });
}

function placeStructures(cx, cz) {
  const x0 = cx * CH, z0 = cz * CH;
  for (const [vx, vz] of VILLAGE_SPOTS) {
    if (vx >= x0 && vx < x0 + CH && vz >= z0 && vz < z0 + CH) placeVillage(vx, vz);
  }
  for (const [px, pz] of PORTAL_SPOTS) {
    if (px >= x0 && px < x0 + CH && pz >= z0 && pz < z0 + CH) placePortalStructure(px, pz, false);
  }
}
function placeNetherStructures(cx, cz) {
  const x0 = cx * CH, z0 = cz * CH;
  for (const [px, pz] of PORTAL_SPOTS) {
    if (px >= x0 && px < x0 + CH && pz >= z0 && pz < z0 + CH) placePortalStructure(px, pz, true);
  }
}

/* 兼容旧 API：维度不再整图预生成（数据惰性生成），保留空实现 */
export function generateWorld() { /* 无限世界：区块按需生成 */ }
export function generateNether() { /* 无限世界：区块按需生成 */ }

/* ================================================================
   实体物理 / 射线
================================================================ */
export const EPS = 1e-4;
export function collideAxis(e, axis) {
  const half = e.w / 2;
  const x0 = Math.floor(e.pos.x - half + EPS), x1 = Math.floor(e.pos.x + half - EPS);
  const y0 = Math.floor(e.pos.y + EPS),        y1 = Math.floor(e.pos.y + e.h - EPS);
  const z0 = Math.floor(e.pos.z - half + EPS), z1 = Math.floor(e.pos.z + half - EPS);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (!isSolid(x, y, z)) continue;
    if (axis === 0)      e.pos.x = (e.vel.x > 0) ? x - half - EPS : x + 1 + half + EPS;
    else if (axis === 2) e.pos.z = (e.vel.z > 0) ? z - half - EPS : z + 1 + half + EPS;
    else                 e.pos.y = (e.vel.y > 0) ? y - e.h - EPS : y + 1 + EPS;
    return true;
  }
  return false;
}
export function moveEntity(e, dt) {
  e.impact = 0;
  e.pos.x += e.vel.x * dt; if (collideAxis(e, 0)) e.vel.x = 0;
  e.pos.z += e.vel.z * dt; if (collideAxis(e, 2)) e.vel.z = 0;
  e.pos.y += e.vel.y * dt; e.onGround = false;
  if (collideAxis(e, 1)) {
    if (e.vel.y < 0) { e.onGround = true; e.impact = -e.vel.y; }
    e.vel.y = 0;
  }
}

export function raycastVoxel(origin, dir, maxDist) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const sx = dir.x > 0 ? 1 : -1, sy = dir.y > 0 ? 1 : -1, sz = dir.z > 0 ? 1 : -1;
  const tdx = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tdy = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tdz = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tmx = dir.x !== 0 ? (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tdx : Infinity;
  let tmy = dir.y !== 0 ? (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tdy : Infinity;
  let tmz = dir.z !== 0 ? (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tdz : Infinity;
  let fx = 0, fy = 0, fz = 0, t = 0;
  for (let i = 0; i < 256; i++) {
    if (tmx < tmy && tmx < tmz)      { x += sx; t = tmx; tmx += tdx; fx = -sx; fy = 0; fz = 0; }
    else if (tmy < tmz)              { y += sy; t = tmy; tmy += tdy; fx = 0; fy = -sy; fz = 0; }
    else                             { z += sz; t = tmz; tmz += tdz; fx = 0; fy = 0; fz = -sz; }
    if (t > maxDist) return null;
    const id = getBlock(x, y, z);
    if (id !== AIR && id !== WATER) return { x, y, z, fx, fy, fz, id, dist: t };
  }
  return null;
}
