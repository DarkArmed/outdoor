const auth = require('./utils/auth');

App({
  globalData: {
    user: null,
    token: '',
    profile: null,
  },

  onLaunch() {
    this.globalData.token = auth.getToken();
    if (this.globalData.token) {
      // 有 token 先验证；失败静默重登一次，再失败清 token 跳登录页
      this._restoreLogin();
    }
  },

  // 恢复登录态：/api/auth/me 校验，失效则静默重登，最终失败清本地态并跳登录页
  _restoreLogin() {
    if (this._restorePromise) return this._restorePromise;
    const api = require('./utils/api');
    this._restorePromise = api.fetchMe()
      .then((me) => {
        this.globalData.user = me;
        return true;
      })
      .catch(() => auth.silentRelogin()
        .then((user) => {
          this.globalData.user = user;
          return true;
        })
        .catch(() => {
          auth.clearLogin();
          wx.reLaunch({ url: '/pages/login/login' });
          return false;
        }));
    return this._restorePromise;
  },

  // 页面 onShow 时 await：已登录返回 true；未登录跳登录页并返回 false
  ensureLogin() {
    if (this.globalData.user) return Promise.resolve(true);
    if (!auth.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return Promise.resolve(false);
    }
    return this._restoreLogin();
  },
});
