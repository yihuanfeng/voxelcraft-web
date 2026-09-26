import { world, inWorld, widx, pendingDiffs, saveDirty, setDim, dim } from './world.js';
import { player } from './player.js';
import { inv, invSlots, hotbar, sel, setSel, armorSlots } from './inventory.js';
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
      if (inWorld(x, y, z)) world[widx(x, y, z)] = data.world[key];
    }
  } catch (e) { console.warn('方块存档恢复失败', e); }
}

// 恢复玩家状态
export function applyPlayerSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data || data.v !== 1 || !data.player) return;
    const p = data.player;
    player.pos.set(p.x, p.y, p.z);
    player.yaw = p.yaw; player.pitch = p.pitch;
    player.hp = p.hp; player.fly = !!p.fly;
    // 背包：新格式 invSlots（16 格）；旧格式 inv（id->count 对象）自动迁移
    for (let i = 0; i < invSlots.length; i++) invSlots[i] = null;
    if (Array.isArray(p.invSlots)) {
      for (let i = 0; i < Math.min(p.invSlots.length, invSlots.length); i++) {
        const e = p.invSlots[i];
        invSlots[i] = (e && typeof e.id === 'number' && e.count > 0) ? { id: e.id, count: e.count } : null;
      }
    } else if (p.inv) {
      const ids = Object.keys(p.inv).map(Number).filter(id => (p.inv[id] || 0) > 0).sort((a, b) => a - b);
      for (let i = 0; i < Math.min(ids.length, invSlots.length); i++) {
        invSlots[i] = { id: ids[i], count: p.inv[ids[i]] };
      }
    }
    if (Array.isArray(p.hotbar)) for (let i = 0; i < 9; i++) hotbar[i] = p.hotbar[i] ?? null;
    if (typeof p.sel === 'number') setSel(Math.min(8, Math.max(0, p.sel)));
    // 盔甲槽（旧存档无此字段时保持空）
    if (p.armor && typeof p.armor === 'object') {
      for (const slot of Object.keys(armorSlots)) {
        armorSlots[slot] = (typeof p.armor[slot] === 'number') ? p.armor[slot] : null;
      }
    }
    if (typeof data.time === 'number') setWorldTime(data.time);
    if (p.dim === 'nether') setDim('nether');   // 恢复玩家所在维度
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
      hotbar: [...hotbar],
      sel,
      dim,
      armor: { ...armorSlots },
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
