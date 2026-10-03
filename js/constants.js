import * as THREE from 'three';

/* ================================================================
   常量 & 方块注册表
================================================================ */
export const SIZE = 512;          // 世界 SIZE x SIZE 方块（大世界）
export const HEIGHT = 96;         // 世界高度
export const CHUNK = 16;          // 区块宽/深
export const CHUNKS = SIZE / CHUNK;
export const SEA = 21;            // 海平面

// 方块 / 物品 ID
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, LOG = 4, LEAVES = 5,
             SAND = 6, WATER = 7, BEDROCK = 8, PLANK = 9, COBBLE = 10,
             STICK = 11, SWORD = 12,                       // 基础合成物
             COAL_ORE = 13, IRON_ORE = 14, GOLD_ORE = 15, DIAMOND_ORE = 16,
             LAVA = 17, OBSIDIAN = 18, CRAFT_TABLE = 19,
             NETHERRACK = 20, GLOWSTONE = 21, PORTAL = 22, ANCIENT_DEBRIS = 23,
             // 新方块
             FURNACE = 43, CHEST = 44, TORCH = 45, GLASS = 46,
             STONE_BRICKS = 47, FENCE = 48, LADDER = 49,
             // 工具（木/石/铁 + 金/钻 全套）
             WOOD_PICK = 25, WOOD_AXE = 26, WOOD_SHOVEL = 27, WOOD_HOE = 28,
             STONE_SWORD = 29, STONE_PICK = 30, STONE_AXE = 31, STONE_SHOVEL = 32, STONE_HOE = 33,
             IRON_SWORD = 34, IRON_PICK = 35, IRON_AXE = 36, IRON_SHOVEL = 37, IRON_HOE = 38,
             GOLD_SWORD = 50, GOLD_PICK = 51, GOLD_AXE = 52, GOLD_SHOVEL = 53, GOLD_HOE = 54,
             DIAMOND_SWORD = 55, DIAMOND_PICK = 56, DIAMOND_AXE = 57, DIAMOND_SHOVEL = 58, DIAMOND_HOE = 59,
             IRON_INGOT = 39, GOLD_INGOT = 40, DIAMOND = 41, COAL = 42,
             // 盔甲（皮/铁/金/钻 × 头/胸/腿/靴）
             LEATHER_HELMET = 60, LEATHER_CHESTPLATE = 61, LEATHER_LEGGINGS = 62, LEATHER_BOOTS = 63,
             IRON_HELMET = 64, IRON_CHESTPLATE = 65, IRON_LEGGINGS = 66, IRON_BOOTS = 67,
             GOLD_HELMET = 68, GOLD_CHESTPLATE = 69, GOLD_LEGGINGS = 70, GOLD_BOOTS = 71,
             DIAMOND_HELMET = 72, DIAMOND_CHESTPLATE = 73, DIAMOND_LEGGINGS = 74, DIAMOND_BOOTS = 75,
             LEATHER = 76, EMERALD = 77, BONE = 78, STRING = 79, GUNPOWDER = 80,
             RAW_MEAT = 81, COPPER_ORE = 82, COPPER_INGOT = 83,
             COPPER_SWORD = 84, COPPER_PICK = 85, COPPER_AXE = 86, COPPER_SHOVEL = 87, COPPER_HOE = 88,
             // 储存方块（9 个材料合成一块，可逆向拆回）
             IRON_BLOCK = 89, GOLD_BLOCK = 90, DIAMOND_BLOCK = 91, COPPER_BLOCK = 92,
             EMERALD_BLOCK = 93, COAL_BLOCK = 94,
             // 铜盔甲
             COPPER_HELMET = 95, COPPER_CHESTPLATE = 96, COPPER_LEGGINGS = 97, COPPER_BOOTS = 98;

// 可放置为方块的 ID 集合（方块类；物品/工具/盔甲不可放置）
export const PLACEABLE_IDS = new Set([
  GRASS, DIRT, STONE, LOG, LEAVES, SAND, WATER, BEDROCK, PLANK, COBBLE,
  COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, LAVA, OBSIDIAN, CRAFT_TABLE,
  NETHERRACK, GLOWSTONE, PORTAL, ANCIENT_DEBRIS,
  FURNACE, CHEST, TORCH, GLASS, STONE_BRICKS, FENCE, LADDER,
  IRON_BLOCK, GOLD_BLOCK, DIAMOND_BLOCK, COPPER_BLOCK, EMERALD_BLOCK, COAL_BLOCK,
]);
export function isPlaceable(id) { return PLACEABLE_IDS.has(id); }

