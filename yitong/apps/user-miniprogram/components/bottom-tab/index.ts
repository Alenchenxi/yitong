interface TabItem {
  /** 受控模式 key：点击 triggerEvent('change', {key})，由 shell 切 tab */
  key: string;
  /** 显示文字 */
  label: string;
  /** 非选中图标（绝对路径如 /assets/tabbar/m-candidates.png） */
  iconPath?: string;
  /** 选中图标 */
  selectedIconPath?: string;
}

Component({
  options: {
    multipleSlots: false,
    addGlobalClass: true,
  },

  properties: {
    tabs: {
      type: Array,
      value: [] as TabItem[],
    },
    /** 当前选中 key */
    current: {
      type: String,
      value: '',
    },
  },

  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const key = e.currentTarget.dataset.key as string;
      if (!key || key === this.data.current) return;
      // 受控模式：通知 shell 切 tab（shell 监听 bind:change）
      this.triggerEvent('change', { key });
    },
  },
});
