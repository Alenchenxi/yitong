import type { AppInstance } from '../../app';
import {
  getQueue,
  approveMerchant,
  rejectMerchant,
  batchMerchants,
  takedownPost,
  takedownAnonPost,
  getPricing,
  updatePricing,
  type AdminQueueVo,
  type PricingVo,
} from '../../services/admin';

Page({
  data: {
    tab: 'queue' as 'queue' | 'pricing',
    queue: null as AdminQueueVo | null,
    pricing: [] as PricingVo[],
    loading: false,
    editingDuration: '',
    editingPrice: '',
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      if (this.data.tab === 'queue') {
        const queue = await getQueue();
        this.setData({ queue });
      } else {
        const pricing = await getPricing();
        this.setData({ pricing });
      }
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: e.currentTarget.dataset.tab as 'queue' | 'pricing' });
    this.load();
  },

  // 审核操作：showModal editable 获取理由
  async approve(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '审核通过',
      editable: true,
      placeholderText: '审核理由（可选）',
      success: async (r) => {
        if (r.confirm) {
          await approveMerchant(id, r.content || undefined);
          wx.showToast({ title: '已通过', icon: 'success' });
          this.load();
        }
      },
    });
  },

  async reject(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '审核拒绝',
      editable: true,
      placeholderText: '拒绝理由（可选）',
      success: async (r) => {
        if (r.confirm) {
          await rejectMerchant(id, r.content || undefined);
          wx.showToast({ title: '已拒绝', icon: 'success' });
          this.load();
        }
      },
    });
  },

  async batchApprove() {
    const pendingIds = this.data.queue?.merchants
      .filter((m) => m.status === 'PENDING')
      .map((m) => m.id) ?? [];
    if (pendingIds.length === 0) {
      wx.showToast({ title: '无待审核商家', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '批量通过',
      content: `确定批量通过 ${pendingIds.length} 个待审核商家？`,
      success: async (r) => {
        if (r.confirm) {
          await batchMerchants(pendingIds, 'approve');
          wx.showToast({ title: '批量通过成功', icon: 'success' });
          this.load();
        }
      },
    });
  },

  async takedown(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '下架帖子',
      editable: true,
      placeholderText: '下架理由（可选）',
      success: async (r) => {
        if (r.confirm) {
          await takedownPost(id, r.content || undefined);
          wx.showToast({ title: '已下架', icon: 'success' });
          this.load();
        }
      },
    });
  },

  async takedownAnon(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '下架匿名帖',
      editable: true,
      placeholderText: '下架理由（可选）',
      success: async (r) => {
        if (r.confirm) {
          await takedownAnonPost(id, r.content || undefined);
          wx.showToast({ title: '已下架', icon: 'success' });
          this.load();
        }
      },
    });
  },

  startEdit(e: WechatMiniprogram.TouchEvent) {
    const { dur, price } = e.currentTarget.dataset as { dur: string; price: string };
    this.setData({ editingDuration: dur, editingPrice: price });
  },

  onPriceInput(e: WechatMiniprogram.Input) {
    this.setData({ editingPrice: e.detail.value });
  },

  async savePrice() {
    if (!this.data.editingDuration || !this.data.editingPrice) return;
    await updatePricing({
      duration: this.data.editingDuration as 'D30' | 'D90',
      price: Number(this.data.editingPrice),
    });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ editingDuration: '', editingPrice: '' });
    this.load();
  },

  cancelEdit() {
    this.setData({ editingDuration: '', editingPrice: '' });
  },
});
