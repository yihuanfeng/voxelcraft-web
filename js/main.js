import * as THREE from 'three';
import { CRAFT_TABLE, TOOL_DAMAGE } from './constants.js';
import {
  world, getBlock, setBlock, surfaceY, generateWorld, generateNether,
  setDim, dim, overworldPortals, netherPortals, villages,
} from './world.js';
import {
  applyWorldDiff, applyPlayerSave, flushSave,
  loadSettings, saveSettings, SAVE_KEY, disableSave,
} from './save.js';
import {
  renderer, scene, camera, aimBlock, highlight,
  rebuildAll, scheduleRebuildAll, updateBuildQueue, ensureChunks,
  updateDayNight, updateParticles,
  updatePickups, updateDropped, setWorldTime, isDay, droppedItems, pickups,
} from './renderer.js';
import {
  player, spawn, updatePlayer, updateMining, dropItem,
  respawn, damagePlayer, keys, mining, updateFlash,
  placeBlock, breakBlock, touchingPortal, playerEvents,
} from './player.js';
import { updateSpawner, zombies, zombieBoxes, setPeaceful, Zombie, updateBoneProjectiles } from './zombies.js';
import { LAVA, BEDROCK } from './constants.js';
import { inv, invSlots, sel, setSel, addItem, selectedHotbarId } from './inventory.js';
import { sfx, initAudio } from './audio.js';
import {
  buildHotbarHud, renderHearts, renderDebug,
  updateSaveStatus, openInventory, closeInventory, isInventoryOpen,
  bindInventoryUI, bindTableUI, openTable, closeTable, isTableOpen,
  setMenuSubtitle, renderAir, renderBlockInfo,
  toggleMap, isMapOpen, tickMap,
} from './ui.js';
import { spawnVillagers, updateVillagers, setVillagersVisible, villagers } from './villagers.js';

/* ================================================================
   初始化：世界生成（主世界 + 下界）→ 存档恢复 → 网格 → 村民 → UI
================================================================ */
applyWorldDiff();     // 恢复方块修改（保持进度）
applyPlayerSave();    // 恢复玩家位置/背包/血量/维度
scheduleRebuildAll(player.pos.x, player.pos.z);   // 大世界分帧构建（优先玩家附近）
if (dim === 'nether') { scheduleRebuildAll(player.pos.x, player.pos.z); setVillagersVisible(false); }
spawnVillagers();
buildHotbarHud();
renderHearts();
bindInventoryUI();
bindTableUI();

const hasSave = !!localStorage.getItem(SAVE_KEY);
setMenuSubtitle(hasSave ? '检测到存档，点击开始自动继续' : '网页版迷你沙盒世界');
updateSaveStatus();

/* ================================================================
   和平模式
================================================================ */
const settings = loadSettings();
const peacefulToggle = document.getElementById('peacefulToggle');
if (typeof settings.peaceful === 'boolean') setPeaceful(settings.peaceful);
peacefulToggle.checked = !!settings.peaceful;
peacefulToggle.addEventListener('change', () => {
  setPeaceful(peacefulToggle.checked);
  settings.peaceful = peacefulToggle.checked;
  saveSettings(settings);
});

