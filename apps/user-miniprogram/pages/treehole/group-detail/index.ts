import type { AppInstance } from '../../../app';
import {
  getAnonGroup,
  joinAnonGroup,
  leaveAnonGroup,
  sendGroupMessage,
  listGroupMessages,
  revokeGroupMessage,
  type AnonGroupDetailVo,
  type GroupMessageVo,
} from '../../../services/treehole';
import { getAnonId } from '../../../services/treehole';

const ROLE_TEXT: Record<string, string> = { OWNER: '群主', ADMIN: '管理员', MEMBER: '成员' };

Page({
  data: {
    group: null as AnonGroupDetailVo | null,
    members: [] as (AnonGroupDetailVo['members'][number] & { roleText: string })[],
    messages: [] as Array<GroupMessageVo & { nickname: string; isMine: boolean }>,
    draft: '',
    sending: false,
    myAnonId: '',
    hasMoreMsg: true,
    msgCursor: '',
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
    if (this.groupId) {
      this.setData({ myAnonId: getAnonId() });
      await this.load();
      await this.loadMessages();
    }
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

  async loadMessages(append = false) {
    if (!append) this.setData({ loading: true });
    try {
      const r = await listGroupMessages(this.groupId, append ? this.data.msgCursor : '', 50);
      const memberMap = new Map(this.data.members.map((m) => [m.anonId, m]));
      const list = r.list.map((msg) => ({
        ...msg,
        nickname: memberMap.get(msg.fromId)?.nickname ?? '匿名',
        isMine: msg.fromId === this.data.myAnonId,
      }));
      this.setData({
        messages: append ? [...list, ...this.data.messages] : list,
        msgCursor: r.nextCursor ?? '',
        hasMoreMsg: r.hasMore,
      });
    } catch {
      /* toast */
    } finally {
      if (!append) this.setData({ loading: false });
    }
  },

  onPullDownRefresh() {
    this.load();
    this.loadMessages();
  },

  onReachBottom() {
    if (this.data.hasMoreMsg) this.loadMessages(true);
  },

  onDraft(e: WechatMiniprogram.Input) {
    this.setData({ draft: e.detail.value });
  },

  async send() {
    const content = this.data.draft.trim();
    if (!content || this.data.sending || !this.data.group?.isMember) return;
    this.setData({ sending: true });
    try {
      const m = await sendGroupMessage(this.groupId, content, 'text');
      this.setData({
        messages: [
          {
            ...m,
            nickname: this.data.members.find((x) => x.anonId === m.fromId)?.nickname ?? '我',
            isMine: true,
          },
          ...this.data.messages,
        ],
        draft: '',
      });
    } catch (e) {
      wx.showToast({ title: (e as Error).message ?? '发送失败', icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },

  async revokeMsg(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    try {
      await revokeGroupMessage(this.groupId, id);
      this.setData({
        messages: this.data.messages.map((m) => (m.id === id ? { ...m, deleted: true, content: '[已撤回]' } : m)),
      });
    } catch {
      wx.showToast({ title: '撤回失败', icon: 'none' });
    }
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
