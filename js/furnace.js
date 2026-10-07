/* ================================================================
   熔炉（烧制系统）
   右键熔炉方块打开烧制界面：上格放原料、下格放燃料（煤/木板等）
   持续燃烧消耗燃料，进度满产出成品
   ================================================================ */
import { IRON_ORE, GOLD_ORE, COPPER_ORE, SAND, COBBLE, RAW_MEAT,
         IRON_INGOT, GOLD_INGOT, COPPER_INGOT, GLASS, STONE, COOKED_MEAT,
         COAL, PLANK, LOG, STICK } from './constants.js';
import { addItem } from './inventory.js';

// 烧制配方：原料 → 成品（time 为烧 1 个所需秒数）
export const SMELT_RECIPES = {
  [IRON_ORE]:   { out: IRON_INGOT,   time: 8 },
  [GOLD_ORE]:   { out: GOLD_INGOT,   time: 8 },
  [COPPER_ORE]: { out: COPPER_INGOT, time: 8 },
  [SAND]:       { out: GLASS,        time: 6 },
  [COBBLE]:     { out: STONE,        time: 6 },
  [RAW_MEAT]:   { out: COOKED_MEAT,  time: 6 },
};
// 燃料：每单位可燃秒数
export const FUEL_VALUES = {
  [COAL]:  80,
  [PLANK]: 15,
  [LOG]:   15,
  [STICK]: 5,
};

export const furnaceEvents = new EventTarget();

// 熔炉状态（input/fuel/result 为 {id, count} | null）
export const furnace = {
  input: null,
  fuel: null,
  result: null,
  fuelLeft: 0,      // 剩余燃料秒数
  progress: 0,      // 当前烧制进度 0..1
};

export function isFuel(id) { return FUEL_VALUES[id] != null; }
export function isSmeltable(id) { return SMELT_RECIPES[id] != null; }

// 每帧推进（dt 秒）
export function updateFurnace(dt) {
  if (dt <= 0) return;
  const recipe = furnace.input ? SMELT_RECIPES[furnace.input.id] : null;
  if (!recipe) {
    if (furnace.progress !== 0) { furnace.progress = 0; furnaceEvents.dispatchEvent(new CustomEvent('change')); }
    return;
  }
  // 燃料不足则尝试消耗一组燃料
  if (furnace.fuelLeft <= 0) {
    if (furnace.fuel && isFuel(furnace.fuel.id)) {
      furnace.fuel.count -= 1;
      if (furnace.fuel.count <= 0) furnace.fuel = null;
      furnace.fuelLeft = FUEL_VALUES[furnace.fuel.id];
    } else {
      if (furnace.progress !== 0) { furnace.progress = 0; furnaceEvents.dispatchEvent(new CustomEvent('change')); }
      return;
    }
  }
  furnace.fuelLeft = Math.max(0, furnace.fuelLeft - dt);
  furnace.progress += dt / recipe.time;
  if (furnace.progress >= 1) {
    furnace.progress = 0;
    furnace.input.count -= 1;
    if (furnace.input.count <= 0) furnace.input = null;
    // 结果格累积同种成品；结果格被占用时直接进背包
    if (furnace.result && furnace.result.id === recipe.out) furnace.result.count += 1;
    else if (!furnace.result) furnace.result = { id: recipe.out, count: 1 };
    else addItem(recipe.out, 1);
  }
  furnaceEvents.dispatchEvent(new CustomEvent('change'));
}

// 存档用：可序列化状态
export function furnaceToSave() {
  return {
    input: furnace.input ? { id: furnace.input.id, count: furnace.input.count } : null,
    fuel: furnace.fuel ? { id: furnace.fuel.id, count: furnace.fuel.count } : null,
    result: furnace.result ? { id: furnace.result.id, count: furnace.result.count } : null,
    fuelLeft: furnace.fuelLeft,
    progress: furnace.progress,
  };
}
export function furnaceFromSave(s) {
  if (!s) return;
  furnace.input = (s.input && typeof s.input.id === 'number' && s.input.count > 0) ? { id: s.input.id, count: s.input.count } : null;
  furnace.fuel = (s.fuel && typeof s.fuel.id === 'number' && s.fuel.count > 0) ? { id: s.fuel.id, count: s.fuel.count } : null;
  furnace.result = (s.result && typeof s.result.id === 'number' && s.result.count > 0) ? { id: s.result.id, count: s.result.count } : null;
  furnace.fuelLeft = +s.fuelLeft || 0;
  furnace.progress = +s.progress || 0;
}
