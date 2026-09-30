import type { AppInstance } from '../../app';
import { createTicket, listMyTickets, type TicketVo } from '../../services/support';

const STATUS_TEXT: Record<string, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  CLOSED: '已关闭',
};

Page({
  data: {
    role: 'user' as 'user' | 'merchant',
    title: '',
    content: '',
    submitting: false,
    tickets: [] as Array<TicketVo & { statusText: string }>,
    loading: false,
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const role = app.globalData.currentRole === 'MERCHANT' ? 'merchant' : 'user';
    this.setData({ role });
    this.loadTickets();
  },

  onTitleInput(e: WechatMiniprogram.Input) {
    this.setData({ title: e.detail.value });
  },

  onContentInput(e: WechatMiniprogram.Input) {
    this.setData({ content: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    const title = this.data.title.trim();
    const content = this.data.content.trim();
    if (!title) return wx.showToast({ title: '请填写标题', icon: 'none' });
    if (!content) return wx.showToast({ title: '请填写内容', icon: 'none' });
    this.setData({ submitting: true });
    try {
      await createTicket({ role: this.data.role, title, content });
      this.setData({ title: '', content: '' });
      wx.showToast({ title: '已提交', icon: 'success' });
      await this.loadTickets();
    } catch {
      /* toast 已弹 */
    } finally {
      this.setData({ submitting: false });
    }
  },

  async loadTickets() {
    this.setData({ loading: true });
    try {
      const list = await listMyTickets();
      this.setData({
        tickets: list.map((t) => ({ ...t, statusText: STATUS_TEXT[t.status] || t.status })),
      });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },
});
