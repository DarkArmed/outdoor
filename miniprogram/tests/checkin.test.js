const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const pageSource = fs.readFileSync(path.join(__dirname, '../pages/trip-detail/trip-detail.js'), 'utf8');
const badgeHelpers = require('../utils/badges');
const planHelpers = require('../utils/plan');

function createPage(overrides = {}) {
  const calls = [];
  const toasts = [];
  const errors = [];
  const before = [{ badge_id: 'old_milestone' }];
  const after = [...before, { badge_id: '2026-09-05' }, { badge_id: 'first_hike' }];
  let badgeReads = 0;
  const defaults = {
    fetchMyBadges: async () => (++badgeReads === 1 ? before : after),
    checkin: async () => ({ trip_id: 7 }),
    fetchMilestones: async () => [
      { id: 'old_milestone', name: '已有里程碑' },
      { id: 'first_hike', name: '首次徒步', rule: { firstType: 'A' } },
      { id: 'count_2', name: '两次冒险', rule: { count: 2 } },
    ],
    // 接口替身保留旧接口，用调用记录发现误发奖或又开始用出行数推算。
    unlockBadge: async () => ({}),
    fetchTrips: async () => [],
  };
  const api = {};
  for (const [name, fn] of Object.entries({ ...defaults, ...overrides })) {
    api[name] = (...args) => {
      calls.push({ name, args });
      return fn(...args);
    };
  }
  let page;
  vm.runInNewContext(pageSource, {
    Page: (definition) => { page = definition; },
    require: (name) => {
      if (name === '../../utils/api') return api;
      if (name === '../../utils/badges') return badgeHelpers;
      if (name === '../../utils/plan') return planHelpers;
      throw new Error(`Unexpected import: ${name}`);
    },
    wx: { showToast: (toast) => toasts.push(toast) },
    console: { error: (err) => errors.push(err) },
    setTimeout,
    clearTimeout,
  });
  page.data = {
    ...page.data,
    trip: { id: 7, plan_id: '2026-09-05', status: 'planned' },
    content: { badge: { icon: '🥾', name: '徒步小勇士' } },
    taskRows: [{ idx: 0, checked: true }, { idx: 1, checked: true }],
  };
  page.tripId = 7;
  page.setData = (values) => {
    for (const [key, value] of Object.entries(values)) {
      const keys = key.split('.');
      let target = page.data;
      for (const part of keys.slice(0, -1)) target = target[part];
      target[keys[keys.length - 1]] = value;
    }
  };
  return { page, calls, toasts, errors };
}

function names(calls) {
  return calls.map((call) => call.name);
}

test('首次里程碑用打卡前后集合差展示，不重复已有里程碑或按活动名称解锁', async () => {
  const { page, calls, toasts } = createPage();
  await page.doCheckin();

  assert.equal(page.data.trip.status, 'done');
  assert.equal(page.data.checking, false);
  assert.equal(page.data.celebrate.fullStar, true);
  assert.equal(page.data.celebrate.badge.name, '徒步小勇士');
  assert.deepEqual(page.data.celebrate.newMilestones.map((m) => m.id), ['first_hike']);
  assert.deepEqual(names(calls), ['fetchMyBadges', 'checkin', 'fetchMilestones', 'fetchMyBadges']);
  assert.deepEqual(calls.find((call) => call.name === 'checkin').args, [7]);
  assert.equal(toasts.length, 0);
});

test('再次完成同一方案时不根据本地完成次数多发累计里程碑', async () => {
  const existing = [{ badge_id: '2026-09-05' }, { badge_id: 'first_hike' }];
  const { page, calls } = createPage({
    fetchMyBadges: async () => existing,
    fetchTrips: async () => [
      { id: 6, plan_id: '2026-09-05', status: 'done' },
      { id: 7, plan_id: '2026-09-05', status: 'done' },
    ],
  });
  page.data.taskRows = [];
  await page.doCheckin();

  assert.equal(page.data.celebrate.newMilestones.length, 0);
  assert.equal(page.data.celebrate.fullStar, false);
  assert.equal(names(calls).includes('unlockBadge'), false);
  assert.equal(names(calls).includes('fetchTrips'), false);
});

test('请求进行中及完成后的重复触发都只提交一次打卡', async () => {
  let resolveCheckin;
  let notifyStarted;
  const started = new Promise((resolve) => { notifyStarted = resolve; });
  const pending = new Promise((resolve) => { resolveCheckin = resolve; });
  const { page, calls } = createPage({
    checkin: () => { notifyStarted(); return pending; },
  });
  const first = page.doCheckin();
  await started;
  assert.equal(page.data.checking, true);
  await page.doCheckin();
  resolveCheckin({ trip_id: 7 });
  await first;
  await page.doCheckin();

  assert.equal(names(calls).filter((name) => name === 'checkin').length, 1);
  assert.equal(names(calls).filter((name) => name === 'fetchMyBadges').length, 2);
  assert.equal(page.data.trip.status, 'done');
});

test('打卡失败保持原状态且允许重试，不展示成功弹窗', async () => {
  let attempts = 0;
  const { page, calls, toasts } = createPage({
    checkin: async () => {
      if (++attempts === 1) throw new Error('网络连接中断');
      return { trip_id: 7 };
    },
  });
  await page.doCheckin();
  assert.equal(page.data.trip.status, 'planned');
  assert.equal(page.data.checking, false);
  assert.equal(page.data.celebrate, null);
  assert.equal(toasts[0].title, '网络连接中断');
  assert.deepEqual(names(calls), ['fetchMyBadges', 'checkin']);

  await page.doCheckin();
  assert.equal(attempts, 2);
  assert.equal(page.data.trip.status, 'done');
  assert.ok(page.data.celebrate);
});

for (const failedRequest of ['fetchMyBadges', 'fetchMilestones']) {
  test(`打卡成功后 ${failedRequest} 刷新失败仍显示完成，不诱导重复打卡`, async () => {
    let reads = 0;
    const failure = async () => { throw new Error('徽章读取失败'); };
    const overrides = failedRequest === 'fetchMyBadges'
      ? { fetchMyBadges: async () => (++reads === 1 ? [] : failure()) }
      : { fetchMilestones: failure };
    const { page, calls, toasts } = createPage(overrides);
    await page.doCheckin();

    assert.equal(page.data.trip.status, 'done');
    assert.equal(page.data.checking, false);
    assert.ok(page.data.celebrate);
    assert.equal(page.data.celebrate.newMilestones.length, 0);
    assert.match(toasts[0].title, /打卡已完成/);
    await page.doCheckin();
    assert.equal(names(calls).filter((name) => name === 'checkin').length, 1);
    assert.equal(names(calls).includes('unlockBadge'), false);
  });
}

test('打卡前徽章读取失败不阻止打卡，也不将未知的旧徽章当作新增', async () => {
  const { page, calls, toasts } = createPage({
    fetchMyBadges: async () => { throw new Error('读取超时'); },
  });
  await page.doCheckin();

  assert.equal(page.data.trip.status, 'done');
  assert.equal(page.data.checking, false);
  assert.equal(page.data.celebrate.newMilestones.length, 0);
  assert.match(toasts[0].title, /打卡已完成/);
  assert.deepEqual(names(calls), ['fetchMyBadges', 'checkin']);
});
