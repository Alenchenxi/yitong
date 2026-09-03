import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, joinParty, getAnonId } from '../../../services/treehole';
import { connectIm, joinRoom, sendRoomMessage, onRoomMessage, type WsMessage } from '../../../services/im';
import {
  bindAnonymousContentPageGuard,
  requireAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../../utils/anonymous-content';

interface Msg { fromId: string; content: string; mine: boolean }

Page({
  data: {
    roomId: '',
    messages: [] as Msg[],
    input: '',
    joined: false,
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    bindAnonymousContentPageGuard(this);
    if (!hasAnonToken()) {
      try { await getAnonymousToken(); } catch { return; }
    }
    await this.enter();
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  async enter() {
    try {
      const r = await joinParty();
      this.setData({ roomId: r.roomId });
      onRoomMessage((m: WsMessage) => {
        if (m.type === 'room-msg') {
          this.setData({
            messages: [...this.data.messages, { fromId: m.fromId!, content: m.content!, mine: m.fromId === getAnonId() }],
          });
        }
      });
      await connectIm(r.imCredential);
      joinRoom(r.roomId);
      this.setData({ joined: true });
    } catch {}
  },

  onInput(e: WechatMiniprogram.Input) { this.setData({ input: e.detail.value }); },

  send() {
    const c = this.data.input.trim();
    if (!c || !this.data.roomId) return;
    sendRoomMessage(this.data.roomId, c);
    this.setData({
      messages: [...this.data.messages, { fromId: getAnonId(), content: c, mine: true }],
      input: '',
    });
  },
});
