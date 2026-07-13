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
  getStats,
  type AdminQueueVo,
  type PricingVo,
  type DashboardStats,
} from '../../services/admin';
import {
  listAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AdminAnnouncementVo,
} from '../../services/announcement';

type Tab = 'queue' | 'stats' | 'pricing' | 'announce';

Page({
  data: {
    tab: 'queue' as Tab,
    queue: null as AdminQueueVo | null,
    pricing: [] as PricingVo[],
    stats: null as DashboardStats | null,
    announcements: [] as AdminAnnouncementVo[],
    loading: false,
    editingDuration: '',
    editingPrice: '',
    annTitle: '',
    annContent: '',
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
      } else if (this.data.tab === 'pricing') {
        const pricing = await getPricing();
        this.setData({ pricing });
      } else if (this.data.tab === 'announce') {
        const announcements = await listAllAnnouncements();
        this.setData({ announcements });
      } else {
        const stats = await getStats();
        this.setData({ stats });
      }
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: e.currentTarget.dataset.tab as Tab });
    this.load();
  },

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

  // 公告管理
  onAnnInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'annTitle' | 'annContent';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },

  async createAnn() {
    if (!this.data.annTitle.trim() || !this.data.annContent.trim()) {
      wx.showToast({ title: '请填标题和内容', icon: 'none' });
      return;
    }
    await createAnnouncement({ title: this.data.annTitle.trim(), content: this.data.annContent.trim() });
    wx.showToast({ title: '已发布', icon: 'success' });
    this.setData({ annTitle: '', annContent: '' });
    this.load();
  },

  async toggleAnn(e: WechatMiniprogram.TouchEvent) {
    const { id, active } = e.currentTarget.dataset as { id: string; active: boolean };
    await updateAnnouncement(id, { active: !active });
    this.load();
  },

  async deleteAnn(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '删除公告',
      content: '确定删除？',
      success: async (r) => {
        if (r.confirm) {
          await deleteAnnouncement(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        }
      },
    });
  },
});
