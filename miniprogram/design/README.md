# 小程序设计稿（PRD-005 微信小程序客户端）

高保真 HTML 原型，供 UI 迭代对齐风格。纯 HTML + 内联 `<style>`，零外部依赖（不引 CDN / 字体 / 图片），图标一律 emoji。

- `prototype/index.html` —— 画廊页：垂直排列全部 8 屏，每屏一个手机框（375px 宽 + 状态栏装饰 9:41 / 信号 / 电池）
- `prototype/screens/*.html` —— 每屏一个独立文件，375px 宽移动页面、奶油纸底色、内容完整展开（无内部滚动）

## 设计 Token

| 类别 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 底色 | paper | `#FFFDF5` | 页面底色（奶油纸） |
| 卡片 | card | `#FFFFFF` | 卡片底色，圆角 16px，投影 `0 2px 8px rgba(45,55,72,.08)` |
| 文字 | ink | `#2D3748` | 主文字 |
| 文字 | muted | `#718096` | 次要文字 |
| 主题色 | sky / sky-deep | `#7ED6FF` / `#4FC3F7` | 天空、提示框边框 |
| 主题色 | sun | `#FFD93D` | 太阳、高亮、目标框边框 |
| 主题色 | grass / grass-dk | `#7CDB6E` / `#4CAF50` | 草地、成功态、进度条、Tab 选中 |
| 主题色 | coral | `#FF6B6B` | 主按钮、安全横幅虚线框 |
| 主题色 | orange | `#FFA94D` | 打卡按钮 |
| 主题色 | purple | `#A78BFA` | 辅助主题 |
| 主题色 | pink | `#FF8FAB` | 辅助主题 |
| 安全区 | — | `#FFF5F5` | 安全口诀 / 安全要点底色 |
| 字体栈 | — | `"PingFang SC","Microsoft YaHei",system-ui,sans-serif` | 全局 |
| 主按钮 | — | coral 或 grass-dk 实心、圆角 14px、白字 | 「加入我的出行」「微信一键登录」「一键加入本赛季计划」 |
| 打卡按钮 | — | orange `#FFA94D` 大圆角（18px）+ 4px 硬投影 `0 4px 0 #E07F1F` | 「🏁 完成本次冒险（长按 2 秒打卡）」 |

类型徽章（bg / 文字）：

| 类型 | bg | 文字 | 说明 |
| --- | --- | --- | --- |
| A | `#B2F5EA` | `#234E52` | 溯溪玩水 |
| B | `#C6F6D5` | `#22543D` | 登山徒步 |
| C | `#FEEBC8` | `#7B341E` | 露营观星 |
| D | `#E9D8FD` | `#44337A` | 备用 |
| E | `#CDEBFF` | `#1D4E7E` | 备用 |
| 妈妈同行 | `#FFD9E4` | `#B03060` | 附加标记 |
| 已归档 | `#E2E8F0` | `#4A5568` | 备用计划区 |

圆角与间距：卡片 16px、按钮 14px、打卡按钮 18px、横幅 16px；页面边距 14–16px；卡片间距 14px。

## 8 屏清单与要点

