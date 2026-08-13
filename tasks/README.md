# 前后端分离改造 · 任务协调

> 本目录是「前后端分离改造」（React 前端 + FastAPI 后端）的**执行与协调**文档，区别于产品文档（PRD 管 What / ADR 管 Why / tech 管 How）。
> 任务**跨 session、可能并行执行**，任何 session 开工以本目录为准：先读总览，认领、更新状态。

## 并行协作约定

1. 每个 session 开工**先读本 README** 与相关任务文件。
2. 认领任务前，把总览表该行状态改为 🔧 并**署名**（session 标识）。
3. **按目录分片**避免冲突：`backend/`、`web/`、`tools/`、`docs/`、`tasks/`。每个 session 只写**自己的任务文件 + 总览表自己那一行**。
4. 完成改 ✅ 并在任务文件写「完成说明」（即 mini 复盘）。
5. 依赖：T1 文档 → T2~T4 基础 → T5/T6 页面 → T7/T8；依赖任务必须等前序完成。

## 任务总览

| ID | 任务 | 目录 | 依赖 | 状态 | 负责 |
|----|------|------|------|------|------|
| T1 | 文档与协调（tasks/ + ADR-002 + PRD-001 修订 + tech 初稿） | docs/、tasks/ | — | ✅ | 2026-08-14 session |
| T2 | 后端内容 API（骨架 + 导出 + schema + 路由） | backend/、tools/ | T1 | 🔲 | |
| T3 | 前端脚手架 + API 客户端 | web/ | T1 | 🔲 | |
| T4 | SVG 模块移植（scenes.ts / maps.ts） | web/src/svg/ | T1 | 🔲 | |
| T5 | 首页（抽屉/徽章/足迹 + localStorage） | web/src | T2/3/4 | 🔲 | |
| T6 | 详情页（地图/装备/打卡） | web/src | T2/3/4 | 🔲 | |
| T7 | 测试与对齐（Vitest + 新旧对比） | web/、site/ | T5/6 | 🔲 | |
| T8 | 收尾 + 复盘（tech 补全 + PR merge） | docs/、git | 全部 | 🔲 | |

## 状态标记

🔲 待做 ｜ 🔧 进行中 ｜ ✅ 完成 ｜ ⚠️ 阻塞
