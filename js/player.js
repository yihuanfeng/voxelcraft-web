import * as THREE from 'three';
import { SIZE, AIR, WATER, BEDROCK, BLOCKS, isPlaceable,
         STONE, COBBLE, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE,
         COAL, IRON_INGOT, GOLD_INGOT, DIAMOND, COPPER_ORE, COPPER_INGOT, LAVA, PORTAL, toolSpeedFor,
         TOOL_TIER, BLOCK_TIER } from './constants.js';
import { getBlock, setBlock, surfaceY, moveEntity, markDirty, tryLightPortal } from './world.js';
import { sfx, initAudio } from './audio.js';
import { addItem, removeItem, itemCount, sel, selectedHotbarId, autoSlot, inventoryEvents, armorDefense } from './inventory.js';
import { camera, aimBlock, rebuildAround, burst, spawnDropped } from './renderer.js';

/* ================================================================
   键盘状态（输入绑定在 main.js）
================================================================ */
export const keys = {};

/* ================================================================
   出生点
================================================================ */
export const spawn = (() => {
  for (let r = 0; r < 40; r += 4) for (let a = 0; a < 6.28; a += 0.7) {
    const x = Math.floor(SIZE / 2 + Math.cos(a) * r), z = Math.floor(SIZE / 2 + Math.sin(a) * r);
    if (x < 2 || x >= SIZE - 2 || z < 2 || z >= SIZE - 2) continue;
    const y = surfaceY(x, z);
    if (y > 21) return new THREE.Vector3(x + 0.5, y + 1.01, z + 0.5);
  }
  return new THREE.Vector3(SIZE / 2 + 0.5, 45, SIZE / 2 + 0.5);
})();

/* ================================================================
   玩家
================================================================ */
export const player = {
  pos: spawn.clone(), vel: new THREE.Vector3(),
  w: 0.6, h: 1.8, eye: 1.62,
  yaw: Math.PI * 0.75, pitch: -0.05,
  onGround: false, hp: 20, dead: false, fly: false,
  inWater: false, headInWater: false, impact: 0,
  lastHurt: -999,
  air: 20,               // 氧气（水下耗尽后窒息掉血）
};
export let suffocateT = 0;

export let clockTime = 0;
export let flashV = 0;
export function updateFlash(dt) { flashV = Math.max(0, flashV - dt * 2.5); return flashV; }
export const playerEvents = new EventTarget();

/* ================================================================
   移动 & 物理
================================================================ */
export function updatePlayer(dt) {
  clockTime += dt;
  const sprint = keys['ShiftLeft'] && !player.fly;
  const speed = player.fly ? 11 : (sprint ? 6.3 : 4.3);
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const r = new THREE.Vector3(-f.z, 0, f.x);
  const dir = new THREE.Vector3();
  if (keys['KeyW']) dir.add(f);
  if (keys['KeyS']) dir.sub(f);
  if (keys['KeyD']) dir.add(r);
  if (keys['KeyA']) dir.sub(r);
  if (dir.lengthSq() > 0) dir.normalize();

  const cb = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.4), Math.floor(player.pos.z));
  const wasInWater = player.inWater;
  player.inWater = cb === WATER ||
    getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 1.2), Math.floor(player.pos.z)) === WATER;
  player.headInWater = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + player.eye), Math.floor(player.pos.z)) === WATER;
  if (player.inWater && !wasInWater && player.vel.y < -6) sfx.splash();

  if (player.fly) {
    player.vel.x = dir.x * speed; player.vel.z = dir.z * speed;
    player.vel.y = (keys['Space'] ? speed : 0) + (keys['KeyC'] ? -speed : 0);
  } else if (player.inWater) {
    player.vel.x = dir.x * speed * 0.65; player.vel.z = dir.z * speed * 0.65;
    player.vel.y -= 9 * dt;
    if (keys['Space']) player.vel.y = 3.6;
    player.vel.y = Math.max(-4, Math.min(3.6, player.vel.y));
  } else {
    player.vel.x = dir.x * speed; player.vel.z = dir.z * speed;
    player.vel.y -= 30 * dt;
    if (player.vel.y < -50) player.vel.y = -50;
    if (keys['Space'] && player.onGround) { player.vel.y = 9.5; player.onGround = false; }
  }

  moveEntity(player, dt);

  // 摔落伤害
  if (!player.fly && !player.inWater && player.impact > 16) {
    const dmg = Math.floor((player.impact - 15) / 2);
    if (dmg > 0) damagePlayer(dmg, null, 'fell from a high place');
  }

  // 10 秒未受伤缓慢回血
  if (!player.dead && clockTime - player.lastHurt > 10 && player.hp < 20) {
    player.hp = Math.min(20, player.hp + dt * 1.5);
    playerEvents.dispatchEvent(new CustomEvent('healthchange'));
  }

  // 岩浆伤害（身处或踩在岩浆上）
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
  const lavaBlock = getBlock(px, Math.floor(player.pos.y + 0.4), pz) === LAVA ||
                    getBlock(px, Math.floor(player.pos.y - 0.1), pz) === LAVA;
  if (lavaBlock) {
    lavaT += dt;
    if (lavaT > 0.6) { lavaT = 0; damagePlayer(2, null, '岩浆'); }
  } else lavaT = 0;

  // 水下呼吸：头没入水中消耗氧气，耗尽后窒息掉血；出水恢复
  if (player.headInWater) {
    player.air = Math.max(0, player.air - dt * 1.35);
    if (player.air <= 0) {
      suffocateT += dt;
      if (suffocateT >= 1) { suffocateT = 0; damagePlayer(1, null, '窒息'); }
    }
  } else {
    player.air = Math.min(20, player.air + dt * 4);
    suffocateT = 0;
  }
  playerEvents.dispatchEvent(new CustomEvent('airchange'));

  camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}
