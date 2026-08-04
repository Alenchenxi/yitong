import type { AppInstance } from '../../../app';
import { getFaqData, type FaqItem } from '../../../services/faq-data';

Page({
  data: {
    items: [] as FaqItem[],
  },

  onLoad() {
    // 按角色加载常见问题（商家：岗位审核/发布/支付；用户：找兼职/投诉/账号）
    const role = getApp<AppInstance>().globalData.currentRole;
    const { list } = getFaqData(role);
    this.setData({ items: list.filter((f) => f.category === 'common') });
  },
});
