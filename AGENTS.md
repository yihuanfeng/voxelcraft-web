# AGENTS.md

面向 AI 编码代理（及协作者）的仓库指南。先读这里再动手改代码。

## 项目速览

网页版沙盒游戏（体素建造/生存）。纯静态前端，无 npm、无构建步骤、无后端：
- **入口**：`game.html`（`index.html` 只是跳转到它）
- **渲染**：Three.js r160（本地化在 `lib/three.module.js`，浏览器 importmap 映射 `three`）
- **模块**：`js/` 下原生 ES Modules，浏览器直接加载
- **运行**：`python3 server.py 8000`（no-cache 静态服务器）→ `http://localhost:8000/game.html`

## 目录职责

| 路径 | 职责 |
|---|---|
| `game.html` | 薄壳：HUD/菜单/背包/工作台 UI 结构 + importmap |
| `index.html` | GitHub Pages 跳转入口（重定向到 game.html） |
| `js/main.js` | 初始化、输入、主循环、维度切换、手动保存、测试钩子 `window.game` |
| `js/constants.js` | ID 常量、方块/工具/盔甲注册表、`PLACEABLE_IDS`、`buildAtlas()` 程序化纹理图集 |
| `js/world.js` | 世界生成（主世界/下界）、矿洞、村庄、传送门、`getBlock/setBlock/moveEntity/collideAxis` |
| `js/noise.js` | 确定性噪声（hash + valueNoise + fbm） |
| `js/renderer.js` | Three.js 渲染、区块网格、粒子/掉落物、`aimBlock`、分帧构建队列 |
| `js/player.js` | 玩家物理、挖掘/放置、伤害（含盔甲减伤）、死亡/重生 |
| `js/inventory.js` | 库存 36 格（同一套格子：0-8 快捷栏 + 9-35 背包）、盔甲槽、物品计数、`inventoryEvents` |
| `js/crafting.js` | 2×2/3×3 合成（形状匹配）、70+ 配方（含储存块正/逆向、铜盔甲）、`craftEvents` |
| `js/zombies.js` | 怪物：僵尸/骷髅/蜘蛛/苦力怕/老虎、刷怪器、骷髅箭 |
| `js/villagers.js` | 村庄村民 NPC |
| `js/ui.js` | HUD、原版布局背包/工作台、配方书（勾叉+自动摆放）、角色小人、物品图标 |
| `js/save.js` | localStorage 存档（方块差异 + 玩家状态 + 时间） |
| `js/audio.js` | WebAudio 音效 |
| `css/main.css` | 全部样式 |
| `backups/` | **历史归档，不要改**（原始版/单文件中文版快照） |
| `WebMC/` | **遗留克隆目录，独立 git 仓库，不要碰**（.gitignore 已排除） |

## 常用命令

```bash
python3 server.py 8000          # 启动本地服务器（no-cache，避免模块缓存）
node --input-type=module --check < js/xxx.js   # 改完 JS 先查语法
git add -A && git commit -m "..." && git push origin main   # 提交推送
```

## 核心架构规则

### 模块依赖方向（上层 import 下层，禁止反向依赖造成环）

```
main.js → ui / player / renderer / zombies / villagers / save / inventory
ui.js → constants / inventory / crafting / player / renderer / save
player.js → constants / world / inventory / renderer / audio
renderer.js → constants / world
zombies.js → constants / world / player / renderer / audio
```

### 存档（save.js）

- key：`voxelcraft_save_v1`；结构 `{ v:1, world:{方块差异}, player:{位置/库存/盔甲/dim}, time }`
- 新增玩家字段：`flushSave()` 写入 + `applyPlayerSave()` 恢复 + 旧存档缺省值处理
- 库存是 **36 格 `invSlots`**（每格 `{id,count}|null`，`invSlots[0..8]`=快捷栏、`[9..35]`=背包；快捷栏是背包的一部分，同一库存不重复计数），`inv` 是 id→count 派生视图；旧 16/27 格存档按长度自动迁移（背包放 9+i，旧 `hotbar` 引用物品从背包扣 1 放回快捷栏），更旧的 `inv` 对象同样迁移
- 设置（和平模式）在 `voxelcraft_settings_v1`

