import type { AppInstance } from '../../../app';
import { getFaqData, type FaqItem } from '../../../services/faq-data';
import {
  bindAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../../utils/anonymous-content';

Page({
  data: {
    items: [] as FaqItem[],
  },

  async onLoad() {
    // 按角色加载常见问题（商家：岗位审核/发布/支付；用户：找兼职/投诉/账号）
    const app = getApp<AppInstance>();
    bindAnonymousContentVisibility(this, (enabled) => {
      this.updateAnonymousContentVisibility(enabled);
    });
    const role = app.globalData.currentRole;
    const anonymousContentEnabled = await app.getAnonymousContentVisibility();
    this.updateAnonymousContentVisibility(anonymousContentEnabled);
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  updateAnonymousContentVisibility(enabled: boolean) {
    const role = getApp<AppInstance>().globalData.currentRole;
    const { list } = getFaqData(role);
    this.setData({
      items: list.filter((item) =>
        item.category === 'common' && (enabled || !item.anonymousOnly)),
    });
  },
});
