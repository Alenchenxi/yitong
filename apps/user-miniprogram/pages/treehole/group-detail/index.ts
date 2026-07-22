import type { AppInstance } from '../../../app';
import { getAnonGroup, joinAnonGroup, leaveAnonGroup, type AnonGroupDetailVo } from '../../../services/treehole';

const ROLE_TEXT: Record<string, string> = { OWNER: '群主', ADMIN: '管理员', MEMBER: '成员' };

Page({
  data: {
    group: null as AnonGroupDetailVo | null,
    members: [] as AnonGroupDetailVo['members'],
    loading: false,
    acting: false,
  },
  groupId: '',

  onLoad(options: { id?: string }) {
    if (!options?.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.groupId = options.id;
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (this.groupId) await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const detail = await getAnonGroup(this.groupId);
      this.setData({
        group: detail,
        members: detail.members.map((m) => ({ ...m, roleText: ROLE_TEXT[m.role] ?? m.role })),
      });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() {
    this.load();
  },

  async join() {
    if (this.data.acting) return;
    this.setData({ acting: true });
    wx.showLoading({ title: '加入中...', mask: true });
    try {
      await joinAnonGroup(this.groupId);
      wx.showToast({ title: '已加入', icon: 'success' });
      await this.load();
    } catch {
      /* toast */
    } finally {
      wx.hideLoading();
      this.setData({ acting: false });
    }
  },

  async leave() {
    if (this.data.acting) return;
    const g = this.data.group;
    if (!g) return;
    const tip = g.isMember && g.ownerAnonId && g.members.find((m) => m.role === 'OWNER' && m.anonId === g.ownerAnonId)
      ? '群主退出将解散群聊，确定吗？'
      : '确定退出该群？';
    wx.showModal({
      title: '退出群聊',
      content: tip,
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ acting: true });
        try {
          const r = await leaveAnonGroup(this.groupId);
          if (r.disbanded) {
            wx.showToast({ title: '已解散群聊', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 600);
            return;
          }
          wx.showToast({ title: '已退出', icon: 'success' });
          await this.load();
        } catch {
          /* toast */
        } finally {
          this.setData({ acting: false });
        }
      },
    });
  },
});
