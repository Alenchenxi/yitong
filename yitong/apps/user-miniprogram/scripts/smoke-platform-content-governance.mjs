import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = resolve(root, '../server');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readServer = (path) => readFileSync(resolve(serverRoot, path), 'utf8');

const schema = readServer('prisma/schema.prisma');
for (const field of ['publisherScope', 'visibilityScope', 'moderationAuthority', 'moderationVersion']) {
  assert.match(schema, new RegExp(`${field}\\s`), `schema must define ${field}`);
}
assert.match(schema, /model CommunityUserBan \{/);
const anonModel = schema.match(/model AnonymousPost \{[\s\S]*?\n\}/)?.[0] ?? '';
assert.doesNotMatch(anonModel, /\b(?:userId|uid|openid|adminId)\b/, 'anonymous posts must not persist real identity');

const policy = readServer('src/modules/publication/publication-policy.service.ts');
assert.match(policy, /isPlatformUser/);
assert.match(policy, /publisherScope: PublicationScope\.PLATFORM/);
assert.match(policy, /visibilityScope: ContentVisibilityScope\.ALL_COMMUNITIES/);
assert.match(policy, /communityUserBan\.find(?:First|Unique)/);
assert.match(policy, /active: true/);
assert.match(policy, /select: \{ deletedAt: true \}/);
assert.match(policy, /u\."deleted_at" IS NULL/);
assert.match(policy, /"deleted_at" AS "deletedAt"/);
assert.match(policy, /throwAccountBanned/);

for (const [name, path] of [
  ['confession', 'src/modules/confession/confession.service.ts'],
  ['treehole', 'src/modules/treehole/treehole.service.ts'],
  ['job', 'src/modules/job/job.service.ts'],
]) {
  const source = readServer(path);
  assert.match(source, /platformPublished/, `${name} must expose the platform badge flag`);
  assert.match(source, /PublicationScope\.PLATFORM/, `${name} must identify platform publications`);
}

const admin = readServer('src/modules/admin/admin.service.ts');
assert.match(admin, /assertModerationTarget/);
assert.match(admin, /moderationVersion: \{ increment: 1 \}/);
assert.match(admin, /HttpStatus\.CONFLICT/);
assert.match(admin, /this\.prisma\.\$transaction/);
assert.match(admin, /communityUserBan\.findUnique/);
assert.match(admin, /communityUserBan\.create/);
assert.match(admin, /communityUserBan\.updateMany/);
assert.match(admin, /OR: \[\{ active: false \}, \{ authority: ModerationAuthority\.COMMUNITY \}\]/);
assert.match(admin, /ModerationAuthority\.PLATFORM/);

const adminApi = read('services/admin.ts');
assert.match(adminApi, /getModerationContexts/);
assert.match(adminApi, /expectedVersion/);
assert.match(adminApi, /unbanUser/);
assert.match(adminApi, /communityId/);

for (const path of ['services/confession.ts', 'services/treehole.ts', 'services/job.ts']) {
  assert.match(read(path), /platformPublished: boolean;/, `${path} must expose platformPublished`);
}
assert.match(read('components/post-card/post-card.wxml'), /平台发布/);
assert.match(read('components/job-card/job-card.wxml'), /平台发布/);
const reviewWxml = read('components/admin-panels/review/index.wxml');
const reviewTs = read('components/admin-panels/review/index.ts');
assert.match(reviewWxml, /moderationScope/);
assert.match(reviewWxml, /restorePostTap/);
assert.match(reviewWxml, /loadingMore \? '加载中…' : '加载更多'/);
assert.match(reviewTs, /loadingMore: false/);
assert.match(reviewTs, /this\.data\.loadingMore/);
assert.match(reviewTs, /requestVersion: 0/);
assert.equal(
  (reviewTs.match(/if \(!this\.isCurrentRequest\(activeRequestVersion\)\) return;/g) ?? []).length,
  5,
  'each paged review list must reject stale responses',
);
assert.equal(
  (reviewTs.match(/if \(this\.isCurrentRequest\(requestVersion\)\) this\.setData\(\{ loadingMore: false \}\);/g) ?? []).length,
  5,
  'stale requests must not release a newer load-more lock',
);
assert.equal(
  (reviewWxml.match(/isPlatformAdmin \|\| item\.moderationAuthority === 'COMMUNITY'/g) ?? []).length,
  3,
  'community admins must not see platform-authority restore actions',
);
assert.match(admin, /orderBy: \[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/);
const searchWxml = read('pages/content-search/index.wxml');
const treeholeSearchBlock = searchWxml.match(/anonymousContentEnabled && tab === 'treehole'[\s\S]*?<!-- 兼职结果 -->/)?.[0] ?? '';
assert.equal(
  (treeholeSearchBlock.match(/平台发布/g) ?? []).length,
  1,
  'treehole search result must render the platform badge once',
);
const usersWxml = read('components/admin-panels/users/index.wxml');
const usersTs = read('components/admin-panels/users/index.ts');
assert.match(usersWxml, /switchUserScope/);
assert.match(usersWxml, /unbanUserTap/);
assert.match(usersWxml, /isPlatformAdmin \|\| item\.banAuthority === 'COMMUNITY'/);
assert.match(usersTs, /requestVersion: 0/);
assert.match(usersTs, /const userQuery = this\.userQuery\(\);/);
assert.match(usersTs, /listUsers\(userKeyword, userQuery\)/);
assert.equal((usersTs.match(/if \(this\.data\.requestVersion !== requestVersion\) return;/g) ?? []).length, 4);
assert.match(usersTs, /if \(this\.data\.requestVersion === requestVersion\) \{/);

const payment = readServer('src/modules/payment/payment.service.ts');
assert.equal(
  (payment.match(/publicationPolicy\.assertCommunityInteractionAllowed\(/g) ?? []).length,
  3,
  'all paid order entry points must reject community-banned publishers before checkout',
);
assert.match(payment, /code: 'FAIL', message: '微信退款回调未接入'/);
assert.match(payment, /refundStatus: 'REQUIRED'/);
assert.match(payment, /retryRequiredFulfillmentRefunds/);
assert.match(payment, /@Cron\('0 \*\/5 \* \* \* \*'\)/);
const jwtGuard = readServer('src/modules/auth/jwt-auth.guard.ts');
const anonGuard = readServer('src/modules/treehole/anon.guard.ts');
assert.match(jwtGuard, /user\.deletedAt/);
assert.match(anonGuard, /user\.deletedAt/);
const treehole = readServer('src/modules/treehole/treehole.service.ts');
assert.match(treehole, /encodeAnonPostCursor/);
assert.match(treehole, /orderBy: \[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/);

console.log('platform content governance smoke: ok');
