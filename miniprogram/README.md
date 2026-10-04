# 小宝的户外大冒险 · 微信小程序客户端

原生微信小程序（WXML/WXSS/JS），无构建链、无 npm 依赖。需求见 `../docs/prd/PRD-005-小程序客户端.md`，技术机制见 `../docs/tech/小程序.md`。

## 运行步骤

1. **启动后端**（另开终端）。全新克隆/worktree 需先准备本地配置与数据（`.env`、`config/profile.json` 均被 gitignore，不会随仓库带过来）：
   ```bash
   cd ../backend
   cp .env.example .env          # 然后把 DATABASE_URL 改为 sqlite:///./outdoor.db，SECRET_KEY 任意，加一行 DEBUG=true
   cp ../../config/profile.json ../config/   # 可选：没有则画像页显示占位
   alembic upgrade head          # 建库（含微信登录列）
   python -m app.seed            # 导入方案/路线/里程碑 + 默认用户
   uvicorn app.main:app --reload
   ```
   本地开发无需真实 AppID：后端 `DEBUG=true` 且未配置 `WECHAT_MINIAPP_APPID` 时走 mock code2session（确定性 `dev_` 前缀 openid）。
   若启动报数据库连接错误，就是 `.env` 没配（默认连 PostgreSQL）；若报端口占用，用 `netstat -ano | findstr :8000` 找占用进程，或换 `--port 8001`（同时改 `config.js`）。
2. **导入项目**：微信开发者工具「导入」选择本目录（`miniprogram/`），无 AppID 时使用测试号（工程已用占位 `touristappid`）。
3. **不校验合法域名**：开发期在「详情 → 本地设置」勾选「不校验合法域名…」（工程 `setting.urlCheck` 已默认关闭）。
4. 点击「微信一键登录」即可进入（mock 模式下任意 code 都能登录成功）。

## 目录说明

```
miniprogram/
├── project.config.json   # 工程配置（appid 占位 touristappid，es6/postcss 已开）
├── app.js                # 启动恢复登录态、globalData、ensureLogin
├── app.json              # 页面注册 + 3 个 tab + 窗口样式
├── app.wxss              # 设计 token（纸系卡通风）+ 公共类
├── config.js             # 环境配置（唯一需要按环境改的文件）
├── sitemap.json
├── assets/               # 本地图片：地图 marker 图标、tabBar 图标（PNG，随包上传必需）
├── design/               # UI 设计稿：prototype/（HTML 原型 + shots/ PNG 截图）
├── utils/
│   ├── api.js            # request 封装（401 静默重登重放）+ 全部端点函数
│   ├── auth.js           # 登录 / 静默重登 / 退出、token 存取
│   ├── badges.js         # 新增里程碑集合差、统计计算
│   └── plan.js           # gear 扁平索引、月份分组、类型色、日期
├── components/
│   ├── plan-card/        # 方案/出行卡片（emoji 场景大图 + 徽章 + 角标）
│   ├── section-title/    # 区块标题（emoji + 文案）
│   └── check-row/        # 可勾选行（装备/任务复用，支持只读）
└── pages/
    ├── login/            # 登录页
    ├── plans/            # Tab1 计划库（月份分组 + 安全口诀 + 备用区）
    ├── plan-detail/      # 方案详情（只读 + 加入我的出行）
    ├── trips/            # Tab2 我的出行（进行中/已完成 + 空状态一键加入）
    ├── trip-detail/      # 出行详情（勾选/地图/长按打卡/庆祝弹窗）
    └── me/               # Tab3 我的（统计/徽章墙/画像摘要/退出）
```

## 配置说明

`config.js` 是唯一需要按环境修改的文件：

```js
module.exports = {
  apiBaseUrl: 'http://localhost:8000', // 发布前改为生产 https 域名
};
```

打卡及颁奖与 Web 共用后端：客户端只提交 `POST checkin`，活动徽章（ID 为 `plan_id`）和里程碑由后端统一颁发。庆祝弹窗以打卡前后徽章集合差显示新增里程碑；客户端不按徽章名写入或自行评估授奖。徽章刷新失败时保留已完成的打卡，稍后在「我的」查看。

其余约定（gear 扁平索引、乐观更新回滚、统计口径、坐标转换）见 `../docs/tech/小程序.md` §五，实现与文档保持一致。

## 回归测试

仓库根运行 `node --test miniprogram/tests/*.test.js`。测试使用 Node 内置 `node:test` 和微信页面替身，无 npm 依赖，覆盖首次里程碑展示、重复方案不由客户端多发奖、重复触发、打卡及徽章读取失败处理；真机渲染与微信登录仍需开发者工具验收。

## 真机 / 发布注意事项

- **合法域名**：正式发布前把 `apiBaseUrl` 改为 https 域名，并在小程序后台「开发管理 → 服务器域名」配置 request 合法域名；`http://localhost` 只能在开发者工具（勾选不校验）里用。
- **AppID**：`touristappid` 为占位/测试号；发布需注册个人小程序获取真实 AppID，并把 AppID/Secret 配置到后端 `.env`（`WECHAT_MINIAPP_APPID` / `WECHAT_MINIAPP_SECRET`）。
- **生产安全**：后端必须 `DEBUG=false` + 真实 AppID/Secret；未配置时登录接口返回 503 而非放行。
- **地图**：`<map>` 组件直接渲染后端 GCJ-02 坐标，无需转换；路线为指路参考，导航请用高德 App。地图 marker 图标为本地 `assets/` 下的 PNG（`<map>` 的 marker `iconPath` 必填，缺失真机不显示）；若 marker 不显示，先检查 `assets/` 是否随包上传、iconPath 路径是否正确。
