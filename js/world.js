import { SIZE, HEIGHT, SEA, AIR, BEDROCK, STONE, SAND, DIRT, GRASS, WATER, LOG, LEAVES, PLANK,
         COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, LAVA, OBSIDIAN, PORTAL, CRAFT_TABLE,
         NETHERRACK, GLOWSTONE, ANCIENT_DEBRIS, FURNACE, CHEST } from './constants.js';
import { fbm, fbm3, hash2 } from './noise.js';

/* ================================================================
   世界数据（主世界 world / 下界 nether 两个维度）
================================================================ */
export const world = new Uint8Array(SIZE * SIZE * HEIGHT);
export const nether = new Uint8Array(SIZE * SIZE * HEIGHT);
export let dim = 'over';            // 'over' | 'nether'
export function setDim(d) { dim = d; }
export const widx = (x, y, z) => (y * SIZE + z) * SIZE + x;
export const inWorld = (x, y, z) => x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y < HEIGHT;

export function getBlock(x, y, z) {
  if (y < 0) return BEDROCK;
  if (y >= HEIGHT || x < 0 || x >= SIZE || z < 0 || z >= SIZE) return AIR;
  const arr = dim === 'over' ? world : nether;
  return arr[widx(x, y, z)];
}
export function setBlock(x, y, z, id) {
  if (!inWorld(x, y, z)) return false;
  const arr = dim === 'over' ? world : nether;
  arr[widx(x, y, z)] = id;
  return true;
}
// 碰撞实心判定
export function isSolid(x, y, z) {
  if (y < 0) return true;
  if (y >= HEIGHT) return false;
  if (x < 0 || x >= SIZE || z < 0 || z >= SIZE) return true;
  const id = getBlock(x, y, z);
  // 水与岩浆均可进入（岩浆进入后持续受伤）
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
   方块差异记录（存档用，主世界）
================================================================ */
export const pendingDiffs = new Map();
export let saveDirty = false;
export function markDirty(x, y, z) {
  if (dim !== 'over' || !inWorld(x, y, z)) return;
  pendingDiffs.set(x + ',' + y + ',' + z, world[widx(x, y, z)]);
  saveDirty = true;
}

/* ================================================================
   村庄 / 传送门标记
================================================================ */
export const villages = [];       // {x, y, z} 村庄中心（主世界）
export const overworldPortals = []; // {x, y, z} 主世界传送门
export const netherPortals = [];    // {x, y, z} 下界传送门

/* ================================================================
   主世界生成（确定性：每次一致，可配合差异存档）
================================================================ */
function placePortalStructure(px, pz, arr, portals, maxY = HEIGHT - 1) {
  // 在 (px,pz) 地表建 4x5 黑曜石传送门（中间为传送方块）
  // maxY：向下搜索上限（下界用于避开顶部基岩层，把门建在下界岩表面）
  let y = -1;
  for (let yy = Math.min(HEIGHT - 1, maxY); yy > 2; yy--) {
    const id = arr[widx(px, yy, pz)];
    // 跳过水与基岩层（下界顶部基岩不应作为传送门落点）
    if (id !== AIR && id !== WATER && id !== BEDROCK) { y = yy + 1; break; }
  }
  if (y <= 2 || y >= HEIGHT - 7) return;
  // 门柱全高度必须非水（避免传送门泡在水里）
  for (let yy = y - 1; yy <= y + 5; yy++) {
    if (arr[widx(px, yy, pz)] === WATER || arr[widx(px + 1, yy, pz)] === WATER) return;
  }
  const bx = px, bz = pz;
  for (let yy = y; yy <= y + 5; yy++) {
    arr[widx(bx, yy, bz)] = (yy === y || yy === y + 5) ? OBSIDIAN : PORTAL;
    arr[widx(bx + 1, yy, bz)] = (yy === y || yy === y + 5) ? OBSIDIAN : PORTAL;
  }
  arr[widx(bx, y + 6, bz)] = OBSIDIAN;
  arr[widx(bx + 1, y + 6, bz)] = OBSIDIAN;
  // 清掉门内挡路方块
  for (let yy = y; yy <= y + 5; yy++) {
    if (arr[widx(bx, yy, bz)] !== OBSIDIAN) arr[widx(bx, yy, bz)] = PORTAL;
    if (arr[widx(bx + 1, yy, bz)] !== OBSIDIAN) arr[widx(bx + 1, yy, bz)] = PORTAL;
  }
  portals.push({ x: bx + 0.5, y: y + 2.5, z: bz + 0.5 });
}

export function generateWorld() {
  // 地表与地下
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const n = fbm(x * 0.014, z * 0.014, 4);
    const detail = fbm(x * 0.06 + 500, z * 0.06 + 500, 2);
    const h = Math.floor(15 + n * 32 + detail * 6);
    for (let y = 0; y <= h; y++) {
      let id;
      if (y === 0) id = BEDROCK;
      else if (y < h - 3) id = STONE;
      else if (y < h) id = (h <= SEA + 1 ? SAND : DIRT);
      else id = (h <= SEA + 1 ? SAND : GRASS);
      world[widx(x, y, z)] = id;
    }
    for (let y = h + 1; y <= SEA; y++) world[widx(x, y, z)] = WATER;
    // 洞穴（3D 粗噪声，step 2 采样；阈值更低 → 矿洞更多更大）
    for (let y = 4; y < h - 1; y += 2) {
      if (fbm3(x * 0.055, y * 0.09, z * 0.055, 2) > 0.68) {
        for (let dy = 0; dy < 2; dy++) {
          const yy = y + dy;
          if (yy > 2 && yy < h - 1 && world[widx(x, yy, z)] === STONE) world[widx(x, yy, z)] = AIR;
        }
      }
    }
    // 矿物团簇（按深度分布）
    for (let y = 2; y < h - 1; y++) {
      const id = world[widx(x, y, z)];
      if (id !== STONE) continue;
      const r = hash2(x * 31 + y * 7, z * 31 + y * 13);
      if (y <= 16 && r < 0.0032)      world[widx(x, y, z)] = DIAMOND_ORE;
      else if (y <= 30 && r < 0.005)  world[widx(x, y, z)] = GOLD_ORE;
      else if (y <= 52 && r < 0.012)  world[widx(x, y, z)] = IRON_ORE;
      else if (y <= 80 && r < 0.022)  world[widx(x, y, z)] = COAL_ORE;
    }
    // 深层岩浆池
    for (let y = 3; y <= 7; y++) {
      if (world[widx(x, y, z)] === STONE && hash2(x * 17 + y, z * 17) < 0.004) {
        world[widx(x, y, z)] = LAVA;
        if (world[widx(x, y + 1, z)] === STONE) world[widx(x, y + 1, z)] = LAVA;
      }
    }
  }
  // 树
  for (let x = 3; x < SIZE - 3; x++) for (let z = 3; z < SIZE - 3; z++) {
    const y = surfaceY(x, z);
    if (world[widx(x, y, z)] !== GRASS) continue;
    if (hash2(x + 9000, z + 9000) > 0.014) continue;
    const th = 4 + Math.floor(hash2(x * 3 + 7, z * 3 + 7) * 3);
    for (let i = 1; i <= th; i++) world[widx(x, y + i, z)] = LOG;
    for (let dy = th - 2; dy <= th + 1; dy++) {
      const r = dy <= th - 1 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy <= th) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && hash2(x + dx * 31 + dy, z + dz * 31) < 0.5) continue;
        const px = x + dx, py = y + dy, pz = z + dz;
        if (inWorld(px, py, pz) && world[widx(px, py, pz)] === AIR) world[widx(px, py, pz)] = LEAVES;
      }
    }
  }
  // 村庄（平原上找 3 处）
  villages.length = 0;
  let placed = 0;
  for (let tries = 0; tries < 180 && placed < 5; tries++) {
    const vx = 30 + Math.floor(hash2(tries * 7 + 1, 99) * (SIZE - 60));
    const vz = 30 + Math.floor(hash2(tries * 13 + 5, 55) * (SIZE - 60));
    const vy = surfaceY(vx, vz);
    if (vy < SEA + 2 || vy > 42) continue;
    if (Math.abs(vx - SIZE / 2) < 24 && Math.abs(vz - SIZE / 2) < 24) continue;   // 避开出生点
    // 简单村庄：3-5 栋木屋
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
        for (let xx = hx - 2; xx <= hx + 2; xx++) world[widx(xx, yy, hz - 2)] = LOG;
        for (let xx = hx - 2; xx <= hx + 2; xx++) {
          if (xx === hx && yy <= hy + 2) continue;   // 正面（村庄侧）门洞：宽1高2
          world[widx(xx, yy, hz + 2)] = LOG;
        }
      }
      for (let yy = hy + 1; yy <= hy + 3; yy++) {
        world[widx(hx - 2, yy, hz - 1)] = LOG;
        world[widx(hx - 2, yy, hz + 1)] = LOG;
        world[widx(hx + 2, yy, hz - 1)] = LOG;
        world[widx(hx + 2, yy, hz + 1)] = LOG;
      }
      for (let xx = hx - 1; xx <= hx + 1; xx++) for (let zz = hz - 1; zz <= hz + 1; zz++) {
        world[widx(xx, hy + 3, zz)] = LOG;
        if (xx === hx && zz === hz) continue;   // 房顶开口
        world[widx(xx, hy + 1, zz)] = PLANK;
        world[widx(xx, hy + 2, zz)] = AIR;
      }
      // 屋内：工作台 + 熔炉 + 箱子
      world[widx(hx, hy + 1, hz)] = CRAFT_TABLE;
      world[widx(hx - 1, hy + 1, hz)] = FURNACE;
      world[widx(hx + 1, hy + 1, hz)] = CHEST;
    }
    villages.push({ x: vx + 0.5, y: vy + 1.2, z: vz + 0.5 });
    placed++;
  }
  // 传送门（主世界 2 处：出生点附近 + 远处）
  overworldPortals.length = 0;
  const portalSpots = [[96, 92], [100, 96], [92, 88], [104, 100], [228, 40], [232, 44], [224, 36]];
  for (const [px, pz] of portalSpots) {
    if (overworldPortals.length >= 2) break;
    placePortalStructure(px, pz, world, overworldPortals);
  }
  // 出生点修正：若出生点落在水里则挪到传送门旁
}

