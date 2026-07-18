import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, matchAnon, getAnonId, sendAnonMessage, type MatchResp } from '../../../services/treehole';
import { connectIm, onMessage, sendWsMessage, type WsMessage } from '../../../services/im';

interface Msg { fromId: string; content: string; mine: boolean }

Page({
  data: {
    matching: false,
    matched: false,
    peerAnonId: '',
    messages: [] as Msg[],
    input: '',
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!hasAnonToken()) {
      try { await getAnonymousToken(); } catch { return; }
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
        this.setData({ matched: true, peerAnonId: r.peerAnonId });
        onMessage((m: WsMessage) => {
          if (m.type === 'msg' && m.fromId === this.data.peerAnonId) {
            this.setData({
              messages: [...this.data.messages, { fromId: m.fromId!, content: m.content!, mine: false }],
            });
          }
        });
        await connectIm(r.imCredential);
        wx.showToast({ title: '匹配成功', icon: 'success' });
      }
    } catch {} finally { this.setData({ matching: false }); wx.hideLoading(); }
  },

  onInput(e: WechatMiniprogram.Input) { this.setData({ input: e.detail.value }); },

  async send() {
    const c = this.data.input.trim();
    if (!c || !this.data.peerAnonId) return;
    const peerAnonId = this.data.peerAnonId;
    try {
      await sendAnonMessage(peerAnonId, c);
      sendWsMessage(peerAnonId, c);
      this.setData({
        messages: [...this.data.messages, { fromId: getAnonId(), content: c, mine: true }],
        input: '',
      });
    } catch {
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },
});
