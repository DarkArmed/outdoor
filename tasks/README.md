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
| T2 | 后端服务化 API（FastAPI + PostgreSQL + 多用户 + 方案/出行计划解耦） | backend/ | T1 | ✅ | current session |
| T3 | 前端脚手架 + API 客户端 | web/ | T2（本阶段不做） | ⏸️ | |
| T4 | SVG 模块移植（scenes.ts / maps.ts） | web/src/svg/ | T1（本阶段不做） | ⏸️ | |
| T5 | 首页（抽屉/徽章/足迹 + localStorage） | web/src | T3/4（本阶段不做） | ⏸️ | |
| T6 | 详情页（地图/装备/打卡） | web/src | T3/4（本阶段不做） | ⏸️ | |
| T7 | 测试与对齐（Vitest + 新旧对比） | web/、site/ | T5/6（本阶段不做） | ⏸️ | |
| T8 | 收尾 + 复盘（tech 补全 + PR merge） | docs/、git | T2 + 文档 | 🔧 | current session |

## 状态标记

🔲 待做 ｜ 🔧 进行中 ｜ ✅ 完成 ｜ ⚠️ 阻塞

## 完成说明

- **T2**：后端骨架、ORM 模型、Pydantic schemas、JWT 认证、`/api/auth`、`/api/me`、`/api/profile`、`/api/plans`、`/api/trips`、`/api/trips/{id}/route`、`/api/network`、`/api/milestones`、gear/tasks/checkin/badges 状态路由、seed 脚本、Alembic 初始迁移、pytest 测试全部完成；8 个测试通过；`node tools/dump-site-data.js` + `python -m app.seed` 可导入现有 site 数据。
- **前端**：按用户决策，本阶段 `site/` 完全不动，T3–T7 暂停（⏸️）。
- **T8**：文档已补全（ADR-003、PRD-004、数据契约 v1.1、网站架构 v1.2、ADR-002/PRD-001 修订记录、tasks/README、.gitignore、backend/README），待发 PR。