import { BLOCKS, atlas,
         SWORD,
         WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_HOE,
         STONE_SWORD, STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_HOE,
         IRON_SWORD, IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_HOE,
         GOLD_SWORD, GOLD_PICK, GOLD_AXE, GOLD_SHOVEL, GOLD_HOE,
         DIAMOND_SWORD, DIAMOND_PICK, DIAMOND_AXE, DIAMOND_SHOVEL, DIAMOND_HOE,
         IRON_INGOT, GOLD_INGOT, DIAMOND, COAL,
         LEATHER, LEATHER_HELMET, LEATHER_CHESTPLATE, LEATHER_LEGGINGS, LEATHER_BOOTS,
         IRON_HELMET, IRON_CHESTPLATE, IRON_LEGGINGS, IRON_BOOTS,
         GOLD_HELMET, GOLD_CHESTPLATE, GOLD_LEGGINGS, GOLD_BOOTS,
         DIAMOND_HELMET, DIAMOND_CHESTPLATE, DIAMOND_LEGGINGS, DIAMOND_BOOTS,
         EMERALD, BONE, STRING, GUNPOWDER, ARMOR, ARMOR_SLOTS, recommendTool,
         BLOCK_TIER, TOOL_TIER } from './constants.js';
import { inv, invSlots, hotbar, sel, setSel, setHotbarSlot, addItem, removeItem,
         itemCount, inventoryEvents, armorSlots, wearArmor, takeOffArmor, armorDefense } from './inventory.js';
import { craftSlots, tableSlots, RECIPES, TABLE_RECIPES,
         matchCraftRecipe, matchTableRecipe, craftOnce, blockName,
         craftEvents, setTableOpen, tableOpen } from './crafting.js';
import { selectedHotbarId } from './inventory.js';
import { player, playerEvents, mining } from './player.js';
import { zombies } from './zombies.js';
import { worldTime, isDay, renderer } from './renderer.js';
import { lastSaveAt } from './save.js';

/* ================================================================
   DOM 工具
================================================================ */
const $ = id => document.getElementById(id);

