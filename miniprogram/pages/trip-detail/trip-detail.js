const api = require('../../utils/api');
const { flatGear, typeClass } = require('../../utils/plan');
const badges = require('../../utils/badges');

Page({
  data: {
    trip: null,
    content: {},
    days: [],
    gearBase: [],
    gearSpecial: [],
    gearChecked: {},
    gearDone: 0,
    gearTotal: 0,
    gearPct: 0,
    taskRows: [],
    hasRoute: false,
    route: null,
    mapCenter: { longitude: 116.397, latitude: 39.908 },
    mapScale: 10,
    markers: [],
    polylines: [],
    capsules: [],
    activeCap: '',
    scrollTo: '',
    typeCls: '',
    holding: false,
    checking: false,
    celebrate: null,
  },

  onLoad(options) {
    this.tripId = (options && options.tripId) || '';
    getApp().ensureLogin().then((ok) => {
      if (ok) this.load();
    });
  },

  load() {
    wx.showLoading({ title: '加载中…', mask: true });
    // gear/tasks/route 失败不阻塞主内容；route 404 = 无路线数据
    const gearP = api.fetchGearStates(this.tripId).catch((e) => {
      if (!e || e.statusCode !== 404) console.error(e);
      return [];
    });
    const taskP = api.fetchTaskStates(this.tripId).catch((e) => {
      if (!e || e.statusCode !== 404) console.error(e);
      return [];
    });
    const routeP = api.fetchRoute(this.tripId).catch((e) => {
      if (!e || e.statusCode !== 404) console.error(e);
      return null;
    });
    Promise.all([api.fetchTrip(this.tripId), gearP, taskP, routeP])
      .then(([trip, gearStates, taskStates, route]) => {
        this.applyAll(trip, gearStates || [], taskStates || [], route);
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
      })
      .then(() => wx.hideLoading());
  },

  applyAll(trip, gearStates, taskStates, route) {
    const content = trip.content || {};
    const gear = flatGear(content.gear);
    const gearChecked = {};
    let gearDone = 0;
    gear.forEach((g) => {
      const st = gearStates.find((s) => s.item_idx === g.idx);
      const on = !!(st && st.checked);
      gearChecked[g.idx] = on;
      if (on) gearDone += 1;
    });
    const taskRows = (content.tasks || []).map((text, idx) => {
      const st = taskStates.find((s) => s.task_idx === idx);
      return { text, idx, checked: !!(st && st.checked) };
    });
    const setData = {
      trip,
      content,
      days: this.buildDays(content),
      gearBase: gear.filter((g) => g.group === 'base'),
      gearSpecial: gear.filter((g) => g.group === 'special'),
      gearChecked,
      gearDone,
      gearTotal: gear.length,
      gearPct: gear.length ? Math.round((gearDone / gear.length) * 100) : 0,
      taskRows,
      route: route || null,
      hasRoute: !!route,
      capsules: this.buildCapsules(content),
      typeCls: typeClass(content.type),
    };
    if (route) Object.assign(setData, this.buildMap(route));
    this.setData(setData);
    const first = setData.capsules[0];
    this.setData({ activeCap: first ? first.id : '' });
  },

  buildDays(content) {
    const itinerary = content.itinerary || [];
    const names = content.day_names || content.dayNames || [];
    if (Array.isArray(itinerary[0])) {
      return itinerary.map((items, i) => ({ name: names[i] || `第 ${i + 1} 天`, items }));
    }
    return itinerary.length ? [{ name: '', items: itinerary }] : [];
  },

  buildCapsules(content) {
    const caps = [];
    if (content.goal) caps.push({ id: 'goal', label: '🎯 目标' });
    if ((content.tasks || []).length) caps.push({ id: 'tasks', label: '🗡️ 任务' });
    if ((content.itinerary || []).length) caps.push({ id: 'itinerary', label: '🕐 行程' });
    caps.push({ id: 'route', label: '🗺️ 路线' });
    if (flatGear(content.gear).length) caps.push({ id: 'gear', label: '🎒 装备' });
    if ((content.safety || []).length) caps.push({ id: 'safety', label: '🛡️ 安全' });
    if ((content.review || []).length) caps.push({ id: 'review', label: '📝 回顾' });
    return caps;
  },

  // 后端坐标为 GCJ-02 [lng, lat] 数对 → <map> 需要 {latitude, longitude}
  buildMap(route) {
    const d = route.drive || {};
    const h = route.hike || {};
    const markers = [];
    const all = [];
    let seq = 0;
    const addMarker = (coord, text, icon, anchor, always) => {
      markers.push({
        id: ++seq,
        longitude: coord[0],
        latitude: coord[1],
        // iconPath 为 <map> marker 必填项，缺失真机上不渲染图标
        iconPath: icon.path,
        width: icon.w,
        height: icon.h,
        anchor,
        callout: {
          content: text,
          display: always ? 'ALWAYS' : 'BYCLICK',
          fontSize: 12,
          color: '#2D3748',
          bgColor: '#FFFFFF',
          padding: 6,
          borderRadius: 10,
        },
      });
    };
    const PIN = { path: '/assets/pin-home.png', w: 30, h: 36 };
    const PIN_DEST = { path: '/assets/pin-dest.png', w: 30, h: 36 };
    const DOT_BLUE = { path: '/assets/dot-blue.png', w: 28, h: 28 };
    const DOT_GREEN = { path: '/assets/dot-green.png', w: 28, h: 28 };
    // 图钉锚点默认 {x:0.5, y:1}（底部中心）正对尖端；圆点显式设为中心
    const ANCHOR_TIP = { x: 0.5, y: 1 };
    const ANCHOR_CENTER = { x: 0.5, y: 0.5 };
    if (d.from && d.from.coord) addMarker(d.from.coord, `🏠 ${d.from.name || '家'}`, PIN, ANCHOR_TIP, true);
    if (d.to && d.to.coord) addMarker(d.to.coord, `📍 ${d.to.name || '目的地'}`, PIN_DEST, ANCHOR_TIP, true);
    (d.landmarks || []).forEach((lm) => {
      if (lm.coord) addMarker(lm.coord, lm.name, DOT_BLUE, ANCHOR_CENTER, false);
    });
    (h.spots || []).forEach((s, i) => {
      if (s.coord) addMarker(s.coord, `${i + 1}. ${s.name}`, DOT_GREEN, ANCHOR_CENTER, false);
    });

    const polylines = [];
    if (d.polyline && d.polyline.length) {
      all.push(...d.polyline);
      polylines.push({
        points: d.polyline.map((c) => ({ latitude: c[1], longitude: c[0] })),
        color: '#4FC3F7',
        width: 6,
        arrowLine: true,
      });
    }
    if (h.path && h.path.length) {
      all.push(...h.path);
      polylines.push({
        points: h.path.map((c) => ({ latitude: c[1], longitude: c[0] })),
        color: '#4CAF50',
        width: 4,
        dottedLine: true,
      });
    }

    const mapCenter = (d.from && d.from.coord)
      ? { longitude: d.from.coord[0], latitude: d.from.coord[1] }
      : (all.length ? { longitude: all[0][0], latitude: all[0][1] } : { longitude: 116.397, latitude: 39.908 });
    const dist = Number(d.distance) || 0;
    const mapScale = dist >= 200 ? 8 : dist >= 80 ? 9 : 10;
    return { markers, polylines, mapCenter, mapScale };
  },

  scrollTo(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.setData({ activeCap: id, scrollTo: '' });
    setTimeout(() => this.setData({ scrollTo: `sec-${id}` }), 60);
  },

  // 任务勾选：乐观更新 → 单项提交 → 失败回滚
  onToggleTask(e) {
    const idx = e.currentTarget.dataset.idx;
    const checked = e.detail.checked;
    const rowIndex = this.data.taskRows.findIndex((r) => r.idx === idx);
    if (rowIndex < 0) return;
    this.setData({ [`taskRows[${rowIndex}].checked`]: checked });
    api.updateTaskStates(this.tripId, [{ task_idx: idx, checked }])
      .catch((err) => {
        this.setData({ [`taskRows[${rowIndex}].checked`]: !checked });
        wx.showToast({ title: (err && err.message) || '保存失败，已回滚', icon: 'none' });
      });
  },

  onToggleGear(e) {
    const idx = e.currentTarget.dataset.idx;
    const checked = e.detail.checked;
    const was = !!this.data.gearChecked[idx];
    if (was === checked) return;
    const gearDone = this.data.gearDone + (checked ? 1 : -1);
    this.setData({
      [`gearChecked.${idx}`]: checked,
      gearDone,
      gearPct: this.data.gearTotal ? Math.round((gearDone / this.data.gearTotal) * 100) : 0,
    });
    api.updateGearStates(this.tripId, [{ item_idx: idx, checked }])
      .catch((err) => {
        const back = gearDone + (was ? 1 : -1);
        this.setData({
          [`gearChecked.${idx}`]: was,
          gearDone: back,
          gearPct: this.data.gearTotal ? Math.round((back / this.data.gearTotal) * 100) : 0,
        });
        wx.showToast({ title: (err && err.message) || '保存失败，已回滚', icon: 'none' });
      });
  },

  // 长按 2 秒打卡
  startHold() {
    if (!this.data.content.badge || this.data.trip.status === 'done' || this.data.checking) return;
    this.setData({ holding: true });
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      this.doCheckin();
    }, 2000);
  },

  endHold() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
    if (this.data.holding) this.setData({ holding: false });
  },

  async doCheckin() {
    if (this.data.checking) return;
    this.setData({ holding: false, checking: true });
    try {
      await api.checkin(this.tripId);
      const badge = this.data.content.badge;
      if (badge) {
        await api.unlockBadge(this.tripId, badge.name).catch((e) => console.error(e));
      }
      // 本地评估里程碑：用最新出行列表（含本次）+ 已解锁集合，满足则逐个解锁
      let newMilestones = [];
      try {
        const [milestones, myBadges, trips] = await Promise.all([
          api.fetchMilestones(),
          api.fetchMyBadges(),
          api.fetchTrips(),
        ]);
        const doneTrips = (trips || []).filter((t) => t.status === 'done');
        const unlockedIds = (myBadges || []).map((b) => b.badge_id);
        newMilestones = badges.evalMilestones(milestones, doneTrips, unlockedIds);
        for (const m of newMilestones) {
          await api.unlockBadge(this.tripId, m.id).catch((e) => console.error(e));
        }
      } catch (e) {
        console.error(e);
      }
      const fullStar = this.data.taskRows.length > 0 && this.data.taskRows.every((r) => r.checked);
      this.setData({
        checking: false,
        'trip.status': 'done',
        celebrate: { badge, fullStar, newMilestones },
      });
    } catch (err) {
      this.setData({ checking: false });
      wx.showToast({ title: (err && err.message) || '打卡失败，请重试', icon: 'none' });
    }
  },

  closeCelebrate() {
    this.setData({ celebrate: null });
  },

  goBadgeWall() {
    this.setData({ celebrate: null });
    wx.switchTab({ url: '/pages/me/me' });
  },

  noop() {},

  onDateChange(e) {
    const plannedDate = e.detail.value;
    api.updateTrip(this.tripId, { planned_date: plannedDate })
      .then(() => {
        this.setData({ 'trip.planned_date': plannedDate });
        wx.showToast({ title: '日期已更新', icon: 'success' });
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.message) || '修改失败', icon: 'none' });
      });
  },

  onDelete() {
    wx.showModal({
      title: '删除出行',
      content: '删除后勾选与打卡记录都会消失，确定吗？',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (!res.confirm) return;
        api.deleteTrip(this.tripId)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.switchTab({ url: '/pages/trips/trips' }), 500);
          })
          .catch((err) => {
            wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' });
          });
      },
    });
  },
});
