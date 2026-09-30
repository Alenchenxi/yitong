import type { AppInstance } from '../../../app';
import { getFaqData, type FaqItem } from '../../../services/faq-data';

Page({
  data: {
    items: [] as FaqItem[],
  },

  onLoad() {
    // 按角色加载报名相关 FAQ（商家：报名处理规则；用户：兼职报名指南）
    const role = getApp<AppInstance>().globalData.currentRole;
    const { list } = getFaqData(role);
    this.setData({ items: list.filter((f) => f.category === 'apply_rules') });
  },
});