/* ================================================================
   手动保存
================================================================ */
document.getElementById('saveNowBtn').addEventListener('click', () => {
  flushSave();
  updateSaveStatus();
  const el = document.getElementById('saveStatus');
  if (el) { el.textContent = '✅ 已手动保存 · ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }); }
});

/* ================================================================
   清除存档
================================================================ */
document.getElementById('resetSaveBtn').addEventListener('click', () => {
  if (confirm('确定要清除当前存档并重新开始吗？')) {
    disableSave();
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
});

/* ================================================================
   维度切换（下界传送门）
================================================================ */
let portalCd = 0;
export function switchDimension() {
  clearZombies();
  const to = dim === 'over' ? 'nether' : 'over';
  const srcPortals = dim === 'over' ? overworldPortals : netherPortals;
  const dstPortals = to === 'nether' ? netherPortals : overworldPortals;
  let best = null, bestD = Infinity;
  for (const p of srcPortals) {
    const d = (p.x - player.pos.x) ** 2 + (p.z - player.pos.z) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  setDim(to);
  scheduleRebuildAll(player.pos.x, player.pos.z);
  let target = null;
  if (best && dstPortals.length) {
    const idx = srcPortals.indexOf(best);
    target = dstPortals[idx] || dstPortals[0];
  }
  if (target) {
    // 把玩家挪到门外空地（避免站在传送方块里反复触发）
    const tx = Math.floor(target.x), tz = Math.floor(target.z);
    let land = null;
    for (let dz = 2; dz <= 7; dz++) {
      const zz = tz + dz, yy = surfaceY(tx, zz);
      const surf = getBlock(tx, yy, zz);
      if (surf !== LAVA && surf !== BEDROCK) { land = { x: tx + 0.5, y: yy + 1.2, z: zz + 0.5 }; break; }
    }
    player.pos.set(land ? land.x : target.x, land ? land.y : target.y, land ? land.z : target.z);
  } else {
    const sx = Math.floor(player.pos.x), sz = Math.floor(player.pos.z);
    player.pos.set(sx + 0.5, surfaceY(sx, sz) + 1.2, sz + 0.5);
  }
  player.vel.set(0, 0, 0);
  setVillagersVisible(to === 'over');
  if (document.exitPointerLock) document.exitPointerLock();
  sfx.zhit();
}
// 维度切换时清掉僵尸（下界没有僵尸；主世界重新自然刷新）
export function clearZombies() {
  for (const z of [...zombies]) z.dispose();
  zombies.length = 0;
  zombieBoxes.length = 0;
}
// 下界死亡重生回主世界
playerEvents.addEventListener('respawn', () => {
  if (dim !== 'over') { setDim('over'); scheduleRebuildAll(player.pos.x, player.pos.z); setVillagersVisible(true); }
});

/* ================================================================
   指针锁定 / 菜单
================================================================ */
const menuEl = document.getElementById('menu');
const hudEl = document.getElementById('hud');
let started = false, locked = false;

function lockPointer() {
  initAudio();
  renderer.domElement.requestPointerLock?.();
}
function forceStart() {
  started = true; locked = true;
  menuEl.classList.add('hidden');
  hudEl.classList.add('visible');
}
document.getElementById('playBtn').addEventListener('click', () => {
  lockPointer();
  setTimeout(() => { if (!started) forceStart(); }, 600);
});
document.getElementById('respawnBtn').addEventListener('click', () => { respawn(); lockPointer(); });

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    started = true;
    menuEl.classList.add('hidden');
    hudEl.classList.add('visible');
  } else if (started && !player.dead && !isInventoryOpen() && !isTableOpen()) {
    menuEl.classList.remove('hidden');
    hudEl.classList.remove('visible');
    document.getElementById('playBtn').textContent = '▶  继续游戏';
    updateSaveStatus();
    mining.active = false;
  }
});
document.addEventListener('pointerlockerror', forceStart);

/* ================================================================
   键盘 / 鼠标输入
================================================================ */
addEventListener('keydown', e => {
  if (['Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','KeyC'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= 9) setSel(n - 1);
  }
  if (e.code === 'KeyF' && !isInventoryOpen() && !isTableOpen()) {
    player.fly = !player.fly;
    player.vel.set(0, 0, 0);
  }
  if (e.code === 'KeyQ' && started && locked && !player.dead && !isInventoryOpen() && !isTableOpen()) {
    dropItem();
  }
  if (e.code === 'KeyE') {
    e.preventDefault();
    if (isTableOpen()) closeTable();
    if (isInventoryOpen()) { closeInventory(); if (!player.dead) lockPointer(); }
    else if (started) openInventory();
  }
  if (e.code === 'Escape') {
    if (isTableOpen()) { closeTable(); if (!player.dead) lockPointer(); }
    else if (isInventoryOpen()) { closeInventory(); if (!player.dead) lockPointer(); }
    else if (isMapOpen()) { toggleMap(); if (!player.dead) lockPointer(); }
  }
  if (e.code === 'KeyM' && started && !player.dead) {
    if (!isInventoryOpen() && !isTableOpen()) {
      if (!isMapOpen()) { toggleMap(); document.exitPointerLock && document.exitPointerLock(); }
      else { toggleMap(); lockPointer(); }
    }
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });

const raycaster = new THREE.Raycaster();
function tryAttack() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = 3.6;
  const hits = raycaster.intersectObjects(zombieBoxes, false);
  if (hits.length) {
    const z = hits[0].object.userData.zombie;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    dir.y = 0; dir.normalize();
    const dmg = TOOL_DAMAGE[selectedHotbarId()] || 1;
    z.damage(dmg, dir);
    sfx.punch();
    return true;
  }
  return false;
}

