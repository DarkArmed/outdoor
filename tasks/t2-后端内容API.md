# T2 · 后端内容 API

> 状态：🔲 待做 ｜ 依赖：T1 ｜ 目录：backend/、tools/

## 范围

- `backend/` FastAPI 骨架（`requirements.txt`：fastapi、uvicorn[standard]；`app/main.py` + `/api/health`）。
- `tools/export-content.js`（Node stdlib）：`node:vm` 读 `site/js/data/data-a..d.js` → `plans.json`/`milestones.json`；`routes.js`/`network.js` 去 `var X=` 前缀 → `routes.json`/`network.json`；`config/profile.json` → `backend/data/profile.json`。
- 生成 `backend/data/*.json`；更新 `.gitignore`（`backend/data/profile.json`、`web/dist/` 等）。
- `app/schemas.py`：Pydantic 模型（Profile / Plan / Drive / Hike / ItineraryItem / GearSection / Badge / Milestone / Route / Network，依 `docs/tech/数据契约.md`）。
- `app/content.py`（启动加载 JSON → 内存单例）+ 路由：`GET /api/profile`、`/api/plans`、`/api/plans/{id}`（plan+route 合并）、`/api/milestones`、`/api/network`。

## 产出

- `backend/`（含 app/、data/、requirements.txt）
- `tools/export-content.js`
- `.gitignore` 更新

## 验收

- `uvicorn app.main:app --reload` 启动；`/docs` 出接口文档。
- `/api/plans`、`/api/plans/2026-09-05`、`/api/profile`、`/api/milestones`、`/api/network` 返回正确。
- 隐私：`backend/data/profile.json` 被 gitignore，不入库。

## 进度 / 完成说明

（完成时记录）
