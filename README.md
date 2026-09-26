# VoxelCraft 网页版（开源 VoxelCraft 二次开发）

基于开源项目 [VoxelCraft](https://github.com/jerrychan7/WebMC) 二次开发的网页版沙盒游戏。
Three.js（本地化到 `lib/three.module.js`，v0.160）渲染，无外部依赖、无需构建，浏览器直接可玩，进度保存在本地浏览器中。

## 快速开始

- **在线试玩**（GitHub Pages）：https://yihuanfeng.github.io/voxelcraft-web/
- **本地运行**：

```bash
./start.command          # 一键启动本地服务器（no-cache，端口 8000）
# 或手动：
python3 server.py 8000   # 支持任意端口；访问 http://localhost:8000/game.html
```

也可直接双击 `game.html` 打开，但**推荐用服务器方式**（模块加载与存档更稳定）。

## 操作键位

| 按键 | 功能 |
|---|---|
| WASD | 移动 |
| 空格 / Shift | 跳跃 / 疾跑 |
| 鼠标左键 / 右键 | 挖掘攻击 / 放置方块（对着工作台右键 = 打开 3×3 合成） |
| E | 打开背包（三段式：合成 / 库存+盔甲 / 快捷栏） |
| Q | 丢弃手中物品 |
| 1-9 / 点击 | 切换快捷栏（滚轮切换已移除） |
| F / C | 飞行上升 / 下降 |
| Esc | 关闭界面 / 暂停 |

- 和平模式开关、手动保存、清除存档均在开始菜单。
- 进度每 5 秒自动保存（localStorage key `voxelcraft_save_v1`），关页前也会保存。

## 目录结构

```
mc/
├── game.html        # 唯一入口（薄壳：HUD/菜单/背包/工作台 UI 结构）
├── server.py             # 本地 no-cache 静态服务器
├── start.command         # 一键启动脚本
├── js/                   # 全部游戏逻辑（ES Modules）
│   ├── main.js           # 入口：初始化、输入、主循环、维度切换、手动保存
│   ├── constants.js      # 世界尺寸/方块/工具/盔甲注册表 + 程序化纹理图集
│   ├── world.js          # 世界生成（主世界/下界）、矿洞、村庄、传送门、碰撞
│   ├── noise.js          # 确定性噪声（hash + valueNoise + fbm）
│   ├── renderer.js       # Three.js 渲染、区块分帧构建、粒子/掉落物
│   ├── player.js         # 玩家移动/物理、挖掘/放置、伤害/死亡/重生
│   ├── inventory.js      # 背包 16 格 / 快捷栏 9 格 / 盔甲槽 / 物品计数
│   ├── crafting.js       # 2×2 与 3×3 配方（形状匹配）、合成执行
│   ├── zombies.js        # 怪物系统：僵尸/骷髅/蜘蛛/苦力怕 + 刷怪器 + 骷髅箭
│   ├── villagers.js      # 村民（村庄 NPC）
│   ├── ui.js             # HUD、背包/工作台界面、物品图标绘制、事件订阅
│   ├── save.js           # localStorage 存档：方块差异 + 玩家状态 + 时间
│   └── audio.js          # WebAudio 音效
├── css/main.css          # 全部样式
├── lib/three.module.js   # 本地化 Three.js（v0.160）
├── backups/              # 历史版本备份（原始开源版 / 单文件中文版）
└── WebMC/                # 上游开源仓库克隆（独立 git 仓库，不参与本项目提交）
```

## 开发指南

### 模块依赖方向（上层 import 下层，避免环）

```
main.js → ui.js / player.js / renderer.js / zombies.js / villagers.js / save.js / inventory.js
ui.js → constants.js / inventory.js / crafting.js / player.js / renderer.js / save.js
player.js → constants.js / world.js / inventory.js / renderer.js / audio.js
renderer.js → constants.js / world.js
world.js → constants.js / noise.js
zombies.js → constants.js / world.js / player.js / renderer.js / audio.js
```

### 新增一个方块

1. `constants.js`：在 ID 常量区加 `XXX = n`；加入 `PLACEABLE_IDS`；在 `BLOCKS` 注册表加条目（`name / hard / tiles / color`；`transparent: true` 表示半透明，走玻璃渲染通道）；如有特殊外观在 `buildAtlas()` 里加 `tile(idx, fn)`。
2. `world.js`：如需自然生成，在 `generateWorld() / generateNether()` 中加入。
3. `crafting.js`：如需配方，加到 `TABLE_RECIPES`（pattern 为 3×3 数组，`null` 表示空，支持整体平移匹配）。
4. 放置/挖掘自动可用（`isPlaceable` + `toolSpeedFor` 已按类别处理）。

### 新增一件工具 / 盔甲

1. `constants.js`：加 ID、加入 `SWORDS/PICKS/AXES/SHOVELS/HOES` 分组、`TOOL_DAMAGE`（攻击力）、`TOOL_SPEED`（挖掘加速）、`ARMOR_SLOTS/ARMOR`（盔甲防御）。
2. `ui.js`：在 `KIND_BY_ID` 注册图标（工具在 `drawSpecial` 里加绘制分支，方块自动截取图集）。
3. `crafting.js`：用 `toolRecipe(mat, kind)` / `armorRecipe(ing, kind, result)` 生成配方。

### 新增怪物类型

`zombies.js`：在 `TYPES` 加类型（`hp/speed/dmg/atkRange/atkCd/burns/scale`），在 `buildMesh()` 加模型分支（注意：**僵尸/骷髅/苦力怕必须有 `legL/legR/armL/armR` 四个 mesh 引用**，否则 `update()` 报错），在 `update()` 加行为分支，在 `updateSpawner()` 的概率表加权重，死亡原因在 `ui.js showDeath()` 加文案。

### 存档兼容

存档结构见 `save.js`（`v:1`，含 `world` 方块差异 / `player` 状态 / `time`）。新增玩家字段时：`flushSave()` 写入 + `applyPlayerSave()` 恢复，并对旧存档做缺省值处理（如 `armor` 字段）。

### 大世界注意事项

- 世界 `SIZE=512 × HEIGHT=96`，区块 16×16 共 32×32 块。
- 网格构建已分帧（`scheduleRebuildAll` 优先玩家附近，每帧 5 块），**不要**改回一次性 `rebuildAll`，否则首次加载会卡顿。
- 挖矿/放置后调 `rebuildAround(x, z)` 局部重建即可。

## 已实现内容

- 双维度：主世界（昼夜循环、5 个村庄、村民、矿洞与矿物按深度分布）+ 下界（岩浆海、下界岩、荧石、远古残骸），紫色传送门往返
- 背包：16 格库存 + 9 格快捷栏 + 2×2 合成 + 4 格盔甲栏（穿戴减伤）
- 工作台：3×3 合成，50 条配方（全套工具 25 件、全套盔甲 16 件、方块 8 种、皮革）
- 怪物：僵尸 / 骷髅（射箭）/ 蜘蛛（快速跳扑）/ 苦力怕（自爆），上限 24，和平模式可关
- 存档：自动保存 + 手动保存 + 清除存档，旧存档自动迁移
