// 已完成出行的内容（snapshot + overrides 合并结果；详情接口直接给 content）
function contentOf(trip) {
  if (trip.content) return trip.content;
  if (trip.snapshot) return Object.assign({}, trip.snapshot, trip.overrides || {});
  return {};
}

function typeLetter(content) {
  return (content.type || '').toString().trim().charAt(0).toUpperCase();
}

function firstNumber(text) {
  const m = /(\d+(?:\.\d+)?)/.exec(String(text || ''));
  return m ? parseFloat(m[1]) : 0;
}

// 本地评估里程碑：返回满足规则且尚未解锁的里程碑数组
// rule 三选一：{firstType:'C'} 首个完成的该型 / {count:N} 累计 N 次 / {minKm:N} 单程 ≥N km
function evalMilestones(milestones, doneTrips, unlockedIds) {
  const unlocked = new Set(unlockedIds || []);
  const contents = (doneTrips || []).map(contentOf);
  return (milestones || []).filter((m) => {
    if (unlocked.has(m.id)) return false;
    const rule = m.rule || {};
    if (rule.firstType) {
      const letter = String(rule.firstType).toUpperCase();
      return contents.some((c) => typeLetter(c) === letter);
    }
    if (rule.count) return contents.length >= rule.count;
    if (rule.minKm) {
      return contents.some((c) => c.drive && Number(c.drive.km) >= rule.minKm);
    }
    return false;
  });
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

module.exports = { evalMilestones, computeStats, contentOf };
