const auth = require('../../utils/auth');

Page({
  data: {
    loading: false,
    error: '',
  },

  // 已登录（如启动恢复成功后又回到本页）直接进计划库
  onShow() {
    if (getApp().globalData.user) {
      wx.switchTab({ url: '/pages/plans/plans' });
    }
  },

  onLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    auth.login()
      .then(() => {
        wx.showToast({ title: '登录成功', icon: 'success' });
        wx.switchTab({ url: '/pages/plans/plans' });
      })
      .catch((err) => {
        this.setData({ loading: false, error: (err && err.message) || '登录失败，请重试' });
      });
  },
});
