/* amap.js — 高德 Web 服务 API 封装（带本地缓存，减少重复调用） */
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '.cache.json');
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (_) {}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 高德个人开发者 QPS 限制较低：限速 + 触发限流时退避重试。
 *  opts.soft: 这些 infocode 视为「无数据」返回 null（不缓存、不抛错） */
async function call(url, opts = {}) {
  if (cache[url]) return cache[url];
  const soft = opts.soft || [];
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(400 + attempt * 800);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const data = await res.json();
    if (data.status !== '1') {
      if (soft.includes(data.infocode)) return null;
      if (data.infocode === '10021') { lastErr = new Error(`高德 API 错误 10021: ${data.info}`); continue; }
      throw new Error(`高德 API 错误 ${data.infocode}: ${data.info}`);
    }
    cache[url] = data;
    saveCache();
    return data;
  }
  throw lastErr || new Error('请求失败（已达最大重试次数）');
}

/** 解析 "lon,lat;lon,lat" → [[lon, lat], ...] */
function parsePolyline(str) {
  return (str || '').split(';').filter(Boolean).map(p => p.split(',').map(Number));
}

function makeApi(key, defaultCity) {
  return {
    /** 地名 → [lon, lat]（GCJ-02）。依次尝试：地理编码(限城市) → 地理编码(全国) → POI 搜索。找不到返回 null */
    async geocode(address, cityOverride) {
      const cities = cityOverride ? [cityOverride, null] : [defaultCity, null];
      for (const c of cities) {
        const cityParam = c ? `&city=${encodeURIComponent(c)}` : '';
        const d = await call(`https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}${cityParam}&key=${key}`, { soft: ['30001'] });
        if (d && d.geocodes && d.geocodes.length && d.geocodes[0].location) {
          return d.geocodes[0].location.split(',').map(Number);
        }
        const cityLimit = c ? '&citylimit=true' : '';
        const p = await call(`https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(address)}${cityParam}${cityLimit}&key=${key}`, { soft: ['30001'] });
        if (p && p.pois && p.pois.length && p.pois[0].location) {
          return p.pois[0].location.split(',').map(Number);
        }
      }
      return null;
    },

    /** 驾车路径 → { polyline, steps, distance(km), duration(min) } */
    async driving(origin, dest) {
      const fmt = c => c.join(',');
      const u = `https://restapi.amap.com/v3/direction/driving?origin=${fmt(origin)}&destination=${fmt(dest)}&strategy=0&key=${key}`;
      const d = await call(u);
      const path0 = d.route.paths[0];
      let polyline = [];
      for (const step of path0.steps) {
        polyline = polyline.concat(parsePolyline(step.polyline));
      }
      return {
        polyline,
        steps: path0.steps,
        distance: Math.round(path0.distance / 100) / 10,
        duration: Math.round(path0.duration / 60),
      };
    },

    /** 步行路径 → [[lon,lat], ...]，无覆盖返回 null */
    async walking(origin, dest) {
      const fmt = c => c.join(',');
      const u = `https://restapi.amap.com/v3/direction/walking?origin=${fmt(origin)}&destination=${fmt(dest)}&key=${key}`;
      try {
        const d = await call(u);
        if (!d.route || !d.route.paths || !d.route.paths.length) return null;
        let polyline = [];
        for (const step of d.route.paths[0].steps) {
          polyline = polyline.concat(parsePolyline(step.polyline));
        }
        return polyline.length >= 2 ? polyline : null;
      } catch (_) { return null; }
    },
  };
}

module.exports = { makeApi, parsePolyline };
