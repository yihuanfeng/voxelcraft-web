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
| `js/inventory.js` | 背包 16 格、快捷栏 9 格、盔甲槽、物品计数、`inventoryEvents` |
| `js/crafting.js` | 2×2/3×3 合成（形状匹配）、50+ 配方、`craftEvents` |
| `js/zombies.js` | 怪物：僵尸/骷髅/蜘蛛/苦力怕、刷怪器、骷髅箭 |
| `js/villagers.js` | 村庄村民 NPC |
| `js/ui.js` | HUD、三段式背包/工作台界面、物品图标绘制、事件订阅 |
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

- key：`voxelcraft_save_v1`；结构 `{ v:1, world:{方块差异}, player:{位置/背包/快捷栏/盔甲/dim}, time }`
- 新增玩家字段：`flushSave()` 写入 + `applyPlayerSave()` 恢复 + 旧存档缺省值处理
- 背包是 16 格 `invSlots`（每格 `{id,count}|null`），`inv` 是 id→count 派生视图；旧格式 `inv` 对象自动迁移
- 设置（和平模式）在 `voxelcraft_settings_v1`

### 大世界（必须遵守）

- 世界 `SIZE=512 × HEIGHT=96`，区块 16×16 共 32×32 块
- 网格构建**必须**走分帧：`scheduleRebuildAll(px,pz)`（按玩家距离排序）+ 每帧 `updateBuildQueue()`（每帧 5 块）。禁止改回一次性 `rebuildAll`，否则首载卡死
- 挖/放单块用 `rebuildAround(x,z)` 局部重建
- 渲染器有玻璃渲染通道（`GLASS` 走 `gpos/glassMat` 半透明）

### 合成（crafting.js）

- `RECIPES`（2×2，3 条）/ `TABLE_RECIPES`（3×3，50 条）
- pattern 是 3×3 数组，`null` 为空；`normPattern` 去空行空列，`matchGrid` 允许整体平移、区域内无多余材料
- 执行：`craftOnce(recipe, slots, hit, W)`（W=2 或 3）
- 工具配方用 `toolRecipe(mat, kind)`；盔甲配方用 `armorRecipe(ing, kind, result)`（**ing 是材料**，result 是成品，别把成品当材料）
- UI 点击合成时用 `matchCraftRecipe()/matchTableRecipe()` 返回 `{recipe, hit}`

### 新增物品/方块清单

1. `constants.js` 加 ID（数值注意不与已有冲突）
2. 方块：加进 `PLACEABLE_IDS` + `BLOCKS`（name/hard/tiles/color；半透明加 `transparent:true`）+ 图集 `tile()`（共 34 格，16×16 图集最多 256 格）
3. 工具：加进 `SWORDS/PICKS/AXES/SHOVELS/HOES` + `TOOL_DAMAGE` + `TOOL_SPEED`
4. 盔甲：加进 `ARMOR_SLOTS/ARMOR`（defense）
5. **图标**：`ui.js` 的 `KIND_BY_ID` 注册手绘（`drawSpecial` 加分支）；方块自动截取图集。**不注册 = 无图标**
6. `crafting.js` 加配方；`world.js` 如需自然生成

### 新增怪物（zombies.js）

- `TYPES` 加类型（hp/speed/dmg/atkRange/atkCd/burns/scale）
- `buildMesh()` 加模型分支：**四足之外的 biped 类型必须有 `legL/legR/armL/armR` 四个 mesh 引用**，否则 `update()` 每帧抛错（苦力怕曾踩过此坑）
- `update()` 加行为分支；骷髅类要在 `updateBoneProjectiles` 处理箭矢，且 **main.js 主循环必须调用 `updateBoneProjectiles(dt)`**
- `updateSpawner()` 概率表加权重；上限 24；和平模式不刷
- 死亡原因文案加在 `ui.js showDeath()`

### UI（ui.js）

- 背包是**三段式**：顶部合成区（2×2+结果+配方）、中部库存+盔甲栏（`armorGrid`）、底部快捷栏（`invHotbar`）
- 工作台同三段式（3×3）：`tableInvGrid` + `tableHotbar` 是独立容器
- 交互模型：点击物品格选中（`selectedInvItem`）→ 点击目标格放入；快捷栏格点击=移回背包/交换
- 事件驱动刷新：`inventoryEvents('invchange'/'selchange'/'armorchange')`、`craftEvents('change')`、`playerEvents('healthchange'/'death'/'respawn')`

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
- 测试动过用户存档后要恢复干净状态，别留测试物品
