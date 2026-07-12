import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, matchAnon, getAnonId, type MatchResp } from '../../../services/treehole';
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
    try {
      const r: MatchResp = await matchAnon();
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
    } catch {} finally { this.setData({ matching: false }); }
  },

  onInput(e: WechatMiniprogram.Input) { this.setData({ input: e.detail.value }); },

  send() {
    const c = this.data.input.trim();
    if (!c || !this.data.peerAnonId) return;
    sendWsMessage(this.data.peerAnonId, c);
    this.setData({
      messages: [...this.data.messages, { fromId: getAnonId(), content: c, mine: true }],
      input: '',
    });
  },
});