| # | 文件 | 页面 | 要点 |
| --- | --- | --- | --- |
| 1 | `screens/login.html` | 登录页 | 品牌 Hero（🏔️🌲⛺🌊 + 渐变天蓝底）、三功能点、grass-dk「微信一键登录」、协议小字 |
| 2 | `screens/plans.html` | 计划库（Tab1） | Hero、5 条安全口诀横幅、9 月 3 卡 + 10 月 1 卡按月分组、底部「📦 备用计划」、Tab 栏（计划库高亮） |
| 3 | `screens/plan-detail.html` | 方案详情 | 只读：Hero+徽标、🎯目标、💡小抄 3 条、🗡️任务 3 条（只读 ☐）、🕐行程 7 段、🗺️路线占位、🎒装备只读、🛡️安全 3 条、📝回顾 2 问、底部「加入我的出行」+ 出发日期 |
| 4 | `screens/trips-empty.html` | 我的出行·空状态 | 引导文案 + grass-dk「一键加入本赛季计划」 |
| 5 | `screens/trips.html` | 我的出行·列表 | 「进行中」在前（准备中带装备进度条 / 待出发），「已完成」在后（✔ 已打卡 · 徽章已解锁） |
| 6 | `screens/trip-detail.html` | 出行详情（核心页） | 顶部胶囊锚点（目标/任务/行程/路线/装备/安全/回顾）；任务、装备可勾选（纯 CSS）；装备进度条「已准备 5/12 件」；🗺️ 内联 SVG 模拟路线图（浅色底 + 路网 + 河流 + 折线 + 🏠家/怀柔城区/🌊白河湾标记，注明「导航请用高德 App」）；底部 orange 打卡大按钮 |
| 7 | `screens/trip-detail-celebrate.html` | 出行详情·打卡庆祝 | 背景页压暗（任务 3/3、装备 12/12、按钮变 ✅ 已完成态）+ 🎉 弹窗：🌊 踩水小能手（满星版金色边框 + 光晕）、里程碑条目「🏕️ 首次露营」、彩纸动画 |
| 8 | `screens/me.html` | 我的（Tab3） | 用户卡片「微信用户」、统计条「已冒险 6 次 · 徒步 14 km · 露营 3 晚」、徽章墙（已解锁高亮 / 未解锁「？？？」，里程碑虚线框）、家庭画像摘要、退出登录按钮 |

Tab 栏（计划库 / 我的出行 / 我的）在 2/4/5/8 屏底部绘制，纯装饰，当前项 grass-dk 高亮。

## 如何查看

- **画廊**：浏览器直接双击打开 `prototype/index.html`，8 屏垂直排列、按内容自适应高度。
  - iframe 高度自适应依赖 JS 读取 `contentDocument.body.scrollHeight`；若 Chrome 拦截 file:// 跨帧读取，会回退到默认高度 900px。此时可换 Firefox，或起一个静态服务器：`npx serve miniprogram/design/prototype` 后访问 `http://localhost:3000`。
- **单屏**：直接双击打开 `prototype/screens/` 下任意文件。
- **无活动徽章变体**：打开 `screens/trip-detail.html?badge=none` 或 `screens/trip-detail-celebrate.html?badge=none`，查看备用方案的打卡按钮与完成确认。此类出行仍可打卡、获得后端颁发的里程碑，页面不显示不存在的活动徽章名。

## 如何导出 PNG

- **`prototype/shots/`**：已用 Playwright 按 375px 视口全页导出全部 8 屏 PNG（`login.png`、`plans.png`、`plan-detail.png`、`trips-empty.png`、`trips.png`、`trip-detail.png`、`trip-detail-celebrate.png`、`me.png`），可直接查看或贴到 PR/文档。
- **重新导出**（在 `web/` 下执行，Playwright 已装）：

```bash
cd web
npx playwright screenshot --viewport-size=375,900 --full-page \
  "file:///<仓库绝对路径>/miniprogram/design/prototype/screens/trip-detail.html" \
  "../miniprogram/design/prototype/shots/trip-detail.png"
```

- **浏览器手动截图**：打开画廊或单屏，用系统截图（Win+Shift+S）框选手机框即可。

## 原型说明（与最终实现的关系）

- 页面在原型中**完整展开无内部滚动**；因此「底部固定操作栏 / 底部 Tab 栏」在原型中按流式呈现在页面末尾，实现时对应 `position: fixed`。
- 任务 / 装备勾选为**纯 CSS**（`input:checked` 样式），零 JS；实现时的进度条计数、长按 2 秒打卡动画、锚点滚动高亮为 JS 逻辑。
- 打卡按钮适用于所有已创建的出行，包括无活动徽章的备用方案。庆祝区有活动徽章时显示徽章图案与名称，无徽章时用 ✅ 和「已完成本次冒险」确认成功；新增里程碑区及查看徽章墙入口保留。两份详情原型用查询参数切换该文案变体，现有 PNG 截图仍为有活动徽章的示例。
- 路线图为内联 SVG 示意（浅色底 + 折线 + 标记）；实现时替换为小程序原生 map 组件（驾车线 + 地标 / 徒步途径点），保留「指路参考 · 导航请用高德 App」提示。
- 内容示例取自真实赛季计划（白河湾 9/5、神堂峪 9/12、华海田园 9/19、西山赏秋 10/10、白河湾收官露营已归档）。
