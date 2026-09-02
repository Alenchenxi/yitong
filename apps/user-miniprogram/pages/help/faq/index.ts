import type { AppInstance } from '../../../app';
import { getFaqData, type FaqItem } from '../../../services/faq-data';

Page({
  data: {
    items: [] as FaqItem[],
  },

  async onLoad() {
    // 按角色加载常见问题（商家：岗位审核/发布/支付；用户：找兼职/投诉/账号）
    const app = getApp<AppInstance>();
    const role = app.globalData.currentRole;
    const anonymousContentEnabled = await app.getAnonymousContentVisibility();
    const { list } = getFaqData(role);
    this.setData({
      items: list.filter((item) =>
        item.category === 'common' && (anonymousContentEnabled || !item.anonymousOnly)),
    });
  },
});
