/**
 * admin tabs smoke：工单 admin + 用户列表 + 活动/话题 admin list
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
  console.log('[admin-tabs smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const U = await login(`U${sfx}`, `User_${sfx}`, 'user');
  await sleep(14000);
  await sleep(14000);
  const admin = await login('admin', '管理员', 'admin');

  // 非管理员 10003
  const forbid = await call('GET', '/admin/tickets', U.accessToken);
  assert(forbid.body.code === 10003, `非管理员工单 10003 got ${forbid.body.code}`);

  // 用户建工单
  const t = await call('POST', '/support/tickets', U.accessToken, { title: '测试工单', content: '帮忙看看' });
  assert(t.body.code === 0, '用户建工单');

  // admin 看工单列表
  const list = await call('GET', '/admin/tickets?status=OPEN', admin.accessToken);
  assert(list.body.code === 0, 'admin 工单列表');
  assert(list.body.data.find((x) => x.id === t.body.data.id), '列表含该工单');
  assert(list.body.data.find((x) => x.id === t.body.data.id).userNickname === `User_${sfx}`, '工单带用户昵称');

  // admin 回复 + 关闭
  const reply = await call('POST', `/admin/tickets/${t.body.data.id}/reply`, admin.accessToken, { reply: '已处理', close: true });
  assert(reply.body.code === 0, 'admin 回复工单');
  assert(reply.body.data.status === 'CLOSED', '回复后 CLOSED');
  assert(reply.body.data.reply === '已处理', 'reply 内容正确');

  // 空回复 20003
  const emptyReply = await call('POST', `/admin/tickets/${t.body.data.id}/reply`, admin.accessToken, { reply: '', close: true });
  assert(emptyReply.body.code === 20003, `空回复 20003 got ${emptyReply.body.code}`);

  // 不存在工单 20003
  const noT = await call('POST', `/admin/tickets/cmx_no/reply`, admin.accessToken, { reply: 'x', close: true });
  assert(noT.body.code === 20003, `不存在工单 20003 got ${noT.body.code}`);

  // ===== 用户列表 + 封禁/禁言 =====
  const users = await call('GET', `/admin/users?keyword=${encodeURIComponent('User_' + sfx)}`, admin.accessToken);
  assert(users.body.code === 0, 'admin 用户列表');
  assert(users.body.data.find((u) => u.id === U.user.id), '列表含目标用户');
  const u0 = users.body.data.find((u) => u.id === U.user.id);
  assert(u0.banned === false, '初始未封禁');

  // 禁言 1 天
  const mute = await call('POST', `/admin/users/${U.user.id}/mute`, admin.accessToken, { days: 1 });
  assert(mute.body.code === 0, '禁言 1 天');
  assert(!!mute.body.data.mutedUntil, '禁言含 mutedUntil');

  // 解除禁言
  const unmute = await call('POST', `/admin/users/${U.user.id}/mute`, admin.accessToken, { days: 0 });
  assert(unmute.body.code === 0 && unmute.body.data.mutedUntil === null, '解除禁言');

  // 禁言天数无效
  const badMute = await call('POST', `/admin/users/${U.user.id}/mute`, admin.accessToken, { days: 9999 });
  assert(badMute.body.code === 10003, `禁言天数 9999 拒绝 got ${badMute.body.code}`);

  // ===== 活动/话题 admin list =====
  const actList = await call('GET', '/admin/activity-topics', admin.accessToken);
  assert(actList.body.code === 0, 'admin 活动专题列表');

  const topicList = await call('GET', '/admin/topics', admin.accessToken);
  assert(topicList.body.code === 0, 'admin 话题列表');

  // 创建活动专题（DRAFT）
  const act = await call('POST', '/admin/activity-topics', admin.accessToken, { title: `管理端专题_${sfx}`, status: 'DRAFT' });
  assert(act.body.code === 0, 'admin 创建专题');
  // admin list 含草稿
  const actList2 = await call('GET', '/admin/activity-topics', admin.accessToken);
  assert(actList2.body.data.find((x) => x.id === act.body.data.id && x.status === 'DRAFT'), 'admin 列表含草稿专题');

  console.log('\n[admin-tabs smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[admin-tabs smoke] STOPPED:', e.message);
  process.exit(1);
});