// 工具按类别分组
export const SWORDS = new Set([SWORD, STONE_SWORD, IRON_SWORD, GOLD_SWORD, DIAMOND_SWORD, COPPER_SWORD]);
export const PICKS = new Set([WOOD_PICK, STONE_PICK, IRON_PICK, GOLD_PICK, DIAMOND_PICK, COPPER_PICK]);
export const AXES = new Set([WOOD_AXE, STONE_AXE, IRON_AXE, GOLD_AXE, DIAMOND_AXE, COPPER_AXE]);
export const SHOVELS = new Set([WOOD_SHOVEL, STONE_SHOVEL, IRON_SHOVEL, GOLD_SHOVEL, DIAMOND_SHOVEL, COPPER_SHOVEL]);
export const HOES = new Set([WOOD_HOE, STONE_HOE, IRON_HOE, GOLD_HOE, DIAMOND_HOE, COPPER_HOE]);

// 工具攻击伤害
export const TOOL_DAMAGE = {
  [SWORD]: 4, [WOOD_PICK]: 2, [WOOD_AXE]: 3, [WOOD_SHOVEL]: 2, [WOOD_HOE]: 1,
  [STONE_SWORD]: 5, [STONE_PICK]: 3, [STONE_AXE]: 4, [STONE_SHOVEL]: 3, [STONE_HOE]: 2,
  [IRON_SWORD]: 6, [IRON_PICK]: 4, [IRON_AXE]: 5, [IRON_SHOVEL]: 4, [IRON_HOE]: 3,
  [GOLD_SWORD]: 5, [GOLD_PICK]: 3, [GOLD_AXE]: 4, [GOLD_SHOVEL]: 3, [GOLD_HOE]: 2,
  [DIAMOND_SWORD]: 7, [DIAMOND_PICK]: 5, [DIAMOND_AXE]: 6, [DIAMOND_SHOVEL]: 5, [DIAMOND_HOE]: 4,
  [COPPER_SWORD]: 5, [COPPER_PICK]: 3, [COPPER_AXE]: 4, [COPPER_SHOVEL]: 3, [COPPER_HOE]: 2,
};
// 镐 / 斧 / 锹 / 锄 挖掘加速（金最快、钻次之、铁第三）
export const TOOL_SPEED = {
  [WOOD_PICK]: 0.45, [STONE_PICK]: 0.38, [IRON_PICK]: 0.32, [GOLD_PICK]: 0.28, [DIAMOND_PICK]: 0.25,
  [WOOD_AXE]: 0.5,   [STONE_AXE]: 0.42,  [IRON_AXE]: 0.35,  [GOLD_AXE]: 0.31,  [DIAMOND_AXE]: 0.28,
  [WOOD_SHOVEL]: 0.55, [STONE_SHOVEL]: 0.46, [IRON_SHOVEL]: 0.4, [GOLD_SHOVEL]: 0.36, [DIAMOND_SHOVEL]: 0.33,
  [WOOD_HOE]: 0.6,   [STONE_HOE]: 0.5,    [IRON_HOE]: 0.45,   [GOLD_HOE]: 0.4,   [DIAMOND_HOE]: 0.37,
  [COPPER_PICK]: 0.35, [COPPER_AXE]: 0.38, [COPPER_SWORD]: 1, [COPPER_SHOVEL]: 0.43, [COPPER_HOE]: 0.47,
};
// 镐类等级：木1 石2 金2 铁3 钻4
export const TOOL_TIER = {
  [WOOD_PICK]: 1, [STONE_PICK]: 2, [GOLD_PICK]: 2, [COPPER_PICK]: 2,
  [IRON_PICK]: 3, [DIAMOND_PICK]: 4,
};
// 方块所需挖掘等级（需对应等级镐，否则挖掉无掉落）
export const BLOCK_TIER = {
  [STONE]: 1, [COBBLE]: 1, [COAL_ORE]: 1, [FURNACE]: 1, [STONE_BRICKS]: 1,
  [IRON_ORE]: 2, [GOLD_ORE]: 2, [COPPER_ORE]: 1,
  [DIAMOND_ORE]: 3, [OBSIDIAN]: 4, [ANCIENT_DEBRIS]: 4, [BEDROCK]: 1,
};
// 推荐工具提示（挖掘/采集）
export function recommendTool(blockId) {
  if (PICKS_BLOCKS.has(blockId)) return BLOCK_TIER[blockId] && BLOCK_TIER[blockId] > 1
    ? '镐（需 ' + ['', '木镐', '石镐', '铁镐', '钻石镐'][BLOCK_TIER[blockId]] + '）' : '镐';
  if (AXES_BLOCKS.has(blockId)) return '斧';
  if (SHOVELS_BLOCKS.has(blockId)) return '锹';
  return '手 / 任意工具';
}
const PICKS_BLOCKS = new Set([STONE, COBBLE, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, COPPER_ORE,
                              OBSIDIAN, ANCIENT_DEBRIS, BEDROCK, FURNACE, STONE_BRICKS]);
