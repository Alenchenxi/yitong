/**
 * P1-26 smoke：商家评价学生
 * 前置：server dev 模式（mock 支付 + 自动审核商家）
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role: 'user', nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) { await sleep(14000); continue; }
    throw new Error(`login: ${JSON.stringify(j)}`);
  }
  throw new Error('login fail');
}
async function call(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

(async () => {
  console.log('[P1-26 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  // 商家
  const M = await login(`M${sfx}`, `Merchant_${sfx}`);
  await sleep(14000);
  await call('POST', '/merchant/register', M.accessToken, {
    shopName: `店铺_${sfx}`, licenseNo: `LIC${sfx}`, contactPhone: '13800000002',
  });
  const post = await call('POST', '/job-posts', M.accessToken, {
    title: 'P1-26 测试岗位', description: '搬运', salary: '100/天', location: '学校',
    category: 'CATERING', settlement: 'DAILY', duration: 'D30',
  });
  const postId = post.body.data.id;
  await call('POST', '/payments/job-publish', M.accessToken, { jobPostId: postId, duration: 'D30' });

  // 学生 A 报名 -> 录用 -> 完成
  const A = await login(`A${sfx}`, `StuA_${sfx}`);
  await sleep(14000);
  const appA = await call('POST', `/job-posts/${postId}/applications`, A.accessToken, {});
  const appIdA = appA.body.data.id;
  await call('POST', `/applications/${appIdA}/transition`, M.accessToken, { action: 'accept' });
  await call('POST', `/applications/${appIdA}/transition`, M.accessToken, { action: 'complete' });

  // 学生 B 待处理（不能被商家评价）
  const B = await login(`B${sfx}`, `StuB_${sfx}`);
  await sleep(14000);
  const appB = await call('POST', `/job-posts/${postId}/applications`, B.accessToken, {});
  const appIdB = appB.body.data.id;

  // 1) PENDING 报名商家评 40005 状态非法
  const r1 = await call('POST', `/applications/${appIdB}/merchant-review`, M.accessToken, { rating: 5, content: 'nice' });
  assert(r1.body.code === 40005, `PENDING 不能评 40005 got ${r1.body.code}`);

  // 2) 学生 A 学生评商家（先评） + 商家评学生（再评）互不冲突
  const stuRev = await call('POST', `/applications/${appIdA}/review`, A.accessToken, { rating: 4, content: '好商家' });
  assert(stuRev.body.code === 0, '学生 A 评商家成功');
  assert(stuRev.body.data.direction === 'stu_to_merchant', 'direction=stu_to_merchant');

  // 3) 用商家 token 评 A
  const merRev = await call('POST', `/applications/${appIdA}/merchant-review`, M.accessToken, { rating: 5, content: '很负责' });
  assert(merRev.body.code === 0, '商家评 A 成功');
  assert(merRev.body.data.direction === 'merchant_to_stu', 'direction=merchant_to_stu');
  assert(merRev.body.data.rating === 5, 'rating=5');

  // 4) 重复评价 40005
  const dup = await call('POST', `/applications/${appIdA}/merchant-review`, M.accessToken, { rating: 3, content: '再评' });
  assert(dup.body.code === 40005, `重复商家评 40005 got ${dup.body.code}`);

  // 5) 学生不能 merchant-review 10003（无权限路径覆盖：不是商家且非本人，作为学生 POST 此路由会因 assertOwnsPost 失败 → 学生其实调用 review 路由，merchant-review 永远仅商家；试个学生 token 直接打）
  const stuWrong = await call('POST', `/applications/${appIdA}/merchant-review`, A.accessToken, { rating: 5, content: 'x' });
  assert(stuWrong.body.code === 10003 || stuWrong.body.code === 60003 || stuWrong.body.code === 40001 || stuWrong.body.code === 40005, `学生不能 merchant-review got ${stuWrong.body.code}`);

  // 6) 另一商家不能评（非岗位所属）
  const M2 = await login(`M2${sfx}`, `Merchant2_${sfx}`);
  await sleep(14000);
  await call('POST', '/merchant/register', M2.accessToken, {
    shopName: `店2_${sfx}`, licenseNo: `LIC2${sfx}`, contactPhone: '13800000003',
  });
  const otherRev = await call('POST', `/applications/${appIdA}/merchant-review`, M2.accessToken, { rating: 1, content: '抢评' });
  assert(otherRev.body.code === 10003, `非岗位商家 10003 got ${otherRev.body.code}`);

  // 7) 商家评完 A，应发站内通知给 A
  const notes = await call('GET', '/notifications?page=1&pageSize=50', A.accessToken);
  const note = notes.body.data.list.find((n) => n.type === 'job_review_from_merchant' && n.targetId === appIdA);
  assert(!!note, 'A 收到 job_review_from_merchant 通知');
  assert(/很负责|5 星/.test(note.content) || /P1-26/.test(note.content), `通知 content 含岗位/评分 got: ${note.content}`);

  // 8) listReviews 应见两条评价（一条 stu + 一条 merchant），方向不同
  const revs = await call('GET', `/job-posts/${postId}/reviews`, M.accessToken);
  if (!Array.isArray(revs.body.data)) {
    console.error('  · reviews body:', JSON.stringify(revs.body));
    throw new Error('listReviews 返回异常');
  }
  const stu = revs.body.data.find((r) => r.applicationId === appIdA && r.direction === 'stu_to_merchant');
  const mer = revs.body.data.find((r) => r.applicationId === appIdA && r.direction === 'merchant_to_stu');
  assert(!!stu, 'listReviews 含 stu 评价');
  assert(!!mer, 'listReviews 含 merchant 评价');

  console.log('\n[P1-26 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-26 smoke] STOPPED:', e.message);
  process.exit(1);
});