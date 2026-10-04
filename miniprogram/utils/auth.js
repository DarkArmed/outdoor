const api = require('./api');

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function saveLogin(token, user) {
  wx.setStorageSync(TOKEN_KEY, token || '');
  wx.setStorageSync(USER_KEY, user || null);
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.token = token || '';
    app.globalData.user = user || null;
  }
}

// 清本地登录态（服务端 token 自然过期，无登出端点）
function clearLogin() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.token = '';
    app.globalData.user = null;
  }
}

// wx.login 拿 code → 后端换 token；nickname 可选（后端默认「微信用户」）
function requestLogin(nickname) {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('微信登录失败：未获取到 code'));
          return;
        }
        api.loginWechat({ code: res.code, nickname })
          .then((data) => {
            saveLogin(data.access_token, data.user);
            resolve(data.user);
          })
          .catch(reject);
      },
      fail() {
        reject(new Error('微信登录失败，请检查网络后重试'));
      },
    });
  });
}

// 用户主动登录（登录页按钮）
function login(nickname) {
  return requestLogin(nickname);
}

// 静默重登：UI 无感，先清旧 token 再换 code；失败抛错由调用方决定后续
function silentRelogin() {
  wx.removeStorageSync(TOKEN_KEY);
  const app = getApp();
  if (app && app.globalData) app.globalData.token = '';
  return requestLogin();
}

// 退出登录：清本地态并回登录页
function logout() {
  clearLogin();
  wx.reLaunch({ url: '/pages/login/login' });
}

module.exports = { getToken, login, silentRelogin, logout, clearLogin };
