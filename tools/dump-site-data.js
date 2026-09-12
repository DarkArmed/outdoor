// Dump existing site/js/data/*.js content as JSON to stdout.
// Usage: node tools/dump-site-data.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_JS = path.join(__dirname, '..', 'site', 'js');

function loadScript(ctx, name) {
  const p = path.join(SITE_JS, name);
  if (!fs.existsSync(p)) {
    console.error(`warn: ${p} not found, skipping`);
    return;
  }
  vm.runInNewContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
}

function loadDataScripts() {
  const ctx = {};
  const scripts = [
    'scenes.js',
    'maps.js',
    'data/profile.js',
    'data/data-a.js',
    'data/data-b.js',
    'data/data-c.js',
    'data/data-d.js',
    'data/routes.js',
    'data/network.js',
  ];
  for (const s of scripts) {
    loadScript(ctx, s);
  }
  return {
    profile: ctx.PROFILE || null,
    plans: ctx.PLANS || [],
    milestones: ctx.MILESTONES || [],
    routes: ctx.ROUTES || {},
    network: ctx.NETWORK || null,
  };
}

console.log(JSON.stringify(loadDataScripts(), null, 2));