/* ================================================================
   物品图标：工具/材料/盔甲手绘原版风格，方块从图集截取
================================================================ */
const MAT = {
  wood:    { head: '#c8a05a', dark: '#6b4f2a' },
  stone:   { head: '#9a9a9a', dark: '#4a4a4a' },
  iron:    { head: '#e0e0e0', dark: '#5a5a5a' },
  gold:    { head: '#ffdf6e', dark: '#a67c1e' },
  diamond: { head: '#6fe3d0', dark: '#2a7a6a' },
  leather: { head: '#8a5a2a', dark: '#5a3a1a' },
};
const KIND_BY_ID = {
  [SWORD]: ['sword', 'wood'], [WOOD_PICK]: ['pick', 'wood'], [WOOD_AXE]: ['axe', 'wood'],
  [WOOD_SHOVEL]: ['shovel', 'wood'], [WOOD_HOE]: ['hoe', 'wood'],
  [STONE_SWORD]: ['sword', 'stone'], [STONE_PICK]: ['pick', 'stone'], [STONE_AXE]: ['axe', 'stone'],
  [STONE_SHOVEL]: ['shovel', 'stone'], [STONE_HOE]: ['hoe', 'stone'],
  [IRON_SWORD]: ['sword', 'iron'], [IRON_PICK]: ['pick', 'iron'], [IRON_AXE]: ['axe', 'iron'],
  [IRON_SHOVEL]: ['shovel', 'iron'], [IRON_HOE]: ['hoe', 'iron'],
  [GOLD_SWORD]: ['sword', 'gold'], [GOLD_PICK]: ['pick', 'gold'], [GOLD_AXE]: ['axe', 'gold'],
  [GOLD_SHOVEL]: ['shovel', 'gold'], [GOLD_HOE]: ['hoe', 'gold'],
  [DIAMOND_SWORD]: ['sword', 'diamond'], [DIAMOND_PICK]: ['pick', 'diamond'], [DIAMOND_AXE]: ['axe', 'diamond'],
  [DIAMOND_SHOVEL]: ['shovel', 'diamond'], [DIAMOND_HOE]: ['hoe', 'diamond'],
  [IRON_INGOT]: ['ingot', 'iron'], [GOLD_INGOT]: ['ingot', 'gold'], [DIAMOND]: ['diamond', 'gem'], [COAL]: ['coal', 'gem'],
  [LEATHER]: ['leather', 'leather'],
  [EMERALD]: ['emerald', 'gem'], [BONE]: ['bone', 'mat'],
  [STRING]: ['string', 'mat'], [GUNPOWDER]: ['powder', 'mat'],
  [LEATHER_HELMET]: ['helmet', 'leather'], [LEATHER_CHESTPLATE]: ['chest', 'leather'],
  [LEATHER_LEGGINGS]: ['legs', 'leather'], [LEATHER_BOOTS]: ['boots', 'leather'],
  [IRON_HELMET]: ['helmet', 'iron'], [IRON_CHESTPLATE]: ['chest', 'iron'],
  [IRON_LEGGINGS]: ['legs', 'iron'], [IRON_BOOTS]: ['boots', 'iron'],
  [GOLD_HELMET]: ['helmet', 'gold'], [GOLD_CHESTPLATE]: ['chest', 'gold'],
  [GOLD_LEGGINGS]: ['legs', 'gold'], [GOLD_BOOTS]: ['boots', 'gold'],
  [DIAMOND_HELMET]: ['helmet', 'diamond'], [DIAMOND_CHESTPLATE]: ['chest', 'diamond'],
  [DIAMOND_LEGGINGS]: ['legs', 'diamond'], [DIAMOND_BOOTS]: ['boots', 'diamond'],
};