### 无限世界（必须遵守）

- **无限区块化**：主世界 `chunks`、下界 `netherChunks` 为 Map（key `"cx,cz"`，每块 Uint8Array 16×16×96）
- `getBlock/setBlock` 任意坐标：未生成的区块按确定性噪声**惰性生成**（genChunk，树/矿洞/矿物同旧算法）
- 出生原点 (256,256)；村庄 5 处与传送门 2 处固定布局（genChunk 时放置）
- 网格构建走分帧：`scheduleRebuildAll(px,pz)`（玩家周围 LOAD_R=8 区块）+ 每帧 `updateBuildQueue()`（5 块/帧）+ `ensureChunks()` 自动补载（跨区块触发，0.4 秒节流）；远离 KEEP_R=12 的区块网格自动回收
- 挖/放单块用 `rebuildAround(x,z)` 局部重建
- 渲染器有玻璃渲染通道（`GLASS` 走 `gpos/glassMat` 半透明）
- 存档方块差异任意坐标（`markDirty` 不再受 512 边界限制）

### 合成（crafting.js）

- `RECIPES`（2×2，4 条：木板/木棍/木剑/荧石）/ `TABLE_RECIPES`（3×3，71 条：工作台等杂项 + 6 材质×5 工具 + 5 材质×4 盔甲 + 6 储存块正逆向）
- pattern 是 W×W 数组（单元素数组也行，normPattern 按 W 读取，越界当空），`null` 为空；`normPattern` 去空行空列，`matchGrid` 允许整体平移、区域内无多余材料
- 执行：`craftOnce(recipe, slots, hit, W)`（W=2 或 3）
- 工具配方用 `toolRecipe(mat, kind)`；盔甲配方用 `armorRecipe(ing, kind, result)`（**ing 是材料**，result 是成品，别把成品当材料）
- 储存块用 `BLOCK_STORE` 表自动生成正向（9 材料满铺→块）与逆向（单格块→9 材料）两条
- UI 点击合成时用 `matchCraftRecipe()/matchTableRecipe()` 返回 `{recipe, hit}`
- 配方书：`renderRecipeBook(list, recipes)`（第一个参数是容器元素）；背包配方书=**全部配方** `[...RECIPES, ...TABLE_RECIPES]`（75 条），工作台配方书= `TABLE_RECIPES`；`canCraftRecipe` 按整个库存 `itemCount` 判定，点击可合成项调 `autoPlaceRecipe`（按 pattern 长度判 W：`length===4` 摆 2×2 `craftSlots`，否则摆 3×3 `tableSlots`，工作台未开时自动 `closeInventory()+openTable()`）

### 新增物品/方块清单

1. `constants.js` 加 ID（数值注意不与已有冲突）
2. 方块：加进 `PLACEABLE_IDS` + `BLOCKS`（name/hard/tiles/color；半透明加 `transparent:true`）+ 图集 `tile()`（已用到 tile 40，16×16 图集最多 256 格）
3. 工具：加进 `SWORDS/PICKS/AXES/SHOVELS/HOES` + `TOOL_DAMAGE` + `TOOL_SPEED`
4. 盔甲：加进 `ARMOR_SLOTS/ARMOR`（defense）；角色小人着色在 `ui.js armorMatColor()` 按 ID 段加分支
5. **图标**：`ui.js` 的 `KIND_BY_ID` 注册手绘（`drawSpecial` 加分支）；方块自动截取图集。**不注册 = 无图标**
6. `crafting.js` 加配方；`world.js` 如需自然生成
7. 已用 ID 段：工具 25-38/50-59、盔甲 60-75 与 95-98（铜）、材料 76-88、储存块 89-94；新物品从 99 起

### 新增怪物（zombies.js）

