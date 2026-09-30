import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const schema = read('apps/server/prisma/schema.prisma');
const migration = read('apps/server/prisma/migrations/20260904193000_job_interview_feed_chat/migration.sql');
const tutorTypes = read('apps/server/src/modules/tutor-sync/tutor-sync.types.ts');
const tutorPolicy = read('apps/server/src/modules/tutor-sync/tutor-job-policy.service.ts');
const squareService = read('apps/server/src/modules/square/square.service.ts');
const squareTypes = read('apps/server/src/modules/square/types.ts');
const communityService = read('apps/server/src/modules/community/community.service.ts');
const jobService = read('apps/server/src/modules/job/job.service.ts');
const communicationService = read('apps/server/src/modules/job-communication/job-communication.service.ts');
const communicationController = read('apps/server/src/modules/job-communication/job-communication.controller.ts');
const merchantService = read('apps/server/src/modules/merchant/merchant.service.ts');
const jobApi = read('apps/user-miniprogram/services/job.ts');
const merchantApi = read('apps/user-miniprogram/services/merchant.ts');
const detailTs = read('apps/user-miniprogram/pages/job/detail/index.ts');
const detailWxml = read('apps/user-miniprogram/pages/job/detail/index.wxml');
const chatTs = read('apps/user-miniprogram/pages/job/chat/index.ts');
const chatWxml = read('apps/user-miniprogram/pages/job/chat/index.wxml');
const candidatesTs = read('apps/user-miniprogram/components/merchant-panels/candidates/index.ts');
const candidatesWxml = read('apps/user-miniprogram/components/merchant-panels/candidates/index.wxml');

assert.match(tutorTypes, /TUTOR_SYNC_SOURCE = 'SENYANG_TUTOR'/, 'sync source identity must remain stable');
assert.match(tutorTypes, /TUTOR_SYNC_PUBLISHER = '燚桐家教'/, 'publisher name must use the Yitong brand');
assert.match(tutorPolicy, /TUTOR_SYNC_LEGACY_PUBLISHERS/, 'policy must recognize legacy publisher rows');
assert.match(migration, /WHERE "source" = 'SENYANG_TUTOR'/, 'job rename must target sync bindings');
assert.match(migration, /system_tutor_sync_user/, 'system publisher migration must use its stable identity');

assert.doesNotMatch(squareTypes, /job_post|JobPostVo/, 'square feed type must not expose job posts');
assert.doesNotMatch(squareService, /fetchApprovedJobs|kind: 'job_post'/, 'square feed must not query jobs');
assert.doesNotMatch(communityService, /jobPost\.count|jobPost\.groupBy/, 'community dynamic counts must exclude jobs');

assert.match(schema, /enum InterviewInvitationStatus \{\s*PENDING\s+ACCEPTED\s+REJECTED\s+CANCELLED/s);
assert.match(schema, /respondedAt\s+DateTime\?/);
assert.match(migration, /RENAME VALUE 'ACTIVE' TO 'PENDING'/);
assert.match(communicationController, /interview-invitations\/:id\/respond/);
assert.match(communicationService, /lockInterviewInvitation[\s\S]*lockApplication/);
assert.match(communicationService, /invitation\.status === targetStatus/);
assert.match(jobApi, /data: \{ action \}/, 'interview response client must submit only action');
assert.match(chatTs, /wx\.showModal\([\s\S]*submitInvitationResponse/);
assert.match(chatTs, /job-interview-updated/);
assert.match(chatWxml, /data-action="accept"/);
assert.match(chatWxml, /data-action="reject"/);

assert.match(merchantService, /interviewInvitations: \{ some: \{ status: InterviewInvitationStatus\.ACCEPTED/);
assert.match(merchantApi, /interviewStatus\?: 'ACCEPTED'/);
assert.match(candidatesTs, /INTERVIEW_ACCEPTED[\s\S]*interviewStatus: activeStatus === 'INTERVIEW_ACCEPTED'/);
assert.match(candidatesWxml, /acceptedInterview[\s\S]*interview-summary/);

assert.match(jobService, /myApplication: application/);
assert.match(jobService, /conversation: \{ select: \{ id: true \} \}/);
assert.match(detailTs, /ensureJobConversation\(post\.myApplication\.id\)/);
assert.match(detailWxml, /post\.myApplication \? '去沟通' : '立即报名'/);

for (const [name, template] of [['chat', chatWxml], ['candidates', candidatesWxml], ['detail', detailWxml]]) {
  const openViews = (template.match(/<view(?:\s|>)/g) ?? []).length;
  const closeViews = (template.match(/<\/view>/g) ?? []).length;
  assert.equal(openViews, closeViews, `${name} WXML view tags must remain balanced`);
}

process.stdout.write('job interview/feed/chat smoke: ok\n');
