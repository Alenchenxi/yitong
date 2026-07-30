import { FAQ_LIST, HELP_CATEGORIES, type FaqItem } from '../../services/faq-data';

Page({
  data: {
    keyword: '',
    categories: [...HELP_CATEGORIES],
    searchResults: [] as FaqItem[],
    searching: false,
  },

  onInput(e: WechatMiniprogram.Input) {
    const keyword = e.detail.value.trim();
    this.setData({ keyword, searching: keyword.length > 0 });
    if (keyword) {
      const lower = keyword.toLowerCase();
      this.setData({
        searchResults: FAQ_LIST.filter(
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
    const item = FAQ_LIST.find((f) => f.id === id);
    if (!item) return;
    const path = item.category === 'apply_rules' ? '/pages/help/apply-rules/index' : '/pages/help/faq/index';
    wx.navigateTo({ url: path });
  },
});
