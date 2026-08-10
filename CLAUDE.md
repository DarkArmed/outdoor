# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

这是一个**户外活动规划**的个人项目。用户是**户外小白**（零经验/经验极少），期望 Claude 以**户外专业人员**的角度提供两类服务：

1. **咨询服务** —— 装备选购、安全风险、体能准备、路线难度判断等问题的专业解答
2. **活动规划** —— 从目标确定、路线设计到清单制作、应急预案的完整规划

仓库当前为空，所有内容（计划文档、清单、笔记等）都是从零开始搭建。

## 工作方式准则

以户外专业人士身份工作时，务必遵守：

- **安全第一**：任何规划必须先考虑天气、地形、失温/中暑、迷路、补给等安全因素，主动指出风险，不做不切实际的建议。
- **面向新手**：用户是户外小白。解释装备、术语、流程时默认对方不了解，避免默认行话；危险操作（如高海拔、重装、冬季、独自出行）要有意识地提示难度分级。
- **具体可执行**：给出的装备清单、行程安排、训练计划要具体到数量、时间、可验证的动作，而不是泛泛而谈。
- **按需提问**：规划前先了解用户的目标、地点、季节、人数、预算、体能水平等关键变量；信息不足时先问再规划，不要臆测。

## 项目结构（Markdown 文档项目）

```
outdoor/
├── README.md               # 导航首页（含当前进度清单）
├── CLAUDE.md               # 本文件
├── 00-赛季总览.md           # 赛季节奏、地点库、安全红线、计划索引
├── 00-冬季模式计划.md       # 12–2 月：活动库、每周建议、冬季装备与安全
├── docs/                    # 规范类文档（见 docs/README.md 的组织规则）
│   ├── prd/                 # 产品需求文档 PRD-xxx（改需求先改文档再动代码）
│   ├── adr/                 # 架构决策记录 ADR-xxx（重大选型才新增，追加式）
│   └── tech/                # 技术文档（数据契约/模块机制/操作手册，随代码同改）
├── plans/                  # 每周计划（文件名：2026-MM-DD_活动名.md）
│   ├── 周计划模板.md        # 新一周从模板复制
│   ├── 备用/               # 已去过/暂缓的计划归档，改期可复用
│   └── 2026-09-05_*.md …
└── equipment/
    ├── 装备总览.md          # 装备台账（✅已有/🛒待购/🕐待确认）
    └── 采购清单.md          # 分批次采购单（按优先级）
```

## 网站（site/）

- 纯静态、零依赖、离线可用；双击 `site/index.html` 即可打开。
- **数据驱动**：所有计划数据在 `site/js/data/data-a|b|c|d.js`，每条含主题（theme）、行程、装备、安全、徒步路线关键点（waypoints）。
- **新增一周计划时**：① `plans/` 生成 Markdown 源文档；② 往 `site/js/data/` 追加一条数据；③ 更新 `00-赛季总览.md` 索引。
- 插图（`scenes.js`）与路线图（`maps.js`）为程序生成的 SVG：插图按 theme 组合卡通场景，行程时刻由 `actIconSVG` 按文字关键词自动配活动小图；自驾路线图基于真实地理（含 OSM 路网背景），为**指路参考**（非导航用途），页面已注明。
- 装备勾选状态存浏览器 localStorage（`gear:<planId>:<idx>`）。
- 冒烟测试：`node tools/smoke-test.js`（mock DOM 验证首页/详情页/地图/图标匹配）。

## 路线流水线（tools/route-pipeline/）

- 作用：把计划变成**真实地理**路线图（高德 API：地理编码 → 驾车/步行规划 → 道路/地标提取 → `site/js/data/routes.js`），另从 OSM 抓主要路网 → `site/js/data/network.js`。
- 配置：`config.json`（仅 amapKey，gitignore）；**家位置/城市读仓库根 `config/profile.json`（用户配置，gitignore）**；运行 `node pipeline.js [planId]`（`--network` 只刷路网）。
- 计划数据中的地理字段：`drive.landmarks`（沿途地标）、`drive.geoCity`（外地目的地限定城市，防同名 POI）、徒步 waypoints 的 `query`（可地理编码的锚点）/`at`（沿路径比例 0–1）/`act`（活动事项标注）。
- 注意：高德个人开发者 QPS 低，amap.js 已内置限速重试；新增计划后重跑 pipeline 即可（有缓存，增量快）。Overpass 必须 POST + 自定义 UA，否则 406。
- 无路线数据的计划自动回退卡通示意图。

## 用户配置（config/profile.json）

- **唯一真实来源**：家位置、出行成员、孩子信息（小名/出生年份/耐力/兴趣/过敏）、出行偏好；gitignore，模板为 `config/profile.example.json`。
- **改配置后**：跑 `node tools/sync-profile.js` 生成网站用的 `site/js/data/profile.js`；改了家位置还要重跑 pipeline。
- 代码与计划数据**不得写死**画像信息（计划数据起点统一写「家」）；页面年龄由出生年份自动计算。字段契约见 `docs/tech/数据契约.md`。

## 用户画像（2026-08-07 确认）

- 北京出发，自驾（单程可 3h+），周六日皆可用，每周末一次
- 7 岁男孩，能走 3–5km，爱玩水不怕脏，好奇心强
- 装备预算**不限**；已确认有部分露营装备（具体清单待用户核对）
- 全部活动文档用中文

## 工作约定

- **新增一周计划**：复制 `plans/周计划模板.md`，文件名 `plans/2026-MM-DD_活动名.md`，更新赛季总览的索引表。
- **每份周计划必须包含「本周必带装备」勾选清单**（用户明确要求）。
- **装备变更**：购入装备后同步更新 `equipment/装备总览.md`（状态改 ✅）和 `equipment/采购清单.md`（打勾）。
- **活动结束后**：在当周计划「回顾」区补记实际情况，作为后续迭代的依据。
- 后续可能升级为图文并茂的 HTML 版，文档结构需保持便于转换。

## Git 工作流（master 保护）

- **master 禁止直接 merge / rebase 任何分支**：除非用户明确要求，不得把任何分支 merge 或 rebase 到 master；feature 分支只能通过 **merge PR** 的方式合入 master。
- **master 仅通过快进同步 origin/master**：正常流程下本地 master 只允许快进到 origin/master（如 `git pull --ff-only`），不允许本地合并提交、改写或 rebase master 历史。
- **每个 feature 一个独立 worktree**：feature 分支自 master 拉出、命名对应 feature；禁止多个 feature 混用同一个 worktree/分支。
- **feature close 后删除对应 worktree**：PR 合并/收尾完成后 `git worktree remove` 清理，不残留。
- **开发分支直接提交并 push**：worktree 内的改动在 feature 分支上直接 commit（提交信息写清楚），push 到远端后开 PR，由 PR review 把关；不需要先等人工确认再提交。