const AXES_BLOCKS = new Set([LOG, PLANK, CRAFT_TABLE, CHEST, FENCE, LADDER]);
const SHOVELS_BLOCKS = new Set([DIRT, SAND, GRASS]);

export function toolSpeedFor(id, blockId) {
  const mult = TOOL_SPEED[id];
  if (!mult) return 1;
  if (PICKS.has(id)) {
    return (blockId === STONE || blockId === COBBLE || blockId === COAL_ORE ||
            blockId === IRON_ORE || blockId === GOLD_ORE || blockId === DIAMOND_ORE ||
            blockId === OBSIDIAN || blockId === ANCIENT_DEBRIS || blockId === FURNACE ||
            blockId === STONE_BRICKS || blockId === BEDROCK) ? mult : 1;
  }
  if (AXES.has(id)) {
    return (blockId === LOG || blockId === PLANK || blockId === CRAFT_TABLE ||
            blockId === CHEST || blockId === FENCE || blockId === LADDER) ? mult : 1;
  }
  if (SHOVELS.has(id)) {
    return (blockId === DIRT || blockId === SAND || blockId === GRASS) ? mult : 1;
  }
  if (HOES.has(id)) {
    return (blockId === DIRT || blockId === GRASS) ? mult : 1;
  }
  return 1;
}

// 盔甲：槽位 + 防御值（原版：皮7 / 铁15 / 金11 / 钻20）
export const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet'];
export const ARMOR = {
  [LEATHER_HELMET]:    { slot: 'head',  defense: 1 },
  [LEATHER_CHESTPLATE]:{ slot: 'chest', defense: 3 },
  [LEATHER_LEGGINGS]:  { slot: 'legs',  defense: 2 },
  [LEATHER_BOOTS]:     { slot: 'feet',  defense: 1 },
  [IRON_HELMET]:       { slot: 'head',  defense: 2 },
  [IRON_CHESTPLATE]:   { slot: 'chest', defense: 6 },
  [IRON_LEGGINGS]:     { slot: 'legs',  defense: 5 },
  [IRON_BOOTS]:        { slot: 'feet',  defense: 2 },
  [GOLD_HELMET]:       { slot: 'head',  defense: 2 },
  [GOLD_CHESTPLATE]:   { slot: 'chest', defense: 5 },
  [GOLD_LEGGINGS]:     { slot: 'legs',  defense: 3 },
  [GOLD_BOOTS]:        { slot: 'feet',  defense: 1 },
  [DIAMOND_HELMET]:    { slot: 'head',  defense: 3 },
  [DIAMOND_CHESTPLATE]:{ slot: 'chest', defense: 8 },
  [DIAMOND_LEGGINGS]:  { slot: 'legs',  defense: 6 },
  [DIAMOND_BOOTS]:     { slot: 'feet',  defense: 3 },
  [COPPER_HELMET]:     { slot: 'head',  defense: 2 },
  [COPPER_CHESTPLATE]: { slot: 'chest', defense: 4 },
  [COPPER_LEGGINGS]:   { slot: 'legs',  defense: 3 },
  [COPPER_BOOTS]:      { slot: 'feet',  defense: 1 },
};

