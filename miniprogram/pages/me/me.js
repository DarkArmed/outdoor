const api = require('../../utils/api');
const auth = require('../../utils/auth');
const badges = require('../../utils/badges');

Page({
  data: {
    user: null,
    joinedAt: '',
    stats: { count: 0, hikeKm: 0, campNights: 0 },
    badgeCells: [],
    hasProfile: false,
    profileRows: [],
  },

  onShow() {
    getApp().ensureLogin().then((ok) => {
      if (ok) this.load();
    });
  },

  load() {
    wx.showLoading({ title: '加载中…', mask: true });
    const app = getApp();
    const userP = app.globalData.user
      ? Promise.resolve(app.globalData.user)
      : api.fetchMe().then((me) => { app.globalData.user = me; return me; });
    // 404 = 未设置画像
    const profileP = api.fetchProfile().catch((e) => {
      if (!e || e.statusCode !== 404) console.error(e);
      return null;
    });
    Promise.all([userP, api.fetchTrips(), api.fetchMilestones(), api.fetchMyBadges(), profileP])
      .then(([user, trips, milestones, myBadges, profile]) => {
        const doneTrips = (trips || []).filter((t) => t.status === 'done');
        const cells = this.buildBadgeCells(doneTrips, milestones, myBadges);
        this.setData({
          user,
          joinedAt: (user.created_at || '').toString().slice(0, 10) || '—',
          stats: badges.computeStats(doneTrips),
          badgeCells: cells,
          hasProfile: !!profile,
          profileRows: this.buildProfileRows(profile),
        });
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
      })
      .then(() => wx.hideLoading());
  },

  // 活动徽章（已完成出行的 content.badge，按名去重）+ 里程碑（未解锁置灰）
  buildBadgeCells(doneTrips, milestones, myBadges) {
    const seen = new Set();
    const cells = [];
    (doneTrips || []).forEach((t) => {
      // 列表/详情外的 TripOut 可能无 content，走合并逻辑；badge 可能为 null
      const b = badges.contentOf(t).badge;
      if (b && b.name && !seen.has(b.name)) {
        seen.add(b.name);
        cells.push({ icon: b.icon, name: b.name, unlocked: true, milestone: false });
      }
    });
    const unlockedIds = new Set((myBadges || []).map((b) => b.badge_id));
    (milestones || []).forEach((m) => {
      cells.push({ icon: m.icon, name: m.name, unlocked: unlockedIds.has(m.id), milestone: true });
    });
    return cells;
  },

  // WXML 不支持 join 等方法调用，这里预拼好展示字符串
  buildProfileRows(profile) {
    if (!profile) return [];
    const rows = [];
    const travelers = profile.family_travelers || [];
    if (travelers.length) rows.push(`👨‍👩‍👦 出行成员：${travelers.join('、')}`);
    if (profile.child) {
      const age = new Date().getFullYear() - (profile.child.birthYear || new Date().getFullYear());
      rows.push(`🧒 孩子：${profile.child.name || '—'}（${age} 岁）`);
    }
    if (profile.home_name) rows.push(`📍 出发地：${profile.home_name}（${profile.home_city || '—'}）`);
    const prefs = profile.prefs || {};
    if (prefs.maxDriveHoursOneWay) rows.push(`🚗 单程车程上限：${prefs.maxDriveHoursOneWay} 小时`);
    if (prefs.availableDays && prefs.availableDays.length) rows.push(`📆 可出行：${prefs.availableDays.join('、')}`);
    if (prefs.activityTypes && prefs.activityTypes.length) rows.push(`🏕️ 活动偏好：${prefs.activityTypes.join('、')}`);
    return rows;
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能同步数据，确定吗？',
      success: (res) => {
        if (res.confirm) auth.logout();
      },
    });
  },
});
