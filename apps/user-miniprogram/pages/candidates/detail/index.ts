import type { AppInstance } from '../../../app';
import { transitionApp } from '../../../services/job';
import {
  getMerchantCandidateDetail,
  markCandidateContacted,
  markCandidateFit,
  type MerchantCandidateDetailVo,
} from '../../../services/merchant';

Page({
  data: {
    id: '' as string,
    detail: null as MerchantCandidateDetailVo | null,
    loading: false,
    loaded: false,
    statusLabels: {
      PENDING: '待处理',
      ACCEPTED: '已录用',
      DONE: '已完成',
      REJECTED: '未录用',
      CANCELLED: '已取消',
    } as Record<string, string>,
  },

  onLoad(options: { id?: string }) {
    if (!options?.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.setData({ id: options.id });
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.reload();
  },

  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh());
  },

  async reload() {
    if (!this.data.id || this.data.loading) return;
    this.setData({ loading: true });
    try {
      const d = await getMerchantCandidateDetail(this.data.id);
      this.setData({ detail: d, loaded: true });
    } catch (e) {
      wx.showToast({ title: e instanceof Error ? e.message : '加载失败', icon: 'none' });
      this.setData({ loaded: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  // M2-04 已联系 / 取消
  async onContact() {
    const d = this.data.detail;
    if (!d) return;
    const next = !d.contactedAt;
    try {
      const r = await markCandidateContacted(d.id, next);
      this.setData({ detail: { ...d, contactedAt: r.contactedAt } });
      wx.showToast({ title: next ? '已标记联系' : '已取消联系', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' });
    }
  },

  // M2-05 合适度循环：未标记->合适->不合适->清除
  async onFit() {
    const d = this.data.detail;
    if (!d) return;
    const next: 'FIT' | 'UNFIT' | null =
      d.fitMark === null ? 'FIT' : d.fitMark === 'FIT' ? 'UNFIT' : null;
    try {
      const r = await markCandidateFit(d.id, next);
      this.setData({ detail: { ...d, fitMark: r.fitMark } });
      wx.showToast({
        title: next ? (next === 'FIT' ? '已标记合适' : '已标记不合适') : '已清除标记',
        icon: 'none',
      });
    } catch (e) {
      wx.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' });
    }
  },

  // 复用现有 status transition
  async onAccept() {
    await this.runTransition('accept');
  },
  async onReject() {
    await this.runTransition('reject');
  },
  async onComplete() {
    await this.runTransition('complete');
  },

  async runTransition(action: 'accept' | 'reject' | 'complete') {
    const d = this.data.detail;
    if (!d) return;
    try {
      const r = await transitionApp(d.id, action);
      this.setData({ detail: { ...d, status: r.status } });
      wx.showToast({ title: '已更新状态', icon: 'none' });
      this.reload();
    } catch (e) {
      wx.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' });
    }
  },

  onJobPost() {
    const d = this.data.detail;
    if (!d) return;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${d.jobPost.id}` });
  },

  onPhoneCall() {
    const d = this.data.detail;
    if (!d?.resume?.phone) return;
    wx.makePhoneCall({ phoneNumber: d.resume.phone }).catch(() => undefined);
  },
});