import type { AppInstance } from '../../../app';
import {
  hasAnonToken,
  getAnonymousToken,
  matchAnon,
  getAnonId,
  sendAnonMessage,
  listAnonMessages,
  type MatchResp,
} from '../../../services/treehole';
import { connectIm, onMessage, sendWsMessage, type WsMessage } from '../../../services/im';
import { uploadImage } from '../../../services/upload';

interface Msg {
  fromId: string;
  content: string;
  mine: boolean;
  type: 'text' | 'image';
}

Page({
  data: {
    matching: false,
    matched: false,
    peerAnonId: '',
    messages: [] as Msg[],
    input: '',
    sending: false,
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!hasAnonToken()) {
      try {
        await getAnonymousToken();
      } catch {
        return;
      }
    }
  },

  async startMatch() {
    if (this.data.matching) return;
    this.setData({ matching: true });
    wx.showLoading({ title: '正在为您匹配...', mask: true });
    try {
      // waiting 时轮询重试（单用户测试或对方尚未入队时，自己会先入队等待）
      let r: MatchResp = await matchAnon();
      let retries = 0;
      while (r.waiting && retries < 5) {
        await new Promise((res) => setTimeout(res, 3000));
        r = await matchAnon();
        retries += 1;
      }
      if (r.waiting) {
        wx.showToast({ title: '暂无可用对象，稍后再试', icon: 'none' });
      } else if (r.imCredential && r.peerAnonId) {
        this.setData({ matched: true, peerAnonId: r.peerAnonId, messages: [] });
        onMessage((m: WsMessage) => {
          if (m.type === 'msg' && m.fromId === this.data.peerAnonId) {
            this.setData({
              messages: [
                ...this.data.messages,
                { fromId: m.fromId!, content: m.content!, mine: false, type: m.msgType === 'image' ? 'image' : 'text' },
              ],
            });
          }
        });
        await connectIm(r.imCredential);
        await this.loadHistory();
        wx.showToast({ title: '匹配成功', icon: 'success' });
      }
    } catch {
      /* toast */
    } finally {
      this.setData({ matching: false });
      wx.hideLoading();
    }
  },

  // P0-14 历史拉取（含图片类型）
  async loadHistory() {
    try {
      const resp = await listAnonMessages(this.data.peerAnonId);
      const me = getAnonId();
      const history: Msg[] = resp.list.map((m) => ({
        fromId: m.fromId,
        content: m.content,
        mine: m.fromId === me,
        type: m.type === 'image' ? 'image' : 'text',
      }));
      this.setData({ messages: [...history, ...this.data.messages] });
    } catch {
      /* ignore */
    }
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ input: e.detail.value });
  },

  async send() {
    const c = this.data.input.trim();
    if (!c || !this.data.peerAnonId || this.data.sending) return;
    const peerAnonId = this.data.peerAnonId;
    this.setData({ sending: true });
    try {
      await sendAnonMessage(peerAnonId, c);
      sendWsMessage(peerAnonId, c);
      this.setData({
        messages: [...this.data.messages, { fromId: getAnonId(), content: c, mine: true, type: 'text' }],
        input: '',
      });
    } catch {
      wx.showToast({ title: '发送失败', icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  },

  // P0-14 发送图片消息：选图 -> 上传(anon) -> 存 + WS 转发
  async sendImage() {
    if (!this.data.peerAnonId || this.data.sending) return;
    const peerAnonId = this.data.peerAnonId;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const f = res.tempFiles[0];
        if (!f) return;
        this.setData({ sending: true });
        wx.showLoading({ title: '发送中...', mask: true });
        try {
          const url = await uploadImage(f.tempFilePath, 'anon');
          await sendAnonMessage(peerAnonId, url, 'image');
          sendWsMessage(peerAnonId, url, 'image');
          this.setData({
            messages: [...this.data.messages, { fromId: getAnonId(), content: url, mine: true, type: 'image' }],
          });
        } catch {
          wx.showToast({ title: '发送失败', icon: 'none' });
        } finally {
          wx.hideLoading();
          this.setData({ sending: false });
        }
      },
    });
  },

  previewImage(e: WechatMiniprogram.TouchEvent) {
    const url = e.currentTarget.dataset.url as string;
    if (url) wx.previewImage({ urls: [url] });
  },
});
