const api = require('../../utils/api');
const { contentOf } = require('../../utils/badges');

Page({
  data: {
    planned: [],
    done: [],
    loading: true,
    joining: false,
  },

  onShow() {
    getApp().ensureLogin().then((ok) => {
      if (ok) this.load();
    });
  },

  load() {
    this.setData({ loading: true });
    api.fetchTrips()
      .then((trips) => {
        // 列表接口无 content，用 snapshot+overrides 合并出渲染内容
        const all = (trips || []).map((t) => Object.assign({}, t, { content: contentOf(t) }));
        const byDate = (a, b) => String(a.planned_date || '').localeCompare(String(b.planned_date || ''));
        this.setData({
          planned: all.filter((t) => t.status !== 'done').sort(byDate),
          done: all.filter((t) => t.status === 'done').sort((a, b) => byDate(b, a)),
          loading: false,
        });
      })
      .catch((err) => {
        this.setData({ loading: false });
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
      });
  },

  onOpenTrip(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/trip-detail/trip-detail?tripId=${id}` });
  },

  joinAll() {
    if (this.data.joining) return;
    wx.showModal({
      title: '一键加入本赛季计划',
      content: '将为全部非归档方案创建出行，确认吗？',
      success: (res) => {
        if (res.confirm) this.doJoinAll();
      },
    });
  },

  doJoinAll() {
    this.setData({ joining: true });
    wx.showLoading({ title: '加入中…', mask: true });
    api.fetchPlans(false)
      .then(async (plans) => {
        let n = 0;
        for (const p of plans || []) {
          try {
            await api.createTrip({ plan_id: p.id });
            n += 1;
          } catch (e) {
            console.error(e);
          }
        }
        wx.hideLoading();
        this.setData({ joining: false });
        wx.showToast({ title: `已加入 ${n} 个出行`, icon: 'success' });
        this.load();
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ joining: false });
        wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' });
      });
  },
});