function drawSpecial(ctx, size, kind, mat) {
  const u = size / 16;
  const px = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(x * u, y * u, Math.ceil(u), Math.ceil(u)); };
  const c = MAT[mat] || MAT.wood;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let col = null;
    if (kind === 'stick') {
      if (x >= 7 && x <= 8 && y >= 1 && y <= 14) col = c.head;
      if (x === 7 && (y === 1 || y === 14)) col = c.dark;
    } else if (kind === 'sword') {
      if (y === 0) col = (x === 7) ? c.head : null;
      else if (y === 1) col = (x >= 6 && x <= 8) ? c.head : null;
      else if (y <= 8) col = (x >= 6 && x <= 8) ? (x === 7 ? c.head : c.dark) : null;
      else if (y === 9) col = (x >= 4 && x <= 11) ? c.dark : null;
      else if (y === 10) col = (x === 7) ? c.dark : null;
      else if (y >= 11 && y <= 12) col = (x === 7) ? c.dark : null;
      else if (y >= 13) col = (x >= 6 && x <= 8) ? c.dark : null;
    } else if (kind === 'pick') {
      if (y >= 2 && y <= 4 && x >= 3 && x <= 6) col = c.head;
      if ((x === 3 || x === 4) && y === 5) col = c.head;
      if (x === 5 && y === 5) col = c.dark;
      if (x === 6 && y === 2) col = c.dark;
      if (y >= 7 && y <= 12 && x === y) col = c.dark;
    } else if (kind === 'axe') {
      if (y >= 3 && y <= 6 && x >= 2 && x <= 4) col = c.head;
      if (x === 1 && (y === 4 || y === 5)) col = c.head;
      if (x === 5 && y === 3) col = c.dark;
      if (x === 4 && y === 6) col = c.dark;
      if (y >= 6 && y <= 12 && x === y) col = c.dark;
    } else if (kind === 'shovel') {
      if (y >= 2 && y <= 4 && x >= 3 && x <= 7) col = c.head;
      if (y === 5 && x >= 4 && x <= 6) col = c.dark;
      if (x === 6 && y >= 6 && y <= 14) col = c.dark;
    } else if (kind === 'hoe') {
      if (y >= 4 && y <= 5 && x >= 2 && x <= 5) col = c.head;
      if (x === 1 && (y === 3 || y === 6)) col = c.head;
      if (x === 6 && y === 4) col = c.dark;
      if (x === 5 && y === 5) col = c.dark;
      if (y >= 7 && y <= 12 && x === y) col = c.dark;
    } else if (kind === 'ingot') {
      if (y === 2 || y === 6) col = (x === 7) ? c.head : null;
      else if (y === 3 || y === 5) col = (x >= 6 && x <= 8) ? c.head : null;
      else if (y === 4) col = (x >= 5 && x <= 9) ? c.head : null;
    } else if (kind === 'diamond') {
      if (y === 3 || y === 7) col = (x === 7) ? '#7df5df' : null;
      else if (y === 4 || y === 6) col = (x >= 6 && x <= 8) ? '#7df5df' : null;
      else if (y === 5) col = (x >= 5 && x <= 9) ? '#6fe3d0' : null;
      else if (y === 8) col = (x === 7) ? '#3a8a7a' : null;
    } else if (kind === 'coal') {
      if (y >= 5 && y <= 10 && x >= 5 && x <= 10) col = (x === 5 || x === 10 || y === 5 || y === 10) ? '#3a3a3a' : '#2a2a2a';
    } else if (kind === 'leather') {
      if (y >= 4 && y <= 11 && x >= 3 && x <= 12) col = c.head;
      if (y === 5 || y === 10) col = (x >= 3 && x <= 12) ? c.dark : null;
      if (y === 4 && (x === 3 || x === 12)) col = c.dark;
      if (y === 11 && (x === 3 || x === 12)) col = c.dark;
    } else if (kind === 'emerald') {
      if (y === 3 || y === 7) col = (x === 7) ? '#3fd95f' : null;
      else if (y === 4 || y === 6) col = (x >= 6 && x <= 8) ? '#2fcf4f' : null;
      else if (y === 5) col = (x >= 5 && x <= 9) ? '#2fc84f' : null;
      else if (y === 8) col = (x === 7) ? '#1a8a3a' : null;
    } else if (kind === 'bone') {
      if (y >= 3 && y <= 12 && (x === y - 2 || x === y + 1)) col = '#e8e4da';
      if ((x === 4 || x === 5) && (y === 3 || y === 4)) col = '#d0ccc4';
      if ((x === 10 || x === 11) && (y === 11 || y === 12)) col = '#d0ccc4';
    } else if (kind === 'string') {
      if (y === 6 && x >= 3 && x <= 12) col = (x % 2 === 0) ? '#e0e0e0' : '#c8c8c8';
      if (y === 7 && x >= 4 && x <= 11) col = (x % 2 === 1) ? '#e0e0e0' : '#c8c8c8';
      if (y === 8 && x >= 5 && x <= 10) col = (x % 2 === 0) ? '#e0e0e0' : '#c8c8c8';
    } else if (kind === 'powder') {
      if (y >= 4 && y <= 11 && x >= 4 && x <= 11) col = (x + y) % 3 === 0 ? '#6a6a6a' : '#8a8a8a';
      if ((y === 4 || y === 11) && x >= 4 && x <= 11) col = '#555555';
      if ((x === 4 || x === 11) && y >= 4 && y <= 11) col = '#555555';
    } else if (kind === 'helmet') {
      if (y >= 2 && y <= 5) col = (x >= 3 && x <= 12) ? c.head : null;
      else if (y >= 6 && y <= 9) col = (x === 3 || x === 12) ? c.head : null;
      else if (y >= 6 && y <= 8) col = (x === 4 || x === 11) ? c.dark : null;
      else if (y === 10 && x >= 5 && x <= 10) col = c.dark;
    } else if (kind === 'chest') {
      if (y >= 3 && y <= 12) col = (x >= 3 && x <= 12) ? c.head : null;
      if (y === 5) col = (x >= 4 && x <= 11) ? c.dark : null;
      if (y === 4 && (x === 7 || x === 8)) col = '#ffd24a';
      if (y === 11) col = (x >= 4 && x <= 11) ? c.dark : null;
    } else if (kind === 'legs') {
      if (y >= 3 && y <= 9 && x >= 4 && x <= 11) col = c.head;
      if (y >= 10 && y <= 14) col = (x >= 4 && x <= 5 || x >= 10 && x <= 11) ? c.head : null;
      if (y === 7 && (x === 4 || x === 11)) col = c.dark;
    } else if (kind === 'boots') {
      if (y >= 4 && y <= 10 && x >= 4 && x <= 11) col = c.head;
      if (y >= 11 && y <= 13 && x >= 3 && x <= 12) col = c.head;
      if (y >= 14 && (x === 3 || x === 12)) col = c.dark;
    }
    if (col) px(x, y, col);
  }
}

