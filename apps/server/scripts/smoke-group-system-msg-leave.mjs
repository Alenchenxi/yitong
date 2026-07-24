/**
 * 补测 smoke：member_left + group_disbanded 两个未覆盖 action。
 * 测试1 member_left：A 建群 g1 + B 加入 -> B leave -> 历史含 member_left(actor=B)，群仍 ACTIVE。
 * 测试2 group_disbanded：A 建群 g2 -> A leave(OWNER 解散) -> leave 返回 {left:true,disbanded:true}；
 *   群 DISBANDED 后历史接口抛 30010（设计）；group_disbanded 系统消息落库用 PrismaClient 直查 DB 验证。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
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
async function fetchHistory(token, gid) {
  const r = await call('GET', `/treehole/groups/${gid}/messages?limit=200`, token);
  return r;
}
function latestSystem(list) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].type === 'system') return list[i];
  return null;
}

(async () => {
  console.log('[leave/disband smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`LA${sfx}`, `LOwner_${sfx}`);
  await sleep(14000);
  const B = await login(`LB${sfx}`, `LMember_${sfx}`);
  await sleep(14000);

  const atA = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const atB = await call('POST', '/treehole/anonymous-token', B.accessToken);
  assert(atA.body.code === 0, 'A 匿名 token');
  assert(atB.body.code === 0, 'B 匿名 token');
  const tokA = atA.body.data.anonToken, tokB = atB.body.data.anonToken;
  const anonA = atA.body.data.anonId, anonB = atB.body.data.anonId;
  const nickA = atA.body.data.nickname, nickB = atB.body.data.nickname;
  console.log('  anonA=%s nick=%s | anonB=%s nick=%s', anonA, nickA, anonB, nickB);

  // ===== 测试1：member_left =====
  console.log('\n--- 测试1: member_left ---');
  const c1 = await call('POST', '/treehole/groups', tokA, { name: `退出群_${sfx}`, maxMembers: 50 });
  assert(c1.body.code === 0, `A 建群 g1 code=0 got ${JSON.stringify(c1.body)}`);
  const g1 = c1.body.data.id;
  const jB = await call('POST', `/treehole/groups/${g1}/join`, tokB);
  assert(jB.body.code === 0, 'B 加入 g1 code=0');
  // B leave
  const lv = await call('POST', `/treehole/groups/${g1}/leave`, tokB);
  assert(lv.body.code === 0, `B leave g1 code=0 got ${JSON.stringify(lv.body)}`);
  assert(lv.body.data.left === true && lv.body.data.disbanded !== true, `leave 返回 left=true 非 disbanded got ${JSON.stringify(lv.body.data)}`);
  // A 拉历史 -> 最新 system = member_left
  const h1 = await fetchHistory(tokA, g1);
  assert(h1.body.code === 0, `拉 g1 历史 code=0 got ${JSON.stringify(h1.body)}`);
  const sys = latestSystem(h1.body.data.list);
  assert(!!sys, 'g1 历史存在系统消息');
  assert(sys.fromId === 'system', `member_left fromId=system got ${sys.fromId}`);
  assert(sys.type === 'system', `member_left type=system got ${sys.type}`);
  let d;
  try { d = JSON.parse(sys.content); } catch { assert(false, 'member_left content JSON 可解析'); }
  assert(d.action === 'member_left', `action=member_left got ${d.action}`);
  assert(d.actor && d.actor.anonId === anonB, `member_left actor=B got ${d.actor && d.actor.anonId}`);
  assert(typeof d.actor.nick === 'string' && d.actor.nick.length > 0, `member_left actor.nick 非空 got ${d.actor && d.actor.nick}`);
  assert(d.actor.nick === nickB, `member_left actor.nick=B 昵称 got ${d.actor.nick}`);
  assert(d.actor.anonId.startsWith('anon_'), `actor.anonId anon_ 前缀 got ${d.actor.anonId}`);
  console.log('  member_left content = %s', sys.content);
  // 群仍 ACTIVE、B 已不在成员
  const det1 = await call('GET', `/treehole/groups/${g1}`, tokA);
  assert(det1.body.code === 0, '查 g1 详情 code=0');
  assert(det1.body.data.status === 'ACTIVE', `g1 仍 ACTIVE got ${det1.body.data.status}`);
  assert(!det1.body.data.members.find((m) => m.anonId === anonB), 'g1 成员无 B');
  assert(det1.body.data.memberCount === 1, `g1 memberCount=1 got ${det1.body.data.memberCount}`);
  // 历史仍可拉（A 在线成员）
  const h1b = await fetchHistory(tokA, g1);
  assert(h1b.body.code === 0 && h1b.body.data.list.length >= 3, 'g1 历史仍可拉且>=3条（group_created+member_joined+member_left）');

  // ===== 测试2：group_disbanded =====
  console.log('\n--- 测试2: group_disbanded ---');
  const c2 = await call('POST', '/treehole/groups', tokA, { name: `解散群_${sfx}`, maxMembers: 50 });
  assert(c2.body.code === 0, `A 建群 g2 code=0 got ${JSON.stringify(c2.body)}`);
  const g2 = c2.body.data.id;
  // 解散前拉历史确认 group_created 在（群 ACTIVE）
  const h2before = await fetchHistory(tokA, g2);
  assert(h2before.body.code === 0, '解散前拉 g2 历史 code=0');
  const sysBefore = latestSystem(h2before.body.data.list);
  assert(sysBefore && JSON.parse(sysBefore.content).action === 'group_created', '解散前 g2 历史含 group_created');
  // A leave（OWNER 退出 = 解散）
  const lv2 = await call('POST', `/treehole/groups/${g2}/leave`, tokA);
  assert(lv2.body.code === 0, `A leave g2 code=0 got ${JSON.stringify(lv2.body)}`);
  assert(lv2.body.data.left === true && lv2.body.data.disbanded === true, `leave 返回 {left:true, disbanded:true} got ${JSON.stringify(lv2.body.data)}`);
  // 群 DISBANDED 后历史接口抛 30010（设计）
  const h2after = await fetchHistory(tokA, g2);
  assert(h2after.body.code === 30010, `解散后历史抛 30010 got code=${h2after.body.code} ${JSON.stringify(h2after.body)}`);
  // group_disbanded 系统消息落库：PrismaClient 直查 DB（API 拉不到，设计如此）
  let prisma;
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  } catch (e) {
    console.error('  (warn) PrismaClient 不可用，跳过 DB 直查:', e.message);
  }
  if (prisma) {
    try {
      const rows = await prisma.chatMessage.findMany({
        where: { groupId: g2, type: 'system' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      assert(rows.length >= 2, `g2 DB 系统消息>=2（group_created+group_disbanded）got ${rows.length}`);
      const last = rows[0];
      assert(last.fromId === 'system', `DB 最新 system fromId=system got ${last.fromId}`);
      const dd = JSON.parse(last.content);
      assert(dd.action === 'group_disbanded', `DB 最新 action=group_disbanded got ${dd.action}`);
      assert(dd.actor && dd.actor.anonId === anonA, `group_disbanded actor=A got ${dd.actor && dd.actor.anonId}`);
      assert(dd.actor.anonId.startsWith('anon_'), `actor.anonId anon_ 前缀 got ${dd.actor.anonId}`);
      assert(typeof dd.actor.nick === 'string' && dd.actor.nick.length > 0, 'group_disbanded actor.nick 非空');
      assert(dd.target === undefined || dd.target === null, 'group_disbanded 无 target');
      console.log('  group_disbanded DB content = %s', last.content);
      // 确认群状态 DISBANDED + 成员已清空
      const g2db = await prisma.anonGroup.findUnique({ where: { id: g2 }, select: { status: true, memberCount: true } });
      assert(g2db && g2db.status === 'DISBANDED', `DB g2 status=DISBANDED got ${g2db && g2db.status}`);
      assert(g2db && g2db.memberCount === 0, `DB g2 memberCount=0 got ${g2db && g2db.memberCount}`);
      const memberCnt = await prisma.anonGroupMember.count({ where: { groupId: g2 } });
      assert(memberCnt === 0, `DB g2 成员已清空 got ${memberCnt}`);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log('\n[leave/disband smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[leave/disband smoke] STOPPED:', e.message);
  process.exit(1);
});
