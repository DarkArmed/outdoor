/* pipeline.js — 路线流水线主流程
 * 用法: node pipeline.js [planId]
 * 输入: data/*.js 中的 PLANS + config.json（amapKey）+ ../../config/profile.json（家位置/城市）
 * 输出: data/routes.js（var ROUTES = {...}）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeApi, parsePolyline } = require('./amap');
const { fetchNetwork } = require('./overpass');

/* 路网抓取区域：覆盖全部目的地（北京城区 → 丰宁坝上） */
const NETWORK_BBOX = [39.6, 115.6, 41.9, 117.5]; // [minLat, minLon, maxLat, maxLon]
const NETWORK_FILE = path.join(__dirname, '..', '..', 'data', 'network.js');

/** 抓取并写出共享路网文件；失败时保留已有文件，不阻断主流程 */
async function buildNetwork() {
  process.stdout.write('🛣️  抓取 OSM 路网 … ');
  try {
    const ways = await fetchNetwork(NETWORK_BBOX);
    const slim = ways.map(w => ({
      ...w,
      polyline: rdp(w.polyline, 0.0004).map(p => p.map(v => +v.toFixed(5))),
    })).filter(w => w.polyline.length >= 2);
    const header = `/* network.js — OSM 主要路网（motorway/trunk/primary，GCJ-02）\n * 由 tools/route-pipeline/pipeline.js 生成于 ${new Date().toISOString()}，请勿手改 */\n`;
    const body = `var NETWORK = ${JSON.stringify({ bbox: NETWORK_BBOX, ways: slim })};\n`;
    fs.writeFileSync(NETWORK_FILE, header + body);
    console.log(`✅ ${slim.length} 条道路，${Math.round(fs.statSync(NETWORK_FILE).size / 1024)}KB`);
  } catch (e) {
    console.log(`⚠️ 失败（保留已有 network.js）：${e.message}`);
  }
}

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(DATA_DIR, 'routes.js');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const PROFILE_FILE = path.join(ROOT, 'config', 'profile.json');

/* ---------- 道路标注：主要道路识别 + 出口类过滤 ---------- */
const MAJOR_ROAD = /高速|环路|快速路|国道|省道|[二三四五六]环|京承|京藏|京新|京哈|京港澳|大广|京密|京加|京漠|昌赤|怀长|怀黄|范崎|G\d+|S\d+/;
const SKIP_ROAD = /出口|入口|收费站|匝道|辅路|桥$|隧道/;

/** 从 steps 提取道路标签：优先主要道路；不足 2 条时用普通道路补足（保证市内短途也有指路标注） */
function extractRoads(steps) {
  const major = [], minor = [];
  for (const step of steps) {
    const road = (step.road || '').trim();
    if (!road || SKIP_ROAD.test(road)) continue;
    const firstPt = parsePolyline(step.polyline)[0];
    if (!firstPt) continue;
    const list = MAJOR_ROAD.test(road) ? major : minor;
    if (!list.some(r => r.name === road)) list.push({ name: road, point: firstPt });
  }
  const merged = major.concat(minor).slice(0, 8);
  return merged;
}

/* ---------- 地标图标猜测 ---------- */
function landmarkIcon(name) {
  if (/水库|湖|河|潭|瀑/.test(name)) return '💧';
  if (/山|峪|峰|岭|峡/.test(name)) return '⛰️';
  if (/城区|县城|市区|镇/.test(name)) return '🏙️';
  if (/寺|庙|观/.test(name)) return '🏯';
  if (/公园|乐园/.test(name)) return '🌳';
  return '📌';
}

/* ---------- 折线抽稀（Ramer–Douglas–Peucker） ---------- */
function rdp(points, tolerance) {
  if (points.length <= 2) return points;
  const [x1, y1] = points[0], [x2, y2] = points[points.length - 1];
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let maxD = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    let d;
    if (len2 === 0) d = Math.hypot(px - x1, py - y1);
    else {
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
      d = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tolerance) return [points[0], points[points.length - 1]];
  const left = rdp(points.slice(0, idx + 1), tolerance);
  const right = rdp(points.slice(idx), tolerance);
  return left.slice(0, -1).concat(right);
}