export function drawItemIcon(canvas, id) {
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (id == null) return;
  const sp = KIND_BY_ID[id];
  if (sp) { drawSpecial(c, canvas.width, sp[0], sp[1]); return; }
  const t = BLOCKS[id] && BLOCKS[id].tiles;
  if (t) {
    const tile = t.side ?? t.all ?? t.top;
    c.drawImage(atlas.canvas, (tile % 16) * 16, Math.floor(tile / 16) * 16, 16, 16,
                0, 0, canvas.width, canvas.height);
  }
}

/* ================================================================
   血条
================================================================ */
export function renderHearts() {
  const heartsEl = $('hearts');
  let html = '';
  for (let i = 0; i < 10; i++) {
    const v = player.hp - i * 2;
    html += `<span class="heart ${v >= 1.5 ? '' : v >= 0.5 ? 'half' : 'empty'}">♥</span>`;
  }
  heartsEl.innerHTML = html;
}

/* ================================================================
   HUD 快捷栏
================================================================ */
const hudSlots = [];
export function buildHotbarHud() {
  const el = $('hotbar');
  el.innerHTML = '';
  hudSlots.length = 0;
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div');
    d.className = 'slot';
    const key = document.createElement('span');
    key.className = 'key'; key.textContent = i + 1;
    d.appendChild(key);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 40;
    d.appendChild(cv);
    const cnt = document.createElement('span');
    cnt.className = 'count';
    d.appendChild(cnt);
    d.addEventListener('click', () => { setSel(i); renderHotbarHud(); });
    el.appendChild(d);
    hudSlots.push(d);
  }
  renderHotbarHud();
}
export function renderHotbarHud() {
  hudSlots.forEach((d, i) => {
    const id = hotbar[i];
    drawItemIcon(d.querySelector('canvas'), id);
    d.classList.toggle('sel', i === sel);
    d.classList.toggle('empty', id == null || itemCount(id) <= 0);
    d.querySelector('.count').textContent = id != null ? (itemCount(id) || '') : '';
    d.title = id != null ? (BLOCKS[id].name + ' ×' + itemCount(id)) : '';
  });
}

/* ================================================================
   调试信息
================================================================ */
// 氧气条（仅头没入水中时显示）
export function renderAir() {
  const el = $('airbar');
  if (!el) return;
  if (!player.headInWater) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const p = player.air / 20;
  el.innerHTML = '<span class="air-ico">气泡</span><div class="air-track"><div class="air-fill" style="width:' +
    (p * 100).toFixed(0) + '%"></div></div>' +
    (player.air <= 0 ? '<span class="air-warn">窒息！</span>' : '');
}

