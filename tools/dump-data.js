// Dump existing data/*.js content as JSON to stdout.
// Usage: node tools/dump-data.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadScript(ctx, name) {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) {
    console.error(`warn: ${p} not found, skipping`);
    return;
  }
  vm.runInNewContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
}

function loadDataScripts() {
  const ctx = {};
  const scripts = [
    'data-a.js',
    'data-b.js',
    'data-c.js',
    'data-d.js',
    'routes.js',
    'network.js',
  ];
  for (const s of scripts) {
    loadScript(ctx, s);
  }
  return {
    plans: ctx.PLANS || [],
    milestones: ctx.MILESTONES || [],
    routes: ctx.ROUTES || {},
    network: ctx.NETWORK || null,
  };
}

console.log(JSON.stringify(loadDataScripts(), null, 2));
