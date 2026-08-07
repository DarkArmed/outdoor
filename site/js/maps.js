/* ============================================================
   maps.js — 路线图渲染器
   优先使用 routes.js 中的真实地理数据（高德 GCJ-02 坐标，
   卡通化渲染、真实方位）；无数据时回退到卡通示意图。
   ============================================================ */

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

/* ---------- 路网背景：OSM 主要道路（network.js，GCJ-02，与路线同一坐标系） ---------- */
function networkLayer(bounds, proj) {
  if (typeof NETWORK === 'undefined' || !NETWORK || !NETWORK.ways) return '';
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const padLon = (maxLon - minLon) * 0.1, padLat = (maxLat - minLat) * 0.1;
  const x0 = minLon - padLon, x1 = maxLon + padLon, y0 = minLat - padLat, y1 = maxLat + padLat;
  const STYLE = { motorway: ['#D9D2C5', 5.5], trunk: ['#DFDAD0', 4.5], primary: ['#E6E2DA', 3.5] };
  let out = '';
  for (const w of NETWORK.ways) {
    let inside = false;
    for (const p of w.polyline) {
      if (p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) { inside = true; break; }
    }
    if (!inside) continue;
    const [color, width] = STYLE[w.cls] || STYLE.primary;
    out += `<path d="${pathFrom(w.polyline, proj)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return out ? `<g clip-path="url(#netclip)" opacity="0.85">${out}</g>` : '';
}

/* ---------- 真实地理：自驾路线图 ---------- */
function realDriveMap(d) {
  const W = 800, H = 460, PAD = 80;
  const all = [...d.polyline, d.from.coord, d.to.coord, ...d.landmarks.map(l => l.coord)];
  const proj = projectPoints(all, W, H, PAD);
  const bounds = [
    Math.min(...all.map(c => c[0])), Math.min(...all.map(c => c[1])),
    Math.max(...all.map(c => c[0])), Math.max(...all.map(c => c[1])),
  ];
  const route = pathFrom(d.polyline, proj);
  const [sx, sy] = proj(d.from.coord);
  const [ex, ey] = proj(d.to.coord);

  const roadLabels = d.roads.map(r => {
    const [x, y] = proj(r.point);
    return `
    <g transform="translate(${x.toFixed(1)},${(y - 18).toFixed(1)})">
      <rect x="${(-r.name.length * 8 - 14)}" y="-15" width="${r.name.length * 16 + 28}" height="30" rx="10" fill="#4A5568" opacity="0.88"/>
      <text y="6" text-anchor="middle" font-size="16" font-weight="bold" fill="#fff">${r.name}</text>
    </g>`;
  }).join('');

  const landmarks = d.landmarks.map(l => {
    const [x, y] = proj(l.coord);
    return `
    <g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <circle r="18" fill="#fff" stroke="#A78BFA" stroke-width="3" opacity="0.95"/>
      <text y="7" text-anchor="middle" font-size="18">${l.icon}</text>
      <text y="34" text-anchor="middle" font-size="14" font-weight="bold" fill="#4A5568">${l.name}</text>
    </g>`;
  }).join('');

  return `
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="自驾路线图（真实地理）">
  <defs><clipPath id="netclip"><rect width="${W}" height="${H}" rx="20"/></clipPath></defs>
  <rect width="${W}" height="${H}" rx="20" fill="#EAF6FF"/>
  <path d="M0 ${H - 90} Q 200 ${H - 140} 400 ${H - 100} T 800 ${H - 120} V ${H} H 0 Z" fill="#D9F2D0"/>
  <!-- 路网背景（OSM 主要道路，示意参照） -->
  ${networkLayer(bounds, proj)}
  <!-- 真实路线：白边 + 珊瑚红主路 -->
  <path d="${route}" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${route}" fill="none" stroke="#FF6B6B" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- 主要道路标注 -->
  ${roadLabels}
  <!-- 沿途地标 -->
  ${landmarks}
  <!-- 起点 -->
  <g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)})">
    <circle r="26" fill="#FFD93D" stroke="#F08C00" stroke-width="4"/>
    <text y="7" text-anchor="middle" font-size="24">🏠</text>
    <text y="52" text-anchor="middle" font-size="16" font-weight="bold" fill="#2D3748">${d.from.name}</text>
  </g>
  <!-- 终点 -->
  <g transform="translate(${ex.toFixed(1)},${ey.toFixed(1)})">
    <circle r="26" fill="#7CDB6E" stroke="#4CAF50" stroke-width="4"/>
    <text y="8" text-anchor="middle" font-size="24">📍</text>
    <text y="-40" text-anchor="middle" font-size="17" font-weight="bold" fill="#2D3748">${d.to.name}</text>
  </g>
  <!-- 真实里程信息牌 -->
  <g transform="translate(${W / 2},52)">
    <rect x="-170" y="-30" width="340" height="56" rx="16" fill="#fff" stroke="#FFA94D" stroke-width="4"/>
    <text y="6" text-anchor="middle" font-size="21" font-weight="bold" fill="#2D3748">🚗 ${d.distance} 公里 · 约 ${d.duration} 分钟</text>
  </g>
  <!-- 指北针 -->
  <g transform="translate(${W - 55},80)">
    <circle r="24" fill="#fff" stroke="#4A5568" stroke-width="3"/>
    <path d="M0 -14 L 6 6 L 0 2 L -6 6 Z" fill="#FF6B6B"/>
    <text y="-30" text-anchor="middle" font-size="14" font-weight="bold" fill="#4A5568">北</text>
  </g>