// 准星指向方块信息：名称 / 推荐工具 / 硬度 / 挖掘血量 / 等级提示
export function renderBlockInfo(hit) {
  const el = $('blockinfo');
  if (!el) return;
  if (!hit) { el.style.display = 'none'; return; }
  const id = hit.id;
  const b = BLOCKS[id];
  if (!b || b.hard <= 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const tool = selectedToolId();
  let html = `<b>${b.name}</b> · 硬度 ${b.hard} · 推荐：${recommendTool(id)}`;
  const tier = BLOCK_TIER[id];
  if (tier && tier > 1) {
    const toolTier = TOOL_TIER[tool] || 0;
    html += `<span class="blk-tier">${toolTier >= tier ? '✓ 当前工具可采集' : '⚠ 需要 ' + ['', '木镐', '石镐', '铁镐', '钻石镐'][tier]}</span>`;
  }
  if (mining.active && mining.x === hit.x && mining.y === hit.y && mining.z === hit.z) {
    const hard = b.hard;
    const p = Math.min(100, mining.t / hard * 100);
    html += `<div class="blk-hp"><div style="width:${p.toFixed(0)}%"></div></div>`;
  }
  el.innerHTML = html;
}
function selectedToolId() {
  return (typeof selectedHotbarId === 'function') ? selectedHotbarId() : null;
}

export function renderDebug(fps, pos, zombieCount, fly, swim, dim) {
  const debugEl = $('debug');
  const t = worldTime < 240 ? `白天 ${(worldTime / 240 * 12 + 6).toFixed(1)} 时` : '夜晚';
  debugEl.textContent =
    `FPS ${fps.toFixed(0)}  坐标 ${pos.x.toFixed(1)} ${pos.y.toFixed(1)} ${pos.z.toFixed(1)}
` +
    `${t}  怪物 ${zombieCount}${fly ? '  [飞行]' : ''}${swim ? '  [游泳]' : ''}` +
    (dim === 'nether' ? '  [下界]' : '');
}

/* ================================================================
   菜单 / 存档状态
================================================================ */
export function updateSaveStatus() {
  const el = $('saveStatus');
  if (!el) return;
  if (lastSaveAt) {
    el.textContent = '✅ 进度已自动保存 · ' + new Date(lastSaveAt).toLocaleTimeString('zh-CN', { hour12: false });
  } else if (localStorage.getItem('voxelcraft_save_v1')) {
    el.textContent = '💾 检测到已有存档，点击开始后自动继续';
  } else {
    el.textContent = '💾 游戏进度会自动保存在当前浏览器中（也可手动保存）';
  }
}
export function setMenuSubtitle(text) {
  const el = $('menuSubtitle');
  if (el) el.textContent = text;
}

/* ================================================================
   死亡界面
================================================================ */
export function showDeath(cause) {
  const msg = cause === 'zombie' ? '你被僵尸吃掉了 🧟'
    : cause === 'spider' ? '你被蜘蛛咬了 🕷'
    : cause === 'creeper' ? '你被苦力怕炸飞了 💥'
    : cause === 'skeleton' ? '你被骷髅射中了 🏹'
    : cause === 'fell from a high place' ? '你从高处坠落摔死了'
    : cause === '岩浆' ? '你掉进岩浆里了 🔥' : '你死了';
  $('deathMsg').textContent = msg;
  $('deathScreen').style.display = 'flex';
  if (document.exitPointerLock) document.exitPointerLock();
}
export function hideDeath() {
  $('deathScreen').style.display = 'none';
}

/* ================================================================
   背包界面（三段式：顶部合成 / 中部库存+盔甲 / 底部快捷栏）
================================================================ */
let inventoryOpen = false;
let selectedInvItem = null;

export function isInventoryOpen() { return inventoryOpen; }

export function openInventory() {
  inventoryOpen = true;
  selectedInvItem = null;
  $('inventoryUI').style.display = 'flex';
  renderInventory();
  if (document.exitPointerLock) document.exitPointerLock();
}
export function closeInventory() {
  inventoryOpen = false;
  selectedInvItem = null;
  $('inventoryUI').style.display = 'none';
}

function makeSlotCv(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  return cv;
}

function renderArmor() {
  const grid = $('armorGrid');
  grid.innerHTML = '';
  const labels = { head: '头盔', chest: '胸甲', legs: '护腿', feet: '靴子' };
  ARMOR_SLOTS.forEach((slot, i) => {
    const id = armorSlots[slot];
    const d = document.createElement('div');
    d.className = 'armor-slot is-slot' + (id ? '' : ' empty');
    if (id) {
      const cv = makeSlotCv(40);
      drawItemIcon(cv, id);
      d.appendChild(cv);
      d.title = BLOCKS[id].name + '（防御 ' + ARMOR[id].defense + '）';
    } else {
      const lbl = document.createElement('span');
      lbl.className = 'armor-label'; lbl.textContent = labels[slot];
      d.appendChild(lbl);
    }
    d.addEventListener('click', () => {
      if (selectedInvItem != null && ARMOR[selectedInvItem] && ARMOR[selectedInvItem].slot === slot) {
        wearArmor(selectedInvItem);
        selectedInvItem = null;
      } else if (armorSlots[slot] != null) {
        takeOffArmor(slot);
      }
      renderInventory();
    });
    grid.appendChild(d);
  });
  const def = armorDefense();
  $('armorDef').textContent = '总防御：' + def + ' 点';
}

function renderInventoryGrid() {
  const grid = $('invGrid');
  grid.innerHTML = '';
  for (let i = 0; i < invSlots.length; i++) {
    const s = invSlots[i];
    const d = document.createElement('div');
    d.className = 'is-slot' + (s ? '' : ' empty') + (s && selectedInvItem === s.id ? ' sel' : '');
    if (s) {
      const cv = makeSlotCv(40);
      drawItemIcon(cv, s.id);
      d.appendChild(cv);
      const cnt = document.createElement('span');
      cnt.className = 'count'; cnt.textContent = s.count;
      d.appendChild(cnt);
      d.title = BLOCKS[s.id].name;
    }
    d.addEventListener('click', () => {
      if (s) selectedInvItem = (selectedInvItem === s.id ? null : s.id);
      else selectedInvItem = null;
      renderInventoryGrid();
      renderArmor();
    });
    grid.appendChild(d);
  }
}

function renderInventoryHotbar() {
  const bar = $('invHotbar');
  bar.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div');
    d.className = 'is-slot' + (i === sel ? ' sel' : '');
    const cv = makeSlotCv(40);
    drawItemIcon(cv, hotbar[i]);
    d.appendChild(cv);
    if (hotbar[i] != null) {
      const cnt = document.createElement('span');
      cnt.className = 'count'; cnt.textContent = itemCount(hotbar[i]);
      d.appendChild(cnt);
      d.title = BLOCKS[hotbar[i]].name;
    }
    d.addEventListener('click', () => {
      if (selectedInvItem != null) {
        const old = hotbar[i];
        if (old === selectedInvItem) {
          selectedInvItem = null;
        } else {
          if (old != null) addItem(old, 1);
          setHotbarSlot(i, selectedInvItem);
          removeItem(selectedInvItem, 1);
          selectedInvItem = null;
        }
      } else if (hotbar[i] != null) {
        addItem(hotbar[i], 1);
        setHotbarSlot(i, null);
      } else {
        setSel(i);
      }
      renderInventory();
    });
    bar.appendChild(d);
  }
}

