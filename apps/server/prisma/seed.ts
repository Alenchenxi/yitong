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
