/* ============================================================
   app.js — 页面渲染逻辑
   首页：时间轴 + 计划卡片；详情页：?id= 渲染完整计划，
   装备勾选存 localStorage。
   ============================================================ */

/* 类型徽标配色 key */
function typeClass(type) {
  if (type.startsWith('A')) return 'type-A';
  if (type.startsWith('B')) return 'type-B';
  if (type.startsWith('C')) return 'type-C';
  if (type.startsWith('E')) return 'type-E';
  return 'type-D';
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- 用户配置：站名 + 头图副标题（无 profile.js 时保留 HTML 静态文案） ---------- */
function siteTitle() {
  if (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.child && PROFILE.child.name)
    return `${PROFILE.child.name}的户外大冒险`;
  return '我们的户外大冒险';
}

function heroSubtitle() {
  if (typeof PROFILE === 'undefined' || !PROFILE || !PROFILE.child) return null;
  const age = PROFILE.child.birthYear ? new Date().getFullYear() - PROFILE.child.birthYear : null;
  const kid = PROFILE.child.name ? `${PROFILE.child.name}${age != null ? `（${age} 岁）` : ''}` : '小勇士';
  const who = (PROFILE.family && PROFILE.family.travelers && PROFILE.family.travelers[0]) || '爸爸';
  const city = (PROFILE.home && PROFILE.home.city) || '北京';
  return `${who} + ${kid} · ${city}出发 · 每周末一次`;
}

/* ---------- 首页：左侧月份时间轴 + 按月分行 ---------- */
function renderHome() {
  const heroEl = document.getElementById('hero-scene');
  if (heroEl) heroEl.innerHTML = sceneSVG('hero');
  const h1El = document.getElementById('hero-title');
  if (h1El) h1El.textContent = '🏕️ ' + siteTitle();
  const subEl = document.getElementById('hero-subtitle');
  const sub = heroSubtitle();
  if (subEl && sub) subEl.textContent = sub;

  const MONTHS = [
    { key: '2026-09', label: '9 月',  cls: 'rail-sep', desc: '溯溪玩水 · 首次露营' },
    { key: '2026-10', label: '10 月', cls: 'rail-oct', desc: '赏秋徒步 · 秋游兜风' },
    { key: '2026-11', label: '11 月', cls: 'rail-nov', desc: '收官露营 · 转室内' },
    { key: '2026-12', label: '12 月', cls: 'rail-dec', desc: '滑雪观鸟 · 冰雪户外' },
  ];
  const active = PLANS.filter(p => !p.archived).slice().sort((a, b) => a.id.localeCompare(b.id));
  const archived = PLANS.filter(p => p.archived);

  const card = p => `
    <a class="plan-card" href="plan.html?id=${p.id}">
      <div class="art">${sceneSVG(p.theme, p.mom)}</div>
      <div class="body">
        <div class="title">${p.emoji} ${esc(p.title)}</div>
        <div class="badges">
          <span class="badge ${typeClass(p.type)}">${esc(p.type)}</span>
          <span class="badge">🗓️ ${esc(p.date)}</span>
          <span class="badge">📍 ${esc(p.location)}</span>
          <span class="badge">🚗 ${esc(p.drive.time)}</span>
          ${p.mom ? '<span class="badge badge-mom">👩 妈妈同行</span>' : ''}
        </div>
      </div>
    </a>`;

  /* 左侧时间轴：只保留月份节点（点 + 线 + 月份 + 主题词） */
  document.getElementById('month-rail').innerHTML = MONTHS.map(m => `
    <a class="tl-node ${m.cls}" href="#m-${m.key}">
      <div class="tl-month">${m.label}</div>
      <div class="tl-desc">${m.desc}</div>
    </a>`).join('');

  /* 每月一行 */
  document.getElementById('month-rows').innerHTML = MONTHS.map(m => {
    const list = active.filter(p => p.id.startsWith(m.key));
    return `<section class="month-row" id="m-${m.key}">
      <h2>${m.label} · ${m.desc}</h2>
      <div class="row-scroll">${list.map(card).join('')}</div>
    </section>`;
  }).join('');

  const archEl = document.getElementById('archive-grid');
  archEl.innerHTML = archived.length ? archived.map(card).join('') : '<p class="muted">暂无</p>';
}

/* ---------- 详情页 ---------- */
function gearKey(planId, idx) { return `gear:${planId}:${idx}`; }

function loadGearState(plan, root) {
  const items = root.querySelectorAll('.gear-item');
  let done = 0;
  items.forEach((el, i) => {
    const cb = el.querySelector('input');
    const checked = localStorage.getItem(gearKey(plan.id, i)) === '1';
    cb.checked = checked;
    el.classList.toggle('done', checked);
    if (checked) done++;
    el.addEventListener('click', e => {
      if (e.target.tagName !== 'INPUT') cb.checked = !cb.checked;
      el.classList.toggle('done', cb.checked);
      localStorage.setItem(gearKey(plan.id, i), cb.checked ? '1' : '0');
      updateGearProgress(plan, root);
    });
  });
  updateGearProgress(plan, root);
}

function updateGearProgress(plan, root) {
  const items = root.querySelectorAll('.gear-item');
  const done = root.querySelectorAll('.gear-item.done').length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const bar = root.querySelector('.gear-progress > div');
  const txt = root.querySelector('.gear-progress-text');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = pct === 100 ? '🎉 全部准备好啦，出发！' : `已准备 ${done}/${items.length} 件`;
}

function renderPlan() {
  const root = document.getElementById('plan-detail');
  const id = new URLSearchParams(location.search).get('id');
  const p = PLANS.find(x => x.id === id);

  if (!p) {
    root.innerHTML = `<h2>😢 没找到这个计划</h2><p><a href="index.html">返回首页</a></p>`;
    return;
  }
  document.title = `${p.title} · ${siteTitle()}`;

  /* 行程（支持多天） */
  const days = Array.isArray(p.itinerary[0]) ? p.itinerary : [p.itinerary];
  const dayNames = p.dayNames || [];
  const itineraryHTML = days.map((items, di) => `
    ${days.length > 1 ? `<h3 class="it-day">📅 ${esc(dayNames[di] || '第 ' + (di + 1) + ' 天')}</h3>` : ''}
    <div class="itinerary">
      ${items.map((it, i) => `<div class="it-item lazy" style="transition-delay:${i * 45}ms"><span class="it-icon">${actIconSVG(it.text)}</span><div class="it-text"><span class="it-time">${esc(it.time)}</span>${esc(it.text)}</div></div>`).join('')}
    </div>`).join('');

  /* 装备 */
  const gearGroups = [
    { name: '🎒 基础装备（每次必带）', items: p.gear.base },
    { name: '⭐ 本周特需', items: p.gear.special },
  ];
  const gearHTML = `
    <div class="gear-progress"><div></div></div>
    <p class="gear-progress-text"></p>
    <div class="gear-section">
      ${gearGroups.map(g => `
        <div class="gear-group">
          <h3>${g.name}</h3>
          ${g.items.map(item => `
            <div class="gear-item"><input type="checkbox" tabindex="-1"><label>${esc(item)}</label></div>`).join('')}
        </div>`).join('')}
    </div>`;

  root.innerHTML = `
    <section class="detail-hero">
      ${sceneSVG(p.theme, p.mom)}
      <h1>${p.emoji} ${esc(p.title)}</h1>
      <div class="badges">
        <span class="badge ${typeClass(p.type)}">${esc(p.type)}</span>
        <span class="badge">🗓️ ${esc(p.date)}</span>
        <span class="badge">📍 ${esc(p.location)}</span>
        <span class="badge">🚗 ${esc(p.drive.time)}</span>
        ${p.mom ? '<span class="badge badge-mom">👩 妈妈同行</span>' : ''}
      </div>
    </section>

    <section class="lazy" id="sec-goal">
      <h2>🎯 本周目标</h2>
      <div class="goal-box">${esc(p.goal)}</div>
      ${p.tips && p.tips.length ? `<div class="tip-box"><strong>💡 爸爸的小抄：</strong><ul>${p.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    </section>

    <section class="lazy" id="sec-itinerary">
      <h2>🕐 行程安排</h2>
      ${itineraryHTML}
    </section>

    <section class="lazy" id="sec-maps">
      <h2>🗺️ 路线图</h2>
      <div class="map-block">
        <h3>🚗 自驾路线（家 → ${esc(p.drive.to)}）</h3>
        ${driveMapSVG(p)}
        <p class="map-note">真实地理数据（高德）卡通化渲染，可用于指路 · 导航仍推荐高德 App</p>
      </div>
      ${p.hike ? `
      <div class="map-block">
        <h3>🥾 ${esc(p.hike.title)}</h3>
        ${hikeMapSVG(p)}
        <p class="map-note">标注关键地点与活动事项 · 数字 = 停留顺序</p>
      </div>` : ''}
    </section>

    <section class="lazy" id="sec-gear">
      <h2>🎒 本周必带装备（点一下打勾）</h2>
      ${gearHTML}
    </section>

    <section class="lazy" id="sec-safety">
      <h2>🛡️ 安全要点</h2>
      <ul class="safety-list">${p.safety.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </section>

    <section class="lazy" id="sec-review">
      <h2>📝 回来以后聊一聊</h2>
      <div class="review-box"><ul>
        ${(p.review || []).map(r => `<li>${esc(r)}</li>`).join('')}
      </ul></div>
    </section>
  `;

  /* 区块导航：内容顶部胶囊横条 */
  const NAV = [
    ['sec-goal', '🎯 目标'], ['sec-itinerary', '🕐 行程'], ['sec-maps', '🗺️ 路线'],
    ['sec-gear', '🎒 装备'], ['sec-safety', '🛡️ 安全'], ['sec-review', '📝 回顾'],
  ];
  const snav = `<nav class="snav">${NAV.map(([id, label]) =>
    `<a class="snav-item" href="#${id}">${label}</a>`).join('')}</nav>`;
  const heroEl = root.querySelector('.detail-hero');
  heroEl.insertAdjacentHTML('afterend', snav);

  /* 左侧：全赛季周计划时间轴（点 · 线 · 日期 · 缩略图，当前周高亮） */
  const shortDate = id => { const [, mm, dd] = id.split('-'); return `${parseInt(mm, 10)}/${parseInt(dd, 10)}`; };
  const weeks = PLANS.filter(x => !x.archived).slice().sort((a, b) => a.id.localeCompare(b.id));
  document.getElementById('detail-rail').innerHTML = weeks.map(w => `
    <a class="tl-week${w.id === p.id ? ' current' : ''}" href="plan.html?id=${w.id}">
      <span class="tl-date">${shortDate(w.id)}</span>
      <div class="tl-thumb">${sceneSVG(w.theme, w.mom)}</div>
      <div class="tl-week-title">${esc(w.title)}</div>
    </a>`).join('');

  loadGearState(p, root);
  setupLazy(root);
}

/* ---------- 滚动懒加载 + 导航高亮 ---------- */
function setupLazy(root) {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }), { threshold: 0.1 });
  root.querySelectorAll('.lazy').forEach(el => io.observe(el));

  const links = [...document.querySelectorAll('.snav-item')];
  const so = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) {
      links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
    }
  }), { rootMargin: '-30% 0px -60% 0px' });
  root.querySelectorAll('section.lazy[id]').forEach(el => so.observe(el));
}

/* ---------- 入口 ---------- */
if (document.getElementById('month-rows')) renderHome();
if (document.getElementById('plan-detail')) renderPlan();
