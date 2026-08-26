import type { AppInstance } from '../../../app';
import {
  hasAnonToken,
  getAnonymousToken,
  matchAnon,
  resumeAnonMatch,
  skipAnonMatch,
  getAnonId,
  sendAnonMessage,
  listAnonMessages,
  revokeAnonChatMessage,
  readAnonChat,
  blockAnon,
  type MatchResp,
} from '../../../services/treehole';
import { connectIm, onMessage, type WsMessage } from '../../../services/im';
import { uploadImage, uploadVoice } from '../../../services/upload';

interface Msg {
  fromId: string;
  content: string;
  mine: boolean;
  type: 'text' | 'image' | 'voice';
  duration?: number; // P1-18 语音时长（秒）
  id?: string; // 服务端消息 id（撤回匹配用，含 HTTP 返回值；远端 WS 推送的消息会带 id）
  deleted?: boolean; // 撤回标记
}

Page({
  data: {
    pageReady: false,
    matching: false,
    restoring: false,
    matched: false,
    matchId: '',
    peerAnonId: '',
    matchKind: 'RANDOM' as 'RANDOM' | 'DIRECT',
    matchScore: 0,
    matchedTags: [] as string[],
    peerTags: [] as string[],
    expireAt: '',
    remainingText: '',
    expired: false,
    messages: [] as Msg[],
    input: '',
    sending: false,
    // P1-18 语音消息
    voiceMode: false,
    recording: false,
    playingIdx: -1,
  },

  countdownTimer: null as ReturnType<typeof setInterval> | null,
  recorder: null as WechatMiniprogram.RecorderManager | null,
  recordCancel: false,
  audioCtx: null as WechatMiniprogram.InnerAudioContext | null,

  async onLoad(options: { matchId?: string; peerAnonId?: string }) {
    const hasResumeParams = Boolean(options.matchId || options.peerAnonId);
    const resumeTarget = this.parseResumeTarget(options);
    this.setData({ pageReady: true, restoring: hasResumeParams });

    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!hasAnonToken()) {
      try {
        await getAnonymousToken();
      } catch {
        if (hasResumeParams) this.handleRestoreFailure('暂时无法恢复对话');
        return;
      }
    }
    this.initRecorder();
    if (hasResumeParams && !resumeTarget) {
      this.handleRestoreFailure();
      return;
    }
    if (resumeTarget) {
      await this.restoreMatch(resumeTarget.matchId, resumeTarget.peerAnonId);
    }
  },

  parseResumeTarget(options: { matchId?: string; peerAnonId?: string }) {
    try {
      const matchId = decodeURIComponent(options.matchId ?? '').trim();
      const peerAnonId = decodeURIComponent(options.peerAnonId ?? '').trim();
      return matchId && peerAnonId ? { matchId, peerAnonId } : null;
    } catch {
      return null;
    }
  },

  async restoreMatch(matchId: string, peerAnonId: string) {
    wx.showLoading({ title: '正在恢复对话...', mask: true });
    try {
      const result = await resumeAnonMatch(matchId);
      if (
        result.waiting ||
        result.matchId !== matchId ||
        result.peerAnonId !== peerAnonId ||
        !result.imCredential
      ) {
        throw new Error('匹配记录不一致');
      }
      await this.applyMatch(result);
      this.setData({ restoring: false });
      wx.hideLoading();
    } catch {
      wx.hideLoading();
      this.handleRestoreFailure();
    }
  },

  handleRestoreFailure(title = '该匹配已结束') {
    wx.showToast({ title, icon: 'none' });
    setTimeout(() => {
      if (getCurrentPages().length > 1) {
        wx.navigateBack();
      } else {
        wx.redirectTo({ url: '/pages/treehole/matches/index' });
      }
    }, 600);
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
        await this.applyMatch(r);
        wx.showToast({ title: '匹配成功', icon: 'success' });
      }
    } catch {
      /* toast */
    } finally {
      this.setData({ matching: false });
      wx.hideLoading();
    }
  },

  // P1-16 应用匹配结果（startMatch / skipPeer 共用）
  async applyMatch(r: MatchResp) {
    if (!r.imCredential || !r.peerAnonId) return;
    this.setData({
      matched: true,
      matchId: r.matchId ?? '',
      peerAnonId: r.peerAnonId,
      matchKind: r.matchKind ?? 'RANDOM',
      matchScore: r.matchScore ?? 0,
      matchedTags: r.matchedTags ?? [],
      peerTags: r.peerTags ?? [],
      expireAt: r.expireAt ?? '',
      expired: false,
      messages: [],
    });
    this.startCountdown(r.expireAt ?? '');
    // 进入 1v1 聊天：清零对方会话未读（fire-and-forget，失败不阻塞）
    readAnonChat(r.peerAnonId).catch(() => {});
    onMessage((m: WsMessage) => {
      if (m.type === 'msg' && m.fromId === this.data.peerAnonId) {
        this.setData({
          messages: [
            ...this.data.messages,
            {
              fromId: m.fromId!,
              content: m.content!,
              mine: false,
              type: m.msgType === 'image' ? 'image' : m.msgType === 'voice' ? 'voice' : 'text',
              duration: m.msgType === 'voice' ? m.duration : undefined,
              id: typeof m.id === 'string' ? m.id : undefined,
            },
          ],
        });
      } else if (m.type === 'msg-revoke' && m.fromId === this.data.peerAnonId && m.messageId) {
        // 1v1 撤回实时同步：对方撤回消息时按 messageId 标记本地消息为已撤回
        const mid = m.messageId;
        this.setData({
          messages: this.data.messages.map((msg) =>
            msg.id === mid ? { ...msg, deleted: true, content: '[已撤回]' } : msg,
          ),
        });
      }
    });
    await connectIm(r.imCredential);
    await this.loadHistory();
  },

  // P1-17 限时聊天倒计时
  startCountdown(expireAtIso: string) {
    this.clearCountdown();
    if (!expireAtIso) return;
    const tick = () => {
      const remain = new Date(expireAtIso).getTime() - Date.now();
      if (remain <= 0) {
        this.setData({ remainingText: '已过期', expired: true });
        this.clearCountdown();
        wx.showToast({ title: '聊天已过期', icon: 'none' });
        return;
      }
      const h = Math.floor(remain / 3600000);
      const m = Math.floor((remain % 3600000) / 60000);
      const s = Math.floor((remain % 60000) / 1000);
      this.setData({
        remainingText: h > 0 ? `${h}时${m}分` : `${m}分${s}秒`,
      });
    };
    tick();
    this.countdownTimer = setInterval(tick, 1000);
  },

  clearCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  onUnload() {
    this.clearCountdown();
    // P1-18 停止录音/播放，释放资源
    if (this.data.recording) {
      this.recordCancel = true;
      this.recorder?.stop();
    }
    if (this.audioCtx) {
      this.audioCtx.destroy();
      this.audioCtx = null;
    }
  },

  // P1-16 跳过/不喜欢当前匹配 + 重新匹配
  async skipPeer() {
    if (this.data.matching || !this.data.matchId) return;
    this.setData({ matching: true });
    wx.showLoading({ title: '正在为您重新匹配...', mask: true });
    try {
      let r: MatchResp = await skipAnonMatch(this.data.matchId);
      let retries = 0;
      while (r.waiting && retries < 5) {
        await new Promise((res) => setTimeout(res, 3000));
        r = await matchAnon();
        retries += 1;
      }
      if (r.waiting) {
        // 无新对象，回到未匹配状态
        this.setData({ matched: false, matchId: '', peerAnonId: '', matchKind: 'RANDOM', messages: [] });
        wx.showToast({ title: '暂无更多对象', icon: 'none' });
      } else {
        await this.applyMatch(r);
        wx.showToast({ title: '已为你匹配新对象', icon: 'success' });
      }
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      this.setData({ matching: false });
      wx.hideLoading();
    }
  },

  // P0-14 历史拉取（含图片类型；P1-18 含语音类型+时长）
  async loadHistory() {
    try {
      const resp = await listAnonMessages(this.data.peerAnonId);
      const me = getAnonId();
      const history: Msg[] = resp.list.map((m) => ({
        id: m.id,
        fromId: m.fromId,
        content: m.deleted ? '[已撤回]' : m.content,
        mine: m.fromId === me,
        type: m.type === 'image' ? 'image' : m.type === 'voice' ? 'voice' : 'text',
        duration: m.type === 'voice' ? (m.duration ?? undefined) : undefined,
        deleted: m.deleted,
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
      const m = await sendAnonMessage(peerAnonId, c);
      this.setData({
        messages: [
          ...this.data.messages,
          { fromId: getAnonId(), content: c, mine: true, type: 'text', id: m.id },
        ],
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
          const m = await sendAnonMessage(peerAnonId, url, 'image');
          this.setData({
            messages: [...this.data.messages, { fromId: getAnonId(), content: url, mine: true, type: 'image', id: m.id }],
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

  // ===== P1-18 语音消息 =====

  // 初始化录音管理器（单例；onStop 在 touchend stop 后回调）
  initRecorder() {
    if (this.recorder) return;
    const recorder = wx.getRecorderManager();
    recorder.onStop((res) => {
      this.setData({ recording: false });
      if (this.recordCancel) {
        this.recordCancel = false;
        return;
      }
      const secs = Math.round(res.duration / 1000);
      if (!res.tempFilePath || secs < 1) {
        wx.showToast({ title: '说话时间太短', icon: 'none' });
        return;
      }
      void this.sendVoice(res.tempFilePath, secs);
    });
    recorder.onError(() => {
      this.setData({ recording: false });
      wx.showToast({ title: '录音失败，请检查麦克风权限', icon: 'none' });
    });
    this.recorder = recorder;
  },

  // 切换语音/键盘输入模式
  toggleVoiceMode() {
    this.setData({ voiceMode: !this.data.voiceMode });
  },

  // 按住开始录音（最长 60s，mp3）
  startRecord() {
    if (this.data.expired || this.data.sending) return;
    this.recordCancel = false;
    this.recorder?.start({
      duration: 60000,
      format: 'mp3',
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
    });
    this.setData({ recording: true });
  },

  // 松开发送
  stopRecord() {
    if (!this.data.recording) return;
    this.recorder?.stop();
  },

  // 上滑取消（松手在按钮外）
  cancelRecord() {
    if (!this.data.recording) return;
    this.recordCancel = true;
    this.recorder?.stop();
  },

  // 上传语音 -> 存消息 -> WS 转发
  async sendVoice(tempFilePath: string, secs: number) {
    const peerAnonId = this.data.peerAnonId;
    if (!peerAnonId || this.data.sending) return;
    this.setData({ sending: true });
    wx.showLoading({ title: '发送中...', mask: true });
    try {
      const url = await uploadVoice(tempFilePath);
      const m = await sendAnonMessage(peerAnonId, url, 'voice', secs);
      this.setData({
        messages: [...this.data.messages, { fromId: getAnonId(), content: url, mine: true, type: 'voice', duration: secs, id: m.id }],
      });
    } catch {
      wx.showToast({ title: '发送失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ sending: false });
    }
  },

  // 播放语音（InnerAudioContext 单例，再点同一条停止）
  playVoice(e: WechatMiniprogram.TouchEvent) {
    const url = e.currentTarget.dataset.url as string;
    const idx = Number(e.currentTarget.dataset.idx);
    if (!url) return;
    if (this.audioCtx && this.data.playingIdx === idx) {
      this.audioCtx.stop();
      this.audioCtx.destroy();
      this.audioCtx = null;
      this.setData({ playingIdx: -1 });
      return;
    }
    if (this.audioCtx) {
      this.audioCtx.destroy();
      this.audioCtx = null;
    }
    const ctx = wx.createInnerAudioContext();
    ctx.src = url;
    ctx.onEnded(() => {
      this.setData({ playingIdx: -1 });
      ctx.destroy();
      if (this.audioCtx === ctx) this.audioCtx = null;
    });
    ctx.onError(() => {
      this.setData({ playingIdx: -1 });
      ctx.destroy();
      if (this.audioCtx === ctx) this.audioCtx = null;
      wx.showToast({ title: '播放失败', icon: 'none' });
    });
    this.audioCtx = ctx;
    this.setData({ playingIdx: idx });
    ctx.play();
  },

  // 1v1 撤回：长按自己消息弹确认（实时同步由后端 chat.service.revokeMessage 1v1 forward 完成，对方收 msg-revoke 自动标记）
  onMsgLongPress(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx);
    const msg = this.data.messages[idx];
    if (!msg || !msg.mine || msg.deleted || !msg.id) return;
    wx.showModal({
      title: '撤回消息',
      content: '确定撤回这条消息？',
      success: async (r) => {
        if (r.confirm && msg.id) {
          try {
            await revokeAnonChatMessage(this.data.matchId, msg.id);
            this.setData({
              messages: this.data.messages.map((m) =>
                m.id === msg.id ? { ...m, deleted: true, content: '[已撤回]' } : m,
              ),
            });
          } catch (err) {
            // 显示后端具体消息（如 40004「只能撤回 X 分钟内的消息」），便于前端解释原因
            wx.showToast({ title: (err as { message?: string })?.message ?? '撤回失败', icon: 'none' });
          }
        }
      },
    });
  },

  // P0-16 拉黑对方：屏蔽后互相隔离（广场/匹配/聊天），拉黑即离场
  blockPeer() {
    const peerAnonId = this.data.peerAnonId;
    if (!peerAnonId) return;
    wx.showModal({
      title: '屏蔽对方',
      content: '屏蔽后将互相看不到帖子、不再匹配、不能聊天。',
      confirmText: '屏蔽',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await blockAnon(peerAnonId);
          wx.showToast({ title: '已屏蔽', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        } catch {
          /* toast */
        }
      },
    });
  },
});
