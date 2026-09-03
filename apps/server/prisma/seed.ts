import { JobDuration, PrismaClient } from '@prisma/client';
import {
  ADMIN_PERMISSION_CATALOG,
  COMMUNITY_ADMIN_DEFAULT_PERMISSIONS,
} from '../src/modules/admin/admin-permissions';

// 默认圈子种子数据（幂等：按 name 查重，已存在则跳过）
const DEFAULT_CIRCLES = [
  { name: '表白', icon: '❤️' },
  { name: '失物招领', icon: '🔍' },
  { name: '二手闲置', icon: '📦' },
  { name: '学习交流', icon: '📚' },
  { name: '日常闲聊', icon: '💬' },
];

// 圈子（Community）种子：默认圈子 id 固定 cm_default（迁移回填引用同一 id），幂等按 id 查重
const DEFAULT_COMMUNITY = {
  id: 'cm_default',
  name: '综合大学',
  category: '校园',
  status: 'ACTIVE' as const,
};

// 补充圈子种子（id 幂等；让加入页 / 圈子广场有真实观感。logo 留空走前端首字占位）
const SEED_COMMUNITIES = [
  { id: 'cm_seed_life', name: '校园生活互助', category: '生活', region: '北校区', location: '学生公寓', memberCount: 186, postCount: 342 },
  { id: 'cm_seed_study', name: '考研自习联盟', category: '校园', region: '东校区', location: '图书馆', memberCount: 152, postCount: 208 },
  { id: 'cm_seed_esports', name: '电竞兴趣社', category: '兴趣', region: '南校区', location: '大学生活动中心', memberCount: 97, postCount: 121 },
  { id: 'cm_seed_parttime', name: '校园兼职信息', category: '兼职', region: '全校区', location: '勤工助学中心', memberCount: 64, postCount: 89 },
];

