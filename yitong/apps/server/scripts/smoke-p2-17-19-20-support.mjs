/**
 * P2-17 + P2-19 + P2-20 smoke：商家账单/薪资保障规则/客服工单
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role, nickname }),
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
  console.log('[P2-17+P2-19+P2-20 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `User_${sfx}`, 'user');
  await sleep(14000);
  const M = await login(`M${sfx}`, `Merchant_${sfx}`, 'user');
  await sleep(14000);

  // ===== P2-19 薪资保障规则（登录用户可访问）=====
  const rules = await call('GET', '/support/salary-guarantee', A.accessToken);
  assert(rules.body.code === 0, '薪资保障规则接口');
  assert(Array.isArray(rules.body.data.rules) && rules.body.data.rules.length >= 5, '规则数组非空');
  assert(/薪资|结算|兼职/.test(rules.body.data.rules.join('')), '规则含薪资/结算/兼职关键词');

  // ===== P2-20 客服工单 =====
  const t1 = await call('POST', '/support/tickets', A.accessToken, {
    title: '工资没收到', content: '请帮我催一下商家',
  });
  assert(t1.body.code === 0, '用户创建工单');
  assert(t1.body.data.status === 'OPEN', '工单 OPEN 状态');

  // 我的工单列表含
  const myList = await call('GET', '/support/tickets', A.accessToken);
  assert(myList.body.code === 0 && myList.body.data.find((t) => t.id === t1.body.data.id), '我的工单含该条');

  // 空标题 20003
  const emptyTitle = await call('POST', '/support/tickets', A.accessToken, { title: '', content: 'x' });
  assert(emptyTitle.body.code === 20003, `空标题 20003 got ${emptyTitle.body.code}`);

  // 空内容 20003
  const emptyContent = await call('POST', '/support/tickets', A.accessToken, { title: 'x', content: '' });
  assert(emptyContent.body.code === 20003, `空内容 20003 got ${emptyContent.body.code}`);

  // 商家也能建工单（role=merchant）
  const t2 = await call('POST', '/support/tickets', M.accessToken, {
    title: '商家咨询', content: '如何发岗', role: 'merchant',
  });
  assert(t2.body.code === 0, '商家创建工单');

  // 看详情
  const detail = await call('GET', `/support/tickets/${t1.body.data.id}`, A.accessToken);
  assert(detail.body.code === 0 && detail.body.data.title === '工资没收到', '看工单详情');

  // ===== P2-17 商家账单 =====
  await call('POST', '/merchant/register', M.accessToken, {
    shopName: `店铺_${sfx}`, licenseNo: `LIC${sfx}`, contactPhone: '13800000009',
  });
  // 非商家看账单 60002
  const nonM = await call('GET', '/support/merchant/orders', A.accessToken);
  assert(nonM.body.code === 60002, `非商家账单 60002 got ${nonM.body.code}`);

  // 商家发岗+发布产生订单
  const post = await call('POST', '/job-posts', M.accessToken, {
    title: `P2-17岗位_${sfx}`, description: 'd', salary: '100/天', location: '校',
    category: 'CATERING', settlement: 'DAILY', duration: 'D30',
  });
  await call('POST', '/payments/job-publish', M.accessToken, { jobPostId: post.body.data.id, duration: 'D30' });

  const orders = await call('GET', '/support/merchant/orders', M.accessToken);
  assert(orders.body.code === 0, '商家账单列表');
  assert(orders.body.data.length >= 1, '账单非空');
  const order = orders.body.data.find((o) => o.jobPostTitle.includes('P2-17'));
  assert(!!order, '账单含 P2-17 岗位');
  assert(order.status === 'PAID', `订单状态 PAID got ${order.status}`);
  assert(parseFloat(order.amount) > 0, `金额>0 got ${order.amount}`);

  console.log('\n[P2-17+P2-19+P2-20 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-17+P2-19+P2-20 smoke] STOPPED:', e.message);
  process.exit(1);
});
