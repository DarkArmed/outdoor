/* overpass.js — 从 OpenStreetMap 抓取区域主要路网（Overpass API）
 * 输出：ways[{ name, ref, cls, polyline(GCJ-02) }]，cls ∈ motorway|trunk|primary */
const { wgs2gcj } = require('./gcj');

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 抓取区域路网。bbox = [minLat, minLon, maxLat, maxLon]。失败抛错（调用方决定降级）
 *  注意：Overpass 会 406 拒绝默认 UA 的客户端，必须带自定义 User-Agent；用 POST 提交查询 */
async function fetchNetwork(bbox) {
  const query = `[out:json][timeout:120];
way["highway"~"^(motorway|trunk|primary)$"](${bbox.join(',')});
out geom;`;

  let lastErr;
  for (const mirror of MIRRORS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(mirror, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'outdoor-family-planner/1.0 (personal local project)',
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return parseWays(data);
      } catch (e) {
        lastErr = new Error(`${mirror}: ${e.message}`);
        await sleep(1500);
      }
    }
  }
  throw lastErr;
}

function parseWays(data) {
  const ways = [];
  for (const el of data.elements || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags || {};
    const polyline = el.geometry.map(n => {
      const [lon, lat] = wgs2gcj([n.lon, n.lat]);
      return [+lon.toFixed(5), +lat.toFixed(5)];
    });
    ways.push({
      name: tags.name || '',
      ref: tags.ref || '',
      cls: tags.highway,
      polyline,
    });
  }
  return ways;
}

module.exports = { fetchNetwork };
