Page({
  data: {
    active: 'service', // service / privacy / posting
  },

  onTabTap(e: WechatMiniprogram.TouchEvent) {
    const active = e.currentTarget.dataset.tab as 'service' | 'privacy' | 'posting';
    this.setData({ active });
  },
});
