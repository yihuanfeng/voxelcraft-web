/* ================================================================
   合成系统：2×2 背包合成 + 3×3 工作台合成
   配方按"形状匹配"（原版风格：可整体平移，无多余材料）
================================================================ */
import { LOG, PLANK, STICK, SWORD, COBBLE, STONE, SAND, COAL, CRAFT_TABLE,
         WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_HOE,
         STONE_SWORD, STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_HOE,
         IRON_SWORD, IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_HOE,
         GOLD_SWORD, GOLD_PICK, GOLD_AXE, GOLD_SHOVEL, GOLD_HOE,
         DIAMOND_SWORD, DIAMOND_PICK, DIAMOND_AXE, DIAMOND_SHOVEL, DIAMOND_HOE,
         IRON_INGOT, GOLD_INGOT, DIAMOND, FURNACE, CHEST, TORCH, GLASS,
         STONE_BRICKS, FENCE, LADDER,
         IRON_HELMET, IRON_CHESTPLATE, IRON_LEGGINGS, IRON_BOOTS,
         GOLD_HELMET, GOLD_CHESTPLATE, GOLD_LEGGINGS, GOLD_BOOTS,
         DIAMOND_HELMET, DIAMOND_CHESTPLATE, DIAMOND_LEGGINGS, DIAMOND_BOOTS,
         LEATHER, LEATHER_HELMET, LEATHER_CHESTPLATE, LEATHER_LEGGINGS, LEATHER_BOOTS,
         BLOCKS } from './constants.js';
import { addItem, autoSlot } from './inventory.js';

// —— 工具配方生成（原版形状）——
const toolId = (mat, kind) => {
  if (kind === 'sword') return mat === PLANK ? SWORD : mat === COBBLE ? STONE_SWORD : mat === IRON_INGOT ? IRON_SWORD : mat === GOLD_INGOT ? GOLD_SWORD : DIAMOND_SWORD;
  if (kind === 'pick')  return mat === PLANK ? WOOD_PICK : mat === COBBLE ? STONE_PICK : mat === IRON_INGOT ? IRON_PICK : mat === GOLD_INGOT ? GOLD_PICK : DIAMOND_PICK;
  if (kind === 'axe')   return mat === PLANK ? WOOD_AXE : mat === COBBLE ? STONE_AXE : mat === IRON_INGOT ? IRON_AXE : mat === GOLD_INGOT ? GOLD_AXE : DIAMOND_AXE;
  if (kind === 'shovel')return mat === PLANK ? WOOD_SHOVEL : mat === COBBLE ? STONE_SHOVEL : mat === IRON_INGOT ? IRON_SHOVEL : mat === GOLD_INGOT ? GOLD_SHOVEL : DIAMOND_SHOVEL;
  return mat === PLANK ? WOOD_HOE : mat === COBBLE ? STONE_HOE : mat === IRON_INGOT ? IRON_HOE : mat === GOLD_INGOT ? GOLD_HOE : DIAMOND_HOE;
};
function toolRecipe(mat, kind) {
  const result = toolId(mat, kind);
  const patterns = {
    sword:  [mat, null, null, mat, null, null, STICK, null, null],
    pick:   [mat, mat, mat, null, STICK, null, null, STICK, null],
    axe:    [mat, mat, null, mat, STICK, null, null, STICK, null],
    shovel: [mat, null, null, STICK, null, null, STICK, null, null],
    hoe:    [mat, mat, null, null, STICK, null, null, STICK, null],
  };
  return { name: BLOCKS[result].name, result, count: 1, pattern: patterns[kind] };
}
// 盔甲配方：ing 为材料（锭/钻石/皮革），result 为成品盔甲 ID
const ARMOR_PATTERNS = {
  helmet:    [1, 1, 1, 1, 0, 1, 0, 0, 0],
  chestplate:[1, 0, 1, 1, 1, 1, 1, 1, 1],
  leggings:  [1, 1, 1, 1, 0, 1, 1, 0, 1],
  boots:     [0, 0, 0, 1, 0, 1, 1, 0, 1],
};
function armorRecipe(ing, kind, result) {
  return {
    name: BLOCKS[result].name, result, count: 1,
    pattern: ARMOR_PATTERNS[kind].map(v => (v ? ing : null)),
  };
}

const MATS = [PLANK, COBBLE, IRON_INGOT, GOLD_INGOT, DIAMOND];
const TOOL_KINDS = ['sword', 'pick', 'axe', 'shovel', 'hoe'];

export const RECIPES = [   // 2×2 背包合成
  { name: '木板', result: PLANK, count: 4, pattern: [LOG, null, null, null] },
  { name: '木棍', result: STICK, count: 4, pattern: [PLANK, null, PLANK, null] },
  { name: '木剑', result: SWORD, count: 1, pattern: [PLANK, null, STICK, null] },
];