function renderCraftArea() {
  for (let i = 0; i < 4; i++) {
    const slot = $('craftSlot' + i);
    slot.innerHTML = '';
    const id = craftSlots[i];
    if (id != null) {
      const cv = makeSlotCv(40);
      drawItemIcon(cv, id);
      slot.appendChild(cv);
      slot.title = BLOCKS[id].name;
      slot.classList.remove('empty');
    } else {
      slot.classList.add('empty');
      slot.title = '';
    }
  }
  const m = matchCraftRecipe();
  const res = $('craftResult');
  res.innerHTML = '';
  res.title = '';
  if (m) {
    const cv = makeSlotCv(48);
    drawItemIcon(cv, m.recipe.result);
    res.appendChild(cv);
    const cnt = document.createElement('span');
    cnt.className = 'count'; cnt.textContent = '×' + m.recipe.count;
    res.appendChild(cnt);
    res.title = m.recipe.name;
    res.classList.remove('empty');
  } else {
    res.classList.add('empty');
  }
  renderRecipeList(RECIPES, $('recipeList'));
}

// 配方需求文本（从 pattern 统计）
function recipeMats(r) {
  const counts = {};
  for (const m of r.pattern) if (m != null) counts[m] = (counts[m] || 0) + 1;
  return Object.entries(counts).map(([id, n]) => `${blockName(+id)}×${n}`).join(' ');
}
function renderRecipeList(recipes, list) {
  list.innerHTML = '';
  recipes.forEach(r => {
    const d = document.createElement('div');
    d.className = 'recipe';
    d.innerHTML = `<b>${r.name}</b><span class="r-mats">${recipeMats(r)}</span><span class="r-out">→ ${r.name}×${r.count}</span>`;
    list.appendChild(d);
  });
}

