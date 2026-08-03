import type { AppInstance } from '../../../app';
import {
  listUsers,
  banUser,
  muteUser,
  listTickets,
  replyTicket,
  reopenTicket,
  type AdminUserVo,
  type AdminTicketVo,
} from '../../../services/admin';

// 管理端底部 tab：看板 / 审核 / 运营 / 用户 / 我的
const ADMIN_TABS = [
  { path: '/pages/admin/dashboard/index', label: '看板' },
  { path: '/pages/admin/review/index', label: '审核' },
  { path: '/pages/admin/ops/index', label: '运营' },
  { path: '/pages/admin/users/index', label: '用户' },
  { path: '/pages/admin/profile/index', label: '我的' },
];

type Sub = 'users' | 'tickets';
const SUBS: Sub[] = ['users', 'tickets'];

Page({
  data: {
    tabs: ADMIN_TABS,
    current: 'pages/admin/users/index',
    sub: 'users' as Sub,
    users: [] as AdminUserVo[],
    userKeyword: '',
    tickets: [] as AdminTicketVo[],
    ticketStatus: 'OPEN',
    loading: false,
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    void this.load();
  },

  switchSub(e: WechatMiniprogram.TouchEvent) {
    const s = e.currentTarget.dataset.sub as Sub;
    if (SUBS.includes(s)) {
      this.setData({ sub: s });
      void this.load();
    }
  },

  async load() {
    this.setData({ loading: true });
    try {
      if (this.data.sub === 'users') {
        this.setData({ users: await listUsers(this.data.userKeyword || undefined) });
      } else {
        this.setData({ tickets: await listTickets(this.data.ticketStatus) });
      }
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  // ===== 用户 =====
  onUserKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ userKeyword: e.detail.value });
  },
  searchUsers() {
    this.load();
  },
  banUserTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '封禁用户',
      content: '封禁后用户无法登录，确定？',
      confirmColor: '#F53F3F',
      success: async (r) => {
        if (r.confirm) {
          await banUser(id);
          wx.showToast({ title: '已封禁', icon: 'success' });
          this.load();
        }
      },
    });
  },
  muteUserTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const isMuted = !!(e.currentTarget.dataset.muted as string);
    if (isMuted) {
      void muteUser(id, 0).then(() => {
        wx.showToast({ title: '已解除禁言', icon: 'success' });
        this.load();
      });
      return;
    }
    wx.showModal({
      title: '禁言',
      editable: true,
      placeholderText: '禁言天数（1-365）',
      success: async (r) => {
        if (r.confirm) {
          const days = Number(r.content) || 1;
          await muteUser(id, days);
          wx.showToast({ title: `已禁言 ${days} 天`, icon: 'success' });
          this.load();
        }
      },
    });
  },

  // ===== 工单 =====
  switchTicketStatus(e: WechatMiniprogram.TouchEvent) {
    this.setData({ ticketStatus: e.currentTarget.dataset.s as string });
    this.load();
  },
  replyTicketTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '回复工单',
      editable: true,
      placeholderText: '回复内容',
      confirmText: '回复并关闭',
      success: async (r) => {
        if (r.confirm && r.content?.trim()) {
          await replyTicket(id, r.content.trim(), true);
          wx.showToast({ title: '已回复并关闭', icon: 'success' });
          this.load();
        }
      },
    });
  },
  replyTicketKeepTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '回复并保留处理中',
      editable: true,
      placeholderText: '回复内容（工单保持处理中）',
      confirmText: '回复',
      success: async (r) => {
        if (r.confirm && r.content?.trim()) {
          await replyTicket(id, r.content.trim(), false);
          wx.showToast({ title: '已回复（处理中）', icon: 'success' });
          this.load();
        }
      },
    });
  },
  reopenTicketTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    wx.showModal({
      title: '重开工单',
      content: '重开后回复内容将被清空，需重新回复。确定？',
      confirmColor: '#F9C801',
      success: async (r) => {
        if (r.confirm) {
          await reopenTicket(id);
          wx.showToast({ title: '已重开', icon: 'success' });
          this.load();
        }
      },
    });
  },
});
