import { setBlock, inWorld, pendingDiffs, saveDirty, setDim, dim, surfaceY } from './world.js';
import { player } from './player.js';
import { inv, invSlots, sel, setSel, armorSlots } from './inventory.js';
import { furnaceToSave, furnaceFromSave } from './furnace.js';
import { worldTime, setWorldTime } from './renderer.js';

/* ================================================================
   存档系统（localStorage）：方块差异 + 玩家状态 + 时间
================================================================ */
export const SAVE_KEY = 'voxelcraft_save_v1';
export const SETTINGS_KEY = 'voxelcraft_settings_v1';
export let lastSaveAt = 0;
export let saveDisabled = false;
// 清除存档时调用：防止刷新/关闭时的 pagehide 兜底把内存状态写回
export function disableSave() { saveDisabled = true; }

// 恢复方块差异：必须在世界生成之后、网格构建之前调用
export function applyWorldDiff() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data || data.v !== 1 || !data.world) return;
    for (const key in data.world) {
      const p = key.split(','), x = +p[0], y = +p[1], z = +p[2];
      if (inWorld(x, y, z)) setBlock(x, y, z, data.world[key]);
    }
  } catch (e) { console.warn('方块存档恢复失败', e); }
}

// 恢复玩家状态
export function applyPlayerSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data || data.v !== 1 || !data.player) return;
    const p = data.player;
    // 位置：若低于新版本地表（世界加高后旧档位置可能被埋），抬升到地表上方
    player.pos.set(p.x, p.y, p.z);
    const ground = surfaceY(Math.floor(p.x), Math.floor(p.z));
    if (player.pos.y < ground + 1) player.pos.y = ground + 1;
    player.yaw = p.yaw; player.pitch = p.pitch;
    player.hp = p.hp; player.fly = !!p.fly;
    // 库存：新格式 invSlots（36 格：0-8 快捷栏 + 9-35 背包）
    // 旧 16/27 格存档自动迁移：背包放 9-35，hotbar 引用物品从背包扣 1 放入快捷栏
    // 更旧格式 inv（id->count 对象）自动迁移
    for (let i = 0; i < invSlots.length; i++) invSlots[i] = null;
    if (Array.isArray(p.invSlots) && p.invSlots.length >= 36) {
      for (let i = 0; i < 36; i++) {
        const e = p.invSlots[i];
        invSlots[i] = (e && typeof e.id === 'number' && e.count > 0) ? { id: e.id, count: e.count } : null;
      }
    } else if (Array.isArray(p.invSlots)) {
      const old = p.invSlots;
      for (let i = 0; i < Math.min(old.length, 27); i++) {
        const e = old[i];
        if (e && typeof e.id === 'number' && e.count > 0) invSlots[9 + i] = { id: e.id, count: e.count };
      }
      if (Array.isArray(p.hotbar)) {
        for (let i = 0; i < 9; i++) {
          const hid = p.hotbar[i];
          if (hid == null) continue;
          const bi = invSlots.findIndex((s, j) => j >= 9 && s && s.id === hid);
          if (bi >= 0) {
            invSlots[bi].count -= 1;
            if (invSlots[bi].count <= 0) invSlots[bi] = null;
          }
          if (invSlots[i] == null) invSlots[i] = { id: hid, count: 1 };
        }
      }
    } else if (p.inv) {
      const ids = Object.keys(p.inv).map(Number).filter(id => (p.inv[id] || 0) > 0).sort((a, b) => a - b);
      for (let i = 0; i < Math.min(ids.length, 27); i++) {
        invSlots[9 + i] = { id: ids[i], count: p.inv[ids[i]] };
      }
      if (Array.isArray(p.hotbar)) {
        for (let i = 0; i < 9; i++) {
          const hid = p.hotbar[i];
          if (hid == null) continue;
          const bi = invSlots.findIndex((s, j) => j >= 9 && s && s.id === hid);
          if (bi >= 0) {
            invSlots[bi].count -= 1;
            if (invSlots[bi].count <= 0) invSlots[bi] = null;
          }
          if (invSlots[i] == null) invSlots[i] = { id: hid, count: 1 };
        }
      }
    }
    if (typeof p.sel === 'number') setSel(Math.min(8, Math.max(0, p.sel)));
    // 盔甲槽（旧存档无此字段时保持空）
    if (p.armor && typeof p.armor === 'object') {
      for (const slot of Object.keys(armorSlots)) {
        armorSlots[slot] = (typeof p.armor[slot] === 'number') ? p.armor[slot] : null;
      }
    }
    if (typeof data.time === 'number') setWorldTime(data.time);
    if (p.dim === 'nether') setDim('nether');   // 恢复玩家所在维度
    // 熔炉状态（旧存档无此字段时保持空）
    furnaceFromSave(p.furnace);
  } catch (e) { console.warn('玩家存档恢复失败', e); }
}

export function flushSave() {
  if (saveDisabled) return;
  try {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
    if (!data || data.v !== 1) data = { v: 1, world: {}, player: null, time: 0 };
    if (saveDirty) {
      for (const [k, id] of pendingDiffs) data.world[k] = id;
      pendingDiffs.clear();
    }
    data.player = {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: player.yaw, pitch: player.pitch,
      hp: player.hp, fly: player.fly,
      invSlots: invSlots.map(s => s ? { id: s.id, count: s.count } : null),
      inv: { ...inv },
      hotbar: invSlots.slice(0, 9).map(s => s ? s.id : null),
      sel,
      dim,
      armor: { ...armorSlots },
      furnace: furnaceToSave(),
    };
    data.time = worldTime;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    lastSaveAt = Date.now();
  } catch (e) { console.warn('存档写入失败', e); }
}

/* ================================================================
   设置（和平模式等）
================================================================ */
export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
  catch (e) { return {}; }
}
export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}
