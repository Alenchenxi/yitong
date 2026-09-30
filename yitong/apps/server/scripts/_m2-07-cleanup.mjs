/**
 * M2-07 候选人详情 smoke 测试数据清理
 * 用法：PAYLOAD=<path-to-json> [DATABASE_URL=...]
 * 顺序：notifications -> jobReviews -> jobViews -> jobApplications -> paymentOrders -> resumes -> jobPosts -> userRoles -> merchants -> users
 */
const fs = await import('fs/promises');
const path = process.env.PAYLOAD || process.argv[2];
if (!path) { console.error('未指定 PAYLOAD'); process.exit(1); }
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const data = JSON.parse(await fs.readFile(path, 'utf8'));
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

const report = [];
async function step(name, table, op, ids, fn) {
  let rows = 0;
  if (ids.length > 0) {
    const r = await fn();
    rows = typeof r === 'number' ? r : (r?.count ?? 0);
  }
  // 复查
  let remaining = 0;
  if (ids.length > 0) {
    remaining = await prisma[table].count({ where: { id: { in: ids } } });
  }
  report.push({ table, op, ids_in: ids.length, deleted: rows, remaining });
  console.log(`  ${remaining === 0 ? '✓' : '✗'} ${name}: in=${ids.length} deleted=${rows} remaining=${remaining}`);
  if (remaining !== 0) {
    process.exitCode = 1;
    throw new Error(`clean ${name} failed: ${remaining} remaining`);
  }
}

(async () => {
  console.log('[m2-07 cleanup] sfx =', data.sfx);
  console.log('[m2-07 cleanup] payload =', path);

  await step('notifications', 'notification', 'delete', data.notificationIds,
    () => prisma.notification.deleteMany({ where: { id: { in: data.notificationIds } } }));

  await step('jobReviews', 'jobReview', 'delete', [],
    () => prisma.jobReview.deleteMany({ where: { applicationId: { in: data.jobApplicationIds } } }));

  await step('jobViews', 'jobView', 'delete', data.jobViewIds,
    () => prisma.jobView.deleteMany({ where: { id: { in: data.jobViewIds } } }));

  await step('jobApplications', 'jobApplication', 'delete', data.jobApplicationIds,
    () => prisma.jobApplication.deleteMany({ where: { id: { in: data.jobApplicationIds } } }));

  await step('paymentOrders', 'paymentOrder', 'delete', data.paymentOrderIds,
    () => prisma.paymentOrder.deleteMany({ where: { id: { in: data.paymentOrderIds } } }));

  await step('resumes', 'resume', 'delete', data.resumeIds,
    () => prisma.resume.deleteMany({ where: { id: { in: data.resumeIds } } }));

  await step('jobPosts', 'jobPost', 'delete', data.jobPostIds,
    () => prisma.jobPost.deleteMany({ where: { id: { in: data.jobPostIds } } }));

  await step('userRoles', 'userRole', 'delete', data.userIds,
    () => prisma.userRole.deleteMany({ where: { userId: { in: data.userIds } } }));

  await step('merchants', 'merchant', 'delete', data.merchantIds,
    () => prisma.merchant.deleteMany({ where: { id: { in: data.merchantIds } } }));

  await step('users', 'user', 'delete', data.userIds,
    () => prisma.user.deleteMany({ where: { id: { in: data.userIds } } }));

  await prisma.$disconnect();
  // 移除 payload 文件
  await fs.unlink(path).catch(() => {});
  console.log('\n[m2-07 cleanup] DONE');
  console.log(JSON.stringify({ report }, null, 2));
})().catch(async (e) => {
  console.error('[m2-07 cleanup] ERROR:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
