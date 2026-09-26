/* ================================================================
   背包（固定 16 格）/ 快捷栏 / 选中格 / 盔甲槽
   初始背包为空：物品通过挖掘收集，可放入 16 格背包 + 9 格快捷栏
================================================================ */
import { ARMOR, ARMOR_SLOTS } from './constants.js';
export const invSlots = new Array(16).fill(null);   // 每格 {id, count} | null
export const inv = {};                              // id -> 总数（派生视图，供存档/钩子使用）
export const hotbar = new Array(9).fill(null);      // 快捷栏 9 格（物品 id 或 null）
export let sel = 0;                                 // 当前选中的快捷栏格
export const armorSlots = { head: null, chest: null, legs: null, feet: null }; // 盔甲槽

export const inventoryEvents = new EventTarget();

function syncInv() {
  for (const k of Object.keys(inv)) delete inv[k];
  for (const s of invSlots) if (s) inv[s.id] = (inv[s.id] || 0) + s.count;
}

export function setSel(i) {
  sel = i;
  inventoryEvents.dispatchEvent(new CustomEvent('selchange'));
}
export function addItem(id, n = 1) {
  if (id == null) return;
  const slot = invSlots.find(s => s && s.id === id);   // 优先并入同类格
  if (slot) {
    slot.count += n;
  } else {
    const i = invSlots.indexOf(null);                  // 其次放入空格
    if (i >= 0) invSlots[i] = { id, count: n };
    else invSlots[0].count += n;                       // 已满：并入第一格兜底
  }
  if (!hotbar.includes(id)) {                          // 快捷栏空位自动放入（便于直接使用）
    const i = hotbar.indexOf(null);
    if (i >= 0) hotbar[i] = id;
  }
  syncInv();
  inventoryEvents.dispatchEvent(new CustomEvent('invchange'));
}
export function removeItem(id, n = 1) {
  for (let i = 0; i < invSlots.length; i++) {
    const s = invSlots[i];
    if (s && s.id === id) {
      s.count -= n;
      if (s.count <= 0) invSlots[i] = null;
      syncInv();
      inventoryEvents.dispatchEvent(new CustomEvent('invchange'));
      return true;
    }
  }
  return false;
}
export function itemCount(id) {
  let c = 0;
  for (const s of invSlots) if (s && s.id === id) c += s.count;
  return c;
}
export function setHotbarSlot(i, id) {
  hotbar[i] = id == null ? null : id;
  inventoryEvents.dispatchEvent(new CustomEvent('invchange'));
}
export function selectedHotbarId() { return hotbar[sel]; }
// 物品自动放入快捷栏空位（仅当该物品还没在快捷栏中）
export function autoSlot(id) {
  if (id == null || hotbar.includes(id)) return;
  const i = hotbar.indexOf(null);
  if (i >= 0) setHotbarSlot(i, id);
}

/* ================================================================
   盔甲：穿戴 / 脱下 / 总防御
================================================================ */
export function wearArmor(id) {
  const a = ARMOR[id];
  if (!a || itemCount(id) <= 0) return false;
  if (armorSlots[a.slot] != null) addItem(armorSlots[a.slot], 1);   // 槽内有旧甲先脱下
  removeItem(id, 1);
  armorSlots[a.slot] = id;
  inventoryEvents.dispatchEvent(new CustomEvent('armorchange'));
  return true;
}
export function takeOffArmor(slot) {
  const id = armorSlots[slot];
  if (id == null) return false;
  addItem(id, 1);
  armorSlots[slot] = null;
  inventoryEvents.dispatchEvent(new CustomEvent('armorchange'));
  return true;
}
export function armorDefense() {
  let d = 0;
  for (const s of ARMOR_SLOTS) if (armorSlots[s] != null) d += ARMOR[armorSlots[s]].defense;
  return d;
}
