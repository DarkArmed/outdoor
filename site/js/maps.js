/* ============================================================
   maps.js — 路线图渲染器（PRD-003 视觉精修版）
   优先使用 routes.js 的真实地理数据（高德 GCJ-02 坐标），
   以「纸色系 + 道路分级 + 光晕文字 + 统一标记」的矢量风渲染，
   真实方位；无数据时回退到卡通示意图。
   ============================================================ */

/* ---------- 共享视觉常量（PRD-003 §3.1） ---------- */
var MAP_C = {
  paper:   '#F4EFE4', // 底图纸色
  line:    '#E6DFCE', // 经纬网 / 细边框
  pill:    '#FFFFFF', // 标签底
  pillEdge:'#E4DCC9', // 标签描边
  road: {             // 道路分级（OSM network.js：motorway/trunk/primary）
    motorway: { casing: '#FFFFFF', casingW: 4.6, fill: '#F0B542', fillW: 3.0, opacity: 0.9 },
    trunk:    { casing: '#FFFFFF', casingW: 3.6, fill: '#E0CA95', fillW: 2.2, opacity: 0.85 },
    primary:  { casing: '#FFFFFF', casingW: 0,   fill: '#DCD4C0', fillW: 1.5, opacity: 0.6 },
  },
  route:    '#E8590C', // 自驾主路线（烧砖橙）
  trail:    '#B07D3B', // 徒步主路线（焦糖棕）
  text:     '#3F3D36', // 主文字
  sub:      '#8A8372', // 次文字
  accent:   '#4C7FB5', // 蓝色强调（地标 / 家 / 信息牌）
  gold:     '#F7B733', // 起点 / 已打卡
  goldDk:   '#C98A12',
  green:    '#5FB45F', // 终点
  greenDk:  '#3E8A4A',
  gray:     '#C2BDB1', // 未打卡
  grayDk:   '#9A9485',
};

/* ---------- 共享 defs：软阴影 / 辉光 / 唯一 clip ---------- */
function mapDefs(id, W, H, rx) {
  return `
  <defs>
    <clipPath id="netclip-${id}"><rect width="${W}" height="${H}" rx="${rx}"/></clipPath>
    <radialGradient id="vig-${id}" cx="50%" cy="40%" r="78%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="sh-${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#5A5244" flood-opacity="0.30"/></filter>
    <filter id="glow-${id}" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${MAP_C.gold}" flood-opacity="0.6"/></filter>
  </defs>`;
}