/* ================================================================
   下界生成（确定性；岩浆海 + 下界岩 + 荧石 + 远古残骸）
================================================================ */
export function generateNether() {
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const h = 30 + Math.floor(fbm(x * 0.03 + 1000, z * 0.03 + 1000, 3) * 18);
    for (let y = 0; y < HEIGHT; y++) {
      let id;
      if (y === 0) id = BEDROCK;                          // 底部基岩
      else if (y === HEIGHT - 1) id = hash2(x, z) < 0.18 ? BEDROCK : NETHERRACK;  // 顶部留洞
      else if (y <= 10) id = LAVA;                       // 底部岩浆海
      else if (y <= h) id = NETHERRACK;
      else id = AIR;
      nether[widx(x, y, z)] = id;
    }
    // 洞穴
    for (let y = 14; y < HEIGHT - 3; y += 2) {
      if (fbm3(x * 0.07, y * 0.11, z * 0.07, 2) > 0.74) {
        for (let dy = 0; dy < 2; dy++) {
          const yy = y + dy;
          if (yy > 12 && nether[widx(x, yy, z)] === NETHERRACK) nether[widx(x, yy, z)] = AIR;
        }
      }
    }
    // 荧石团簇（顶部与随机）
    if (hash2(x * 41, z * 41) < 0.01) {
      const gy = HEIGHT - 2 - Math.floor(hash2(x, z) * 12);
      if (nether[widx(x, gy, z)] === NETHERRACK) nether[widx(x, gy, z)] = GLOWSTONE;
    }
    // 远古残骸（深层稀有）
    for (let y = 8; y <= 24; y++) {
      if (nether[widx(x, y, z)] === NETHERRACK && hash2(x * 53 + y * 3, z * 53) < 0.0022) {
        nether[widx(x, y, z)] = ANCIENT_DEBRIS;
      }
    }
  }
  // 下界传送门（对应主世界传送门坐标，供返回）
  netherPortals.length = 0;
  placePortalStructure(96, 92, nether, netherPortals, 78);
  placePortalStructure(228, 40, nether, netherPortals, 78);
}

/* ================================================================
   实体物理 / 射线（同前）
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

// 模块加载即生成两个维度（确定性；spawn 等依赖世界数据的模块在其后执行）
generateWorld();
generateNether();

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
