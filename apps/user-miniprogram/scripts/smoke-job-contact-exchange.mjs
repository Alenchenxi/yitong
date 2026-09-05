import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const schema = read('apps/server/prisma/schema.prisma');
const migration = read('apps/server/prisma/migrations/20260904143000_job_contact_exchange/migration.sql');
const jobService = read('apps/server/src/modules/job/job.service.ts');
const communicationService = read('apps/server/src/modules/job-communication/job-communication.service.ts');
const communicationController = read('apps/server/src/modules/job-communication/job-communication.controller.ts');
const jobApi = read('apps/user-miniprogram/services/job.ts');
const resumeTs = read('apps/user-miniprogram/pages/resume/index.ts');
const resumeWxml = read('apps/user-miniprogram/pages/resume/index.wxml');
const chatTs = read('apps/user-miniprogram/pages/job/chat/index.ts');
const chatWxml = read('apps/user-miniprogram/pages/job/chat/index.wxml');
const chatWxss = read('apps/user-miniprogram/pages/job/chat/index.wxss');
const applyTs = read('apps/user-miniprogram/pages/job/apply/index.ts');
const applyWxml = read('apps/user-miniprogram/pages/job/apply/index.wxml');

assert.match(schema, /CONTACT_EXCHANGE\s+RESUME_EXCHANGE/, 'Prisma must define both exchange message types');
assert.match(schema, /exchangePayload\s+Json\?/, 'chat messages must persist immutable exchange payloads');
assert.match(schema, /model Resume[\s\S]*wechat\s+String\?/, 'resume must persist optional WeChat');
assert.match(migration, /ADD VALUE 'CONTACT_EXCHANGE'/, 'migration must add contact exchange enum value');
assert.match(migration, /ADD COLUMN "exchange_payload" JSONB/, 'migration must add exchange JSON payload');
assert.match(migration, /ADD COLUMN "wechat" TEXT/, 'migration must add resume WeChat');

assert.match(
  jobService,
  /jobPostId_userId: \{ jobPostId: id, userId: actorId \}[\s\S]*toPostVo\(post, isOwner \|\| !!application\)[\s\S]*myApplication:/,
  'only the owner or an existing applicant may unlock in-app job contacts',
);
assert.match(
  communicationController,
  /@Post\('job-conversations\/:id\/exchanges'\)/,
  'exchange endpoint must be registered',
);
assert.match(
  communicationService,
  /assertParticipant\(actorId, conversation\.application\)[\s\S]*lockApplication[\s\S]*assertParticipant\(actorId, lockedConversation\.application\)/,
  'both conversation participants must be able to request an exchange',
);
assert.match(
  communicationService,
  /tx\.resume\.findUnique\(\{ where: \{ userId: lockedConversation\.studentId \} \}\)/,
  'exchange data must always read the applicant current resume regardless of requester',
);
assert.match(
  communicationService,
  /contactPhoneSnapshot\?\.trim\(\)[\s\S]*contactWechatSnapshot\?\.trim\(\)/,
  'merchant exchange data must prefer the job contact snapshots',
);
assert.match(
  communicationService,
  /exchangeStatus: JobExchangeStatus\.PENDING/,
  'new exchanges must start pending',
);
assert.match(
  communicationService,
  /JobConversationMessageType\.TEXT[\s\S]*需要对方回复后才可以使用/,
  'the server must reject exchanges until both participants have sent text messages',
);
assert.match(
  communicationService,
  /respondExchange[\s\S]*exchangeStatus: targetStatus[\s\S]*exchangePayload[,}]/,
  'only an explicit response may persist the unlocked exchange snapshot',
);
assert.match(communicationController, /exchanges\/:messageId\/respond/, 'exchange response endpoint must be registered');

assert.match(jobApi, /data: \{ kind, clientMessageId \}/, 'the client may send only exchange kind and idempotency key');
assert.doesNotMatch(
  jobApi,
  /sendJobConversationExchange[\s\S]{0,400}data: \{[^}]*phone|sendJobConversationExchange[\s\S]{0,400}data: \{[^}]*wechat/,
  'the client must not submit contact values to the exchange endpoint',
);
assert.match(resumeTs, /wechat: this\.data\.wechat\.trim\(\) \|\| undefined/, 'resume save must include configured WeChat');
assert.match(resumeWxml, /data-field="wechat"/, 'resume page must expose a WeChat input');