export function renderInventory() {
  renderArmor();
  renderInventoryGrid();
  renderInventoryHotbar();
  renderCraftArea();
}

function renderTable() {
  for (let i = 0; i < 9; i++) {
    const slot = $('tableSlot' + i);
    slot.innerHTML = '';
    const id = tableSlots[i];
    if (id != null) {
      const cv = makeSlotCv(40);
      drawItemIcon(cv, id);
      slot.appendChild(cv);
      slot.title = BLOCKS[id].name;
      slot.classList.remove('empty');
    } else {
      slot.classList.add('empty');
      slot.title = '';
    }
  }
  const m = matchTableRecipe();
  const res = $('tableResult');
  res.innerHTML = '';
  res.title = '';
  if (m) {
    const cv = makeSlotCv(48);
    drawItemIcon(cv, m.recipe.result);
    res.appendChild(cv);
    const cnt = document.createElement('span');
    cnt.className = 'count'; cnt.textContent = '×' + m.recipe.count;
    res.appendChild(cnt);
    res.title = m.recipe.name;
    res.classList.remove('empty');
  } else {
    res.classList.add('empty');
  }
  renderTableInvGrid();
  renderTableHotbar();
  renderRecipeList(TABLE_RECIPES, $('tableRecipeList'));
}

function renderTableInvGrid() {
  const grid = $('tableInvGrid');
  grid.innerHTML = '';
  for (let i = 0; i < invSlots.length; i++) {
    const s = invSlots[i];
    const d = document.createElement('div');
    d.className = 'is-slot' + (s ? '' : ' empty') + (s && selectedInvItem === s.id ? ' sel' : '');
    if (s) {
      const cv = makeSlotCv(40);
      drawItemIcon(cv, s.id);
      d.appendChild(cv);
      const cnt = document.createElement('span');
      cnt.className = 'count'; cnt.textContent = s.count;
      d.appendChild(cnt);
      d.title = BLOCKS[s.id].name;
    }
    d.addEventListener('click', () => {
      if (s) selectedInvItem = (selectedInvItem === s.id ? null : s.id);
      else selectedInvItem = null;
      renderTableInvGrid();
    });
    grid.appendChild(d);
  }
}

