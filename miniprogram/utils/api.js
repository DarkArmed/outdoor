const config = require('../config');

// 从 FastAPI 错误响应里提取可读信息
function errorMessage(res) {
  const d = res.data;
  if (d && typeof d.detail === 'string') return d.detail;
  if (d && Array.isArray(d.detail) && d.detail.length && d.detail[0]) {
    return d.detail[0].msg || '请求参数有误';
  }
  return `请求失败（${res.statusCode}）`;
}

// 统一请求封装：自动注入 token；401 → 静默重登一次并重放原请求；再失败 reject
// auth=false 的接口（登录）不注入 token、不重登
function request({ path, method = 'GET', data, auth = true, replay = true }) {
  return new Promise((resolve, reject) => {
    const header = { 'content-type': 'application/json' };
    if (auth) {
      const token = require('./auth').getToken();
      if (token) header.Authorization = `Bearer ${token}`;
    }
    wx.request({
      url: config.apiBaseUrl + path,
      method,
      data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        if (res.statusCode === 401 && auth && replay) {
          require('./auth').silentRelogin()
            .then(() => request({ path, method, data, auth, replay: false }))
            .then(resolve, reject);
          return;
        }
        const err = new Error(errorMessage(res));
        err.statusCode = res.statusCode;
        reject(err);
      },
      fail() {
        reject(new Error('网络异常，请确认后端已启动'));
      },
    });
  });
}

module.exports = {
  request,
  // 认证
  loginWechat: ({ code, nickname } = {}) => request({
    path: '/api/auth/wechat/miniapp',
    method: 'POST',
    data: { code, nickname },
    auth: false,
  }),
  fetchMe: () => request({ path: '/api/auth/me' }),
  // 方案
  fetchPlans: (archived) => request({
    path: archived === undefined ? '/api/plans' : `/api/plans?archived=${archived}`,
  }),
  fetchPlan: (planId) => request({ path: `/api/plans/${planId}` }),
  // 出行
  fetchTrips: () => request({ path: '/api/trips' }),
  fetchTrip: (tripId) => request({ path: `/api/trips/${tripId}` }),
  createTrip: (data) => request({ path: '/api/trips', method: 'POST', data }),
  updateTrip: (tripId, data) => request({ path: `/api/trips/${tripId}`, method: 'PUT', data }),
  deleteTrip: (tripId) => request({ path: `/api/trips/${tripId}`, method: 'DELETE' }),
  fetchRoute: (tripId) => request({ path: `/api/trips/${tripId}/route` }),
  // 装备 / 任务勾选（单项数组提交，失败由页面回滚）
  fetchGearStates: (tripId) => request({ path: `/api/trips/${tripId}/gear` }),
  updateGearStates: (tripId, items) => request({ path: `/api/trips/${tripId}/gear`, method: 'PUT', data: { items } }),
  fetchTaskStates: (tripId) => request({ path: `/api/trips/${tripId}/tasks` }),
  updateTaskStates: (tripId, items) => request({ path: `/api/trips/${tripId}/tasks`, method: 'PUT', data: { items } }),
  // 打卡 / 徽章 / 里程碑
  checkin: (tripId) => request({ path: `/api/trips/${tripId}/checkin`, method: 'POST' }),
  unlockBadge: (tripId, badgeId) => request({
    path: `/api/trips/${tripId}/badges/${encodeURIComponent(badgeId)}`,
    method: 'POST',
  }),
  fetchMilestones: () => request({ path: '/api/milestones' }),
  fetchMyBadges: () => request({ path: '/api/me/badges' }),
  // 画像（404 = 未设置）
  fetchProfile: () => request({ path: '/api/profile' }),
};