addEventListener('mousedown', e => {
  if (!started || player.dead || isInventoryOpen() || isTableOpen()) return;
  if (e.button === 0) {
    if (!tryAttack()) {
      mining.active = true;
      mining.t = 0;
      const hit = aimBlock();
      if (hit) { mining.x = hit.x; mining.y = hit.y; mining.z = hit.z; }
    }
  } else if (e.button === 2) {
    const hit = aimBlock();
    if (hit && hit.id === CRAFT_TABLE) openTable();
    else placeBlock();
  }
});
addEventListener('mouseup', e => { if (e.button === 0) mining.active = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (!started || player.dead || isInventoryOpen() || isTableOpen()) return;
  const s = 0.0035;
  player.yaw -= e.movementX * s;
  player.pitch -= e.movementY * s;
  const lim = Math.PI / 2 - 0.01;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
});
/* ================================================================
   自动保存
================================================================ */
setInterval(() => { if (started) { flushSave(); updateSaveStatus(); } }, 5000);
addEventListener('pagehide', () => { if (started) flushSave(); });
addEventListener('beforeunload', () => { if (started) flushSave(); });

/* ================================================================
   主循环
================================================================ */
const clock = new THREE.Clock();
let orbit = 0, fps = 60, debugAcc = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  debugAcc += dt;

  if (started && isMapOpen()) tickMap();
  if (started && locked && !player.dead && !isInventoryOpen() && !isTableOpen() && !isMapOpen()) {
    updatePlayer(dt);
    for (const z of [...zombies]) z.update(dt);
    updateBoneProjectiles(dt);
    updatePickups(dt, player.pos.x, player.pos.y, player.pos.z, () => {
      player.hp = Math.min(20, player.hp + 2);
      sfx.pickup();
    });
    updateDropped(dt, player.pos.x, player.pos.y, player.pos.z, d => {
      addItem(d.id, 1);
      sfx.pickup();
    });
    if (dim === 'over') updateSpawner(dt);
    updateMining(dt);
    if (dim === 'over') updateVillagers(dt);
    updateDayNight(dt, player.pos.x, player.pos.y, player.pos.z, dim);
    // 传送门触发
    if (touchingPortal()) {
      portalCd -= dt;
      if (portalCd <= 0) { switchDimension(); portalCd = 2; }
    } else portalCd = 0;
    ensureChunks(player.pos.x, player.pos.z, dt);   // 无限世界：跨区块自动补载
    if (debugAcc > 0.5) {
      fps = fps * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
      renderDebug(fps, player.pos, zombies.length, player.fly, player.inWater, dim);
      debugAcc = 0;
    }
  } else if (!started) {
    orbit += dt * 0.06;
    camera.position.set(spawn.x + Math.cos(orbit) * 14, spawn.y + 9, spawn.z + Math.sin(orbit) * 14);
    camera.lookAt(spawn.x, spawn.y + 1, spawn.z);
    updateDayNight(dt * 0.2, spawn.x, spawn.y, spawn.z);
  }
  updateParticles(dt);
  renderAir();          // 氧气条
  renderBlockInfo(aimBlock());   // 准星指向方块信息
  updateBuildQueue();   // 分帧构建剩余区块
  const flash = updateFlash(dt);
  document.getElementById('flash').style.opacity = flash;
  document.getElementById('watertint').style.opacity = player.headInWater ? 1 : 0;

  if (!started || player.dead || isInventoryOpen() || isTableOpen()) highlight.visible = false;
  else {
    const hit = aimBlock();
    if (hit) {
      highlight.visible = true;
      highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else highlight.visible = false;
  }
  renderer.render(scene, camera);
}
animate();

/* ================================================================
   自动化测试钩子
================================================================ */
window.game = {
  THREE, scene, camera, renderer, player, zombies, inv, world,
  getBlock, setBlock, surfaceY, spawn, sel, invSlots,
  get hotbar() { return invSlots.slice(0, 9).map(s => s ? s.id : null); },
  droppedItems, pickups, zombieBoxes, villages, villagers,
  forceStart, setPeaceful, openInventory, closeInventory, flushSave,
  openTable, closeTable, isTableOpen, aimBlock, dim: () => dim, switchDimension,
  look(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; },
  teleport(x, y, z) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
  breakAt(x, y, z) { return breakBlock(x, y, z); },
  placeAt(x, y, z, id) { setBlock(Math.floor(x), Math.floor(y), Math.floor(z), id); },
  addItem,
  spawnZombie(x, y, z, type = 'zombie') { const zb = new Zombie(x, y, z, type); zombies.push(zb); return zb; },
  attack: tryAttack,
  damagePlayer: n => damagePlayer(n, null, 'zombie'),
  respawn,
  setTime(t) { setWorldTime(t); },
  isDay: () => isDay,
  mineState: mining,
};