/* ---------- 光晕文字：paint-order:stroke 纸色描边，代替重型色块 ---------- */
function haloText(x, y, txt, size, fill, anchor) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor || 'middle'}" font-size="${size}" font-weight="700"
    fill="${fill || MAP_C.text}" stroke="${MAP_C.paper}" stroke-width="4.5" paint-order="stroke">${txt}</text>`;
}

/* ---------- 经纬网（淡 graticule，制造"地图感"） ---------- */
function graticule(W, H, proj, bounds) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const step = Math.max(0.05, Math.ceil(Math.max(maxLon - minLon, maxLat - minLat) / 4 * 100) / 100);
  let out = '';
  for (let lon = Math.ceil(minLon / step) * step; lon <= maxLon; lon += step) {
    const x = proj([lon, (minLat + maxLat) / 2])[0];
    out += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" stroke="${MAP_C.line}" stroke-width="1" opacity="0.5"/>`;
  }
  for (let lat = Math.ceil(minLat / step) * step; lat <= maxLat; lat += step) {
    const y = proj([(minLon + maxLon) / 2, lat])[1];
    out += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="${MAP_C.line}" stroke-width="1" opacity="0.5"/>`;
  }
  return out;
}

/* ---------- 坐标投影：经纬度 → SVG 画布 ---------- */
function projectPoints(allCoords, W, H, pad) {
  const lons = allCoords.map(c => c[0]), lats = allCoords.map(c => c[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const lat0 = (minLat + maxLat) / 2;
  const kx = Math.cos((lat0 * Math.PI) / 180); // 经度随纬度收缩
  const w = Math.max((maxLon - minLon) * kx, 1e-6);
  const h = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const ox = (W - w * scale) / 2, oy = (H - h * scale) / 2;
  return c => [
    ox + (c[0] - minLon) * kx * scale,
    H - (oy + (c[1] - minLat) * scale), // Y 翻转：北在上
  ];
}

function pathFrom(coords, proj) {
  return coords.map((c, i) => {
    const [x, y] = proj(c);
    return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function mapBounds(all) {
  return [
    Math.min(...all.map(c => c[0])), Math.min(...all.map(c => c[1])),
    Math.max(...all.map(c => c[0])), Math.max(...all.map(c => c[1])),
  ];
}

/* ---------- 路网背景：OSM 主要道路（network.js，GCJ-02），分级渲染
   simple=true 时单遍淡渲染（足迹大地图用，省一半体积） ---------- */
function networkLayer(bounds, proj, id, simple) {
  if (typeof NETWORK === 'undefined' || !NETWORK || !NETWORK.ways) return '';
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const padLon = (maxLon - minLon) * 0.15, padLat = (maxLat - minLat) * 0.15;
  const x0 = minLon - padLon, x1 = maxLon + padLon, y0 = minLat - padLat, y1 = maxLat + padLat;
  const ST = MAP_C.road;
  const SIMPLE = { motorway: ['#E9D9AC', 1.8], trunk: ['#E5D9BA', 1.5] }; // 足迹图只保留高速+干道
  let casing = '', fill = '';
  for (const w of NETWORK.ways) {
    let inside = false;
    for (const p of w.polyline) {
      if (p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) { inside = true; break; }
    }
    if (!inside) continue;
    const d = pathFrom(w.polyline, proj);
    if (simple) {
      const s = SIMPLE[w.cls];
      if (!s) continue;
      fill += `<path d="${d}" fill="none" stroke="${s[0]}" stroke-width="${s[1]}" stroke-opacity="0.55" stroke-linecap="round" stroke-linejoin="round"/>`;
      continue;
    }
    const s = ST[w.cls] || ST.primary;
    if (s.casingW > 0) casing += `<path d="${d}" fill="none" stroke="${s.casing}" stroke-width="${s.casingW}" stroke-linecap="round" stroke-linejoin="round"/>`;
    fill += `<path d="${d}" fill="none" stroke="${s.fill}" stroke-width="${s.fillW}" stroke-opacity="${s.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return (casing || fill) ? `<g clip-path="url(#netclip-${id})">${casing}${fill}</g>` : '';
}

/* ---------- 统一标记：白色圆底 + 强调色环 + emoji + 光晕文字 ---------- */
function pinMarker(x, y, emoji, ring, id) {
  return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})" filter="url(#sh-${id})">
    <circle r="15" fill="#FFFFFF" stroke="${ring}" stroke-width="3"/>
    <text y="6" text-anchor="middle" font-size="15">${emoji}</text>
  </g>`;
}

/* ---------- 指北针 ---------- */
function compass(x, y, id) {
  return `<g transform="translate(${x},${y})" filter="url(#sh-${id})">
    <circle r="20" fill="#FFFFFF" stroke="${MAP_C.line}" stroke-width="1.5"/>
    <path d="M0 -12 L 5 5 L 0 2 L -5 5 Z" fill="${MAP_C.route}"/>
    <path d="M0 12 L 5 -5 L 0 -2 L -5 -5 Z" fill="#B9B2A1"/>
    <text y="34" text-anchor="middle" font-size="13" font-weight="700" fill="${MAP_C.text}">北</text>
  </g>`;
}

/* ---------- 信息牌（里程/标题）；id 传入时才加软阴影 ---------- */
function infoCard(x, y, text, accent, w, id) {
  const flt = id ? ` filter="url(#sh-${id})"` : '';
  return `<g transform="translate(${x},${y})"${flt}>
    <rect x="${-w / 2}" y="-24" width="${w}" height="44" rx="14" fill="#FFFFFF" opacity="0.95" stroke="${accent}" stroke-width="2"/>
    <text y="6" text-anchor="middle" font-size="18" font-weight="700" fill="${MAP_C.text}">${text}</text>
  </g>`;
}

/* ---------- 真实地理：自驾路线图 ---------- */
function realDriveMap(d, id) {
  const W = 800, H = 460, PAD = 82;
  const all = [...d.polyline, d.from.coord, d.to.coord, ...(d.landmarks || []).map(l => l.coord)];
  const proj = projectPoints(all, W, H, PAD);
  const bounds = mapBounds(all);
  const route = pathFrom(d.polyline, proj);
  const [sx, sy] = proj(d.from.coord);
  const [ex, ey] = proj(d.to.coord);

  const roadLabels = (d.roads || []).filter(r => r.name && r.name.trim()).map(r => {
    const [x, y] = proj(r.point);
    const w = r.name.length * 13 + 16;
    return `
    <g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <rect x="${(-w / 2).toFixed(1)}" y="-12.5" width="${w}" height="25" rx="12.5" fill="${MAP_C.pill}" opacity="0.92" stroke="${MAP_C.pillEdge}" stroke-width="1"/>
      <text y="4.5" text-anchor="middle" font-size="12.5" font-weight="600" fill="${MAP_C.text}">${r.name}</text>
    </g>`;
  }).join('');

  const landmarks = (d.landmarks || []).map(l => {
    const [x, y] = proj(l.coord);
    return `
    <g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      ${pinMarker(0, 0, l.icon, MAP_C.accent, id)}
      ${haloText(0, 34, l.name, 13.5)}
    </g>`;
  }).join('');

  return `
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="自驾路线图（真实地理）" style="font-family:system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">
  ${mapDefs(id, W, H, 20)}
  <rect width="${W}" height="${H}" rx="20" fill="${MAP_C.paper}"/>
  <rect width="${W}" height="${H}" rx="20" fill="url(#vig-${id})"/>
  ${graticule(W, H, proj, bounds)}
  <!-- 路网背景（OSM 主要道路，分级示意） -->
  ${networkLayer(bounds, proj, id)}
  <!-- 真实路线：白描边 + 烧砖橙主路 -->
  <path d="${route}" fill="none" stroke="#FFFFFF" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${route}" fill="none" stroke="${MAP_C.route}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- 主要道路标注 -->
  ${roadLabels}
  <!-- 沿途地标 -->
  ${landmarks}
  <!-- 起点 -->
  <g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)})" filter="url(#sh-${id})">
    <circle r="20" fill="${MAP_C.gold}" stroke="#FFFFFF" stroke-width="3.5"/>
    <text y="7" text-anchor="middle" font-size="18">🏠</text>
    ${haloText(0, 46, d.from.name, 16)}
  </g>
  <!-- 终点 -->
  <g transform="translate(${ex.toFixed(1)},${ey.toFixed(1)})" filter="url(#sh-${id})">
    <circle r="20" fill="${MAP_C.green}" stroke="#FFFFFF" stroke-width="3.5"/>
    <text y="7" text-anchor="middle" font-size="18">📍</text>
    ${haloText(0, -38, d.to.name, 17)}
  </g>
  <!-- 真实里程信息牌 -->
  <g transform="translate(${W / 2},50)">
    <rect x="-180" y="-26" width="360" height="48" rx="15" fill="#FFFFFF" opacity="0.95" stroke="${MAP_C.route}" stroke-width="2.5"/>
    <text y="7" text-anchor="middle" font-size="19" font-weight="700" fill="${MAP_C.text}">🚗 ${d.distance} 公里 · 约 ${d.duration} 分钟</text>
  </g>
  <!-- 指北针 -->
  ${compass(W - 46, 84, id)}
</svg>`;
}

/* ---------- 真实地理：徒步/活动路线图 ---------- */
function realHikeMap(h, id) {
  const W = 800, H = 420, PAD = 85;
  const coords = h.spots.map(s => s.coord).concat(h.path || []);
  const proj = projectPoints(coords, W, H, PAD);
  const bounds = mapBounds(coords);

  /* 路径：真实步行折线（实线）或点位示意连线（虚线） */
  let pathLayer;
  if (h.path && h.path.length >= 2) {
    pathLayer = `
    <path d="${pathFrom(h.path, proj)}" fill="none" stroke="#FFFFFF" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${pathFrom(h.path, proj)}" fill="none" stroke="${MAP_C.trail}" stroke-width="4.5" stroke-dasharray="1 12" stroke-linecap="round"/>`;
  } else {
    let dAttr = '';
    h.spots.forEach((s, i) => {
      const [x, y] = proj(s.coord);
      dAttr += `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    });
    pathLayer = `
    <path d="${dAttr}" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" opacity="0.9"/>
    <path d="${dAttr}" fill="none" stroke="${MAP_C.trail}" stroke-width="4" stroke-dasharray="6 10" stroke-linecap="round" opacity="0.85"/>
    <text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-size="13" fill="${MAP_C.sub}">虚线为点位示意连接（山野步道无地图数据）</text>`;
  }

  const spots = h.spots.map((s, i) => {
    const [x, y] = proj(s.coord);
    const isStart = i === 0, isEnd = i === h.spots.length - 1;
    const below = i % 2 === 0;
    const icon = s.icon || (isStart ? '🚩' : isEnd ? '🏁' : '⭐');
    const bg = isStart ? MAP_C.gold : isEnd ? MAP_C.green : '#FFFFFF';
    const ring = isStart ? MAP_C.goldDk : isEnd ? MAP_C.greenDk : MAP_C.accent;
    return `
    <g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <g filter="url(#sh-${id})">
        <circle r="19" fill="${bg}" stroke="#FFFFFF" stroke-width="3"/>
        <text y="7" text-anchor="middle" font-size="17">${icon}</text>
      </g>
      <circle cx="19" cy="-19" r="10" fill="${MAP_C.route}"/>
      <text x="19" y="-14" text-anchor="middle" font-size="12" font-weight="700" fill="#FFFFFF">${i + 1}</text>
      ${haloText(0, below ? 50 : -38, s.name, 15.5)}
      ${s.act ? haloText(0, below ? 70 : -56, s.act, 13, MAP_C.route) : ''}
    </g>`;
  }).join('');

  return `
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="徒步路线图（真实地理）" style="font-family:system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">
  ${mapDefs(id, W, H, 20)}
  <rect width="${W}" height="${H}" rx="20" fill="${MAP_C.paper}"/>
  <rect width="${W}" height="${H}" rx="20" fill="url(#vig-${id})"/>
  ${graticule(W, H, proj, bounds)}
  ${pathLayer}
  ${spots}
  ${infoCard(W / 2, 40, `🥾 ${h.title}${h.length ? ' · ' + h.length : ''}`, MAP_C.green, 420, id)}
  ${compass(W - 46, 104, id)}
</svg>`;
}

/* ============================================================
   回退方案：无 routes.js 数据时的卡通示意图（视觉与新色板对齐）
   ============================================================ */
function schematicDriveMap(drive) {
  const path = 'M 90 270 C 220 180, 300 300, 430 220 S 640 130, 710 110';
  return `
<svg viewBox="0 0 800 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="自驾路线示意图" style="font-family:system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">
  <rect width="800" height="340" rx="20" fill="${MAP_C.paper}"/>
  <path d="M0 220 Q 120 140 240 200 T 480 190 T 800 170 V 340 H 0 Z" fill="#E3EAD6"/>
  <path d="M0 270 Q 160 210 340 260 T 800 240 V 340 H 0 Z" fill="#D5E0C6"/>
  <path d="${path}" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="${MAP_C.route}" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 22"/>
  <g transform="translate(90,270)">
    <circle r="22" fill="${MAP_C.gold}" stroke="#FFFFFF" stroke-width="3.5"/>
    <text y="8" text-anchor="middle" font-size="20">🏠</text>
    <text y="52" text-anchor="middle" font-size="16" font-weight="bold" fill="${MAP_C.text}">${drive.from || '家'}</text>
  </g>
  <g transform="translate(710,110)">
    <circle r="22" fill="${MAP_C.green}" stroke="#FFFFFF" stroke-width="3.5"/>
    <text y="8" text-anchor="middle" font-size="20">📍</text>
    <text y="-38" text-anchor="middle" font-size="17" font-weight="bold" fill="${MAP_C.text}">${drive.to}</text>
  </g>
  <g transform="translate(400,238) rotate(-8)">
    <rect x="-34" y="-16" width="68" height="18" rx="8" fill="${MAP_C.route}"/>
    <path d="M-22 -16 L -13 -28 H 12 L 21 -16 Z" fill="${MAP_C.route}"/>
    <rect x="-11" y="-26" width="10" height="10" rx="2" fill="#BDE8FF"/>
    <rect x="3" y="-26" width="10" height="10" rx="2" fill="#BDE8FF"/>
    <circle cx="-19" cy="4" r="8" fill="${MAP_C.text}"/><circle cx="19" cy="4" r="8" fill="${MAP_C.text}"/>
  </g>
  <g transform="translate(400,56)">
    <rect x="-140" y="-28" width="280" height="50" rx="15" fill="#FFFFFF" opacity="0.95" stroke="${MAP_C.route}" stroke-width="2.5"/>
    <text y="6" text-anchor="middle" font-size="20" font-weight="700" fill="${MAP_C.text}">🚗 ${drive.time} · 约 ${drive.km} 公里</text>
  </g>
  ${compass(745, 84, 'scd')}
  <text x="400" y="326" text-anchor="middle" font-size="13" fill="${MAP_C.sub}">示意图 · 运行 route-pipeline 生成真实地理路线图</text>
</svg>`;
}

function schematicHikeMap(hike) {
  const pts = hike.waypoints;
  const n = pts.length;
  const coords = pts.map((_, i) => {
    const x = 90 + (620 * i) / (n - 1 || 1);
    const y = 210 + Math.sin(i * 1.6) * 70;
    return [Math.round(x), Math.round(y)];
  });
  let d = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 1; i < n; i++) {
    const [x0, y0] = coords[i - 1], [x1, y1] = coords[i];
    d += ` Q ${Math.round((x0 + x1) / 2)} ${y0 - 40}, ${x1} ${y1}`;
  }
  const wp = pts.map((p, i) => {
    const [x, y] = coords[i];
    const isStart = i === 0, isEnd = i === n - 1;
    const labelY = y + (i % 2 === 0 ? 50 : -36);
    const actY = y + (i % 2 === 0 ? 70 : -54);
    const icon = p.icon || (isStart ? '🚩' : isEnd ? '🏁' : '⭐');
    const bg = isStart ? MAP_C.gold : isEnd ? MAP_C.green : '#FFFFFF';
    const ring = isStart ? MAP_C.goldDk : isEnd ? MAP_C.greenDk : MAP_C.accent;
    return `
    <g transform="translate(${x},${y})">
      <circle r="19" fill="${bg}" stroke="#FFFFFF" stroke-width="3"/>
      <text y="7" text-anchor="middle" font-size="17">${icon}</text>
      <circle cx="19" cy="-19" r="10" fill="${MAP_C.route}"/>
      <text x="19" y="-14" text-anchor="middle" font-size="12" font-weight="700" fill="#FFFFFF">${i + 1}</text>
      <text y="${labelY}" text-anchor="middle" font-size="15.5" font-weight="bold" fill="${MAP_C.text}" stroke="${MAP_C.paper}" stroke-width="4.5" paint-order="stroke">${p.name}</text>
      ${p.act ? `<text y="${actY}" text-anchor="middle" font-size="13" fill="${MAP_C.route}" font-weight="bold" stroke="${MAP_C.paper}" stroke-width="4.5" paint-order="stroke">${p.act}</text>` : ''}
    </g>`;
  }).join('');
  return `
<svg viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="徒步路线示意图" style="font-family:system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">
  <rect width="800" height="420" rx="20" fill="${MAP_C.paper}"/>
  <path d="M0 120 Q 140 60 280 110 T 800 90 V 0 H 0 Z" fill="#E3EAD6"/>
  <path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>
  <path d="${d}" fill="none" stroke="${MAP_C.trail}" stroke-width="4" stroke-dasharray="1 12" stroke-linecap="round"/>
  ${wp}
  ${infoCard(400, 40, `🥾 ${hike.title}${hike.length ? ' · ' + hike.length : ''}`, MAP_C.green, 420)}
  <text x="400" y="404" text-anchor="middle" font-size="13" fill="${MAP_C.sub}">示意图 · 运行 route-pipeline 生成真实地理路线图</text>
</svg>`;
}

/* ---------- 对外接口：优先真实数据，回退示意图 ---------- */
function routeData(planId) {
  return (typeof ROUTES !== 'undefined' && ROUTES[planId]) || null;
}

function driveMapSVG(plan) {
  const r = routeData(plan.id);
  if (r && r.drive && r.drive.polyline && r.drive.polyline.length >= 2) return realDriveMap(r.drive, 'drv');
  return schematicDriveMap(plan.drive);
}

function hikeMapSVG(plan) {
  const r = routeData(plan.id);
  if (r && r.hike && r.hike.spots && r.hike.spots.length) return realHikeMap(r.hike, 'hik');
  if (!plan.hike) return '';
  return schematicHikeMap(plan.hike);
}

/* ---------- 足迹大地图（PRD-002 §四）：全部目的地的真实坐标总览 ---------- */
function footprintMapSVG(doneIds) {
  if (typeof ROUTES === 'undefined' || typeof PLANS === 'undefined') return '';
  const done = new Set(doneIds || []);
  const pts = [];
  let home = null;
  for (const p of PLANS) {
    const r = ROUTES[p.id];
    if (!r || !r.drive || !r.drive.to || !r.drive.to.coord) continue;
    if (!home && r.drive.from && r.drive.from.coord) home = r.drive.from.coord;
    /* 同城多点去重（如多次白河湾）：坐标近似则合并，已打卡状态取或 */
    const near = pts.find(q => Math.hypot(q.coord[0] - r.drive.to.coord[0], q.coord[1] - r.drive.to.coord[1]) < 0.01);
    if (near) { near.done = near.done || done.has(p.id); continue; }
    pts.push({ coord: r.drive.to.coord, name: p.location, title: p.title, date: p.date, done: done.has(p.id), archived: !!p.archived });
  }
  if (!pts.length || !home) return '';

  const W = 800, H = 420, PAD = 56;
  const all = [...pts.map(p => p.coord), home];
  const proj = projectPoints(all, W, H, PAD);
  const bounds = mapBounds(all);

  const [hx, hy] = proj(home);
  const markers = pts.map(p => {
    const [x, y] = proj(p.coord);
    const tip = `${p.title}｜${p.date}${p.archived ? '（备用）' : ''}${p.done ? '｜已打卡 ✅' : ''}`;
    return p.done
      ? `<g filter="url(#glow-fp)"><title>${tip}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="${MAP_C.gold}" stroke="#FFFFFF" stroke-width="2.5"/><text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-size="15">⭐</text></g>`
      : `<g opacity="0.75"><title>${tip}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="${MAP_C.gray}" stroke="#FFFFFF" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle" font-size="14">📍</text></g>`;
  }).join('');

  const legend = `
  <g transform="translate(${W / 2},${H - 24})">
    <circle cx="-118" cy="0" r="5.5" fill="${MAP_C.gold}" stroke="#FFFFFF" stroke-width="1.5"/>
    <text x="-108" y="4" text-anchor="middle" font-size="13" font-weight="600" fill="${MAP_C.text}">已打卡</text>
    <circle cx="-30" cy="0" r="5.5" fill="${MAP_C.gray}" stroke="#FFFFFF" stroke-width="1.5"/>
    <text x="-20" y="4" text-anchor="middle" font-size="13" font-weight="600" fill="${MAP_C.text}">还没去</text>
    <circle cx="58" cy="0" r="5.5" fill="${MAP_C.accent}" stroke="#FFFFFF" stroke-width="1.5"/>
    <text x="68" y="4" text-anchor="middle" font-size="13" font-weight="600" fill="${MAP_C.text}">家</text>
  </g>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="足迹大地图" style="font-family:system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">
    ${mapDefs('fp', W, H, 18)}
    <rect width="${W}" height="${H}" rx="18" fill="${MAP_C.paper}"/>
    <rect width="${W}" height="${H}" rx="18" fill="url(#vig-fp)"/>
    ${graticule(W, H, proj, bounds)}
    ${networkLayer(bounds, proj, 'fp', true)}
    <g filter="url(#sh-fp)"><title>家</title><circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="15" fill="#FFFFFF" stroke="${MAP_C.accent}" stroke-width="3"/><text x="${hx.toFixed(1)}" y="${(hy + 6).toFixed(1)}" text-anchor="middle" font-size="16">🏠</text></g>
    ${markers}
    ${legend}
  </svg>`;
}