export let lavaT = 0;
export function touchingPortal() {
  const p = player.pos;
  for (let oy = 0; oy <= 2; oy++) {
    if (getBlock(Math.floor(p.x), Math.floor(p.y + oy), Math.floor(p.z)) === PORTAL) return true;
  }
  return false;
}

/* ================================================================
   挖掘 & 放置
================================================================ */
export const mining = { active: false, x: 0, y: 0, z: 0, t: 0 };

const ORE_DROPS = {
  [STONE]: COBBLE, [COAL_ORE]: COAL, [IRON_ORE]: IRON_INGOT,
  [GOLD_ORE]: GOLD_INGOT, [DIAMOND_ORE]: DIAMOND, [COPPER_ORE]: COPPER_INGOT,
};
export function breakBlock(x, y, z, toolId) {
  const id = getBlock(x, y, z);
  if (id === AIR || id === WATER) return false;
  if (id === BEDROCK && !TOOL_TIER[toolId]) return false;   // 基岩必须用镐
  setBlock(x, y, z, AIR);
  markDirty(x, y, z);
  // 工具等级不足 → 挖掉但无掉落（提示会显示需要更高级镐）
  const tier = TOOL_TIER[toolId] || 0;
  const needTier = BLOCK_TIER[id] || 0;
  let drop = ORE_DROPS[id] || id;
  if (needTier && tier < needTier) drop = null;
  if (drop) { addItem(drop); autoSlot(drop); }
  burst(x + 0.5, y + 0.5, z + 0.5, BLOCKS[id].color, 12, 3.2, 3.5);
  sfx.break();
  rebuildAround(x, z);
  return true;
}
export function updateMining(dt) {
  const minebar = document.getElementById('minebar');
  if (!mining.active) { minebar.style.display = 'none'; return; }
  const hit = aimBlock();
  if (!hit) { mining.t = 0; minebar.style.display = 'none'; return; }
  if (hit.x !== mining.x || hit.y !== mining.y || hit.z !== mining.z) {
    mining.x = hit.x; mining.y = hit.y; mining.z = hit.z; mining.t = 0;
  }
  const hard = BLOCKS[hit.id].hard;
  if (!isFinite(hard)) { minebar.style.display = 'none'; return; }
  const tool = selectedHotbarId();
  if (hit.id === BEDROCK && !TOOL_TIER[tool]) return;   // 基岩必须用镐才能挖
  mining.t += dt / toolSpeedFor(tool, hit.id);
  const p = Math.min(1, mining.t / hard);
  minebar.style.display = 'block';
  minebar.firstElementChild.style.width = (p * 100).toFixed(1) + '%';
  if (p >= 1) {
    breakBlock(hit.x, hit.y, hit.z, tool);
    mining.t = 0;
    mining.x = mining.y = mining.z = -999;
  }
}
export function placeBlock() {
  const hit = aimBlock();
  if (!hit) return;
  const id = selectedHotbarId();
  if (id == null || !isPlaceable(id) || itemCount(id) <= 0) return;
  const px = hit.x + hit.fx, py = hit.y + hit.fy, pz = hit.z + hit.fz;
  const cur = getBlock(px, py, pz);
  if (cur !== AIR && cur !== WATER) return;
  // 不能放进玩家身体里
  const half = player.w / 2;
  if (px + 1 > player.pos.x - half && px < player.pos.x + half &&
      pz + 1 > player.pos.z - half && pz < player.pos.z + half &&
      py + 1 > player.pos.y && py < player.pos.y + player.h) return;
  if (!setBlock(px, py, pz, id)) return;
  markDirty(px, py, pz);
  removeItem(id);
  sfx.place();
  rebuildAround(px, pz);
  // 黑曜石搭出门框 → 自动激活传送门
  if (id === OBSIDIAN && tryLightPortal(px, py, pz)) {
    sfx.portal && sfx.portal();
  }
}

/* ================================================================
   丢弃物品（Q 键）—— 丢到面前地上，可捡回
================================================================ */
export function dropItem() {
  const id = selectedHotbarId();
  if (id == null || itemCount(id) <= 0) return;
  removeItem(id, 1);
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const x = player.pos.x + dir.x * 1.6, z = player.pos.z + dir.z * 1.6;
  const y = Math.max(player.pos.y + 0.5, surfaceY(Math.floor(x), Math.floor(z)) + 1.0);
  spawnDropped(id, x, y, z);
  sfx.drop();
}

/* ================================================================
   伤害 / 死亡 / 重生
================================================================ */
export function damagePlayer(amount, fromDir, cause) {
  if (player.dead) return;
  // 盔甲减伤：每 1 点防御约减 4%（原版风格），最多减 80%
  const def = armorDefense();
  const final = Math.max(0.5, amount * (1 - Math.min(0.8, def / 25)));
  player.hp -= final;
  player.lastHurt = clockTime;
  flashV = 1;
  sfx.hurt();
  if (fromDir) {
    player.vel.x += fromDir.x * 5; player.vel.z += fromDir.z * 5; player.vel.y += 2.5;
  }
  playerEvents.dispatchEvent(new CustomEvent('healthchange'));
  if (player.hp <= 0) {
    player.hp = 0;
    player.dead = true;
    playerEvents.dispatchEvent(new CustomEvent('death', { detail: { cause } }));
    mining.active = false;
  }
}
export function respawn() {
  player.hp = 20; player.dead = false;
  player.pos.copy(spawn); player.vel.set(0, 0, 0);
  playerEvents.dispatchEvent(new CustomEvent('healthchange'));
  playerEvents.dispatchEvent(new CustomEvent('respawn'));
}
