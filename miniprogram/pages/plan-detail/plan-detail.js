const api = require('../../utils/api');
const { flatGear, typeClass } = require('../../utils/plan');

Page({
  data: {
    plan: null,
    days: [],
    gearBase: [],
    gearSpecial: [],
    taskRows: [],
    joinedTripId: '',
    showJoin: false,
    joinDate: '',
    typeCls: '',
  },

  onLoad(options) {
    this.planId = (options && options.planId) || '';
    getApp().ensureLogin().then((ok) => {
      if (ok) this.load();
    });
  },

  load() {
    wx.showLoading({ title: '加载中…', mask: true });
    Promise.all([api.fetchPlan(this.planId), api.fetchTrips()])
      .then(([plan, trips]) => {
        const gear = flatGear(plan.gear);
        const joined = (trips || []).find((t) => t.plan_id === plan.id);
        this.setData({
          plan,
          days: this.buildDays(plan),
          gearBase: gear.filter((g) => g.group === 'base'),
          gearSpecial: gear.filter((g) => g.group === 'special'),
          taskRows: (plan.tasks || []).map((text, idx) => ({ text, idx })),
          joinedTripId: joined ? joined.id : '',
          joinDate: this.defaultDate(plan),
          typeCls: typeClass(plan.type),
        });
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
      })
      .then(() => wx.hideLoading());
  },

  // 行程：多日方案 itinerary 为数组的数组，配 day_names；单日为对象数组
  buildDays(plan) {
    const itinerary = plan.itinerary || [];
    const names = plan.day_names || plan.dayNames || [];
    if (Array.isArray(itinerary[0])) {
      return itinerary.map((items, i) => ({ name: names[i] || `第 ${i + 1} 天`, items }));
    }
    return itinerary.length ? [{ name: '', items: itinerary }] : [];
  },

  // 默认出发日期：plan.id 前缀 YYYY-MM-DD 合法则用它，否则今天
  defaultDate(plan) {
    const id = String((plan && plan.id) || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return id;
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  },

  openJoin() {
    this.setData({ showJoin: true, joinDate: this.data.joinDate || this.defaultDate(this.data.plan) });
  },
  closeJoin() { this.setData({ showJoin: false }); },
  noop() {},
  onJoinDateChange(e) { this.setData({ joinDate: e.detail.value }); },

  confirmJoin() {
    if (this._joining) return;
    this._joining = true;
    api.createTrip({ plan_id: this.planId, planned_date: this.data.joinDate })
      .then((trip) => {
        this.setData({ showJoin: false, joinedTripId: (trip && trip.id) || '' });
        wx.showToast({ title: '已加入我的出行', icon: 'success' });
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' });
      })
      .then(() => { this._joining = false; });
  },

  goTrip() {
    if (!this.data.joinedTripId) return;
    wx.navigateTo({ url: `/pages/trip-detail/trip-detail?tripId=${this.data.joinedTripId}` });
  },
});
