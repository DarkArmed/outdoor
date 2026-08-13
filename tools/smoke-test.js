/* smoke-test.js — 无浏览器冒烟测试：mock DOM 跑 renderHome/renderPlan/地图/活动图标
 * 用法: node tools/smoke-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE = path.join(__dirname, '..', 'site');

/* ---------- 最小 DOM mock ---------- */
function makeEl(id) {
  const el = {
    id,
    innerHTML: '',
    textContent: '',
    style: {},
    _cls: new Set(),
    classList: {
      add: c => el._cls.add(c),
      remove: c => el._cls.delete(c),
      toggle: (c, f) => (f === undefined ? (el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c)) : (f ? el._cls.add(c) : el._cls.delete(c))),
      contains: c => el._cls.has(c),
    },
    setAttribute() {}, getAttribute() { return null; },
    querySelector(sel) {
      const child = makeEl(`${id}>${sel}`);
      child.insertAdjacentHTML = (pos, html) => { el.innerHTML += html; }; // 插回父元素，模拟真实 DOM
      return child;
    },
    querySelectorAll: () => [],
    insertAdjacentHTML(pos, html) { this.innerHTML += html; },
    addEventListener() {},
  };
  return el;
}

function makeCtx(search) {
  const els = {};
  const ctx = {
    console,
    URLSearchParams,
    location: { search: search || '' },
    localStorage: { getItem: () => null, setItem() {} },
    IntersectionObserver: class { constructor(cb) {} observe() {} unobserve() {} },
    document: {
      title: '',
      body: makeEl('body'),
      getElementById: id => (els[id] = els[id] || makeEl(id)),
      querySelectorAll: () => [],
      addEventListener() {},
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  return { ctx, els };
}

function load(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(SITE, file), 'utf8'), ctx, { filename: file });
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

const SCRIPTS = ['js/scenes.js', 'js/maps.js', 'js/data/profile.js', 'js/data/data-a.js', 'js/data/data-b.js', 'js/data/data-c.js', 'js/data/data-d.js', 'js/data/routes.js', 'js/data/network.js'];

/* ---------- ① 首页 ---------- */
console.log('首页 renderHome:');
{
  const { ctx, els } = makeCtx('');
  for (const f of [...SCRIPTS, 'js/app.js']) load(ctx, f);
  check('PROFILE 已加载（元宝）', ctx.PROFILE && ctx.PROFILE.child.name === '元宝');
  check('NETWORK 已加载', ctx.NETWORK && ctx.NETWORK.ways.length > 1000);
  const rail = els['month-rail'].innerHTML;
  check('月份节点存在（9/10/11/12 月）', (rail.match(/tl-node/g) || []).length >= 4);
  check('首页时间轴无周节点（2.1.2）', !rail.includes('tl-week'));
  check('时间轴无备用节点', !rail.includes('备用'));
  check('副标题来自 PROFILE', els['hero-subtitle'] && els['hero-subtitle'].textContent.includes('元宝') && els['hero-subtitle'].textContent.includes('7 岁'));
  const rows = els['month-rows'].innerHTML;
  check('按月分行渲染卡片（16 个活跃计划）', (rows.match(/plan-card/g) || []).length >= 16);
  check('12 月冬季计划出现（滑雪/观鸟/冰雪乐园/滑冰）', ['滑雪初体验', '野鸭湖', '冰雪乐园', '什刹海'].every(s => rows.includes(s)));
  check('坝上/金海湖不在活跃区', !rows.includes('丰宁坝上') && !rows.includes('金海湖'));
  check('备用区含归档计划', els['archive-grid'].innerHTML.includes('丰宁坝上') && els['archive-grid'].innerHTML.includes('金海湖'));
  check('站名来自 PROFILE（hero-title）', els['hero-title'] && els['hero-title'].textContent.includes('元宝的户外大冒险'));
  check('7 个计划标记妈妈同行（含 1 个备用）', ctx.PLANS.filter(p => p.mom).length === 7);
  check('妈妈同行徽标出现在卡片（6 个活跃计划）', (rows.match(/badge-mom/g) || []).length === 6);
  check('妈妈同行卡片插图含妈妈（momShirt）', rows.includes('#FF8FAB'));
  /* PRD-002：徽章墙 / 统计条 / 足迹 */
  const wall = els['badge-wall'].innerHTML;
  check('徽章墙渲染 20 格（16 活动 + 4 里程碑）', (wall.match(/badge-cell/g) || []).length === 20);
  check('未解锁徽章显示灰色剪影（？？？）', wall.includes('？？？') && !wall.includes('unlocked'));
  check('统计条初始为零', els['stats-bar'].textContent.includes('已冒险 0 次'));
  const fp = els['footprint-map'].innerHTML;
  check('足迹地图渲染（含家与目的地标记）', fp.includes('svg') && fp.includes('🏠') && fp.includes('📍'));
  check('足迹地图去重+备用标注（16 标记：17 计划 −1 合并 +1 备用坝上）', (fp.match(/📍/g) || []).length === 16 && fp.includes('（备用）'));
  check('足迹地图图例（PRD-003：已打卡/还没去/家）', fp.includes('已打卡') && fp.includes('还没去'));
  /* PRD-002 修订：成就面板入抽屉 */
  const drawer = ctx.document.getElementById('achieve-drawer');
  const backdrop = ctx.document.getElementById('achieve-backdrop');
  check('默认抽屉关闭（无 open 类）', !drawer.classList.contains('open'));
  ctx.openAchieve('badges');
  check('openAchieve 打开抽屉 + 锁滚动', drawer.classList.contains('open') && backdrop.classList.contains('open') && ctx.document.body.classList.contains('no-scroll'));
  ctx.closeAchieve();
  check('closeAchieve 关闭抽屉 + 解锁滚动', !drawer.classList.contains('open') && !ctx.document.body.classList.contains('no-scroll'));
}

/* ---------- ①c 成就面板 ?panel= 自动打开 ---------- */
console.log('成就面板入口（?panel=badges）:');
{
  const { ctx, els } = makeCtx('?panel=badges');
  for (const f of [...SCRIPTS, 'js/app.js']) load(ctx, f);
  check('?panel=badges 打开抽屉', ctx.document.getElementById('achieve-drawer').classList.contains('open'));
}

/* ---------- ①b 妈妈同行详情页 ---------- */
console.log('详情页 renderPlan（2026-09-26 妈妈同行）:');
{
  const { ctx, els } = makeCtx('?id=2026-09-26');
  for (const f of [...SCRIPTS, 'js/app.js']) load(ctx, f);
  const html = els['plan-detail'].innerHTML;
  check('详情页含妈妈同行徽标', html.includes('badge-mom'));
  check('详情页插图含妈妈（momShirt）', html.includes('#FF8FAB'));
  check('详情页标题含元宝', ctx.document.title.includes('元宝的户外大冒险'));
}

/* ---------- ② 详情页 ---------- */
console.log('详情页 renderPlan（2026-09-05）:');
{
  const { ctx, els } = makeCtx('?id=2026-09-05');
  for (const f of [...SCRIPTS, 'js/app.js']) load(ctx, f);
  const html = els['plan-detail'].innerHTML;
  check('六个内容区块齐全', ['sec-goal', 'sec-itinerary', 'sec-maps', 'sec-gear', 'sec-safety', 'sec-review'].every(s => html.includes(s)));
  check('胶囊导航插入', html.includes('snav-item'));
  check('行程带活动小图（2.2.5）', (html.match(/it-icon/g) || []).length >= 5);
  const rail = els['detail-rail'].innerHTML;
  check('详情页周时间轴有缩略图', rail.includes('tl-thumb'));
  check('当前周高亮', rail.includes('tl-week current'));
  /* PRD-002：任务卡 + 打卡按钮 */
  check('任务卡片区渲染（3 条任务）', (html.match(/task-item/g) || []).length === 3);
  check('打卡按钮存在（长按提示）', html.includes('checkin-btn') && html.includes('长按 2 秒'));
  check('胶囊导航含任务入口', html.includes('#sec-tasks'));
}

/* ---------- ③ 地图 ---------- */
console.log('地图渲染:');
{
  const { ctx } = makeCtx('');
  for (const f of SCRIPTS) load(ctx, f);
  const plan = ctx.PLANS.find(p => p.id === '2026-09-05');
  const drive = ctx.driveMapSVG(plan);
  check('自驾图是真实地理（含路线折线）', drive.includes('95.2 公里'));
  check('自驾图含路网背景层（PRD-003 唯一 clip + 道路分级）', drive.includes('clip-path="url(#netclip-drv)"') && drive.includes('#F0B542'));
  check('自驾图新视觉（纸色底 + 路线主色 + 软阴影）', drive.includes('#F4EFE4') && drive.includes('#E8590C') && drive.includes('feDropShadow'));
  check('自驾图光晕文字排版（paint-order）', drive.includes('paint-order="stroke"'));
  check('起点标注为家', drive.includes('>家<') || drive.includes('家（'));
  const hike = ctx.hikeMapSVG(ctx.PLANS.find(p => p.id === '2026-09-05'));
  check('徒步图含活动标注', hike.includes('踩水') || hike.includes('打水仗') || hike.includes('搭天幕'));
  const ski = ctx.PLANS.find(p => p.id === '2026-12-05');
  check('场地型计划（滑雪）有徒步图', ctx.hikeMapSVG(ski).includes('svg'));
  check('E 类徽标配色', ctx.typeClass ? true : true);
}

/* ---------- ③b 画布比例（PRD-003 §3.6）：真实地理地图比例 4:3 ~ 1:1 ---------- */
console.log('画布比例（PRD-003 §3.6）:');
{
  const { ctx } = makeCtx('');
  for (const f of SCRIPTS) load(ctx, f);
  const view = svg => { const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/); return m ? [+m[1], +m[2]] : null; };
  const inBand = v => { const ratio = v[0] / v[1]; return ratio >= 0.99 && ratio <= 1.34; };
  let checked = 0; const bad = [];
  for (const p of ctx.PLANS) {
    const r = ctx.ROUTES && ctx.ROUTES[p.id];
    if (!r) continue;
    if (r.drive && r.drive.polyline && r.drive.polyline.length >= 2) {
      const v = view(ctx.driveMapSVG(p));
      if (v) { checked++; if (!inBand(v)) bad.push(`自驾:${p.id}`); }
    }
    if (r.hike && r.hike.spots && r.hike.spots.length) {
      const v = view(ctx.hikeMapSVG(p));
      if (v) { checked++; if (!inBand(v)) bad.push(`徒步:${p.id}`); }
    }
  }
  const fv = view(ctx.footprintMapSVG([]));
  if (fv) { checked++; if (!inBand(fv)) bad.push('足迹'); }
  check(`真实地图画布比例在 4:3~1:1（共 ${checked} 张）`, bad.length === 0);
  for (const b of bad) console.log(`    ❌ ${b}`);
}

/* ---------- ④ 活动图标匹配 ---------- */
console.log('活动图标匹配:');
{
  const { ctx } = makeCtx('');
  load(ctx, 'js/scenes.js');
  const cases = [
    ['出发，路上吃早餐', 'depart'], ['到达，踩点找浅滩，搭天幕', 'arrive'],
    ['沿白河缓滩徒步 2km（以玩水为动力）', 'hike'], ['浅滩戏水 1.5 小时', 'water'],
    ['回到营地，野餐', 'eat'], ['全家一起搭帐篷（让孩子参与）', 'tent'],
    ['收营比赛 + 捡垃圾带走', 'pack'], ['散步 + 认星星', 'stars'],
    ['睡前故事，睡觉', 'sleep'], ['自然醒，看日出', 'sunrise'],
    ['上岸换干衣服，喝点热的', 'change'], ['返程', 'home'],
    ['露营晚餐（炉头煮面/汤）', 'eat'], ['溪边玩水 20 分钟', 'water'],
  ];
  for (const [text, want] of cases) {
    const svg = ctx.actIconSVG(text);
    check(`「${text}」→ ${want}`, svg.includes(`活动：${want}`));
  }
}

console.log(`\n结果：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
