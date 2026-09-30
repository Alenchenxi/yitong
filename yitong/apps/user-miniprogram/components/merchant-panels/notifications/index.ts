// 商家 shell 消息 panel：包 notifications-view，onPanelShow 调 refresh；opencandidates -> switchtab 切候选人 tab
Component({
  options: {
    addGlobalClass: true,
  },

  properties: {
    params: {
      type: Object,
      value: {},
    },
  },

  methods: {
    onPanelShow() {
      const v = this.selectComponent('#nv') as { refresh?: () => void } | null;
      if (v?.refresh) v.refresh();
    },
    // 报名处理提醒 -> 切候选人 tab（事件冒泡 shell）
    onOpenCandidates() {
      this.triggerEvent('switchtab', { tab: 'candidates' });
    },
  },
});
