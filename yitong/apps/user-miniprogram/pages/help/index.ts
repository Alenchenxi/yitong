import type { AppInstance } from '../../app';
import { getFaqData, type FaqItem, type HelpCategory } from '../../services/faq-data';

Page({
  data: {
    keyword: '',
    categories: [] as HelpCategory[],
    faqList: [] as FaqItem[],
    searchResults: [] as FaqItem[],
    searching: false,
  },

  onLoad() {
    // 按角色加载帮助内容：商家看商家向，用户看用户向
    const role = getApp<AppInstance>().globalData.currentRole;
    const { list, categories } = getFaqData(role);
    this.setData({ faqList: list, categories });
  },

  onInput(e: WechatMiniprogram.Input) {
    const keyword = e.detail.value.trim();
    this.setData({ keyword, searching: keyword.length > 0 });
    if (keyword) {
      const lower = keyword.toLowerCase();
      this.setData({
        searchResults: this.data.faqList.filter(
          (f) => f.q.toLowerCase().includes(lower) || f.a.toLowerCase().includes(lower),
        ),
      });
    } else {
      this.setData({ searchResults: [] });
    }
  },

  clearInput() {
    this.setData({ keyword: '', searching: false, searchResults: [] });
  },

  goCategory(e: WechatMiniprogram.TouchEvent) {
    const path = e.currentTarget.dataset.path as string;
    wx.navigateTo({ url: path });
  },

  tapResult(e: WechatMiniprogram.TouchEvent) {
    // 搜索结果点击：展开答案（这里跳到对应分类页，简化交互）
    const id = e.currentTarget.dataset.id as string;
    const item = this.data.faqList.find((f) => f.id === id);
    if (!item) return;
    const path = item.category === 'apply_rules' ? '/pages/help/apply-rules/index' : '/pages/help/faq/index';
    wx.navigateTo({ url: path });
  },
});
