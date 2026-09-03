import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const serverRoot = resolve(root, '../server');
const readServer = (path) => readFileSync(resolve(serverRoot, path), 'utf8');

const schema = readServer('prisma/schema.prisma');
assert.match(schema, /model AdminType {/);
assert.match(schema, /model AdminPermission {/);
assert.match(schema, /model AdminCommunityScope {/);
assert.match(schema, /model AdminAuditLog {/);
assert.ok(
  schema.includes('communityId String       @map("community_id") // 所有广告位必须归属具体圈子'),
  'Banner.communityId 必须为非空 String',
);
assert.doesNotMatch(schema, /communityId String\?/);

const guard = readServer('src/modules/auth/admin.guard.ts');
assert.match(guard, /accessService\.resolve\(req\.user\.openid\)/);
assert.match(guard, /仅平台管理员可管理管理员权限/);
assert.match(guard, /!required\?\.length/);

const adminController = readServer('src/modules/admin/admin.controller.ts');
for (const permission of [
  'CONTENT_MODERATE',
  'BANNER_MANAGE',
  'COMMUNITY_VIEW',
  'COMMUNITY_EDIT',
  'COMMUNITY_REVIEW',
  'ADMIN_MANAGE',
  'ADMIN_TYPE_MANAGE',
]) {
  assert.match(adminController, new RegExp(`ADMIN_PERMISSIONS\\.${permission}`));
}

const adminService = readServer('src/modules/admin/admin.service.ts');
assert.match(adminService, /communityIdWhere\(access\)/);
assert.match(adminService, /assertCommunity\(access, existing\.communityId\)/);
assert.match(adminService, /广告位必须选择所属圈子/);
assert.match(adminService, /TransactionIsolationLevel\.Serializable/);
assert.match(adminService, /该用户已是管理员，请使用编辑功能调整权限/);
assert.match(adminService, /adminUser\.create\(/);
assert.doesNotMatch(adminService, /adminUser\.upsert\(/);
assert.match(adminService, /username: `admin_\$\{user\.id\}`/);
assert.match(adminService, /targets\.includes\('openid'\)/);
assert.doesNotMatch(adminService, /reports: reports\.map/);
assert.match(adminService, /adminType\.delete\(\{ where: \{ id \} \}\)/);

const announcementController = readServer('src/modules/announcement/announcement.controller.ts');
assert.match(announcementController, /RequireAdminPermission\(ADMIN_PERMISSIONS\.GLOBAL_OPERATIONS\)/);

const app = read('app.ts');
assert.match(app, /refreshAdminAccess\(\)/);
assert.match(app, /ADMIN_ACCESS_STORAGE_KEY/);
assert.match(app, /currentRole === 'admin'/);

const adminPage = read('pages/admin/index.ts');
assert.match(adminPage, /visibleTabs\(access\)/);
assert.match(adminPage, /access\.isPlatform/);
assert.match(adminPage, /'community\.review'/);

const usersPanel = read('components/admin-panels/users/index.ts');
assert.match(usersPanel, /access\.isPlatform && can\('admin_type\.manage'\)/);
assert.match(usersPanel, /selectedAdminTypeId/);
assert.match(usersPanel, /selectedCommunityIds/);
assert.match(usersPanel, /createAdminType/);
assert.match(usersPanel, /updateAdminType/);
assert.match(usersPanel, /deleteAdminType/);

const opsPanel = read('components/admin-panels/ops/index.ts');
assert.match(opsPanel, /communityId: this\.data\.bnCommunityId/);
assert.doesNotMatch(opsPanel, /communityId: null/);
assert.match(opsPanel, /updateCommunityAdmin/);
assert.match(opsPanel, /canCommunityEdit: can\('community\.edit'\)/);
assert.match(opsPanel, /canCommunityReview: can\('community\.review'\)/);

const opsTemplate = read('components/admin-panels/ops/index.wxml');
assert.match(opsTemplate, /wx:if="\{\{canCommunityEdit\}\}"/);
assert.match(opsTemplate, /wx:if="\{\{canCommunityReview && item\.id/);

const publicCommunity = readServer('src/modules/community/community.service.ts');
assert.match(publicCommunity, /where: \{ status: 'ENABLED', communityId \}/);
assert.doesNotMatch(publicCommunity, /communityId: null/);

console.log('admin RBAC smoke: ok');