function renderTableHotbar() {
  const bar = $('tableHotbar');
  bar.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div');
    d.className = 'is-slot' + (i === sel ? ' sel' : '');
    const cv = makeSlotCv(40);
    drawItemIcon(cv, hotbar[i]);
    d.appendChild(cv);
    if (hotbar[i] != null) {
      const cnt = document.createElement('span');
      cnt.className = 'count'; cnt.textContent = itemCount(hotbar[i]);
      d.appendChild(cnt);
      d.title = BLOCKS[hotbar[i]].name;
    }
    d.addEventListener('click', () => {
      if (selectedInvItem != null) {
        const old = hotbar[i];
        if (old === selectedInvItem) {
          selectedInvItem = null;
        } else {
          if (old != null) addItem(old, 1);
          setHotbarSlot(i, selectedInvItem);
          removeItem(selectedInvItem, 1);
          selectedInvItem = null;
        }
      } else if (hotbar[i] != null) {
        addItem(hotbar[i], 1);
        setHotbarSlot(i, null);
      } else {
        setSel(i);
      }
      renderTable();
    });
    bar.appendChild(d);
  }
}

export function openTable() {
  setTableOpen(true);
  $('tableUI').style.display = 'flex';
  renderTable();
  if (document.exitPointerLock) document.exitPointerLock();
}
export function closeTable() {
  setTableOpen(false);
  // 合成格里的材料全部退回背包
  tableSlots.forEach((id, i) => { if (id != null) { addItem(id, 1); tableSlots[i] = null; } });
  $('tableUI').style.display = 'none';
}
export function isTableOpen() { return tableOpen; }

export function bindInventoryUI() {
  $('closeInvBtn').addEventListener('click', () => {
    closeInventory();
    if (!player.dead) renderer.domElement.requestPointerLock?.();
  });
  for (let i = 0; i < 4; i++) {
    $('craftSlot' + i).addEventListener('click', () => {
      if (craftSlots[i] != null) {
        addItem(craftSlots[i], 1);
        craftSlots[i] = null;
      } else if (selectedInvItem != null && itemCount(selectedInvItem) > 0) {
        craftSlots[i] = selectedInvItem;
        removeItem(selectedInvItem, 1);
        selectedInvItem = null;
      }
      craftEvents.dispatchEvent(new CustomEvent('change'));
      renderInventory();
    });
  }
  $('craftResult').addEventListener('click', () => {
    const m = matchCraftRecipe();
    if (m) {
      craftOnce(m.recipe, craftSlots, m.hit, 2);
      renderInventory();
    }
  });
}
export function bindTableUI() {
  $('closeTableBtn').addEventListener('click', () => {
    closeTable();
    if (!player.dead) renderer.domElement.requestPointerLock?.();
  });
  for (let i = 0; i < 9; i++) {
    $('tableSlot' + i).addEventListener('click', () => {
      if (tableSlots[i] != null) {
        addItem(tableSlots[i], 1);
        tableSlots[i] = null;
      } else if (selectedInvItem != null && itemCount(selectedInvItem) > 0) {
        tableSlots[i] = selectedInvItem;
        removeItem(selectedInvItem, 1);
        selectedInvItem = null;
      }
      craftEvents.dispatchEvent(new CustomEvent('change'));
      renderTable();
    });
  }
  $('tableResult').addEventListener('click', () => {
    const m = matchTableRecipe();
    if (m) {
      craftOnce(m.recipe, tableSlots, m.hit, 3);
      renderTable();
    }
  });
}

/* ================================================================
   事件订阅
================================================================ */
inventoryEvents.addEventListener('invchange', () => {
  renderHotbarHud();
  if (inventoryOpen) renderInventoryGrid();
});
inventoryEvents.addEventListener('selchange', () => {
  renderHotbarHud();
  if (inventoryOpen) renderInventory();
});
inventoryEvents.addEventListener('armorchange', () => {
  if (inventoryOpen) renderArmor();
});
craftEvents.addEventListener('change', () => {
  if (inventoryOpen) renderCraftArea();
  if (tableOpen) renderTable();
});
playerEvents.addEventListener('healthchange', renderHearts);
playerEvents.addEventListener('death', e => showDeath(e.detail && e.detail.cause));
playerEvents.addEventListener('respawn', hideDeath);

export { zombies };
