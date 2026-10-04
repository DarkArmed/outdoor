// 已完成出行的内容（snapshot + overrides 合并结果；详情接口直接给 content）
function contentOf(trip) {
  if (trip.content) return trip.content;
  if (trip.snapshot) return Object.assign({}, trip.snapshot, trip.overrides || {});
  return {};
}

function firstNumber(text) {
  const m = /(\d+(?:\.\d+)?)/.exec(String(text || ''));
  return m ? parseFloat(m[1]) : 0;
}

// 仅展示后端新颁发的里程碑，不在客户端重复评估或写入授奖结果。
function newMilestones(milestones, beforeBadges, afterBadges) {
  const before = new Set((beforeBadges || []).map((b) => b.badge_id));
  const after = new Set((afterBadges || []).map((b) => b.badge_id));
  return (milestones || []).filter((m) => after.has(m.id) && !before.has(m.id));
}

// 统计：已冒险次数 / 徒步 km（hike.length 首个数字求和）/ 露营晚数
function computeStats(doneTrips) {
  let hikeKm = 0;
  let campNights = 0;
  (doneTrips || []).forEach((t) => {
    const c = contentOf(t);
    hikeKm += firstNumber(c.hike && c.hike.length);
    if (c.theme === 'camp' || c.theme === 'campnight') {
      const days = (c.day_names && c.day_names.length) || 0;
      campNights += days > 1 ? days - 1 : 1;
    }
  });
  return { count: (doneTrips || []).length, hikeKm, campNights };
}

module.exports = { newMilestones, computeStats, contentOf };
