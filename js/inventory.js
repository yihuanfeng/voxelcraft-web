/* ================================================================
   库存（36 格，原版模型）：快捷栏与背包是同一套格子
   invSlots[0..8]   = 快捷栏（玩家手持）
   invSlots[9..35]  = 背包
   物品放进快捷栏只是改变存放位置，不额外扣数量
   旧 16/27 格存档在 save.js 自动迁移
================================================================ */
import { ARMOR, ARMOR_SLOTS } from './constants.js';
export const invSlots = new Array(36).fill(null);   // 每格 {id, count} | null
export const inv = {};                              // id -> 总数（派生视图，供存档/钩子使用）
export let sel = 0;                                 // 当前选中的快捷栏格（0-8）
export const armorSlots = { head: null, chest: null, legs: null, feet: null }; // 盔甲槽

export const inventoryEvents = new EventTarget();

function syncInv() {
  for (const k of Object.keys(inv)) delete inv[k];
  for (const s of invSlots) if (s) inv[s.id] = (inv[s.id] || 0) + s.count;
}

export function setSel(i) {
  if (i < 0 || i > 8) return;
  sel = i;
  inventoryEvents.dispatchEvent(new CustomEvent('selchange'));
}
export function addItem(id, n = 1) {
  if (id == null) return;
  const slot = invSlots.find(s => s && s.id === id);   // 优先并入同类格
  if (slot) {
    slot.count += n;
  } else {
    const i = invSlots.indexOf(null);                  // 其次放入任意空格
    if (i >= 0) invSlots[i] = { id, count: n };
    else invSlots[0].count += n;                       // 已满：并入快捷栏首格兜底
  }
  autoSlot(id);                                        // 快捷栏空位自动放入（同库存移动，不重复计数）
  syncInv();
  inventoryEvents.dispatchEvent(new CustomEvent('invchange'));
}
// 从指定格子移除 n 个
export function removeItemAt(i, n = 1) {
  const s = invSlots[i];
  if (!s) return false;
  s.count -= n;
  if (s.count <= 0) invSlots[i] = null;
  syncInv();
  inventoryEvents.dispatchEvent(new CustomEvent('invchange'));
  return true;
}
export function removeItem(id, n = 1) {
  for (let i = 0; i < invSlots.length; i++) {
    const s = invSlots[i];
    if (s && s.id === id) return removeItemAt(i, n);
  }
  return false;
}
// 交换两个格子的整叠物品
export function moveSlot(from, to) {
  if (from === to || from < 0 || to < 0 || from >= invSlots.length || to >= invSlots.length) return;
  const tmp = invSlots[from];
  invSlots[from] = invSlots[to];
  invSlots[to] = tmp;
  syncInv();
  inventoryEvents.dispatchEvent(new CustomEvent('invchange'));
}
export function itemCount(id) {
  let c = 0;
  for (const s of invSlots) if (s && s.id === id) c += s.count;
  return c;
}
// 快捷栏格物品 id（null 为空）
export function hotbarId(i) { return invSlots[i] ? invSlots[i].id : null; }
export function selectedHotbarId() { return invSlots[sel] ? invSlots[sel].id : null; }
// 新物品自动放入快捷栏空位（从该物品所在格移动 1 个过去，总数量不变）
export function autoSlot(id) {
  if (id == null) return;
  for (let i = 0; i < 9; i++) if (invSlots[i] && invSlots[i].id === id) return;
  const empty = invSlots.findIndex((s, i) => i < 9 && !s);
  if (empty < 0) return;
  const src = invSlots.findIndex((s, i) => i >= 9 && s && s.id === id);
  if (src < 0) return;
  invSlots[src].count -= 1;
  if (invSlots[src].count <= 0) invSlots[src] = null;
  invSlots[empty] = { id, count: 1 };
  syncInv();
}

/* ================================================================
   盔甲：穿戴 / 脱下 / 总防御
================================================================ */
// 从指定格子穿戴盔甲（精确扣减）
export function wearArmorAt(idx) {
  const s = invSlots[idx];
  if (!s) return false;
  const a = ARMOR[s.id];
  if (!a || s.count <= 0) return false;
  if (armorSlots[a.slot] != null) addItem(armorSlots[a.slot], 1);   // 槽内有旧甲先脱下
  removeItemAt(idx, 1);
  armorSlots[a.slot] = s.id;
  inventoryEvents.dispatchEvent(new CustomEvent('armorchange'));
  return true;
}
export function wearArmor(id) {
  if (id == null) return false;
  const i = invSlots.findIndex(s => s && s.id === id);
  if (i < 0) return false;
  return wearArmorAt(i);
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