- `TYPES` 加类型（hp/speed/dmg/atkRange/atkCd/burns/scale）
- `buildMesh()` 加模型分支：**四足之外的 biped 类型必须有 `legL/legR/armL/armR` 四个 mesh 引用**，否则 `update()` 每帧抛错（苦力怕曾踩过此坑）
- `update()` 加行为分支；骷髅类要在 `updateBoneProjectiles` 处理箭矢，且 **main.js 主循环必须调用 `updateBoneProjectiles(dt)`**
- `updateSpawner()` 概率表加权重；上限 24；和平模式不刷
- 死亡原因文案加在 `ui.js showDeath()`

### UI（ui.js）

- 背包/工作台是**两栏原版布局**（`mc-panel > mc-body`）：左栏分类 tabs（`.recipe-tabs`，竖排：全部/方块/工具/装备/材料，`recipeCategory()` 按 result 的 `ARMOR/TOOL_DAMAGE/PLACEABLE_IDS` 分类，state `invCat/tableCat`）+ 配方书（`.recipe-book`，3 列纵向滚动，✓可合成/✕材料不足，**不可合成也正常显示不灰化**），右栏顶部合成区（2×2/3×3 → 箭头 → 结果格，背包右上有角色小人 `playerModel` + 盔甲竖槽 `armorGrid`），右栏底部背包 3×9（`invGrid`，只渲染 9-35）与快捷栏 1×9（`invHotbar`，只渲染 0-8）在同一 `mc-bag` 容器内紧贴
- 工作台同构（3×3，无小人/盔甲栏）：`tableRecipeList`、`tableInvGrid`、`tableHotbar`
- 交互模型：点击库存格选中（`selectedSlot`，invSlots 全局索引）→ 再点另一格 `moveSlot` 整格交换；快捷栏格点击顺带 `setSel`；HTML5 拖放 `slotDnd`（data JSON `{i:库存索引}` 或 `{c:合成格索引}`）：库存↔库存整格交换、合成格→库存退回 `addItem`、库存→合成格 `removeItemAt(src,1)` 放入、合成格间移动；点击配方书可合成项=自动摆放材料；关闭背包/工作台时合成格材料自动退回
- 角色小人为 2D 像素绘制（`renderPlayerModel`，16×32 逻辑像素），盔甲颜色按 ID 段映射
- 事件驱动刷新：`inventoryEvents('invchange'/'selchange'/'armorchange')`、`craftEvents('change')`、`playerEvents('healthchange'/'death'/'respawn')`；背包/工作台开着时 invchange 要全刷（配方书勾叉随材料变化）

## 验证流程（改完必须做）

1. `node --input-type=module --check < js/涉及文件.js` 全量语法
2. 浏览器打开 `http://localhost:8000/game.html`，看 Console 无报错
3. 涉及背包/合成/盔甲：用 `window.game` 钩子（forceStart/openInventory/addItem/flushSave）实测闭环
4. 涉及存档：刷新页面验证恢复；不要手动写脏数据进用户存档

## 提交约定

- 分支 `main`；提交信息用中文、简洁描述改动
- **禁止在提交信息/代码/界面中出现名称来源相关词句**（已全量清理，保持干净）
- 别把 `backups/`、`WebMC/`、`.DS_Store` 提交进去（gitignore 已覆盖）
- 改完记得 `git push origin main`（GitHub Pages 从 main 自动部署）

## 已踩过的坑（别再犯）

- 盔甲配方曾把成品 ID 当材料 → 永远匹配不上；材料必须是锭/钻石/皮革
- 苦力怕模型缺 armL/armR → 每帧 Uncaught TypeError
- 清档后 pagehide 会把内存旧状态写回 → `disableSave()` 守卫
- 滚轮切换快捷栏已移除（误触），只保留数字键/点击
- 测试动过用户存档后要恢复干净状态，别留测试物品（**恢复基准**：位置 256,28,256、hp20、无盔甲、快捷栏 7 格 id 序 `[10,42,5,1,2,79,11]` 各 1、背包 `9+i` 放 `[[10,47],[42,1],[5,3],[1,2],[2,2],[11,1],[39,1]]`）
- 迁移旧档后测试前先确认页面 `started` 状态：未点开始前 pagehide 不会写回，可直接改 localStorage 重测迁移
