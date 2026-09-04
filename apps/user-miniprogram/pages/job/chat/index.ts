import type { AppInstance } from '../../../app';
import {
  cancelInterviewInvitation,
  ensureJobConversation,
  getJobConversation,
  listJobConversationMessages,
  parseTencentMeeting,
  respondInterviewInvitation,
  sendInterviewInvitation,
  sendJobConversationExchange,
  sendJobConversationMessage,
  type InterviewInvitationVo,
  type JobExchangeKind,
  type JobConversationMessageVo,
  type JobConversationVo,
} from '../../../services/job';
import { connectIm, getImToken, onMessage, type WsMessage } from '../../../services/im';
import {
  EMPTY_MEETING_FORM,
  mergeParsedMeetingForm,
  normalizeMeetingSource,
  type MeetingForm,
} from './meeting-form';

type SendState = 'sending' | 'sent' | 'failed';

interface ChatMessage extends JobConversationMessageVo {
  clientKey: string;
  anchorId: string;
  mine: boolean;
  timeText: string;
  dayText: string;
  showDay: boolean;
  sendState: SendState;
}

type RequiredMeetingField = 'meetingUrl' | 'title' | 'meetingDate' | 'meetingTime' | 'interviewerName';
type MeetingErrors = Record<RequiredMeetingField, string>;

const EMPTY_MEETING_ERRORS: MeetingErrors = {
  meetingUrl: '',
  title: '',
  meetingDate: '',
  meetingTime: '',
  interviewerName: '',
};

const REQUIRED_MEETING_FIELDS: RequiredMeetingField[] = [
  'meetingUrl',
  'title',
  'meetingDate',
  'meetingTime',
  'interviewerName',
];

