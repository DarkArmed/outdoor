// gear 扁平索引：按对象键序 base→special 展开，idx 为全局下标
// 与网站 localStorage 约定（gear:<planId>:<idx>）一致
function flatGear(gear) {
  if (!gear) return [];
  const out = [];
  (gear.base || []).forEach((text) => {
    out.push({ group: 'base', text, idx: out.length });
  });
  (gear.special || []).forEach((text) => {
    out.push({ group: 'special', text, idx: out.length });
  });
  return out;
}

// 月份分组键：id 形如 2026-09-05 取前 7 位，否则归入「其他」
function monthKey(plan) {
  const id = plan && plan.id !== undefined ? String(plan.id) : '';
  return /^\d{4}-\d{2}/.test(id) ? id.slice(0, 7) : '其他';
}

// 类型徽章类名：取 type 首字母（如「A 溯溪玩水」→ type-A）
function typeClass(type) {
  const t = (type || '').toString().trim().charAt(0).toUpperCase();
  return /^[A-E]$/.test(t) ? `type-${t}` : '';
}

// 出行展示用日期：优先 planned_date，其次方案自带日期
function tripDate(trip) {
  if (!trip) return '';
  if (trip.planned_date) return trip.planned_date;
  const c = trip.content || {};
  return c.date || '';
}

module.exports = { flatGear, monthKey, typeClass, tripDate };
