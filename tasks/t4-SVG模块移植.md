# T4 · SVG 模块移植

> 状态：🔲 待做 ｜ 依赖：T1 ｜ 目录：web/src/svg/

## 范围

机械移植（**逻辑/视觉不变，不重写**）：
- `site/js/scenes.js` → `web/src/svg/scenes.ts`（`SCENES` 主题表 + `sceneSVG` + `actIconSVG`），补 TS 类型、改模块导出。
- `site/js/maps.js` → `web/src/svg/maps.ts`（`driveMapSVG` / `hikeMapSVG` / `footprintMapSVG` + `makeProj` / `placeLabel` / `placeHikeBlock` / `pushOutOfRects` 算法原样保留），补 TS 类型、改模块导出。

## 产出

- `web/src/svg/scenes.ts`、`web/src/svg/maps.ts`

## 验收

- 两模块在 `npm run build`/vitest 下类型检查通过。
- 移植后的 SVG 输出与旧 `site/` 一致（可对拍关键标记/画布比例）。

## 进度 / 完成说明

（完成时记录）
