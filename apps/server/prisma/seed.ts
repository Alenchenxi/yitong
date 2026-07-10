import { PrismaClient } from '@prisma/client';

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
