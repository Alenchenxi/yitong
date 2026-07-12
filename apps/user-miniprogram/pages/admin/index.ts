import type { AppInstance } from '../../app';
import {
  getQueue,
  approveMerchant,
  rejectMerchant,
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

  async approve(e: WechatMiniprogram.TouchEvent) {
    await approveMerchant(e.currentTarget.dataset.id as string);
    wx.showToast({ title: '已通过', icon: 'success' });
    this.load();
  },

  async reject(e: WechatMiniprogram.TouchEvent) {
    await rejectMerchant(e.currentTarget.dataset.id as string);
    wx.showToast({ title: '已拒绝', icon: 'success' });
    this.load();
  },

  async takedown(e: WechatMiniprogram.TouchEvent) {
    await takedownPost(e.currentTarget.dataset.id as string);
    wx.showToast({ title: '已下架', icon: 'success' });
    this.load();
  },

  async takedownAnon(e: WechatMiniprogram.TouchEvent) {
    await takedownAnonPost(e.currentTarget.dataset.id as string);
    wx.showToast({ title: '已下架', icon: 'success' });
    this.load();
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
