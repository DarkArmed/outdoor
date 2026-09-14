/* mock.js — 生成「近似真实地理」的白河湾路线数据，用于预览渲染效果。
 * 坐标为手工标注的近似值（非 API 精确值），仅供预览；
 * 正式数据请运行 node pipeline.js 生成（会覆盖 routes.js）。
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '..', 'data', 'routes.js');
const PROFILE_FILE = path.join(__dirname, '..', '..', 'config', 'profile.json');

/* 家的位置读用户配置；坐标为近似值（仅预览用，正式数据跑 pipeline.js） */
let homeName = '家';
try { homeName = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8')).home.name; } catch (_) {}

/* 近似坐标（GCJ-02 风格，仅预览用；起点取城区东北角近似位置即可） */
const HOME = [116.433, 39.972];        // 家（近似，演示数据无需精确）
const BHW = [116.615, 40.660];         // 白河湾
const QSL = [116.595, 40.668];         // 青石岭村（戏水区方向）

/* 自驾折线：家 → 北五环 → 京承高速 → 怀柔 → G111 怀丰公路 → 琉璃庙 → 白河湾 */
const DRIVE_POLYLINE = [
  HOME,
  [116.428, 40.058], [116.445, 40.045],
  [116.485, 40.060], [116.525, 40.095], [116.560, 40.150],
  [116.590, 40.210], [116.610, 40.265],
  [116.632, 40.316],
  [116.640, 40.370], [116.636, 40.430], [116.624, 40.500],
  [116.626, 40.555], [116.628, 40.600],
  [116.622, 40.632], BHW,
];

const DRIVE = {
  from: { name: `家（${homeName}）`, coord: HOME },
  to: { name: '白河湾', coord: BHW },
  polyline: DRIVE_POLYLINE,
  roads: [
    { name: '北五环', point: [116.445, 40.045] },
    { name: '京承高速', point: [116.560, 40.150] },
    { name: '京密路 G101', point: [116.632, 40.300] },
    { name: '怀丰公路 G111', point: [116.624, 40.500] },
  ],
  landmarks: [
    { name: '望京', icon: '🏙️', coord: [116.470, 40.000] },
    { name: '雁栖湖', icon: '💧', coord: [116.677, 40.385] },
    { name: '怀柔城区', icon: '🏙️', coord: [116.632, 40.316] },
    { name: '琉璃庙镇', icon: '🏙️', coord: [116.628, 40.600] },
  ],
  distance: 92,
  duration: 100,
};

/* 沿河徒步折线（白河湾 → 青石岭村方向） */
const HIKE_PATH = [
  BHW, [116.610, 40.662], [116.606, 40.664], [116.600, 40.666], QSL,
];

function hike(spots) {
  return {
    title: '白河缓滩路线',
    length: '约 2km',
    spots,
    path: HIKE_PATH,
    pathSource: 'mock',
  };
}

const ROUTES = {
  '2026-09-05': {
    source: 'mock',
    drive: DRIVE,
    hike: hike([
      { name: '营地（搭天幕）', icon: '⛺', act: '搭天幕·野餐', coord: BHW },
      { name: '缓滩徒步起点', icon: '🥾', act: '出发寻宝', coord: [116.612, 40.661] },
      { name: '折返点', icon: '⭐', act: '观察小鱼', coord: [116.603, 40.665] },
      { name: '浅滩戏水区', icon: '💦', act: '踩水·打水仗', coord: QSL },
    ]),
  },
  '2026-09-19': {
    source: 'mock',
    drive: { ...DRIVE, to: { name: '白河湾营地', coord: BHW } },
    hike: hike([
      { name: '营地帐篷', icon: '⛺', act: '全家搭帐篷', coord: BHW },
      { name: '浅滩玩水区', icon: '💦', act: '踩水', coord: QSL },
      { name: '观星空地', icon: '🌟', act: '认星星·睡前故事', coord: [116.606, 40.664] },
    ]),
  },
  '2026-11-07': {
    source: 'mock',
    drive: DRIVE,
    hike: hike([
      { name: '营地', icon: '⛺', act: '搭营·热汤面', coord: BHW },
      { name: '河景观景点', icon: '🌊', act: '冬日散步·看河', coord: QSL },
      { name: '返回营地', icon: '🏁', act: '喝热饮·收营', coord: BHW },
    ]),
  },
};

const header = `/* routes.js — MOCK 预览数据（mock.js 生成，坐标为近似值）\n * 正式数据请运行 tools/route-pipeline/pipeline.js 生成 */\n`;
fs.writeFileSync(OUT, header + `var ROUTES = ${JSON.stringify(ROUTES, null, 1)};\n`);
console.log(`💾 已写入 mock 数据：${OUT}（白河湾 ×3 计划）`);