</svg>`;
}

/* ---------- 真实地理：徒步/活动路线图 ---------- */
function realHikeMap(h) {
  const W = 800, H = 420, PAD = 85;
  const coords = h.spots.map(s => s.coord).concat(h.path || []);
  const proj = projectPoints(coords, W, H, PAD);

  /* 路径：真实步行折线（实线）或点位示意连线（虚线） */
  let pathLayer;
  if (h.path && h.path.length >= 2) {
    pathLayer = `<path d="${pathFrom(h.path, proj)}" fill="none" stroke="#E9D8A6" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${pathFrom(h.path, proj)}" fill="none" stroke="#B08948" stroke-width="4" stroke-dasharray="3 14" stroke-linecap="round"/>`;
  } else {
    let dAttr = '';
    h.spots.forEach((s, i) => {
      const [x, y] = proj(s.coord);
      dAttr += `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    });
    pathLayer = `<path d="${dAttr}" fill="none" stroke="#B08948" stroke-width="5" stroke-dasharray="6 10" stroke-linecap="round" opacity="0.8"/>
    <text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-size="13" fill="#8A6D3B">虚线为点位示意连接（山野步道无地图数据）</text>`;
  }

  const spots = h.spots.map((s, i) => {
    const [x, y] = proj(s.coord);
    const isStart = i === 0, isEnd = i === h.spots.length - 1;
    const below = i % 2 === 0;
    const icon = s.icon || (isStart ? '🚩' : isEnd ? '🏁' : '⭐');
    return `
    <g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      <circle r="24" fill="${isStart ? '#FFD93D' : isEnd ? '#7CDB6E' : '#fff'}" stroke="#FF8A65" stroke-width="4"/>
      <text y="8" text-anchor="middle" font-size="22">${icon}</text>
      <circle cx="20" cy="-20" r="13" fill="#FF6B6B"/>
      <text x="20" y="-15" text-anchor="middle" font-size="15" font-weight="bold" fill="#fff">${i + 1}</text>
      <text y="${below ? 58 : -42}" text-anchor="middle" font-size="16" font-weight="bold" fill="#2D3748">${s.name}</text>
      ${s.act ? `<text y="${below ? 78 : -60}" text-anchor="middle" font-size="14" fill="#E85D3D" font-weight="bold">${s.act}</text>` : ''}
    </g>`;
  }).join('');

  return `
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="徒步路线图（真实地理）">
  <rect width="${W}" height="${H}" rx="20" fill="#F3FBEF"/>
  <path d="M0 100 Q 150 50 300 90 T 800 70 V 0 H 0 Z" fill="#DFF2D8"/>
  ${pathLayer}
  ${spots}
  <g transform="translate(${W / 2},40)">
    <rect x="-200" y="-26" width="400" height="52" rx="16" fill="#fff" stroke="#7CDB6E" stroke-width="4"/>
    <text y="7" text-anchor="middle" font-size="20" font-weight="bold" fill="#2D3748">🥾 ${h.title}${h.length ? ' · ' + h.length : ''}</text>
  </g>
  <g transform="translate(${W - 55},110)">
    <circle r="22" fill="#fff" stroke="#4A5568" stroke-width="3"/>
    <path d="M0 -13 L 5 5 L 0 2 L -5 5 Z" fill="#FF6B6B"/>
    <text y="-28" text-anchor="middle" font-size="13" font-weight="bold" fill="#4A5568">北</text>
  </g>
</svg>`;
}

/* ============================================================
   回退方案：无 routes.js 数据时的卡通示意图
   ============================================================ */
function schematicDriveMap(drive) {
  const path = 'M 90 270 C 220 180, 300 300, 430 220 S 640 130, 710 110';
  return `
<svg viewBox="0 0 800 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="自驾路线示意图">
  <rect width="800" height="340" rx="20" fill="#EAF6FF"/>
  <path d="M0 220 Q 120 140 240 200 T 480 190 T 800 170 V 340 H 0 Z" fill="#D3EBD0"/>
  <path d="M0 270 Q 160 210 340 260 T 800 240 V 340 H 0 Z" fill="#BDE3B8"/>
  <path d="${path}" fill="none" stroke="#FF6B6B" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 22"/>
  <g transform="translate(90,270)">
    <circle r="26" fill="#FFD93D" stroke="#F08C00" stroke-width="4"/>
    <text y="7" text-anchor="middle" font-size="24">🏠</text>
    <text y="52" text-anchor="middle" font-size="17" font-weight="bold" fill="#2D3748">${drive.from || '家'}</text>
  </g>
  <g transform="translate(710,110)">
    <circle r="26" fill="#7CDB6E" stroke="#4CAF50" stroke-width="4"/>
    <text y="8" text-anchor="middle" font-size="24">📍</text>
    <text y="-40" text-anchor="middle" font-size="18" font-weight="bold" fill="#2D3748">${drive.to}</text>
  </g>
  <g transform="translate(400,238) rotate(-8)">
    <rect x="-34" y="-16" width="68" height="18" rx="8" fill="#FF6B6B"/>
    <path d="M-22 -16 L -13 -28 H 12 L 21 -16 Z" fill="#FF6B6B"/>
    <rect x="-11" y="-26" width="10" height="10" rx="2" fill="#BDE8FF"/>
    <rect x="3" y="-26" width="10" height="10" rx="2" fill="#BDE8FF"/>
    <circle cx="-19" cy="4" r="8" fill="#2D3748"/><circle cx="19" cy="4" r="8" fill="#2D3748"/>
  </g>
  <g transform="translate(400,60)">
    <rect x="-130" y="-32" width="260" height="56" rx="16" fill="#fff" stroke="#FFA94D" stroke-width="4"/>
    <text y="6" text-anchor="middle" font-size="22" font-weight="bold" fill="#2D3748">🚗 ${drive.time} · 约 ${drive.km} 公里</text>
  </g>
  <g transform="translate(745,55)">
    <circle r="24" fill="#fff" stroke="#4A5568" stroke-width="3"/>
    <path d="M0 -14 L 6 6 L 0 2 L -6 6 Z" fill="#FF6B6B"/>
    <text y="-30" text-anchor="middle" font-size="14" font-weight="bold" fill="#4A5568">北</text>
  </g>
  <text x="400" y="326" text-anchor="middle" font-size="13" fill="#718096">示意图 · 运行 route-pipeline 生成真实地理路线图</text>
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
    const labelY = y + (i % 2 === 0 ? 58 : -40);
    const actY = y + (i % 2 === 0 ? 78 : -58);
    const icon = p.icon || (isStart ? '🚩' : isEnd ? '🏁' : '⭐');
    return `
    <g transform="translate(${x},${y})">
      <circle r="24" fill="${isStart ? '#FFD93D' : isEnd ? '#7CDB6E' : '#fff'}" stroke="#FF8A65" stroke-width="4"/>
      <text y="8" text-anchor="middle" font-size="22">${icon}</text>
      <circle cx="20" cy="-20" r="13" fill="#FF6B6B"/>
      <text x="20" y="-15" text-anchor="middle" font-size="15" font-weight="bold" fill="#fff">${i + 1}</text>
      <text y="${labelY}" text-anchor="middle" font-size="16" font-weight="bold" fill="#2D3748">${p.name}</text>
      ${p.act ? `<text y="${actY}" text-anchor="middle" font-size="14" fill="#E85D3D" font-weight="bold">${p.act}</text>` : ''}
    </g>`;
  }).join('');
  return `
<svg viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="徒步路线示意图">
  <rect width="800" height="420" rx="20" fill="#F3FBEF"/>
  <path d="M0 120 Q 140 60 280 110 T 800 90 V 0 H 0 Z" fill="#DFF2D8"/>
  <path d="${d}" fill="none" stroke="#E9D8A6" stroke-width="18" stroke-linecap="round"/>
  <path d="${d}" fill="none" stroke="#B08948" stroke-width="4" stroke-dasharray="3 14" stroke-linecap="round"/>
  ${wp}
  <g transform="translate(400,40)">
    <rect x="-200" y="-26" width="400" height="52" rx="16" fill="#fff" stroke="#7CDB6E" stroke-width="4"/>
    <text y="7" text-anchor="middle" font-size="20" font-weight="bold" fill="#2D3748">🥾 ${hike.title}${hike.length ? ' · ' + hike.length : ''}</text>
  </g>
  <text x="400" y="404" text-anchor="middle" font-size="13" fill="#718096">示意图 · 运行 route-pipeline 生成真实地理路线图</text>
</svg>`;
}

/* ---------- 对外接口：优先真实数据，回退示意图 ---------- */
function routeData(planId) {
  return (typeof ROUTES !== 'undefined' && ROUTES[planId]) || null;
}

function driveMapSVG(plan) {
  const r = routeData(plan.id);
  if (r && r.drive && r.drive.polyline && r.drive.polyline.length >= 2) return realDriveMap(r.drive);
  return schematicDriveMap(plan.drive);
}

function hikeMapSVG(plan) {
  const r = routeData(plan.id);
  if (r && r.hike && r.hike.spots && r.hike.spots.length) return realHikeMap(r.hike);
  if (!plan.hike) return '';
  return schematicHikeMap(plan.hike);
}
