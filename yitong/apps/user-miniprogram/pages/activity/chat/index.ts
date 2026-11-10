import type { AppInstance } from '../../../app';
import { activityDetail, listChatMessages, sendChatMessage, type ActivityDetailVo } from '../../../services/activity';

interface ChatMsg {
  id: string;
  fromId: string;
  content: string;
  type: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: string;
}

// 活动群聊：HTTP 轮询（3s）拉最新消息；发送走服务端（含只读守卫 + 内容审核）
Page({
  data: {
    id: '',
    detail: null as ActivityDetailVo | null,
    messages: [] as ChatMsg[],
    input: '',
    sending: false,
    readonly: false,
    myUid: '',
    scrollInto: '',
  },

  onLoad(query: Record<string, string>) {
    const app = getApp<AppInstance>();
    this.setData({ id: query.id ?? '', myUid: app.globalData.user?.id ?? '' });
  },

  async onShow() {
    await this.reloadDetail();
    if (!this.data.readonly) await this.pull();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  pollingTimer: 0,

  startPolling() {
    this.stopPolling();
    this.pollingTimer = setInterval(() => {
      if (!this.data.readonly) void this.pull();
    }, 3000) as unknown as number;
  },

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = 0;
    }
  },

  async reloadDetail() {
    try {
      const detail = await activityDetail(this.data.id);
      this.setData({ detail, readonly: detail.chat.readonly });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  async pull() {
    try {
      const res = await listChatMessages(this.data.id);
      const messages = res.list;
      const last = messages[messages.length - 1];
      this.setData({
        messages,
        scrollInto: last ? `msg-${last.id}` : '',
      });
    } catch {
      /* 轮询失败静默 */
    }
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ input: e.detail.value });
  },

  async onSend() {
    const content = this.data.input.trim();
    if (!content || this.data.sending || this.data.readonly) return;
    this.setData({ sending: true });
    try {
      await sendChatMessage(this.data.id, content);
      this.setData({ input: '' });
      await this.pull();
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ sending: false });
    }
  },
});