// 广告位占位 Banner（幂等按 id；prod 由管理端换真图）
const DEFAULT_BANNERS = [
  { id: 'bn_seed_1', title: '欢迎来到综合大学圈', imageUrl: 'https://mock-minio.example.com/banners/seed-1.png', communityId: 'cm_default', sortOrder: 1 },
  { id: 'bn_seed_2', title: '新学期招新活动', imageUrl: 'https://mock-minio.example.com/banners/seed-2.png', communityId: 'cm_default', sortOrder: 2 },
  { id: 'bn_seed_g1', title: '平台公告：文明发言', imageUrl: 'https://mock-minio.example.com/banners/seed-global-1.png', communityId: 'cm_default', sortOrder: 3 },
];

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  for (const c of DEFAULT_CIRCLES) {
    const exists = await prisma.circle.findFirst({ where: { name: c.name } });
    if (exists) continue;
    await prisma.circle.create({ data: c });
    created += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`seed: ${created}/${DEFAULT_CIRCLES.length} circles created`);

  // 圈子（Community）：默认圈子（迁移已建则跳过）
  const existsCommunity = await prisma.community.findUnique({ where: { id: DEFAULT_COMMUNITY.id } });
  if (!existsCommunity) {
    await prisma.community.create({ data: DEFAULT_COMMUNITY });
    console.log(`seed: community ${DEFAULT_COMMUNITY.name} created`);
  }
  // 补充圈子（幂等按 id）
  let createdExtraCommunities = 0;
  for (const c of SEED_COMMUNITIES) {
    const exists = await prisma.community.findUnique({ where: { id: c.id } });
    if (exists) continue;
    await prisma.community.create({
      data: { ...c, logo: null, description: null, status: 'ACTIVE' },
    });
    createdExtraCommunities += 1;
  }
  if (createdExtraCommunities > 0) console.log(`seed: ${createdExtraCommunities}/${SEED_COMMUNITIES.length} extra communities created`);
  // 占位 Banner
  let createdBanners = 0;
  for (const b of DEFAULT_BANNERS) {
    const exists = await prisma.banner.findUnique({ where: { id: b.id } });
    if (exists) continue;
    await prisma.banner.create({
      data: { id: b.id, title: b.title, imageUrl: b.imageUrl, linkUrl: null, communityId: b.communityId, sortOrder: b.sortOrder, status: 'ENABLED' },
    });
    createdBanners += 1;
  }
  if (createdBanners > 0) console.log(`seed: ${createdBanners}/${DEFAULT_BANNERS.length} banners created`);

  for (const item of ADMIN_PERMISSION_CATALOG) {
    await prisma.adminPermission.upsert({
      where: { code: item.code },
      create: item,
      update: {
        module: item.module,
        name: item.name,
        description: item.description,
        sortOrder: item.sortOrder,
      },
    });
  }
  const platformType = await prisma.adminType.upsert({
    where: { code: 'PLATFORM_ADMIN' },
    create: {
      id: 'at_platform',
      name: '平台管理员',
      code: 'PLATFORM_ADMIN',
      description: '拥有平台全部权限',
      active: true,
      isPlatform: true,
      systemProtected: true,
    },
    update: { active: true, isPlatform: true, systemProtected: true, deletedAt: null },
  });
  const communityType = await prisma.adminType.upsert({
    where: { code: 'COMMUNITY_ADMIN' },
    create: {
      id: 'at_community',
      name: '圈子管理员',
      code: 'COMMUNITY_ADMIN',
      description: '维护授权圈子的资料、广告位和内容',
      active: true,
      isPlatform: false,
      systemProtected: true,
    },
    update: { active: true, isPlatform: false, systemProtected: true, deletedAt: null },
  });
  const communityPermissions = await prisma.adminPermission.findMany({
    where: { code: { in: COMMUNITY_ADMIN_DEFAULT_PERMISSIONS } },
    select: { id: true },
  });
  await prisma.adminTypePermission.deleteMany({ where: { adminTypeId: communityType.id } });
  if (communityPermissions.length) {
    await prisma.adminTypePermission.createMany({
      data: communityPermissions.map((permission) => ({
        adminTypeId: communityType.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`seed: ${ADMIN_PERMISSION_CATALOG.length} admin permissions and 2 protected admin types ensured`);

  // 管理员预设 openid 绑定：开发期用 mock（mock code2session 对 code='admin' 返回 'mock_admin'）；
  // 上线前设环境变量 ADMIN_OPENID 为真实管理员 openid。
  const ADMIN_OPENID = process.env.ADMIN_OPENID || 'mock_admin';
  const existsAdmin = await prisma.adminUser.findFirst({ where: { username: 'admin' } });
  if (!existsAdmin) {
    await prisma.adminUser.create({
      data: {
        username: 'admin',
        openid: ADMIN_OPENID,
        adminTypeId: platformType.id,
        allCommunities: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`seed: admin bound openid=${ADMIN_OPENID}`);
  } else if (existsAdmin.openid !== ADMIN_OPENID) {
    await prisma.adminUser.update({
      where: { id: existsAdmin.id },
      data: { openid: ADMIN_OPENID },
    });
    // eslint-disable-next-line no-console
    console.log(`seed: admin openid updated to ${ADMIN_OPENID}`);
  }
  await prisma.adminUser.updateMany({
    where: { adminTypeId: platformType.id },
    data: { allCommunities: true },
  });

  // PricingConfig 默认单价（功能方案价目表：30 天 ¥90，90 天 ¥180；管理员可后台改）
  const DEFAULT_PRICING: Array<{ duration: JobDuration; price: number }> = [
    { duration: JobDuration.D30, price: 90 },
    { duration: JobDuration.D90, price: 180 },
  ];
  for (const p of DEFAULT_PRICING) {
    const exists = await prisma.pricingConfig.findUnique({ where: { duration: p.duration } });
    if (!exists) {
      await prisma.pricingConfig.create({ data: { duration: p.duration, price: p.price } });
    }
  }
  // eslint-disable-next-line no-console
  console.log('seed: pricing config ensured (D30=90, D90=180)');

  // 内容推广档位默认价（1天/3天/7天；管理员可后台改；幂等：code 查重）
  const DEFAULT_BOOST_PLANS: Array<{ code: string; name: string; durationHours: number; price: number }> = [
    { code: 'BOOST_1D', name: '1天推广', durationHours: 24, price: 5 },
    { code: 'BOOST_3D', name: '3天推广', durationHours: 72, price: 12 },
    { code: 'BOOST_7D', name: '7天推广', durationHours: 168, price: 30 },
  ];
  for (const p of DEFAULT_BOOST_PLANS) {
    const exists = await prisma.boostPlan.findUnique({ where: { code: p.code } });
    if (!exists) {
      await prisma.boostPlan.create({ data: p });
    }
  }
  // eslint-disable-next-line no-console
  console.log('seed: boost plans ensured (BOOST_1D=5, BOOST_3D=12, BOOST_7D=30)');

  // P1-13 树洞标签库种子（个性 / 兴趣 / 心情 三类；幂等：category+name 查重）
  const DEFAULT_ANON_TAGS: Array<{ category: string; name: string; sortOrder: number }> = [
    // 心情（发帖 mood + 资料 moodState）
    { category: 'mood', name: '开心', sortOrder: 1 },
    { category: 'mood', name: 'emo', sortOrder: 2 },
    { category: 'mood', name: '吐槽', sortOrder: 3 },
    { category: 'mood', name: '求安慰', sortOrder: 4 },
    { category: 'mood', name: '学习', sortOrder: 5 },
    { category: 'mood', name: '恋爱', sortOrder: 6 },
    { category: 'mood', name: '迷茫', sortOrder: 7 },
    // 兴趣
    { category: 'interest', name: '音乐', sortOrder: 1 },
    { category: 'interest', name: '电影', sortOrder: 2 },
    { category: 'interest', name: '游戏', sortOrder: 3 },
    { category: 'interest', name: '阅读', sortOrder: 4 },
    { category: 'interest', name: '运动', sortOrder: 5 },
    { category: 'interest', name: '美食', sortOrder: 6 },
    { category: 'interest', name: '旅行', sortOrder: 7 },
    { category: 'interest', name: '摄影', sortOrder: 8 },
    // 个性
    { category: 'personality', name: '社恐', sortOrder: 1 },
    { category: 'personality', name: '话痨', sortOrder: 2 },
    { category: 'personality', name: '理性', sortOrder: 3 },
    { category: 'personality', name: '感性', sortOrder: 4 },
    { category: 'personality', name: '乐观', sortOrder: 5 },
    { category: 'personality', name: '慢热', sortOrder: 6 },
  ];
  let tagCreated = 0;
  for (const t of DEFAULT_ANON_TAGS) {
    const exists = await prisma.anonTag.findUnique({
      where: { category_name: { category: t.category, name: t.name } },
    });
    if (!exists) {
      await prisma.anonTag.create({ data: t });
      tagCreated += 1;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`seed: ${tagCreated}/${DEFAULT_ANON_TAGS.length} anon tags created`);

  // 全局配置默认值：缺省关闭，由管理端按运营需要开启。
  const configUpserts = [
    { key: 'community.need_review', value: false, updatedBy: 'seed' },
    { key: 'content.anonymous_enabled', value: false, updatedBy: 'seed' },
  ];
  let configCreated = 0;
  for (const c of configUpserts) {
    const exists = await prisma.appConfig.findUnique({ where: { key: c.key } });
    if (!exists) {
      await prisma.appConfig.create({ data: c });
      configCreated += 1;
    }
  }
  if (configCreated > 0) {
    // eslint-disable-next-line no-console
    console.log(`seed: ${configCreated}/${configUpserts.length} app configs created (boolean switches default false)`);
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
