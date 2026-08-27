import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const miniprogram = new URL('../../user-miniprogram/', import.meta.url);
const [meetingHelperTs, chatTs, jobServiceTs, chatWxml, candidateWxml, candidateWxss] = await Promise.all([
  readFile(new URL('pages/job/chat/meeting-form.ts', miniprogram), 'utf8'),
  readFile(new URL('pages/job/chat/index.ts', miniprogram), 'utf8'),
  readFile(new URL('services/job.ts', miniprogram), 'utf8'),
  readFile(new URL('pages/job/chat/index.wxml', miniprogram), 'utf8'),
  readFile(new URL('pages/candidates/detail/index.wxml', miniprogram), 'utf8'),
  readFile(new URL('pages/candidates/detail/index.wxss', miniprogram), 'utf8'),
]);

const compiledHelper = ts.transpileModule(meetingHelperTs, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const helperModule = { exports: {} };
vm.runInNewContext(compiledHelper, {
  module: helperModule,
  exports: helperModule.exports,
});
const { EMPTY_MEETING_FORM, mergeParsedMeetingForm } = helperModule.exports;

const parsedA = {
  meetingUrl: 'https://meeting.tencent.com/dm/meeting-a',
  title: '第一轮面试',
  meetingDate: '2026-08-29',
  meetingTime: '14:30',
  meetingNo: '111222333',
  password: '2468',
  interviewerName: '陈老师',
};
const formA = mergeParsedMeetingForm(parsedA, EMPTY_MEETING_FORM, false);
const parsedB = {
  meetingUrl: 'https://meeting.tencent.com/dm/meeting-b',
  title: null,
  meetingDate: '2026-08-30',
  meetingTime: null,
  meetingNo: null,
  password: null,
  interviewerName: null,
};
const formB = mergeParsedMeetingForm(parsedB, formA, false);
assert.deepEqual(
  JSON.parse(JSON.stringify(formB)),
  {
    meetingUrl: 'https://meeting.tencent.com/dm/meeting-b',
    title: '',
    meetingDate: '2026-08-30',
    meetingTime: '',
    meetingNo: '',
    password: '',
    interviewerName: '',
  },
  '连续解析不同分享源时，第二份缺失字段不继承第一份会议数据',
);

const manuallyCompletedA = {
  ...formA,
  interviewerName: '人工补充面试官',
};
const reparsedA = mergeParsedMeetingForm(
  { ...parsedA, interviewerName: null },
  manuallyCompletedA,
  true,
);
assert.equal(
  reparsedA.interviewerName,
  '人工补充面试官',
  '同一分享源重新识别时保留解析缺失字段的人工补充内容',
);

assert(
  chatTs.includes('parsedMeetingSource') &&
    chatTs.includes('meetingParseSeq') &&
    chatTs.includes('requestSeq !== this.meetingParseSeq') &&
    chatTs.includes('normalizeMeetingSource(this.data.meetingSource) !== source'),
  '聊天页记录已解析分享源，并阻止切换来源后的过期解析请求回写',
);
assert(
  (chatTs.match(/parsedMeetingSource: ''/gu) ?? []).length >= 3 &&
    (chatTs.match(/meetingForm: \{ \.\.\.EMPTY_MEETING_FORM \}/gu) ?? []).length >= 4,
  '打开、关闭和发送成功后均清空会议分享源与表单状态',
);
assert(
  chatTs.includes('if (this.data.parsing || this.data.inviting) return;') &&
    chatTs.includes('if (this.data.inviting || this.data.parsing) return;') &&
    chatWxml.includes('disabled="{{parsing || inviting}}"') &&
    chatWxml.includes('disabled="{{inviting || parsing}}"'),
  '会议识别与邀请发送互斥，避免迟到识别结果污染已提交或关闭的表单',
);

assert(
  chatTs.includes("if (!applicationId && !conversationId)") &&
    chatTs.includes("applicationId: base.applicationId"),
  "聊天页允许仅凭 conversationId 进入，并以服务端会话 applicationId 覆盖 URL 参数",
);
assert(
  jobServiceTs.includes("sendJobConversationMessage(conversationId: string, content: string, clientMessageId: string)") &&
    jobServiceTs.includes("data: { content, clientMessageId }"),
  "发送消息请求必须携带稳定 clientMessageId",
);
assert(
  chatTs.includes("clientMessageId") &&
    chatTs.includes("message.clientMessageId") &&
    chatTs.includes("sendJobConversationMessage(conversation.id, content, clientMessageId)"),
  "聊天页乐观发送与失败重试必须复用同一 clientMessageId",
);
assert(
  chatTs.includes("byClientMessageId") && chatTs.includes("byServerId"),
  "聊天消息合并同时按 clientMessageId 与服务端 id 去重并替换本地状态",
);

const compiledChat = ts.transpileModule(chatTs, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sentCalls = [];
let sendJobMessageImpl = async (conversationId, content, clientMessageId) => ({
  id: `server-${clientMessageId}`,
  senderId: 'student_a',
  type: 'TEXT',
  content,
  clientMessageId,
  invitation: null,
  createdAt: '2026-08-27T00:01:00.000Z',
});
const serverConversation = {
  id: 'conversation_server',
  applicationId: 'application_server',
  role: 'student',
  readOnly: false,
  applicationStatus: 'PENDING',
  jobPost: { id: 'post_a', title: '校园活动助理', salary: '150元/天', location: '大学生活动中心' },
  peer: { id: 'merchant_user_a', name: '校园服务站', avatarUrl: null },
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
};
const jobModule = {
  ensureJobConversation: async () => serverConversation,
  getJobConversation: async () => serverConversation,
  listJobConversationMessages: async () => ({ list: [], nextCursor: null, hasMore: false }),
  sendJobConversationMessage: async (conversationId, content, clientMessageId) => {
    sentCalls.push({ conversationId, content, clientMessageId });
    return sendJobMessageImpl(conversationId, content, clientMessageId);
  },
  cancelInterviewInvitation: async () => ({}),
  parseTencentMeeting: async () => ({}),
  sendInterviewInvitation: async () => ({}),
};
const imModule = {
  connectIm: async () => undefined,
  getImToken: async () => ({}),
  onMessage: () => () => undefined,
};
const miniApp = {
  requireAuth: () => true,
  globalData: { user: { id: 'student_a' } },
};
let pageDefinition = null;
const chatModule = { exports: {} };
vm.runInNewContext(compiledChat, {
  module: chatModule,
  exports: chatModule.exports,
  require(specifier) {
    if (specifier === '../../../services/job') return jobModule;
    if (specifier === '../../../services/im') return imModule;
    if (specifier === './meeting-form') return helperModule.exports;
    throw new Error(`unexpected module: ${specifier}`);
  },
  Page(definition) { pageDefinition = definition; },
  getApp: () => miniApp,
  wx: {
    setNavigationBarTitle: () => undefined,
    showToast: () => undefined,
    setClipboardData: () => undefined,
    showModal: () => undefined,
    navigateTo: () => undefined,
  },
  setInterval: () => 1,
  clearInterval: () => undefined,
  console,
});
assert(pageDefinition, '聊天页应注册 Page 定义');
const page = {
  ...pageDefinition,
  data: structuredClone(pageDefinition.data),
  setData(updates, callback) {
    for (const [path, value] of Object.entries(updates)) {
      const keys = path.split('.');
      let target = this.data;
      for (const key of keys.slice(0, -1)) {
        target[key] ??= {};
        target = target[key];
      }
      target[keys[keys.length - 1]] = value;
    }
    callback?.();
  },
};
await page.onLoad({ conversationId: 'conversation_server', applicationId: 'application_from_url' });
assert.equal(page.data.applicationId, 'application_server', '服务端会话 applicationId 覆盖 URL 参数');

const failedMessage = {
  id: 'local-client_a',
  senderId: 'student_a',
  type: 'TEXT',
  content: '你好',
  clientMessageId: 'client_a',
  invitation: null,
  createdAt: '2026-08-27T00:00:30.000Z',
  clientKey: 'client-client_a',
  anchorId: 'message-local-client_a',
  mine: true,
  timeText: '08:00',
  dayText: '今天',
  showDay: true,
  sendState: 'failed',
};
const serverMessage = {
  id: 'message_a',
  senderId: 'student_a',
  type: 'TEXT',
  content: '你好',
  clientMessageId: 'client_a',
  invitation: null,
  createdAt: '2026-08-27T00:01:00.000Z',
};
page.data.messages = [failedMessage];
page.mergeMessages([serverMessage], false);
page.mergeMessages([serverMessage], false);
assert.equal(page.data.messages.length, 1, '轮询、WS 与 POST 响应按 clientMessageId/id 去重');
assert.equal(page.data.messages[0].id, 'message_a', '服务端消息替换对应本地失败消息');
assert.equal(page.data.messages[0].sendState, 'sent', '服务端消息将本地失败状态更新为已发送');

page.data.messages = [{ ...failedMessage, id: 'local-retry_a', clientMessageId: 'retry_a' }];
page.data.sending = false;
await page.retryMessage({ currentTarget: { dataset: { id: 'local-retry_a' } } });
assert.equal(sentCalls.at(-1).clientMessageId, 'retry_a', '失败重试复用原 clientMessageId');
assert.equal(page.data.messages.length, 1, '重试响应替换失败消息而非追加重复项');

let rejectDelayedSend;
sendJobMessageImpl = async () => new Promise((_, reject) => {
  rejectDelayedSend = reject;
});
page.data.messages = [];
page.data.sending = false;
const delayedSend = page.sendTextMessage('竞态消息', 'race_a', false);
const confirmedRaceMessage = {
  id: 'message_race_a',
  senderId: 'student_a',
  type: 'TEXT',
  content: '竞态消息',
  clientMessageId: 'race_a',
  invitation: null,
  createdAt: '2026-08-27T00:02:00.000Z',
};
page.mergeMessages([confirmedRaceMessage], false);
rejectDelayedSend(new Error('模拟响应丢失'));
await delayedSend;
assert.equal(page.data.messages.length, 1, '响应丢失时已由轮询确认的消息不应恢复本地副本');
assert.equal(page.data.messages[0].id, 'message_race_a', '轮询确认的服务端消息保持为唯一消息');
assert.equal(page.data.messages[0].sendState, 'sent', '迟到的 POST 失败不得把已确认消息改回发送失败');


assert(
  candidateWxml.includes('src="{{detail.user.avatarUrl}}"') &&
    candidateWxml.includes('/assets/icons/recruitment/user.svg') &&
    candidateWxml.includes('/assets/icons/recruitment/phone.svg'),
  '候选人基本信息区展示真实头像并复用统一用户/电话线性图标',
);
assert(
  candidateWxml.includes("detail.resume.name || '简历未填写姓名'") &&
    candidateWxml.includes('{{detail.resume.phone}}') &&
    candidateWxml.includes("detail.resume ? '简历未提供联系方式' : '报名时未附简历，暂无联系方式'"),
  '候选人基本信息区展示简历姓名和电话，并区分无简历与简历未留手机号',
);
assert(
  candidateWxss.includes('.candidate-avatar') &&
    candidateWxss.includes('.candidate-info-line'),
  '候选人头像和基本信息行具备对应布局样式',
);

console.log('招聘沟通会话真源、消息幂等去重、会议状态边界与候选人信息 smoke 通过');
