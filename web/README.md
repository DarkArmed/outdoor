# 户外大冒险 · 前端核心模块（T2）

Vite + React 19 + TypeScript strict + Tailwind CSS v4。T2 提供模块和路由骨架，完整页面与业务流程在 T3 实现。

## 本地命令

在 `web/` 内执行：

```sh
npm ci
npm run dev
npm run build
npm run lint
npm test -- --run
npm run test:e2e -- --workers=2
```

开发服务默认端口 5173；`/api` 代理到 `http://localhost:8000`。可通过 `VITE_API_BASE_URL` 覆盖 API 地址。
Playwright 使用独立端口 5175，避免复用其他 worktree 的服务。首次使用需要 `npx playwright install chromium`。
`e2e/components.html` 仅供浏览器测试，不是应用页面，也不是生产构建入口。

后端启动后，执行 `npm run generate:api` 更新 `src/api/generated/api.ts`。

## 模块接口

- `AuthProvider` 包裹需要认证状态的组件，`useAuth()` 提供登录、注册、退出和状态；`main.tsx` 已接入 Provider 和 BrowserRouter。
- API 函数使用生成的请求/响应类型。`useTrips()` 返回 `TripOut[]`（含 snapshot/overrides），`useTrip(id)` 返回 `TripDetailOut`（额外含合并后的 content）。
- 私有 hooks 在登录完成后请求数据，缓存按用户与会话隔离。
- `ArchiveGrid({ plans })` 接收计划列表，只展示 archived 项；PlanCard 的 `fluid` 参数支持网格宽度。
- `SafetyBanner({ rules? })` 默认展示原站安全口诀。
- `BadgeDrawer({ open, panel, onClose, onPanelChange, badges, footprint, stats? })` 提供受控抽屉。`panel` 为 `badges` 或 `footprint`，后三项为 React 内容插槽。页面负责数据加载、徽章墙、统计和 URL 参数联动。

地图函数为纯渲染函数：

```ts
import { driveMapSVG, hikeMapSVG, footprintMapSVG } from './src/svg/maps'
import type { MapData } from './src/svg/maps'

// data.routes 按 plan id 索引；data.plans 用于足迹图；data.network 为可选路网。
// 嵌套 JSON 的字段类型见 mapTypes.ts，页面接入 API 时负责校验/转换。
const data: MapData = { routes: {}, plans: [], network: { ways: [] } }
const drive = driveMapSVG({ id: 'example', drive: { from: '家', to: '营地', time: '1小时', km: 60 } }, data)
const hike = hikeMapSVG({ id: 'example' }, data)
const footprint = footprintMapSVG([], data)
```

传入真实路线时按原算法渲染；缺少路线时回退示意图。SVG 测试直接加载旧版 `site/js/maps.js` / `scenes.js`，验证输出一致。

## T3 接入边界

`/`、`/plan/:id`、`/login` 当前只有占位标题。完整页面、登录/注册表单、画像、我的出行、清单后端持久化及打卡/徽章解锁留在 T3。
