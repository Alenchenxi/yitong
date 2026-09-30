/**
 * P1-21 + P1-22 smoke：简历完整度 + 简历投递记录
 * 前置：server dev 模式
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
  console.log('[P1-21+P1-22 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;

  // ===== P1-21 完整度 =====
  const A = await login(`A${sfx}`, `StuA_${sfx}`);
  await sleep(14000);

  // 无简历：getMyResume 返回 null
  const empty = await call('GET', '/resume', A.accessToken);
  assert(empty.body.code === 0 && empty.body.data === null, '无简历时返回 null');

  // 仅填 name+phone -> 完整度 33%（2/6）
  const r1 = await call('PUT', '/resume', A.accessToken, {
    name: '张三', phone: '13800000005',
  });
  assert(r1.body.code === 0, '保存基础简历');
  assert(r1.body.data.completeness === 33, `2/6 字段完整度=33 got ${r1.body.data.completeness}`);
  assert(r1.body.data.missingFields.length === 4, `缺失 4 字段 got ${r1.body.data.missingFields.length}`);
  assert(r1.body.data.missingFields.includes('自我介绍') && r1.body.data.missingFields.includes('技能'), '缺失字段含自我介绍/技能');

  // 补全全部 -> 100%
  const r2 = await call('PUT', '/resume', A.accessToken, {
    name: '张三', phone: '13800000005',
    selfIntro: '认真负责', skills: ['PS'], availabilities: ['周末'], experience: '某店兼职',
  });
  assert(r2.body.data.completeness === 100, `全填完整度=100 got ${r2.body.data.completeness}`);
  assert(r2.body.data.missingFields.length === 0, '全填无缺失字段');

  // getMyResume 也带完整度
  const get = await call('GET', '/resume', A.accessToken);
  assert(get.body.data.completeness === 100, 'getMyResume 返回完整度 100');

  // 空字符串视为未填：selfIntro='' -> 完整度降
  const r3 = await call('PUT', '/resume', A.accessToken, {
    name: '张三', phone: '13800000005',
    selfIntro: '', skills: ['PS'], availabilities: ['周末'], experience: '某店兼职',
  });
  assert(r3.body.data.completeness === 83, `selfIntro 空 -> 83 (5/6) got ${r3.body.data.completeness}`);
  assert(r3.body.data.missingFields.includes('自我介绍'), 'selfIntro 空计入缺失');

  // ===== P1-22 投递记录 =====
  // 商家 + 岗位 + A 报名（带简历）
  const M = await login(`M${sfx}`, `Merchant_${sfx}`);
  await sleep(14000);
  await call('POST', '/merchant/register', M.accessToken, {
    shopName: `店铺_${sfx}`, licenseNo: `LIC${sfx}`, contactPhone: '13800000006',
  });
  const post = await call('POST', '/job-posts', M.accessToken, {
    title: 'P1-22 岗位', description: '搬运', salary: '100/天', location: '学校',
    category: 'CATERING', settlement: 'DAILY', duration: 'D30',
  });
  const postId = post.body.data.id;
  await call('POST', '/payments/job-publish', M.accessToken, { jobPostId: postId, duration: 'D30' });

  // A 报名带简历
  const app1 = await call('POST', `/job-posts/${postId}/applications`, A.accessToken, { resumeId: r2.body.data.id });
  assert(app1.body.code === 0, 'A 带简历报名');

  // 投递记录列表
  const apps = await call('GET', '/resume/applications', A.accessToken);
  assert(apps.body.code === 0, '投递记录接口');
  assert(Array.isArray(apps.body.data) && apps.body.data.length >= 1, '投递记录非空');
  const rec = apps.body.data.find((x) => x.jobPostId === postId);
  assert(!!rec, '投递记录含该岗位');
  assert(rec.jobPostTitle === 'P1-22 岗位', `投递记录含岗位标题 got ${rec.jobPostTitle}`);
  assert(rec.merchantShopName === `店铺_${sfx}`, `投递记录含商家名 got ${rec.merchantShopName}`);
  assert(rec.hasResume === true, `投递记录 hasResume=true got ${rec.hasResume}`);
  assert(rec.status === 'PENDING', `投递记录 status=PENDING got ${rec.status}`);

  // 商家 accept 后，投递记录状态变 ACCEPTED
  await call('POST', `/applications/${app1.body.data.id}/transition`, M.accessToken, { action: 'accept' });
  const apps2 = await call('GET', '/resume/applications', A.accessToken);
  const rec2 = apps2.body.data.find((x) => x.jobPostId === postId);
  assert(rec2.status === 'ACCEPTED', `录用后投递记录 status=ACCEPTED got ${rec2.status}`);

  // B 无报名 -> 投递记录空
  const B = await login(`B${sfx}`, `StuB_${sfx}`);
  await sleep(14000);
  const appsB = await call('GET', '/resume/applications', B.accessToken);
  assert(Array.isArray(appsB.body.data) && appsB.body.data.length === 0, '无报名用户投递记录为空');

  console.log('\n[P1-21+P1-22 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-21+P1-22 smoke] STOPPED:', e.message);
  process.exit(1);
});