// tiles: 16x16 纹理图集中的索引
export const BLOCKS = {
  [GRASS]:  { name:'草方块',   hard:0.6,  tiles:{ top:0, side:1, bottom:2 }, color:0x6abe30 },
  [DIRT]:   { name:'泥土',     hard:0.6,  tiles:{ all:2 },                   color:0x8a5f3c },
  [STONE]:  { name:'石头',     hard:1.9,  tiles:{ all:3 },                   color:0x7d7d7d },
  [LOG]:    { name:'原木',     hard:0.8,  tiles:{ top:5, side:4, bottom:5 }, color:0x6b4f2a },
  [LEAVES]: { name:'树叶',     hard:0.45, tiles:{ all:6 },                   color:0x2f7a1f },
  [SAND]:   { name:'沙子',     hard:0.6,  tiles:{ all:7 },                   color:0xdcd29b },
  [WATER]:  { name:'水',       hard:Infinity, tiles:{ all:11 },              color:0x3f76e4 },
  [BEDROCK]:{ name:'基岩',     hard:8,      tiles:{ all:10 },              color:0x444444 },
  [PLANK]:  { name:'木板',     hard:1.2,  tiles:{ all:8 },                   color:0xa08050 },
  [COBBLE]: { name:'圆石',     hard:1.9,  tiles:{ all:9 },                   color:0x777777 },
  [COAL_ORE]:   { name:'煤矿石', hard:3.0, tiles:{ all:12 }, color:0x3a3a3a },
  [IRON_ORE]:   { name:'铁矿石', hard:3.5, tiles:{ all:13 }, color:0x8f7a66 },
  [GOLD_ORE]:   { name:'金矿石', hard:3.5, tiles:{ all:14 }, color:0xd9b23c },
  [DIAMOND_ORE]:{ name:'钻石矿石', hard:4.5, tiles:{ all:15 }, color:0x59d9c2 },
  [COPPER_ORE]:{ name:'铜矿石', hard:3.0, tiles:{ all:34 }, color:0xcf8a3a },
  [LAVA]:       { name:'岩浆',   hard:Infinity, tiles:{ all:16 }, color:0xff7a1f },
  [OBSIDIAN]:   { name:'黑曜石', hard:Infinity, tiles:{ all:17 }, color:0x2a1f4a },
  [CRAFT_TABLE]:{ name:'工作台', hard:1.2, tiles:{ top:18, side:19, bottom:20 }, color:0xa08050 },
  [NETHERRACK]: { name:'下界岩', hard:0.7, tiles:{ all:21 }, color:0x8a3a2a },
  [GLOWSTONE]:  { name:'荧石',   hard:0.5, tiles:{ all:22 }, color:0xffe07a },
  [PORTAL]:     { name:'下界传送门', hard:0.2, tiles:{ all:23 }, color:0x9a4ae0 },
  [ANCIENT_DEBRIS]: { name:'远古残骸', hard:6.0, tiles:{ all:24 }, color:0x5a4a3a },
  [FURNACE]:    { name:'熔炉',   hard:2.0, tiles:{ top:25, side:26, front:27, bottom:25 }, color:0x666666 },
  [CHEST]:      { name:'箱子',   hard:1.2, tiles:{ all:28 }, color:0xa08050 },
  [TORCH]:      { name:'火把',   hard:0.15, tiles:{ all:29 }, color:0xffb040 },
  [GLASS]:      { name:'玻璃',   hard:0.4, tiles:{ all:30 }, color:0xcfe8f0, transparent:true },
  [STONE_BRICKS]:{ name:'石砖',  hard:2.0, tiles:{ all:31 }, color:0x8a8a8a },
  [FENCE]:      { name:'栅栏',   hard:1.2, tiles:{ all:32 }, color:0x9a7a4a },
  [LADDER]:     { name:'梯子',   hard:1.0, tiles:{ all:33 }, color:0xb09060 },
  // 合成物 / 工具 / 盔甲（图标在 UI 中单独绘制）
  [STICK]:  { name:'木棍', hard:0, tiles:{ all:4 }, color:0x8a6a3a },
  [SWORD]:  { name:'木剑', hard:0, tiles:{ all:8 }, color:0x9a7a4a },
  [WOOD_PICK]:   { name:'木镐', hard:0, tiles:{ all:8 }, color:0x9a7a4a },
  [WOOD_AXE]:    { name:'木斧', hard:0, tiles:{ all:8 }, color:0x9a7a4a },
  [WOOD_SHOVEL]: { name:'木锹', hard:0, tiles:{ all:8 }, color:0x9a7a4a },
  [WOOD_HOE]:    { name:'木锄', hard:0, tiles:{ all:8 }, color:0x9a7a4a },
  [STONE_SWORD]:   { name:'石剑', hard:0, tiles:{ all:3 }, color:0x8a8a8a },
  [STONE_PICK]:    { name:'石镐', hard:0, tiles:{ all:3 }, color:0x8a8a8a },
  [STONE_AXE]:     { name:'石斧', hard:0, tiles:{ all:3 }, color:0x8a8a8a },
  [STONE_SHOVEL]:  { name:'石锹', hard:0, tiles:{ all:3 }, color:0x8a8a8a },
  [STONE_HOE]:     { name:'石锄', hard:0, tiles:{ all:3 }, color:0x8a8a8a },
  [IRON_SWORD]:    { name:'铁剑', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [IRON_PICK]:     { name:'铁镐', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [IRON_AXE]:      { name:'铁斧', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [IRON_SHOVEL]:   { name:'铁锹', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [IRON_HOE]:      { name:'铁锄', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [GOLD_SWORD]:    { name:'金剑', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [GOLD_PICK]:     { name:'金镐', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [GOLD_AXE]:      { name:'金斧', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [GOLD_SHOVEL]:   { name:'金锹', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [GOLD_HOE]:      { name:'金锄', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [DIAMOND_SWORD]: { name:'钻石剑', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [DIAMOND_PICK]:  { name:'钻石镐', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [DIAMOND_AXE]:   { name:'钻石斧', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [DIAMOND_SHOVEL]:{ name:'钻石锹', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [DIAMOND_HOE]:   { name:'钻石锄', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [IRON_INGOT]: { name:'铁锭', hard:0, tiles:{ all:9 }, color:0xd8d8d8 },
  [GOLD_INGOT]: { name:'金锭', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [DIAMOND]:    { name:'钻石', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [COAL]:       { name:'煤',   hard:0, tiles:{ all:12 }, color:0x2a2a2a },
  [LEATHER]:    { name:'皮革', hard:0, tiles:{ all:8 }, color:0x8a5a2a },
  [EMERALD]:    { name:'绿宝石', hard:0, tiles:{ all:15 }, color:0x3fd95f },
  [BONE]:       { name:'骨头', hard:0, tiles:{ all:3 }, color:0xe8e4da },
  [STRING]:     { name:'线', hard:0, tiles:{ all:6 }, color:0xdddddd },
  [GUNPOWDER]:  { name:'火药', hard:0, tiles:{ all:7 }, color:0x8a8a8a },
  [COPPER_INGOT]:{ name:'铜锭', hard:0, tiles:{ all:8 }, color:0xcf8a3a },
  [RAW_MEAT]:  { name:'生肉', hard:0, tiles:{ all:7 }, color:0xd96a4a },
  [COPPER_SWORD]:{ name:'铜剑', hard:0, tiles:{ all:8 }, color:0xcf8a3a },
  [COPPER_PICK]: { name:'铜镐', hard:0, tiles:{ all:8 }, color:0xcf8a3a },
  [COPPER_AXE]:  { name:'铜斧', hard:0, tiles:{ all:8 }, color:0xcf8a3a },
  [COPPER_SHOVEL]:{ name:'铜锹', hard:0, tiles:{ all:8 }, color:0xcf8a3a },
  [COPPER_HOE]:  { name:'铜锄', hard:0, tiles:{ all:8 }, color:0xcf8a3a },
  [LEATHER_HELMET]:    { name:'皮革头盔', hard:0, tiles:{ all:8 }, color:0x8a5a2a },
  [LEATHER_CHESTPLATE]:{ name:'皮革胸甲', hard:0, tiles:{ all:8 }, color:0x8a5a2a },
  [LEATHER_LEGGINGS]:  { name:'皮革护腿', hard:0, tiles:{ all:8 }, color:0x8a5a2a },
  [LEATHER_BOOTS]:     { name:'皮革靴子', hard:0, tiles:{ all:8 }, color:0x8a5a2a },
  [IRON_HELMET]:       { name:'铁头盔', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [IRON_CHESTPLATE]:   { name:'铁胸甲', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [IRON_LEGGINGS]:     { name:'铁护腿', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [IRON_BOOTS]:        { name:'铁靴子', hard:0, tiles:{ all:9 }, color:0xc8ccd4 },
  [GOLD_HELMET]:       { name:'金头盔', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [GOLD_CHESTPLATE]:   { name:'金胸甲', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [GOLD_LEGGINGS]:     { name:'金护腿', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [GOLD_BOOTS]:        { name:'金靴子', hard:0, tiles:{ all:8 }, color:0xffdf6e },
  [DIAMOND_HELMET]:    { name:'钻石头盔', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [DIAMOND_CHESTPLATE]:{ name:'钻石胸甲', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [DIAMOND_LEGGINGS]:  { name:'钻石护腿', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  [DIAMOND_BOOTS]:     { name:'钻石靴子', hard:0, tiles:{ all:15 }, color:0x6fe3d0 },
  // 储存方块
  [IRON_BLOCK]:    { name:'铁块',   hard:4.0, tiles:{ all:35 }, color:0xd8d8d8 },
  [GOLD_BLOCK]:    { name:'金块',   hard:3.5, tiles:{ all:36 }, color:0xffdf6e },
  [DIAMOND_BLOCK]: { name:'钻石块', hard:4.5, tiles:{ all:37 }, color:0x6fe3d0 },
  [COPPER_BLOCK]:  { name:'铜块',   hard:4.0, tiles:{ all:38 }, color:0xd98a4a },
  [EMERALD_BLOCK]: { name:'绿宝石块', hard:4.0, tiles:{ all:39 }, color:0x3fd95f },
  [COAL_BLOCK]:    { name:'煤炭块', hard:4.0, tiles:{ all:40 }, color:0x1f1f1f },
  // 铜盔甲
  [COPPER_HELMET]:    { name:'铜头盔', hard:0, tiles:{ all:8 }, color:0xd98a4a },
  [COPPER_CHESTPLATE]:{ name:'铜胸甲', hard:0, tiles:{ all:8 }, color:0xd98a4a },
  [COPPER_LEGGINGS]:  { name:'铜护腿', hard:0, tiles:{ all:8 }, color:0xd98a4a },
  [COPPER_BOOTS]:     { name:'铜靴子', hard:0, tiles:{ all:8 }, color:0xd98a4a },
};

// 盔甲 / 工具 外观配色（UI 图标与玩家模型）
export const MAT_COLORS = {
  leather: 0x8a5a2a, iron: 0xc8ccd4, gold: 0xffdf6e, diamond: 0x6fe3d0,
};

/* ================================================================
   程序化纹理图集（16x16 格 16px，画在 256px canvas 上）
================================================================ */
export function buildAtlas() {
  const T = 16, N = 16;
  const cv = document.createElement('canvas');
  cv.width = cv.height = T * N;
  const ctx = cv.getContext('2d');

  const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(1337);

  function tile(idx, fn) {
    const ox = (idx % N) * T, oy = Math.floor(idx / N) * T;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const c = fn(x, y);
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
  const shade = (r,g,b,v) => `rgb(${Math.min(255,r*v)|0},${Math.min(255,g*v)|0},${Math.min(255,b*v)|0})`;
  const noisy = (r,g,b,amp=0.25) => shade(r,g,b, 1 - amp/2 + rnd()*amp);
  const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };

  tile(0, () => noisy(106, 190, 48));                                   // 草方块顶
  tile(1, (x,y) => {                                                    // 草方块侧
    const edge = 3 + ((x * 2654435761) % 3 | 0);
    return y <= edge ? noisy(106,190,48) : noisy(138, 95, 60);
  });
  tile(2, () => noisy(138, 95, 60));                                    // 泥土
  tile(3, () => noisy(125, 125, 125, 0.18));                            // 石头
  tile(4, (x) => {                                                      // 原木侧
    const stripe = (x % 4 === 0) ? 0.72 : 1;
    return shade(107*stripe, 79*stripe, 42*stripe, 0.9 + rnd()*0.2);
  });
  tile(5, (x,y) => {                                                    // 原木顶（年轮）
    const d = Math.max(Math.abs(x-7.5), Math.abs(y-7.5)) | 0;
    return d % 2 === 0 ? noisy(150, 112, 64, 0.12) : noisy(107, 79, 42, 0.12);
  });
  tile(6, () => rnd() < 0.12 ? shade(20, 60, 12, 1) : noisy(47, 122, 31, 0.35)); // 树叶
  tile(7, () => noisy(220, 210, 155, 0.15));                            // 沙子
  tile(8, (x,y) => {                                                    // 木板
    const line = (y % 4 === 3) ? 0.7 : 1;
    return shade(160*line, 128*line, 80*line, 0.9 + rnd()*0.2);
  });
  tile(9, (x,y) => {                                                    // 圆石
    const cell = ((x >> 2) + (y >> 2) * 4);
    const v = 0.7 + ((cell * 137) % 5) * 0.12;
    const border = (x % 4 === 0 || y % 4 === 0) ? 0.62 : 1;
    return shade(119*v*border, 119*v*border, 119*v*border, 1);
  });
  tile(10, () => noisy(68, 68, 68, 0.9));                               // 基岩
  tile(11, (x,y) => {                                                   // 水
    const wave = Math.sin((x + y * 2) * 0.8) * 0.08;
    return shade(63, 118, 228, 0.95 + wave + rnd()*0.06);
  });
  // 12 煤矿石：石头底 + 黑斑
  tile(12, (x,y) => hash(x, y*7+1) < 0.09 ? shade(30, 30, 30, 0.9 + rnd()*0.2)
                                          : noisy(110, 108, 108, 0.16));
  // 13 铁矿石：石头底 + 棕褐斑
  tile(13, (x,y) => hash(x, y*13+2) < 0.1 ? shade(178, 142, 108, 0.85 + rnd()*0.3)
                                          : noisy(120, 118, 116, 0.16));
  // 14 金矿石：石头底 + 金黄斑
  tile(14, (x,y) => hash(x, y*17+3) < 0.1 ? shade(226, 190, 60, 0.8 + rnd()*0.3)
                                          : noisy(120, 118, 116, 0.16));
  // 15 钻石矿石：石头底 + 青蓝斑
  tile(15, (x,y) => hash(x, y*19+4) < 0.1 ? shade(80, 226, 200, 0.75 + rnd()*0.3)
                                          : noisy(120, 118, 116, 0.16));
  // 16 岩浆
  tile(16, () => rnd() < 0.12 ? shade(255, 220, 120, 0.9 + rnd()*0.2)
                              : shade(214, 88, 20, 0.75 + rnd()*0.4));
  // 17 黑曜石
  tile(17, (x,y) => {
    const v = hash(x * 3, y * 5) < 0.5 ? 0.55 : 0.85;
    return shade(42 * v, 31 * v, 74 * v, 0.9 + rnd()*0.2);
  });
  // 18 工作台顶：木板 + 中间工具架
  tile(18, (x,y) => {
    if (x >= 6 && x <= 9 && y >= 5 && y <= 10) return shade(70, 54, 34, 0.9 + rnd()*0.2);
    const line = (y % 4 === 3) ? 0.7 : 1;
    return shade(160*line, 128*line, 80*line, 0.9 + rnd()*0.2);
  });
  // 19 工作台侧：木板 + 顶部工具架阴影
  tile(19, (x,y) => {
    if (y <= 4) return shade(60, 46, 28, 0.85 + rnd()*0.2);
    const line = (y % 4 === 3) ? 0.7 : 1;
    return shade(160*line, 128*line, 80*line, 0.9 + rnd()*0.2);
  });
  // 20 工作台底：木板
  tile(20, (x,y) => {
    const line = (y % 4 === 3) ? 0.7 : 1;
    return shade(150*line, 118*line, 72*line, 0.9 + rnd()*0.2);
  });
  // 21 下界岩
  tile(21, () => rnd() < 0.15 ? shade(150, 45, 30, 0.8 + rnd()*0.3)
                              : shade(112, 34, 24, 0.75 + rnd()*0.4));
  // 22 荧石
  tile(22, () => rnd() < 0.15 ? shade(255, 244, 180, 0.9 + rnd()*0.2)
                              : shade(214, 190, 110, 0.8 + rnd()*0.3));
  // 23 传送门：紫色漩涡纹
  tile(23, (x,y) => {
    const v = Math.sin((x + y * 2) * 1.3) * 0.5 + 0.5;
    return shade(140 + v * 60, 60 + v * 80, 220, 0.9 + rnd()*0.15);
  });
  // 24 远古残骸：深棕黑 + 橙斑
  tile(24, (x,y) => {
    if (hash(x * 7, y * 11) < 0.12) return shade(220, 130, 60, 0.85 + rnd()*0.3);
    return shade(60 + rnd()*20, 44 + rnd()*14, 34, 0.9);
  });
  // 25 熔炉顶/底：圆石 + 中心孔
  tile(25, (x,y) => {
    if (x >= 6 && x <= 9 && y >= 6 && y <= 9) return shade(40, 40, 40, 0.95 + rnd()*0.1);
    const cell = ((x >> 2) + (y >> 2) * 4);
    const v = 0.7 + ((cell * 137) % 5) * 0.12;
    const border = (x % 4 === 0 || y % 4 === 0) ? 0.62 : 1;
    return shade(119*v*border, 119*v*border, 119*v*border, 1);
  });
  // 26 熔炉侧：圆石
  tile(26, (x,y) => {
    const cell = ((x >> 2) + (y >> 2) * 4);
    const v = 0.7 + ((cell * 137) % 5) * 0.12;
    const border = (x % 4 === 0 || y % 4 === 0) ? 0.62 : 1;
    return shade(119*v*border, 119*v*border, 119*v*border, 1);
  });
  // 27 熔炉正面：圆石 + 炉口
  tile(27, (x,y) => {
    if (x >= 4 && x <= 11 && y >= 8 && y <= 14) {
      const e = (x === 4 || x === 11 || y === 8 || y === 14) ? 0.5 : 0.16;
      return shade(70*e, 60*e, 55*e, 1);
    }
    const cell = ((x >> 2) + (y >> 2) * 4);
    const v = 0.7 + ((cell * 137) % 5) * 0.12;
    const border = (x % 4 === 0 || y % 4 === 0) ? 0.62 : 1;
    return shade(119*v*border, 119*v*border, 119*v*border, 1);
  });
  // 28 箱子：木板 + 深色边框/锁扣
  tile(28, (x,y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return shade(90, 70, 44, 1);
    if (x >= 7 && x <= 8 && y >= 6 && y <= 9) return shade(70, 54, 34, 1);
    const line = (y % 4 === 3) ? 0.7 : 1;
    return shade(166*line, 132*line, 84*line, 0.9 + rnd()*0.2);
  });
  // 29 火把：棕柱 + 橙色火苗
  tile(29, (x,y) => {
    if (x >= 7 && x <= 8 && y >= 4 && y <= 15) return shade(120, 84, 48, 0.9 + rnd()*0.2);
    if (y <= 3) return rnd() < 0.5 ? shade(255, 170, 60, 0.85 + rnd()*0.3) : shade(255, 120, 40, 0.85 + rnd()*0.3);
    return shade(50, 40, 30, 1);
  });
  // 30 玻璃：浅蓝白半透明格
  tile(30, (x,y) => {
    const border = (x % 4 === 0 || y % 4 === 0);
    if (border) return shade(210, 228, 235, 1);
    return shade(190, 218, 228, 0.7 + rnd()*0.2);
  });
  // 31 石砖
  tile(31, (x,y) => {
    const cell = ((x >> 2) + (y >> 2) * 4);
    const v = 0.78 + ((cell * 131) % 3) * 0.1;
    const mortar = (x % 4 === 0 || y % 4 === 0) ? 0.6 : 1;
    return shade(125*v*mortar, 125*v*mortar, 125*v*mortar, 1);
  });
  // 32 栅栏：木柱 + 横杆
  tile(32, (x,y) => {
    if (x >= 6 && x <= 9) return shade(140, 108, 66, 0.9 + rnd()*0.2);
    if (y >= 5 && y <= 6 || y >= 10 && y <= 11) return shade(150, 116, 72, 0.9 + rnd()*0.2);
    return shade(120, 92, 56, 0.8 + rnd()*0.2);
  });
  // 33 梯子：竖框 + 横档
  tile(33, (x,y) => {
    if (x <= 1 || x >= 14) return shade(140, 108, 66, 0.9 + rnd()*0.2);
    if (y % 4 === 1 || y % 4 === 2) return shade(150, 116, 72, 0.9 + rnd()*0.2);
    return shade(60, 48, 34, 0.9);
  });
  // 34 铜矿石：石头底 + 铜色斑点
  tile(34, (x, y) => {
    const stone = 0.78 + hash(x, y) * 0.1;
    return (x % 5 === 0 && y % 5 === 0) ? shade(207, 138, 58, 1) : shade(125*stone, 125*stone, 125*stone, 1);
  });
  // 35 铁块
  tile(35, (x, y) => {
    if (x === 0 || y === 0) return shade(205, 205, 212, 1);
    if (x === 15 || y === 15) return shade(120, 120, 128, 1);
    return noisy(182, 182, 188, 0.1);
  });
  // 36 金块
  tile(36, (x, y) => {
    if (x === 0 || y === 0) return shade(255, 232, 120, 1);
    if (x === 15 || y === 15) return shade(170, 130, 30, 1);
    return noisy(242, 202, 82, 0.1);
  });
  // 37 钻石块
  tile(37, (x, y) => {
    if (x === 0 || y === 0) return shade(140, 240, 225, 1);
    if (x === 15 || y === 15) return shade(50, 150, 140, 1);
    return noisy(95, 215, 200, 0.12);
  });
  // 38 铜块
  tile(38, (x, y) => {
    if (x === 0 || y === 0) return shade(235, 160, 90, 1);
    if (x === 15 || y === 15) return shade(140, 80, 35, 1);
    return noisy(205, 130, 70, 0.12);
  });
  // 39 绿宝石块
  tile(39, (x, y) => {
    if (x === 0 || y === 0) return shade(110, 235, 120, 1);
    if (x === 15 || y === 15) return shade(30, 120, 45, 1);
    return noisy(70, 205, 90, 0.12);
  });
  // 40 煤炭块
  tile(40, (x, y) => {
    if (x === 0 || y === 0) return shade(64, 64, 64, 1);
    return noisy(28, 28, 28, 0.35);
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, canvas: cv };
}
export const atlas = buildAtlas();