assert.match(chatTs, /\['PHONE', 'WECHAT', 'RESUME'\]/, 'chat must expose all three exchange actions');
assert.match(jobApi, /exchangeReady: boolean/, 'conversation summary must expose exchange readiness');
assert.match(chatWxml, /disabled="\{\{!conversation\.exchangeReady \|\| item\.pending \|\| conversation\.readOnly \|\| exchanging\}\}"/, 'unreplied exchange controls must use the native disabled state');
assert.match(chatWxml, /!conversation\.exchangeReady[\s\S]*需要对方回复后才可以使用/, 'unreplied conversations must show the exchange gate reason');
assert.match(chatTs, /需要对方回复后才可以使用/, 'tapping a gated exchange action must explain why it is unavailable');
assert.match(
  chatTs,
  /observeConfirmedTextSenders[\s\S]*refreshExchangeReadiness[\s\S]*getJobConversation\(this\.data\.conversationId\)/,
  'new confirmed text must refresh server readiness when the other participant text is outside the loaded page',
);
assert.match(
  chatTs,
  /catch \{[\s\S]{0,180}confirmedTextSenders\.clear\(\)/,
  'a failed readiness refresh must be retried after the next message poll',
);
assert.match(chatWxml, /class="exchange-toolbar"[\s\S]*data-kind="\{\{item\.kind\}\}"/, 'exchange actions must be placed in the top toolbar');
assert.ok(
  chatWxml.indexOf('class="exchange-toolbar"') < chatWxml.indexOf('class="conversation-card"'),
  'exchange toolbar must be the first conversation block below the navigation bar',
);
assert.match(chatTs, /wx\.showModal\(\{[\s\S]*confirmText: '确认交换'/, 'exchange must require explicit confirmation');
assert.match(chatTs, /sendJobConversationExchange\(conversation\.id, kind, createClientMessageId\(\)\)/, 'confirmed exchange must use a unique idempotency key');
assert.match(chatTs, /respondJobConversationExchange/, 'chat must support accepting or rejecting exchange requests');
assert.match(
  chatTs,
  /serverPendingKinds\.includes\(action\.kind\)/,
  'top toolbar must preserve pending state when a request is outside the first message page',
);
assert.doesNotMatch(
  chatTs,
  /if \(!conversation \|\| conversation\.role !== 'student' \|\| conversation\.readOnly/,
  'merchant must also be able to initiate exchanges',
);
assert.match(chatWxml, /item\.type === 'CONTACT_EXCHANGE'/, 'chat must render contact exchange cards');
assert.match(chatWxml, /item\.type === 'RESUME_EXCHANGE'/, 'chat must render resume exchange cards');
assert.match(chatWxml, /data-action="accept"/, 'pending exchange cards must expose accept');
assert.match(chatWxml, /data-action="reject"/, 'pending exchange cards must expose reject');
assert.match(
  chatWxml,
  /data-action="accept"[\s\S]{0,160}disabled="\{\{!conversation\.exchangeReady \|\| respondingExchangeId === item\.id\}\}"/,
  'accepting a pending exchange must remain disabled until both participants have replied',
);
assert.match(chatWxml, /item\.exchange\.status === 'PENDING'/, 'pending exchanges must render without unlocked details');
assert.match(chatWxml, /item\.exchange\.status === 'REJECTED'/, 'rejected exchanges must keep a terminal card');
assert.match(chatWxml, /catchtap="callExchangePhone"/, 'phone cards must support direct calls');
assert.match(chatWxml, /catchtap="copyMeetingValue"/, 'WeChat cards must support copying');
assert.match(chatWxss, /\.message-stack\.rich-stack[\s\S]*width: 570rpx/, 'structured cards must use a stable width');
assert.match(chatWxss, /\.exchange-toolbar[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, 'top exchange actions must use a stable three-column layout');

assert.match(
  applyTs,
  /const refreshedPost = await getJobPost\(this\.data\.postId\)[\s\S]*this\.setData\(\{ application, post: refreshedPost \}\)/,
  'successful application must refresh contact visibility immediately',
);
assert.match(applyWxml, /success-contact[\s\S]*post\.contactPhone[\s\S]*post\.contactWechat/, 'application success must show publisher contacts');

const openViews = (chatWxml.match(/<view(?:\s|>)/g) || []).length;
const closeViews = (chatWxml.match(/<\/view>/g) || []).length;
assert.equal(openViews, closeViews, 'chat WXML view tags must remain balanced');

process.stdout.write('job contact exchange smoke: ok\n');
