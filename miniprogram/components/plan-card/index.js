const { typeClass } = require('../../utils/plan');

Component({
  // 复用 app.wxss 的主题渐变与徽章类
  options: { styleIsolation: 'apply-shared' },

  properties: {
    plan: { type: Object, value: {} },
    // 出行页复用：'done' 时显示「已打卡」角标
    tripStatus: { type: String, value: '' },
  },

  data: {
    typeCls: '',
  },

  observers: {
    plan(plan) {
      this.setData({ typeCls: typeClass(plan && plan.type) });
    },
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { plan: this.data.plan });
    },
  },
});
