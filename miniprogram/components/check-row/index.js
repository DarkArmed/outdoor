Component({
  properties: {
    text: { type: String, value: '' },
    checked: { type: Boolean, value: false },
    // 只读模式（方案详情展示用）：不抛事件
    disabled: { type: Boolean, value: false },
  },

  methods: {
    onTap() {
      if (this.data.disabled) return;
      this.triggerEvent('toggle', { checked: !this.data.checked });
    },
  },
});
