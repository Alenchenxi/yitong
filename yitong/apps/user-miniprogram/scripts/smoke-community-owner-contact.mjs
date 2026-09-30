import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const schema = read('apps/server/prisma/schema.prisma');
const authService = read('apps/server/src/modules/auth/auth.service.ts');
const tutorSync = read('apps/server/src/modules/tutor-sync/tutor-sync.service.ts');
const jobService = read('apps/server/src/modules/job/job.service.ts');
const adminService = read('apps/server/src/modules/admin/admin.service.ts');
const adminController = read('apps/server/src/modules/admin/admin.controller.ts');
const accountPage = read('apps/user-miniprogram/pages/account-security/index.wxml');
const adminPage = read('apps/user-miniprogram/components/admin-panels/ops/index.wxml');
const adminStyle = read('apps/user-miniprogram/components/admin-panels/ops/index.wxss');

assert.match(schema, /model User[\s\S]*phone\s+String\?[\s\S]*wechat\s+String\?/);
assert.match(schema, /model Community[\s\S]*deletedAt\s+DateTime\?/);
assert.match(authService, /phone: true,[\s\S]*wechat: true/);
assert.match(accountPage, /bindinput="onPhone"[\s\S]*bindinput="onWechat"/);
assert.match(tutorSync, /contactPhoneSnapshot: null,[\s\S]*contactWechatSnapshot: null/);
assert.doesNotMatch(tutorSync, /contactPhoneSnapshot: TUTOR_SYNC_CONTACT/);
assert.match(
  jobService,
  /resolveCommunityOwnerContact[\s\S]*where: \{ id: community\.ownerId \},[\s\S]*select: \{ phone: true, wechat: true \}/,
);
assert.match(jobService, /isExternalTutorPost[\s\S]*communityOwnerContact\?\.phone \?\? null/);
// 平台管理员发布岗位（非同步家教）：圈子管理员联系方式优先，回退发岗时快照
assert.match(
  jobService,
  /isPlatformManagedPost[\s\S]*publisherScope === PublicationScope\.PLATFORM/,
);
assert.match(
  jobService,
  /isExternalTutorPost\(post\) \|\| this\.isPlatformManagedPost\(post\)/,
);
assert.match(
  jobService,
  /circleContact\s*\?\s*\(circleContact\.phone \?\? null\)\s*:\s*\(p\.contactPhoneSnapshot \?\? p\.merchant\?\.contactPhone \?\? null\)/,
);
assert.match(
  jobService,
  /circleContact\s*\?\s*\(circleContact\.wechat \?\? null\)\s*:\s*\(p\.contactWechatSnapshot \?\? p\.merchant\?\.contactWechat \?\? null\)/,
);
assert.match(adminService, /updateMany\([\s\S]*status: CommunityStatus\.DISABLED[\s\S]*adminAuditLog\.create/);
assert.match(adminService, /enableCommunity[\s\S]*updateMany\([\s\S]*status: CommunityStatus\.DISABLED[\s\S]*deletedAt: null/);
assert.match(adminService, /getModerationContexts[\s\S]*communityWhere\(access\), deletedAt: null/);
assert.match(adminService, /id: \{ in: normalizedIds \}, deletedAt: null/);
assert.match(adminService, /community: \{ deletedAt: null \}/);
assert.match(read('apps/server/src/modules/community/community.service.ts'), /where: \{ id, status: CommunityStatus\.ACTIVE, deletedAt: null \}/);
assert.match(read('apps/server/src/modules/community/community.service.ts'), /community: \{ deletedAt: null \}/);
assert.match(adminController, /@Delete\('communities\/:id'\)/);
assert.match(
  adminPage,
  /<scroll-view class="adm-community-list" scroll-y[\s\S]*item\.status === 'DISABLED'[\s\S]*bindtap="deleteCommunity"/,
);
assert.match(adminStyle, /\.adm-community-list \{ max-height: 720rpx;/);

console.log('community owner contact smoke passed');