const READ_ONLY_TEXT: Record<string, string> = {
  CANCELLED: '报名已取消，仅可查看历史消息',
  REJECTED: '报名已结束，仅可查看历史消息',
};

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayText(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86400000).toISOString());
  const key = dayKey(iso);
  if (key === today) return '今天';
  if (key === yesterday) return '昨天';
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function timeText(iso: string) {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function safeAnchor(id: string) {
  return `message-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function createClientMessageId() {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

Page({
  data: {
    applicationId: '',
    conversationId: '',
    conversation: null as JobConversationVo | null,
    messages: [] as ChatMessage[],
    loading: true,
    loadError: '',
    loadingEarlier: false,
    hasMore: false,
    nextCursor: '' as string,
    input: '',
    canSend: false,
    sending: false,
    exchanging: false,
    scrollIntoView: '',
    extensionOpen: false,
    invitationOpen: false,
    meetingSource: '',
    parsedMeetingSource: '',
    meetingForm: { ...EMPTY_MEETING_FORM } as MeetingForm,
    meetingErrors: { ...EMPTY_MEETING_ERRORS } as MeetingErrors,
    parsing: false,
    parsed: false,
    inviting: false,
    respondingInvitationId: '',
    peerInitial: '同',
    readOnlyText: '',
  },

  pollingTimer: null as ReturnType<typeof setInterval> | null,
  messageUnsubscribe: null as (() => void) | null,
  meetingParseSeq: 0,
  destroyed: false,

  async onLoad(options: { applicationId?: string; conversationId?: string }) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const applicationId = decodeURIComponent(options.applicationId ?? '').trim();
    const conversationId = decodeURIComponent(options.conversationId ?? '').trim();
    if (!applicationId && !conversationId) {
      this.setData({ loading: false, loadError: '缺少报名记录或会话，无法进入沟通' });
      return;
    }
    this.setData({ applicationId, conversationId });
    await this.initialize();
  },

  onUnload() {
    this.destroyed = true;
    this.stopPolling();
    this.messageUnsubscribe?.();
    this.messageUnsubscribe = null;
  },

  async initialize() {
    this.setData({ loading: true, loadError: '' });
    try {
      const base = this.data.conversationId
        ? await getJobConversation(this.data.conversationId)
        : await ensureJobConversation(this.data.applicationId);
      if (this.destroyed) return;
      this.setData({
        conversation: base,
        conversationId: base.id,
        applicationId: base.applicationId,
        peerInitial: base.peer.name.trim().slice(0, 1) || '同',
        readOnlyText: base.readOnly ? (READ_ONLY_TEXT[base.applicationStatus] ?? '当前会话仅可查看历史消息') : '',
        meetingForm: { ...EMPTY_MEETING_FORM },
        meetingErrors: { ...EMPTY_MEETING_ERRORS },
      });
      wx.setNavigationBarTitle({ title: base.peer.name || '岗位沟通' });
      this.bindRealtime();
      await this.loadInitialMessages();
      this.startPolling();
    } catch (error) {
      if (this.destroyed) return;
      this.setData({
        loadError: error instanceof Error ? error.message : '会话加载失败，请稍后重试',
      });
    } finally {
      if (!this.destroyed) this.setData({ loading: false });
    }
  },

  async bindRealtime() {
    this.messageUnsubscribe?.();
    this.messageUnsubscribe = onMessage((message) => this.handleWsMessage(message));
    try {
      const app = getApp<AppInstance>();
      const credential = await getImToken(app);
      if (!this.destroyed) await connectIm(credential);
    } catch {
      // WebSocket 不可用时由轮询兜底，不阻断会话。
    }
  },

  handleWsMessage(frame: WsMessage) {
    if (frame.conversationId !== this.data.conversationId) return;
    if (frame.type === 'job-message' && frame.message && typeof frame.message === 'object') {
      this.mergeMessages([frame.message as unknown as JobConversationMessageVo], true);
      return;
    }
    if (frame.type === 'job-interview-updated' && frame.invitation && typeof frame.invitation === 'object') {
      this.applyInvitationUpdate(frame.invitation as unknown as InterviewInvitationVo);
      return;
    }
    if (frame.type === 'job-interview-cancelled' && typeof frame.invitationId === 'string') {
      this.markInvitationCancelled(frame.invitationId);
    }
  },

  async loadInitialMessages() {
    const page = await listJobConversationMessages(this.data.conversationId);
    if (this.destroyed) return;
    this.setData({
      messages: this.decorateMessages(page.list),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor ?? '',
    }, () => this.scrollToBottom(false));
  },

  async loadEarlier() {
    if (this.data.loadingEarlier || !this.data.hasMore || !this.data.nextCursor) return;
    const previousFirst = this.data.messages[0]?.anchorId ?? '';
    this.setData({ loadingEarlier: true });
    try {
      const page = await listJobConversationMessages(this.data.conversationId, this.data.nextCursor);
      if (this.destroyed) return;
      const merged = this.mergeMessageValues(page.list, this.data.messages);
      this.setData({
        messages: this.decorateMessages(merged),
        hasMore: page.hasMore,
        nextCursor: page.nextCursor ?? '',
        scrollIntoView: previousFirst,
      });
    } finally {
      if (!this.destroyed) this.setData({ loadingEarlier: false });
    }
  },

  startPolling() {
    this.stopPolling();
    this.pollingTimer = setInterval(() => {
      void this.pollLatest();
    }, 5000);
  },

  stopPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = null;
  },

  async pollLatest() {
    if (!this.data.conversationId || this.destroyed) return;
    try {
      const page = await listJobConversationMessages(this.data.conversationId);
      if (!this.destroyed) this.mergeMessages(page.list, false);
    } catch {
      // 静默轮询，避免聊天过程中反复 toast。
    }
  },

  mergeMessageValues(incoming: JobConversationMessageVo[], current: JobConversationMessageVo[]) {
    const values: JobConversationMessageVo[] = [];
    const byClientMessageId = new Map<string, number>();
    const byServerId = new Map<string, number>();
    const upsert = (item: JobConversationMessageVo) => {
      const existingIndex = item.clientMessageId
        ? byClientMessageId.get(item.clientMessageId) ?? byServerId.get(item.id)
        : byServerId.get(item.id);
      const index = existingIndex ?? values.length;
      values[index] = item;
      byServerId.set(item.id, index);
      if (item.clientMessageId) byClientMessageId.set(item.clientMessageId, index);
    };
    current.forEach(upsert);
    incoming.forEach(upsert);
    return values.sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  },

  mergeMessages(incoming: JobConversationMessageVo[], scroll: boolean) {
    if (!incoming.length) return;
    const merged = this.mergeMessageValues(incoming, this.data.messages);
    this.setData({ messages: this.decorateMessages(merged) }, () => {
      if (scroll) this.scrollToBottom(true);
    });
  },

  decorateMessages(values: JobConversationMessageVo[]) {
    const me = getApp<AppInstance>().globalData.user?.id ?? '';
    const ordered = [...values].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
    return ordered.map((item, index) => {
      const previous = ordered[index - 1];
      const previousDay = previous ? dayKey(previous.createdAt) : '';
      const currentDay = dayKey(item.createdAt);
      const previousUi = this.data.messages.find((message) =>
        message.id === item.id ||
        (!!item.clientMessageId && message.clientMessageId === item.clientMessageId),
      );
      const local = item.id.startsWith('local-');
      return {
        ...item,
        clientKey: previousUi?.clientKey ?? (item.clientMessageId ? `client-${item.clientMessageId}` : item.id),
        anchorId: previousUi?.anchorId ?? safeAnchor(item.id),
        mine: item.senderId === me,
        timeText: timeText(item.createdAt),
        dayText: dayText(item.createdAt),
        showDay: currentDay !== previousDay,
        sendState: local ? (previousUi?.sendState ?? 'sending') : 'sent',
      };
    });
  },

  scrollToBottom(animated = true) {
    this.setData({ scrollIntoView: '' }, () => {
      this.setData({ scrollIntoView: 'message-end' });
      if (!animated) return;
    });
  },

  onInput(event: WechatMiniprogram.Input) {
    const input = event.detail.value;
    this.setData({ input, canSend: !!input.trim() });
  },

  async send() {
    const content = this.data.input.trim();
    const conversation = this.data.conversation;
    if (!content || !conversation || conversation.readOnly || this.data.sending) return;
    await this.sendTextMessage(content, createClientMessageId(), false);
  },

  async sendTextMessage(content: string, clientMessageId: string, reuseExisting: boolean) {
    const conversation = this.data.conversation;
    if (!conversation || conversation.readOnly) return;
    const app = getApp<AppInstance>();
    const localId = `local-${clientMessageId}`;
    let messages: ChatMessage[];
    if (reuseExisting) {
      messages = this.data.messages.map((item) =>
        item.clientMessageId === clientMessageId
          ? { ...item, sendState: 'sending' as SendState }
          : item,
      );
    } else {
      const optimistic: JobConversationMessageVo = {
        id: localId,
        senderId: app.globalData.user?.id ?? '',
        type: 'TEXT',
        content,
        clientMessageId,
        invitation: null,
        exchange: null,
        createdAt: new Date().toISOString(),
      };
      messages = this.decorateMessages([...this.data.messages, optimistic]);
    }
    this.setData({
      messages,
      input: reuseExisting ? this.data.input : '',
      canSend: reuseExisting ? this.data.canSend : false,
      sending: true,
    }, () => this.scrollToBottom(true));
    try {
      const sent = await sendJobConversationMessage(conversation.id, content, clientMessageId);
      this.mergeMessages([sent], true);
    } catch {
      this.setData({
        messages: this.data.messages.map((item) =>
          item.id === localId && item.clientMessageId === clientMessageId
            ? { ...item, sendState: 'failed' as SendState }
            : item,
        ),
      });
    } finally {
      this.setData({ sending: false });
    }
  },

  async retryMessage(event: WechatMiniprogram.TouchEvent) {
    if (this.data.sending) return;
    const id = event.currentTarget.dataset.id as string;
    const message = this.data.messages.find((item) => item.id === id);
    if (!message || message.sendState !== 'failed' || !message.clientMessageId) return;
    await this.sendTextMessage(message.content, message.clientMessageId, true);
  },

  toggleExtension() {
    if (this.data.conversation?.readOnly) return;
    this.setData({ extensionOpen: !this.data.extensionOpen });
  },

  confirmExchange(event: WechatMiniprogram.TouchEvent) {
    const kind = event.currentTarget.dataset.kind as JobExchangeKind;
    if (!['PHONE', 'WECHAT', 'RESUME'].includes(kind) || this.data.exchanging) return;
    const prompts: Record<JobExchangeKind, { title: string; content: string }> = {
      PHONE: {
        title: '交换电话',
        content: '确认将你在简历中设置的电话与招聘方岗位电话发送到当前聊天？',
      },
      WECHAT: {
        title: '交换微信',
        content: '确认将你在简历中设置的微信与招聘方岗位微信发送到当前聊天？',
      },
      RESUME: {
        title: '交换简历',
        content: '确认将当前完整简历发送给招聘方？发送后本次快照会保留在聊天记录中。',
      },
    };
    const prompt = prompts[kind];
    this.setData({ extensionOpen: false });
    wx.showModal({
      title: prompt.title,
      content: prompt.content,
      confirmText: '确认交换',
      success: (result) => {
        if (result.confirm) void this.submitExchange(kind);
      },
    });
  },

  async submitExchange(kind: JobExchangeKind) {
    const conversation = this.data.conversation;
    if (!conversation || conversation.role !== 'student' || conversation.readOnly || this.data.exchanging) return;
    this.setData({ exchanging: true });
    try {
      const message = await sendJobConversationExchange(conversation.id, kind, createClientMessageId());
      this.mergeMessages([message], true);
      wx.showToast({ title: '已发送', icon: 'success' });
    } catch (error) {
      const apiError = error as { code?: number; message?: string };
      if (apiError.code !== 40008) return;
      const message = apiError.message || '交换信息未配置';
      if (!message.includes('我的简历')) {
        wx.showToast({ title: message, icon: 'none' });
        return;
      }
      wx.showModal({
        title: '信息未完善',
        content: message,
        confirmText: '去完善',
        success: (result) => {
          if (result.confirm) wx.navigateTo({ url: '/pages/resume/index' });
        },
      });
    } finally {
      this.setData({ exchanging: false });
    }
  },

  openJobDetail() {
    const conversation = this.data.conversation;
    if (!conversation) return;
    const url = conversation.role === 'merchant'
      ? `/pages/merchant/job-detail/index?id=${encodeURIComponent(conversation.jobPost.id)}`
      : `/pages/job/detail/index?id=${encodeURIComponent(conversation.jobPost.id)}`;
    wx.navigateTo({ url });
  },

  openInvitation() {
    if (this.data.conversation?.role !== 'merchant') return;
    this.meetingParseSeq += 1;
    this.setData({
      extensionOpen: false,
      invitationOpen: true,
      meetingSource: '',
      parsedMeetingSource: '',
      meetingForm: { ...EMPTY_MEETING_FORM },
      meetingErrors: { ...EMPTY_MEETING_ERRORS },
      parsing: false,
      parsed: false,
    });
  },

  closeInvitation() {
    if (this.data.inviting) return;
    this.meetingParseSeq += 1;
    this.setData({
      invitationOpen: false,
      meetingSource: '',
      parsedMeetingSource: '',
      meetingForm: { ...EMPTY_MEETING_FORM },
      meetingErrors: { ...EMPTY_MEETING_ERRORS },
      parsing: false,
      parsed: false,
    });
  },

  stopPropagation() {
    // 阻止点击面板内容关闭弹层。
  },

  onMeetingSourceInput(event: WechatMiniprogram.Input) {
    const meetingSource = event.detail.value;
    const sourceChanged = normalizeMeetingSource(meetingSource) !== normalizeMeetingSource(this.data.meetingSource);
    const parsedSourceChanged = normalizeMeetingSource(meetingSource) !== this.data.parsedMeetingSource;
    const updates: Record<string, unknown> = { meetingSource };
    if (sourceChanged) {
      this.meetingParseSeq += 1;
      updates.parsing = false;
    }
    if (parsedSourceChanged) {
      updates.parsed = false;
      updates.meetingForm = { ...EMPTY_MEETING_FORM };
      updates.meetingErrors = { ...EMPTY_MEETING_ERRORS };
    }
    this.setData(updates);
  },

  onMeetingFieldInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field as keyof MeetingForm;
    const updates: Record<string, string> = {
      [`meetingForm.${field}`]: event.detail.value,
    };
    if (REQUIRED_MEETING_FIELDS.includes(field as RequiredMeetingField)) {
      updates[`meetingErrors.${field}`] = '';
    }
    this.setData(updates);
  },

  onMeetingDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({
      'meetingForm.meetingDate': event.detail.value as string,
      'meetingErrors.meetingDate': '',
    });
  },

  onMeetingTimeChange(event: WechatMiniprogram.PickerChange) {
    this.setData({
      'meetingForm.meetingTime': event.detail.value as string,
      'meetingErrors.meetingTime': '',
    });
  },

  async parseMeeting() {
    const source = normalizeMeetingSource(this.data.meetingSource);
    if (this.data.parsing || this.data.inviting) return;
    if (!source) {
      wx.showToast({ title: '请先粘贴腾讯会议分享内容', icon: 'none' });
      return;
    }
    const requestSeq = ++this.meetingParseSeq;
    this.setData({ parsing: true });
    try {
      const parsed = await parseTencentMeeting(this.data.applicationId, source);
      if (
        this.destroyed ||
        requestSeq !== this.meetingParseSeq ||
        normalizeMeetingSource(this.data.meetingSource) !== source
      ) {
        return;
      }
      const preserveManualValues = source === this.data.parsedMeetingSource;
      const nextForm = mergeParsedMeetingForm(parsed, this.data.meetingForm, preserveManualValues);
      this.setData({
        meetingForm: nextForm,
        meetingErrors: this.validateMeetingForm(nextForm),
        parsedMeetingSource: source,
        parsed: true,
      });
      wx.showToast({ title: '已识别，请核对信息', icon: 'none' });
    } finally {
      if (requestSeq === this.meetingParseSeq) {
        this.setData({ parsing: false });
      }
    }
  },

  validateMeetingForm(form?: MeetingForm): MeetingErrors {
    const values = form ?? this.data.meetingForm;
    return {
      meetingUrl: values.meetingUrl.trim() ? '' : '请填写腾讯会议链接',
      title: values.title.trim() ? '' : '请填写面试标题',
      meetingDate: values.meetingDate ? '' : '请选择面试日期',
      meetingTime: values.meetingTime ? '' : '请选择面试时间',
      interviewerName: values.interviewerName.trim() ? '' : '请填写面试官名称',
    };
  },

  async submitInvitation() {
    if (this.data.inviting || this.data.parsing) return;
    const meetingErrors = this.validateMeetingForm();
    this.setData({ meetingErrors });
    if (Object.values(meetingErrors).some(Boolean)) return;
    const form = this.data.meetingForm;
    this.setData({ inviting: true });
    try {
      const message = await sendInterviewInvitation(this.data.applicationId, {
        meetingUrl: form.meetingUrl.trim(),
        title: form.title.trim(),
        meetingDate: form.meetingDate,
        meetingTime: form.meetingTime,
        meetingNo: form.meetingNo.trim() || undefined,
        password: form.password.trim() || undefined,
        interviewerName: form.interviewerName.trim(),
      });
      this.meetingParseSeq += 1;
      this.setData({
        invitationOpen: false,
        meetingSource: '',
        parsedMeetingSource: '',
        parsed: false,
        meetingForm: { ...EMPTY_MEETING_FORM },
        meetingErrors: { ...EMPTY_MEETING_ERRORS },
      });
      this.mergeMessages([message], true);
      wx.showToast({ title: '面试邀请已发送', icon: 'success' });
    } finally {
      this.setData({ inviting: false });
    }
  },

  callExchangePhone(event: WechatMiniprogram.TouchEvent) {
    const phoneNumber = event.currentTarget.dataset.value as string;
    if (phoneNumber) wx.makePhoneCall({ phoneNumber });
  },

  copyMeetingValue(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as string;
    if (!value) return;
    wx.setClipboardData({ data: value });
  },

  enterMeeting(event: WechatMiniprogram.TouchEvent) {
    const url = event.currentTarget.dataset.url as string;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '会议链接已复制',
          content: '请打开腾讯会议或浏览器，粘贴链接进入面试。',
          showCancel: false,
          confirmText: '知道了',
        });
      },
    });
  },

  cancelInvitation(event: WechatMiniprogram.TouchEvent) {
    const invitationId = event.currentTarget.dataset.id as string;
    if (!invitationId) return;
    wx.showModal({
      title: '取消面试邀请',
      content: '取消后候选人仍可查看会议记录，但链接将标记为不可用。',
      confirmText: '确认取消',
      confirmColor: '#F53F3F',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          const invitation = await cancelInterviewInvitation(invitationId);
          this.applyInvitationUpdate(invitation);
          wx.showToast({ title: '邀请已取消', icon: 'success' });
        } catch {
          // 请求层已给出具体错误。
        }
      },
    });
  },

  markInvitationCancelled(invitationId: string) {
    const now = new Date().toISOString();
    this.setData({
      messages: this.data.messages.map((message) => {
        const invitation = message.invitation;
        if (!invitation || invitation.id !== invitationId) return message;
        const updated: InterviewInvitationVo = {
          ...invitation,
          status: 'CANCELLED',
          respondedAt: invitation.respondedAt,
          cancelledAt: invitation.cancelledAt ?? now,
        };
        return { ...message, invitation: updated };
      }),
    });
  },

  respondInvitation(event: WechatMiniprogram.TouchEvent) {
    const { id, action } = event.currentTarget.dataset as {
      id: string;
      action: 'accept' | 'reject';
    };
    if (!id || !['accept', 'reject'].includes(action) || this.data.respondingInvitationId) return;
    const accepting = action === 'accept';
    wx.showModal({
      title: accepting ? '接受面试邀请' : '拒绝面试邀请',
      content: accepting
        ? '确认接受本次面试邀请？商家将在候选人列表中看到你的响应。'
        : '确认拒绝本次面试邀请？提交后不能改为接受。',
      confirmText: accepting ? '确认接受' : '确认拒绝',
      confirmColor: accepting ? '#D4A900' : '#F53F3F',
      success: (result) => {
        if (result.confirm) void this.submitInvitationResponse(id, action);
      },
    });
  },

  async submitInvitationResponse(invitationId: string, action: 'accept' | 'reject') {
    if (this.data.respondingInvitationId) return;
    this.setData({ respondingInvitationId: invitationId });
    try {
      const invitation = await respondInterviewInvitation(invitationId, action);
      this.applyInvitationUpdate(invitation);
      wx.showToast({ title: action === 'accept' ? '已接受邀请' : '已拒绝邀请', icon: 'success' });
    } finally {
      this.setData({ respondingInvitationId: '' });
    }
  },

  applyInvitationUpdate(invitation: InterviewInvitationVo) {
    this.setData({
      messages: this.data.messages.map((message) =>
        message.invitation?.id === invitation.id
          ? { ...message, invitation }
          : message,
      ),
    });
  },

  retryLoad() {
    void this.initialize();
  },
});
