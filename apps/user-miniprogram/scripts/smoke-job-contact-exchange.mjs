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
  /jobPostId_userId: \{ jobPostId: id, userId: actorId \}[\s\S]*toPostVo\(post, isOwner \|\| !!application\)/,
  'only the owner or an existing applicant may unlock in-app job contacts',
);
assert.match(
  communicationController,
  /@Post\('job-conversations\/:id\/exchanges'\)/,
  'exchange endpoint must be registered',
);
assert.match(
  communicationService,
  /assertStudent\(actorId, conversation\.application\)[\s\S]*lockApplication[\s\S]*assertStudent\(actorId, lockedConversation\.application\)/,
  'exchange must check the student role before and after locking the application',
);
assert.match(
  communicationService,
  /tx\.resume\.findUnique\(\{ where: \{ userId: actorId \} \}\)/,
  'student exchange data must be read from the current resume',
);
assert.match(
  communicationService,
  /contactPhoneSnapshot\?\.trim\(\)[\s\S]*contactWechatSnapshot\?\.trim\(\)/,
  'merchant exchange data must prefer the job contact snapshots',
);
assert.match(
  communicationService,
  /exchangePayload: exchangePayload as Prisma\.InputJsonValue/,
  'the generated exchange snapshot must be persisted',
);

assert.match(jobApi, /data: \{ kind, clientMessageId \}/, 'the client may send only exchange kind and idempotency key');
assert.doesNotMatch(
  jobApi,
  /sendJobConversationExchange[\s\S]{0,400}data: \{[^}]*phone|sendJobConversationExchange[\s\S]{0,400}data: \{[^}]*wechat/,
  'the client must not submit contact values to the exchange endpoint',
);
assert.match(resumeTs, /wechat: this\.data\.wechat\.trim\(\) \|\| undefined/, 'resume save must include configured WeChat');
assert.match(resumeWxml, /data-field="wechat"/, 'resume page must expose a WeChat input');

for (const kind of ['PHONE', 'WECHAT', 'RESUME']) {
  assert.match(chatWxml, new RegExp(`data-kind="${kind}"`), `chat extension must expose ${kind}`);
}
assert.match(chatTs, /wx\.showModal\(\{[\s\S]*confirmText: '确认交换'/, 'exchange must require explicit confirmation');
assert.match(chatTs, /sendJobConversationExchange\(conversation\.id, kind, createClientMessageId\(\)\)/, 'confirmed exchange must use a unique idempotency key');
assert.match(chatWxml, /item\.type === 'CONTACT_EXCHANGE'/, 'chat must render contact exchange cards');
assert.match(chatWxml, /item\.type === 'RESUME_EXCHANGE'/, 'chat must render resume exchange cards');
assert.match(chatWxml, /catchtap="callExchangePhone"/, 'phone cards must support direct calls');
assert.match(chatWxml, /catchtap="copyMeetingValue"/, 'WeChat cards must support copying');
assert.match(chatWxss, /\.message-stack\.rich-stack[\s\S]*width: 570rpx/, 'structured cards must use a stable width');
assert.match(chatWxss, /\.extension-panel[\s\S]*display: flex/, 'exchange actions must use a stable horizontal layout');

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