/* ---------- 折线上按里程取点 ---------- */
function pointAtFraction(polyline, frac) {
  let total = 0;
  const segs = [];
  for (let i = 1; i < polyline.length; i++) {
    const d = Math.hypot(polyline[i][0] - polyline[i - 1][0], polyline[i][1] - polyline[i - 1][1]);
    segs.push(d); total += d;
  }
  let target = total * frac;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] === 0 ? 0 : Math.min(1, target / segs[i]);
      const [x1, y1] = polyline[i], [x2, y2] = polyline[i + 1];
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }
    target -= segs[i];
  }
  return polyline[polyline.length - 1];
}

/** 点到折线的最小距离（度，粗算） */
function distToPolyline(pt, polyline) {
  let min = Infinity;
  for (const p of polyline) {
    const d = Math.hypot(pt[0] - p[0], pt[1] - p[1]);
    if (d < min) min = d;
  }
  return min;
}

/* ---------- 加载计划数据 ---------- */
function loadPlans() {
  const ctx = {};
  vm.createContext(ctx);
  for (const f of ['data-a.js', 'data-b.js', 'data-c.js', 'data-d.js']) {
    vm.runInContext(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.PLANS;
}

/* ---------- 主流程 ---------- */
async function processPlan(api, homeCoord, plan) {
  const out = { source: 'amap', generatedAt: new Date().toISOString() };

  /* ① 自驾（geoCity：目的地在外地时限定城市，防止同名 POI 张冠李戴） */
  const geoCity = plan.drive.geoCity || null;
  const destCoord = await api.geocode(plan.drive.to, geoCity);
  if (!destCoord) throw new Error(`目的地「${plan.drive.to}」地理编码失败`);
  const route = await api.driving(homeCoord, destCoord);
  /* 家门口 ~1.5km 内的路牌/地标不提取：护隐私（家附近路名会暴露位置），起点处也不需要指路标注 */
  const nearHome = c => Math.hypot(c[0] - homeCoord[0], c[1] - homeCoord[1]) < 0.015;
  const majorRoads = extractRoads(route.steps).filter(r => !nearHome(r.point));

  /* 沿途地标：地理编码后筛掉离路线太远的（>0.15 度 ≈ 15km）和家门口的 */
  const landmarks = [];
  for (const name of plan.drive.landmarks || []) {
    const c = await api.geocode(name, geoCity);
    if (c && !nearHome(c) && distToPolyline(c, route.polyline) < 0.15) {
      landmarks.push({ name, icon: landmarkIcon(name), coord: c });
    }
  }

  out.drive = {
    from: { name: plan.drive.from, coord: homeCoord },
    to: { name: plan.drive.to, coord: destCoord },
    polyline: rdp(route.polyline, 0.0008).map(p => p.map(v => +v.toFixed(5))),
    roads: majorRoads,
    landmarks,
    distance: route.distance,
    duration: route.duration,
  };

  /* ② 徒步/活动路线 */
  if (plan.hike) {
    const spots = [];
    const anchors = [];
    for (let i = 0; i < plan.hike.waypoints.length; i++) {
      const wp = plan.hike.waypoints[i];
      const spot = { name: wp.name, icon: wp.icon || '⭐', act: wp.act || '' };
      if (wp.query) {
        const c = await api.geocode(wp.query, geoCity);
        if (c) { spot.coord = c; anchors.push({ i, coord: c }); }
      }
      spots.push(spot);
    }

    /* 步行折线：首尾锚点间规划；山野无覆盖则 null */
    let walkLine = null;
    if (anchors.length >= 2) {
      walkLine = await api.walking(anchors[0].coord, anchors[anchors.length - 1].coord);
    }
    /* 无坐标的点：按 at（0–1）沿步行线/锚点连线定位 */
    for (let i = 0; i < spots.length; i++) {
      if (spots[i].coord) continue;
      const frac = plan.hike.waypoints[i].at != null
        ? plan.hike.waypoints[i].at
        : i / Math.max(1, spots.length - 1);
      if (walkLine) spots[i].coord = pointAtFraction(walkLine, frac);
      else if (anchors.length >= 2) {
        const a = anchors[0].coord, b = anchors[anchors.length - 1].coord;
        spots[i].coord = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
      } else if (anchors.length === 1) {
        /* 场地型（滑雪场/乐园/冰场）：只有一个锚点，其余点按 at 在锚点周边扇形铺开（示意） */
        const [ax, ay] = anchors[0].coord;
        const ang = frac * Math.PI * 1.5;
        const r = 0.0012 + frac * 0.0018;
        spots[i].coord = [+(ax + Math.cos(ang) * r).toFixed(5), +(ay + Math.sin(ang) * r).toFixed(5)];
      }
    }

    if (spots.every(s => s.coord)) {
      out.hike = {
        title: plan.hike.title,
        length: plan.hike.length || '',
        spots,
        path: walkLine ? rdp(walkLine, 0.0002).map(p => p.map(v => +v.toFixed(5))) : null,
        pathSource: walkLine ? 'amap-walking' : 'schematic-link',
      };
    }
  }
  return out;
}

async function main() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('❌ 缺少 config.json。请复制 config.example.json 并填入高德 Key。见 README.md');
    process.exit(1);
  }
  if (!fs.existsSync(PROFILE_FILE)) {
    console.error('❌ 缺少 config/profile.json（家的位置在用户配置里）。请照 config/profile.example.json 抄一份并填真实值。');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const profile = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
  if (!config.amapKey || config.amapKey.includes('在此填入')) {
    console.error('❌ config.json 中的 amapKey 未填写。见 README.md');
    process.exit(1);
  }
  if (!profile.home || !profile.home.name) {
    console.error('❌ config/profile.json 缺少 home.name（家的大致位置）');
    process.exit(1);
  }
  const targetId = process.argv[2];
  /* 只刷路网：node pipeline.js --network */
  if (targetId === '--network') { await buildNetwork(); return; }
  const plans = loadPlans().filter(p => !p.archived && (!targetId || p.id === targetId));
  if (!plans.length) { console.error('❌ 没有匹配的计划'); process.exit(1); }

  const api = makeApi(config.amapKey, profile.home.city || '北京');
  const homeCoord = await api.geocode(profile.home.name, profile.home.city);
  if (!homeCoord) { console.error(`❌ 家的位置「${profile.home.name}」地理编码失败`); process.exit(1); }
  console.log(`🏠 起点：${profile.home.name} → [${homeCoord}]`);

  /* 已有输出则合并更新 */
  let routes = {};
  if (fs.existsSync(OUT_FILE) && !targetId) {
    // 全量重跑则直接覆盖
  } else if (fs.existsSync(OUT_FILE)) {
    const m = fs.readFileSync(OUT_FILE, 'utf8').match(/var ROUTES = (\{[\s\S]*\});?\s*$/);
    if (m) { try { routes = JSON.parse(m[1]); } catch (_) {} }
  }

  let ok = 0, fail = 0;
  for (const plan of plans) {
    process.stdout.write(`⏳ ${plan.id} ${plan.title} … `);
    try {
      routes[plan.id] = await processPlan(api, homeCoord, plan);
      ok++;
      console.log(`✅ 自驾 ${routes[plan.id].drive.distance}km / ${routes[plan.id].drive.duration}min，道路 ${routes[plan.id].drive.roads.length} 条，地标 ${routes[plan.id].drive.landmarks.length} 个${routes[plan.id].hike ? '，徒步点 ' + routes[plan.id].hike.spots.length + ' 个' : ''}`);
    } catch (e) {
      fail++;
      console.log(`⚠️ 失败：${e.message}`);
    }
  }

  const header = `/* routes.js — 由 tools/route-pipeline/pipeline.js 生成，请勿手改\n * 坐标: GCJ-02（高德）· 生成于 ${new Date().toISOString()} */\n`;
  fs.writeFileSync(OUT_FILE, header + `var ROUTES = ${JSON.stringify(routes, null, 1)};\n`);
  console.log(`\n💾 已写入 ${path.relative(ROOT, OUT_FILE)}（成功 ${ok}，失败 ${fail}）`);

  if (!targetId) await buildNetwork();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
