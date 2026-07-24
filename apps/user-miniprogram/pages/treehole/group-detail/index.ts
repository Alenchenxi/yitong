import type { AppInstance } from '../../../app';
import {
  getAnonGroup,
  joinAnonGroup,
  leaveAnonGroup,
  sendGroupMessage,
  listGroupMessages,
  revokeGroupMessage,
  transferGroupOwner,
  setGroupMemberRole,
  kickGroupMember,
  muteGroupMember,
  type AnonGroupDetailVo,
  type GroupMessageVo,
} from '../../../services/treehole';
import { getAnonId } from '../../../services/treehole';
import { uploadImage } from '../../../services/upload';
import { connectIm, joinRoom, leaveRoom, onRoomMessage, sendRoomMessage, type WsMessage } from '../../../services/im';

const ROLE_TEXT: Record<string, string> = { OWNER: '群主', ADMIN: '管理员', MEMBER: '成员' };

Page({
  data: {
    group: null as AnonGroupDetailVo | null,
    members: [] as (AnonGroupDetailVo['members'][number] & { roleText: string; muted: boolean })[],
    messages: [] as Array<GroupMessageVo & { nickname: string; isMine: boolean }>,
    draft: '',
    sending: false,
    myAnonId: '',
    myRole: '',
    isOwner: false,
    canManage: false,
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
      this.joinRoomRealtime();
    }
  },

  // P2-11 群消息实时推送：连 WS + join group room + 监听 room-msg
  async joinRoomRealtime() {
    const detail = this.data.group;
    if (!detail?.isMember || !detail.imCredential) return;
    try {
      await connectIm(detail.imCredential);
      joinRoom(`group:${this.groupId}`);
      onRoomMessage((m: WsMessage) => {
        if (m.type === 'room-msg' && m.roomId === `group:${this.groupId}` && m.fromId) {
          const memberMap = new Map(this.data.members.map((mb) => [mb.anonId, mb]));
          this.setData({
            messages: [
              {
                id: `ws_${m.ts ?? Date.now()}_${m.fromId}`,
                fromId: m.fromId,
                toId: null,
                content: m.content ?? '',
                type: m.msgType === 'image' ? 'image' : 'text',
                duration: null,
                groupId: this.groupId,
                deleted: false,
                createdAt: m.ts ? new Date(m.ts).toISOString() : new Date().toISOString(),
                nickname: memberMap.get(m.fromId)?.nickname ?? '匿名',
                isMine: m.fromId === this.data.myAnonId,
              },
              ...this.data.messages,
            ],
          });
        }
      });
    } catch {
      /* IM 连接失败不影响 HTTP 收发 */
    }
  },

  onUnload() {
    leaveRoom(`group:${this.groupId}`);
  },

  async load() {
    this.setData({ loading: true });
    try {
      const detail = await getAnonGroup(this.groupId);
      const members = detail.members.map((m) => ({
        ...m,
        roleText: ROLE_TEXT[m.role] ?? m.role,
        muted: !!m.mutedUntil && new Date(m.mutedUntil).getTime() > Date.now(),
      }));
      const myRole = members.find((m) => m.anonId === this.data.myAnonId)?.role ?? '';
      const isOwner = detail.isMember && detail.ownerAnonId === this.data.myAnonId;
      this.setData({
        group: detail,
        myRole,
        isOwner,
        canManage: isOwner || myRole === 'ADMIN',
        members,
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

  // 点击「加载更多」手动翻页（wxml chat-tip 绑定）
  loadMore() {
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
      // P2-11 WS 实时广播给群内其他成员
      sendRoomMessage(`group:${this.groupId}`, content, 'text');
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

  // B1 群图片消息：选图 -> 上传(anon) -> 落库 + WS 广播
  async sendImage() {
    if (this.data.sending || !this.data.group?.isMember) return;
    this.setData({ sending: true });
    wx.showLoading({ title: '发送中...', mask: true });
    try {
      const res: WechatMiniprogram.ChooseMediaSuccessCallbackResult = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        } as any);
      });
      const f = res.tempFiles?.[0];
      if (!f) return;
      const url = await uploadImage(f.tempFilePath);
      const m = await sendGroupMessage(this.groupId, url, 'image');
      sendRoomMessage(`group:${this.groupId}`, url, 'image');
      this.setData({
        messages: [
          {
            ...m,
            nickname: this.data.members.find((x) => x.anonId === m.fromId)?.nickname ?? '我',
            isMine: true,
          },
          ...this.data.messages,
        ],
      });
    } catch (e) {
      wx.showToast({ title: (e as { message?: string })?.message ?? '发送失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ sending: false });
    }
  },

  // P2-11 群图片消息点击预览全屏
  previewImg(e: WechatMiniprogram.TouchEvent) {
    const url = e.currentTarget.dataset.url as string;
    if (url) wx.previewImage({ urls: [url] });
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

  // P2-10 群成员管理：点成员弹操作菜单（按操作者/目标角色过滤；OWNER 可设角色/转交，OWNER+ADMIN 可禁言/踢人，ADMIN 不能管 ADMIN）
  onTapMember(e: WechatMiniprogram.TouchEvent) {
    const myRole = this.data.myRole;
    if (myRole !== 'OWNER' && myRole !== 'ADMIN') return;
    const anonId = e.currentTarget.dataset.anonId as string;
    const nickname = e.currentTarget.dataset.nickname as string;
    const role = e.currentTarget.dataset.role as string;
    if (!anonId || anonId === this.data.myAnonId || role === 'OWNER') return;
    const isOwner = myRole === 'OWNER';
    const canModerate = isOwner || role === 'MEMBER'; // ADMIN 只能管 MEMBER
    const target = this.data.members.find((m) => m.anonId === anonId);
    const items: string[] = [];
    const actions: Array<() => void> = [];
    if (isOwner) {
      items.push(role === 'ADMIN' ? '取消管理员' : '设为管理员');
      actions.push(() => this.doSetRole(anonId, role === 'ADMIN' ? 'MEMBER' : 'ADMIN'));
    }
    if (canModerate) {
      if (target?.muted) {
        items.push('解除禁言');
        actions.push(() => this.doMute(anonId, 0, '已解除禁言'));
      } else {
        items.push('禁言');
        actions.push(() => this.pickMuteDays(anonId));
      }
      items.push('踢出群聊');
      actions.push(() => this.confirmKick(anonId, nickname));
    }
    if (isOwner) {
      items.push('转交群主');
      actions.push(() => this.confirmTransfer(anonId, nickname));
    }
    if (!items.length) return;
    wx.showActionSheet({
      itemList: items,
      success: (res) => actions[res.tapIndex]?.(),
    });
  },

  async doSetRole(anonId: string, role: 'ADMIN' | 'MEMBER') {
    try {
      await setGroupMemberRole(this.groupId, anonId, role);
      wx.showToast({ title: role === 'ADMIN' ? '已设为管理员' : '已取消管理员', icon: 'success' });
      await this.load();
    } catch (err) {
      wx.showToast({ title: (err as Error).message ?? '操作失败', icon: 'none' });
    }
  },

  // 禁言天数选择（1/3/7/30 天）
  pickMuteDays(anonId: string) {
    const days = [1, 3, 7, 30];
    wx.showActionSheet({
      itemList: days.map((d) => `禁言 ${d} 天`),
      success: (res) => {
        const d = days[res.tapIndex];
        if (d) this.doMute(anonId, d, `已禁言 ${d} 天`);
      },
    });
  },

  async doMute(anonId: string, days: number, tip: string) {
    try {
      await muteGroupMember(this.groupId, anonId, days);
      wx.showToast({ title: tip, icon: 'success' });
      await this.load();
    } catch (err) {
      wx.showToast({ title: (err as Error).message ?? '操作失败', icon: 'none' });
    }
  },

  confirmKick(anonId: string, nickname: string) {
    wx.showModal({
      title: '踢出群聊',
      content: `确定把「${nickname}」踢出群聊吗？`,
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await kickGroupMember(this.groupId, anonId);
          wx.showToast({ title: '已踢出', icon: 'success' });
          await this.load();
        } catch (err) {
          wx.showToast({ title: (err as Error).message ?? '踢出失败', icon: 'none' });
        }
      },
    });
  },

  // B3 群主转交：确认 -> 转交后刷新
  confirmTransfer(anonId: string, nickname: string) {
    wx.showModal({
      title: '转交群主',
      content: `确定把群主转交给「${nickname}」吗？转交后你将变为普通成员。`,
      confirmColor: '#E63946',
      success: async (modal) => {
        if (!modal.confirm) return;
        this.setData({ acting: true });
        try {
          await transferGroupOwner(this.groupId, anonId);
          wx.showToast({ title: '已转交', icon: 'success' });
          await this.load();
        } catch (err) {
          wx.showToast({ title: (err as Error).message ?? '转交失败', icon: 'none' });
        } finally {
          this.setData({ acting: false });
        }
      },
    });
  },

  async leave() {
    if (this.data.acting) return;
    const g = this.data.group;
    if (!g) return;
    const tip = this.data.isOwner ? '群主退出将解散群聊，确定吗？' : '确定退出该群？';
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
