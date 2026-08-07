/* sync-profile.js — 把 config/profile.json 转成网站可用的 site/js/data/profile.js
 * （file:// 协议读不了 JSON，网站只加载 JS 数据文件）
 * 用法: node tools/sync-profile.js
 * profile.json 与 profile.js 均已 gitignore，可随时重建。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'config', 'profile.json');
const OUT = path.join(ROOT, 'site', 'js', 'data', 'profile.js');

if (!fs.existsSync(SRC)) {
  console.error('❌ 缺少 config/profile.json。请照 config/profile.example.json 抄一份并填真实值。');
  process.exit(1);
}

const profile = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const header = `/* profile.js — 由 tools/sync-profile.js 生成，请勿手改（源: config/profile.json，gitignore）\n * 生成于 ${new Date().toISOString()} */\n`;
fs.writeFileSync(OUT, header + `var PROFILE = ${JSON.stringify(profile, null, 1)};\n`);
console.log(`💾 已写入 ${path.relative(ROOT, OUT)}`);