export const TABLE_RECIPES = [   // 3×3 工作台合成（原版主要类别）
  { name: '工作台', result: CRAFT_TABLE, count: 1,
    pattern: [PLANK, PLANK, null, PLANK, PLANK, null, null, null, null] },
  { name: '熔炉', result: FURNACE, count: 1,
    pattern: [COBBLE, COBBLE, COBBLE, COBBLE, null, COBBLE, COBBLE, COBBLE, COBBLE] },
  { name: '箱子', result: CHEST, count: 1,
    pattern: [PLANK, PLANK, PLANK, PLANK, null, PLANK, PLANK, PLANK, PLANK] },
  { name: '火把', result: TORCH, count: 4,
    pattern: [null, COAL, null, null, STICK, null, null, null, null] },
  { name: '玻璃', result: GLASS, count: 4,
    pattern: [SAND, SAND, null, SAND, SAND, null, null, null, null] },
  { name: '石砖', result: STONE_BRICKS, count: 4,
    pattern: [STONE, STONE, null, STONE, STONE, null, null, null, null] },
  { name: '栅栏', result: FENCE, count: 3,
    pattern: [STICK, PLANK, STICK, STICK, PLANK, STICK, null, null, null] },
  { name: '梯子', result: LADDER, count: 3,
    pattern: [STICK, null, STICK, STICK, STICK, STICK, STICK, null, STICK] },
  ...MATS.flatMap(mat => TOOL_KINDS.map(kind => toolRecipe(mat, kind))),
  // 皮革（简化合成：世界暂无动物，用木棍合成）
  { name: '皮革（简化）', result: LEATHER, count: 2,
    pattern: [STICK, STICK, null, STICK, STICK, null, null, null, null] },
  // 盔甲（皮 / 铁 / 金 / 钻，共 16 件）
  armorRecipe(LEATHER, 'helmet', LEATHER_HELMET), armorRecipe(LEATHER, 'chestplate', LEATHER_CHESTPLATE),
  armorRecipe(LEATHER, 'leggings', LEATHER_LEGGINGS), armorRecipe(LEATHER, 'boots', LEATHER_BOOTS),
  armorRecipe(IRON_INGOT, 'helmet', IRON_HELMET), armorRecipe(IRON_INGOT, 'chestplate', IRON_CHESTPLATE),
  armorRecipe(IRON_INGOT, 'leggings', IRON_LEGGINGS), armorRecipe(IRON_INGOT, 'boots', IRON_BOOTS),
  armorRecipe(GOLD_INGOT, 'helmet', GOLD_HELMET), armorRecipe(GOLD_INGOT, 'chestplate', GOLD_CHESTPLATE),
  armorRecipe(GOLD_INGOT, 'leggings', GOLD_LEGGINGS), armorRecipe(GOLD_INGOT, 'boots', GOLD_BOOTS),
  armorRecipe(DIAMOND, 'helmet', DIAMOND_HELMET), armorRecipe(DIAMOND, 'chestplate', DIAMOND_CHESTPLATE),
  armorRecipe(DIAMOND, 'leggings', DIAMOND_LEGGINGS), armorRecipe(DIAMOND, 'boots', DIAMOND_BOOTS),
];

export const craftSlots = [null, null, null, null];       // 2×2 合成格
export const tableSlots = new Array(9).fill(null);        // 3×3 工作台合成格
export let tableOpen = false;
export function setTableOpen(v) { tableOpen = v; craftEvents.dispatchEvent(new CustomEvent('change')); }
export const craftEvents = new EventTarget();

// 归一化 pattern（去掉空行空列）
function normPattern(pattern, W) {
  let minX = W, maxX = -1, minY = W, maxY = -1;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    if (pattern[y * W + x] != null) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const p = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.push(pattern[(y + minY) * W + (x + minX)]);
  return { p, w, h };
}

// 在 W×W 网格中匹配形状（允许整体平移；网格内无多余材料）
export function matchGrid(slots, W, recipe) {
  const np = normPattern(recipe.pattern, W);
  if (!np) return null;
  for (let sy = 0; sy + np.h <= W; sy++) for (let sx = 0; sx + np.w <= W; sx++) {
    let ok = true;
    for (let y = 0; y < np.h && ok; y++) for (let x = 0; x < np.w && ok; x++) {
      const pid = np.p[y * np.w + x];
      const sid = slots[(sy + y) * W + (sx + x)];
      if (pid != null ? sid !== pid : sid != null) ok = false;
    }
    if (!ok) continue;
    // 区域外必须为空（无多余材料）
    for (let i = 0; i < W * W; i++) {
      if (slots[i] != null) {
        const gx = i % W, gy = Math.floor(i / W);
        if (gx < sx || gx >= sx + np.w || gy < sy || gy >= sy + np.h) { ok = false; break; }
      }
    }
    if (ok) return { sx, sy, w: np.w, h: np.h };
  }
  return null;
}

// 2×2 背包合成匹配
export function matchCraftRecipe() {
  for (const r of RECIPES) { const hit = matchGrid(craftSlots, 2, r); if (hit) return { recipe: r, hit }; }
  return null;
}
// 3×3 工作台合成匹配
export function matchTableRecipe() {
  for (const r of TABLE_RECIPES) { const hit = matchGrid(tableSlots, 3, r); if (hit) return { recipe: r, hit }; }
  return null;
}

export function craftOnce(recipe, slots, hit, W) {
  const np = normPattern(recipe.pattern, W);
  for (let y = 0; y < np.h; y++) for (let x = 0; x < np.w; x++) {
    if (np.p[y * np.w + x] != null) {
      const i = (hit.sy + y) * W + (hit.sx + x);
      slots[i] = null;
    }
  }
  craftEvents.dispatchEvent(new CustomEvent('change'));
  addItem(recipe.result, recipe.count);
  autoSlot(recipe.result);
  return recipe;
}

export function blockName(id) { return BLOCKS[id] ? BLOCKS[id].name : '未知'; }
