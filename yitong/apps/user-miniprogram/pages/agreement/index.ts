import type { AppInstance } from '../../app';

Page({
  data: {
    isMerchant: false,
    active: 'service', // service / privacy / posting
  },

  onLoad() {
    // 协议按角色区分：商家端三 tab（服务规则/隐私/发布规范），用户/管理端仅隐私说明
    const role = getApp<AppInstance>().globalData.currentRole;
    const isMerchant = role === 'MERCHANT';
    this.setData({ isMerchant, active: isMerchant ? 'service' : 'privacy' });
  },

  onTabTap(e: WechatMiniprogram.TouchEvent) {
    const active = e.currentTarget.dataset.tab as 'service' | 'privacy' | 'posting';
    this.setData({ active });
  },
});
