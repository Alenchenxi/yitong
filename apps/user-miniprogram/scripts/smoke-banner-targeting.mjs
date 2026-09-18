import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const read = (p) => readFileSync(resolve(repo, p), 'utf8');

// ===== 服务端：Schema / 迁移 / seed =====
const schema = read('apps/server/prisma/schema.prisma');
assert.match(schema, /model Banner \{[\s\S]*?allCommunities\s+Boolean\s+@default\(false\)\s+@map\("all_communities"\)/, 'Banner 必须有 all_communities 标记');
assert.match(schema, /model BannerCommunity \{[\s\S]*?@@unique\(\[bannerId, communityId\]\)/, '必须有 BannerCommunity 定向表且 (bannerId, communityId) 唯一');
assert.match(schema, /model Community \{[\s\S]*?bannerTargets\s+BannerCommunity\[\]/, 'Community 必须有 bannerTargets 反向关系');

const migrationDir = 'apps/server/prisma/migrations/20260918030000_banner_multi_community';
assert.ok(existsSync(resolve(repo, migrationDir, 'migration.sql')), '必须提交 banner_multi_community 迁移文件');
const migration = read(`${migrationDir}/migration.sql`);
assert.match(migration, /ALTER TABLE "banners" ADD COLUMN "all_communities" BOOLEAN NOT NULL DEFAULT false;/, '迁移必须加 all_communities 列');
assert.match(migration, /CREATE TABLE "banner_communities"/, '迁移必须建 banner_communities 表');

const seed = read('apps/server/prisma/seed.ts');
assert.match(seed, /bn_seed_g1[\s\S]*?allCommunities: true/, 'seed 平台公告 Banner 应为全圈投放');

// ===== 服务端：管理端投放范围 =====
const adminService = read('apps/server/src/modules/admin/admin.service.ts');
assert.match(adminService, /const allCommunities = dto\.allCommunities === true;/, 'createBanner 必须支持 allCommunities');
assert.match(adminService, /normalizeBannerTargetIds[\s\S]*?new Set\(/, '目标圈子必须去重归一（兼容旧 communityId）');
assert.match(adminService, /if \(allCommunities\) \{\s*\n\s*\/\/ 全圈投放是平台级能力，仅平台管理员可用\s*\n\s*this\.accessService\.assertPlatform\(access\);/, '全圈投放必须仅平台管理员');
assert.match(adminService, /targets: \{ create: targetIds\.map\(\(id\) => \(\{ communityId: id \}\)\) \}/, '指定圈投放必须写入定向行');
assert.match(adminService, /bannerCommunity\.deleteMany\(\{ where: \{ bannerId: id \} \}\)/, '改投必须在事务内先清旧定向行');
assert.match(adminService, /if \(existing\.allCommunities\) \{\s*\n\s*\/\/ 全圈广告仅平台管理员可管理\s*\n\s*this\.accessService\.assertPlatform\(access\);/, '全圈广告的编辑/删除/启停必须仅平台管理员');

const adminController = read('apps/server/src/modules/admin/admin.controller.ts');
assert.match(adminController, /createBanner\(@Body\(\) body: \{ title: string; imageUrl: string; linkUrl\?: string \| null; communityId\?: string; communityIds\?: string\[\]; allCommunities\?: boolean;/, '创建接口必须接收投放范围字段');

// ===== 服务端：用户端可见口径 =====
const communityService = read('apps/server/src/modules/community/community.service.ts');
assert.match(
  communityService,
  /OR: \[\s*\{ allCommunities: true \},\s*\{ targets: \{ some: \{ communityId \} \} \},\s*\{ targets: \{ none: \{\} \}, communityId \},\s*\]/,
  '用户端 Banner 可见口径必须为 全圈 / 指定圈含当前圈 / 存量单圈兜底',
);

// ===== 小程序：admin 服务类型 =====
const adminClient = read('apps/user-miniprogram/services/admin.ts');
assert.match(adminClient, /interface AdminBannerVo \{[\s\S]*?allCommunities: boolean;[\s\S]*?targets: AdminBannerTargetVo\[\]/, 'AdminBannerVo 必须带投放范围字段');
assert.match(adminClient, /createBannerAdmin\(data: \{[\s\S]*?communityIds\?: string\[\];[\s\S]*?allCommunities\?: boolean;/, 'createBannerAdmin 必须支持投放范围参数');

// ===== 小程序：ops 面板 =====
const ops = read('apps/user-miniprogram/components/admin-panels/ops/index.ts');
assert.match(ops, /onBannerScopeChange/, '必须有投放范围切换处理');
assert.match(ops, /onBannerTargetToggle/, '必须有多选圈子切换处理');
assert.match(ops, /refreshBannerTargetChips/, '必须维护渲染用 chips');
assert.match(ops, /bannerPlatform = access\?\.isPlatform === true/, '面板必须按平台管理员身份分流');
assert.match(ops, /createBannerAdmin\(\{ \.\.\.base, allCommunities: true \}\)/, '全圈投放必须提交 allCommunities');
assert.match(ops, /createBannerAdmin\(\{ \.\.\.base, communityIds: this\.data\.bnTargetIds \}\)/, '指定圈投放必须提交 communityIds');
assert.match(ops, /targetDesc: item\.allCommunities\s*\? '全部圈子'/, '列表必须展示投放范围描述');

const opsWxml = read('apps/user-miniprogram/components/admin-panels/ops/index.wxml');
assert.match(opsWxml, /data-scope="all" bindtap="onBannerScopeChange">全部圈子</, '必须有“全部圈子”范围项');
assert.match(opsWxml, /data-scope="pick" bindtap="onBannerScopeChange">指定圈子</, '必须有“指定圈子”范围项');
assert.match(opsWxml, /wx:for="\{\{bnTargetChips\}\}"/, '必须渲染指定圈子多选 chips');
assert.match(opsWxml, /\{\{item\.targetDesc\}\} · /, '列表行必须展示投放范围');
assert.match(opsWxml, /wx:else mode="selector" range="\{\{communities\}\}"/, '圈子管理员保留单圈 picker');

console.log('banner multi-community targeting smoke: ok');
