const assert = require('node:assert/strict');
const test = require('node:test');
const { newMilestones, computeStats, contentOf } = require('../utils/badges');

test('新增里程碑只认后端徽章 ID，忽略规则满足与否、活动 ID 和未知 ID', () => {
  const result = newMilestones([
    { id: 'old', rule: { count: 1 } },
    { id: 'new', rule: { count: 999 } },
    { id: 'not_awarded', rule: { count: 1 } },
  ], [{ badge_id: 'old' }], [
    { badge_id: 'old' }, { badge_id: 'new' }, { badge_id: '2026-09-05' }, { badge_id: 'unknown' },
  ]);
  assert.deepEqual(result.map((m) => m.id), ['new']);
});

test('我的页统计继续逐次计算出行，保留覆盖内容、无徒步和露营晚数语义', () => {
  const snapshot = { theme: 'camp', day_names: ['第一天', '第二天', '第三天'], hike: { length: '约 2km' } };
  const trips = [
    { plan_id: 'same', snapshot, overrides: { hike: { length: '3.5km' } } },
    { plan_id: 'same', content: snapshot },
    { plan_id: 'indoor', content: { hike: null } },
    { plan_id: 'camp', content: { theme: 'campnight' } },
  ];
  assert.deepEqual(computeStats(trips), { count: 4, hikeKm: 5.5, campNights: 5 });
  assert.deepEqual(computeStats([]), { count: 0, hikeKm: 0, campNights: 0 });
  assert.deepEqual(contentOf({}), {});
});
