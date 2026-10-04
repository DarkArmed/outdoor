const api = require('../../utils/api');
const { monthKey } = require('../../utils/plan');

// 无画像（404）时的兜底文案
const FALLBACK_HERO = {
  title: '我们的户外大冒险',
  subtitle: '一家人 · 每周末一次 · 向山野出发',
};

const SAFETY_RULES = [
  '天气不好不出门',
  '玩水必穿救生衣',
  '下坡慢点走',
  '渴了先喝水',
  '垃圾带回家',
];

Page({
  data: {
    heroTitle: FALLBACK_HERO.title,
    heroSubtitle: FALLBACK_HERO.subtitle,
    safetyRules: SAFETY_RULES,
    groups: [],
    archived: [],
    loading: true,
  },

  onShow() {
    getApp().ensureLogin().then((ok) => {
      if (ok) this.load();
    });
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh());
  },

  load(done) {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中…', mask: true });
    const profileP = api.fetchProfile().catch((e) => {
      if (!e || e.statusCode !== 404) console.error(e);
      return null;
    });
    Promise.all([profileP, api.fetchPlans(false), api.fetchPlans(true)])
      .then(([profile, active, backup]) => {
        getApp().globalData.profile = profile;
        const hero = this.buildHero(profile);
        this.setData({
          heroTitle: hero.title,
          heroSubtitle: hero.subtitle,
          groups: this.buildGroups(active),
          archived: backup || [],
          loading: false,
        });
      })
      .catch((err) => {
        this.setData({ loading: false });
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
      })
      .then(() => {
        wx.hideLoading();
        if (done) done();
      });
  },

  buildHero(profile) {
    if (!profile || !profile.child) return FALLBACK_HERO;
    const year = new Date().getFullYear();
    const childName = profile.child.name || '小宝';
    const age = year - (profile.child.birthYear || year);
    const travelers = (profile.family_travelers && profile.family_travelers.length)
      ? profile.family_travelers
      : ['全家'];
    const city = profile.home_city || '北京';
    return {
      title: `${childName}的户外大冒险`,
      subtitle: `${travelers[0]} + ${childName}（${age} 岁）· ${city}出发 · 每周末一次`,
    };
  },

  // 按月份分组（id 前 7 位），组内按 id 排序，「其他」排最后
  buildGroups(plans) {
    const map = {};
    (plans || []).forEach((p) => {
      const k = monthKey(p);
      (map[k] = map[k] || []).push(p);
    });
    const keys = Object.keys(map);
    const normal = keys.filter((k) => k !== '其他').sort();
    return normal.concat(keys.filter((k) => k === '其他')).map((k) => ({
      key: k,
      label: k === '其他' ? '其他' : `${parseInt(k.slice(5), 10)} 月`,
      plans: map[k].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    }));
  },

  onOpenPlan(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/plan-detail/plan-detail?planId=${id}` });
  },
});
