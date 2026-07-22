import { JobDuration, PrismaClient } from '@prisma/client';

// 默认圈子种子数据（幂等：按 name 查重，已存在则跳过）
const DEFAULT_CIRCLES = [
  { name: '表白', icon: '❤️' },
  { name: '失物招领', icon: '🔍' },
  { name: '二手闲置', icon: '📦' },
  { name: '学习交流', icon: '📚' },
  { name: '日常闲聊', icon: '💬' },
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

  // 管理员预设 openid 绑定：开发期用 mock（mock code2session 对 code='admin' 返回 'mock_admin'）；
  // 上线前设环境变量 ADMIN_OPENID 为真实管理员 openid。
  const ADMIN_OPENID = process.env.ADMIN_OPENID || 'mock_admin';
  const existsAdmin = await prisma.adminUser.findFirst({ where: { username: 'admin' } });
  if (!existsAdmin) {
    await prisma.adminUser.create({ data: { username: 'admin', openid: ADMIN_OPENID } });
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
