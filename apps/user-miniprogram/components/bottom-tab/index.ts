interface TabItem {
  /** 跳转路径（绝对路径，pages/ 前缀），如 /pages/job/manage/index */
  path: string;
  /** 显示文字 */
  label: string;
  /** 非选中图标（可选，相对路径如 assets/tabbar/job.png） */
  iconPath?: string;
  /** 选中图标 */
  selectedIconPath?: string;
  /** 内部用：高亮态 */
  active?: boolean;
}

function stripSlash(p: string): string {
  return (p || '').replace(/^\//, '');
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
    /** 当前页路径（含 / 前缀也可），如 "pages/job/manage/index" 或 "/pages/job/manage/index" */
    current: {
      type: String,
      value: '',
    },
  },

  observers: {
    // 仅监听 current；tabs 在 attached 时一次性计算高亮，避免 observer 触发 recompute 后
    // setData({ tabs }) 改变 tabs 引用再次触发 observer 造成无限 setData 卡死。
    current: function () {
      this.recompute();
    },
  },

  lifetimes: {
    attached() {
      this.recompute();
    },
  },

  methods: {
    recompute() {
      const cur = stripSlash(this.data.current);
      const tabs = (this.data.tabs || []).map((t) => ({
        ...t,
        active: stripSlash(t.path) === cur,
      }));
      this.setData({ tabs });
    },
    onTap(e: WechatMiniprogram.TouchEvent) {
      const path = e.currentTarget.dataset.path as string;
      if (!path) return;
      const cur = stripSlash(this.data.current);
      if (stripSlash(path) === cur) return;
      wx.reLaunch({ url: path });
    },
  },
});