/**
 * 活动模块 smoke（specs/features/活动模块.md，工作目录 worktree activity-module）
 *
 * 覆盖业务规则：
 *   1  报名双模式：DIRECT 有名额 APPROVED / 满员 WAITLIST；REVIEW 提交 PENDING_REVIEW，审核通过时有名额 APPROVED / 满员 WAITLIST
 *   2  候补 FIFO：正式用户被 revoke 后 waitlistedAt 最早者自动转正并收通知
 *   3  REVOKED 再次报名拒 70004；REJECTED 可重新提交
 *   4  APPROVED 用户改资料：资格保留 + pendingData 待复审；复审拒绝恢复原资料；复审通过新资料生效
 *   4b WAITLIST 期间改资料 → 转正只采纳已审核通过资料，pendingData 保留待复审（RE_REVIEW 可见），复审通过新资料生效
 *   5  产生报名后表单结构锁定（删字段/改类型/删选项/新增必填 → 70006；改说明/排序/新增选填 OK）
 *   6  手动提醒仅 APPROVED、同人同活动 24h 一次（全部跳过 → 70014）；候补不收
 *   7  群聊：非 APPROVED/管理员 70015；cancel 立即只读 70016；finish +7 天只读（未到点仍可发）
 *   8  可见范围：PLATFORM 全员可见；COMMUNITY 仅本圈（圈外 404）
 *   9  APPROVED_ONLY：非正式参与人 location/joinLink=null + visible=false
 *   10 三类人数分开统计；BR-012 无删除端点
 *   11 内容安全：标题/介绍/表单文本 checkText、图片 checkImage（mock 放行不抛 90002）
 *   12 权限：transfer/cancel/admins/lark-config 仅发起人 70007；edit/审核/提醒/报名列表发起人+活动管理员 70008；
 *      圈子活动须自己管理的圈子 70009；平台活动须平台管理员 70010
 *
 * 用法：BASE_URL / DATABASE_URL 可覆盖；默认 localhost:3000 + docker postgres。
 * 前置：dev server 运行中（mock 模式，WX 凭证置空）。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role, nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) { console.log('  (login throttled, wait 20s)'); await sleep(20000); continue; }
    throw new Error(`login: ${JSON.stringify(j)}`);
  }
  throw new Error('login fail');
}

async function call(method, path, token, body, extraHeaders = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json;
    try { json = await r.json(); } catch { json = { _raw: await r.text() }; }
    if (r.status === 429) { console.log('  (429 throttled, wait 20s)'); await sleep(20000); continue; }
    return { status: r.status, body: json };
  }
  throw new Error(`call still throttled: ${method} ${path}`);
}

let failedCnt = 0;
function assert(cond, msg) {
  if (!cond) { failedCnt += 1; console.error('  ✗ FAIL:', msg); return; }
  console.log('  ✓', msg);
}
function assertCode(res, code, msg) {
  assert(res.body.code === code, `${msg}（实际 code=${res.body.code} status=${res.status}）`);
}

const sfx = Date.now().toString(36);
const codeFor = (tag) => `${tag}${sfx}`; // openid = mock_<code 前8位>，保证 run 内 tag 不同、跨 run 不同

const created = {
  userIds: [], // 本 run 创建的普通用户
  communityIds: [],
  activityIds: [],
  larkConnectionIds: [],
};
let adminUid = null;
let adminPreExisted = false; // mock_admin 管理员若 run 前已存在，users/user_roles 不删（只删本 run 产生的 notifications）

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理测试数据...');
  const aids = created.activityIds;
  const groupIds = aids.map((id) => `activity-${id}`);
  let r;
  if (groupIds.length) {
    r = await prisma.chatMessage.deleteMany({ where: { groupId: { in: groupIds } } });
    console.log(`  chat_messages(groupId=activity-*) deleteMany: ${r.count}`);
    r = await prisma.activitySyncRecord.deleteMany({ where: { activityId: { in: aids } } });
    console.log(`  activity_sync_records deleteMany: ${r.count}`);
    r = await prisma.activityReminder.deleteMany({ where: { activityId: { in: aids } } });
    console.log(`  activity_reminders deleteMany: ${r.count}`);
    r = await prisma.activityInterest.deleteMany({ where: { activityId: { in: aids } } });
    console.log(`  activity_interests deleteMany: ${r.count}`);
    r = await prisma.activityAdmin.deleteMany({ where: { activityId: { in: aids } } });
    console.log(`  activity_admins deleteMany: ${r.count}`);
    r = await prisma.activityEnrollment.deleteMany({ where: { activityId: { in: aids } } });
    console.log(`  activity_enrollments deleteMany: ${r.count}`);
    r = await prisma.activity.deleteMany({ where: { id: { in: aids } } });
    console.log(`  activities deleteMany: ${r.count}`);
  }
  if (created.larkConnectionIds.length) {
    r = await prisma.larkConnection.deleteMany({ where: { id: { in: created.larkConnectionIds } } });
    console.log(`  lark_connections deleteMany: ${r.count}`);
  }
  // 通知：普通用户全删；管理员只删指向本 run 活动的（管理员可能预存在）
  r = await prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } });
  console.log(`  notifications(测试用户) deleteMany: ${r.count}`);
  if (adminUid) {
    r = await prisma.notification.deleteMany({ where: { userId: adminUid, targetId: { in: aids } } });
    console.log(`  notifications(管理员, 仅本 run 活动) deleteMany: ${r.count}`);
  }
  if (created.communityIds.length) {
    r = await prisma.communityMember.deleteMany({ where: { communityId: { in: created.communityIds } } });
    console.log(`  community_members deleteMany: ${r.count}`);
    r = await prisma.community.deleteMany({ where: { id: { in: created.communityIds } } });
    console.log(`  communities deleteMany: ${r.count}`);
  }
  const delUserIds = adminUid && !adminPreExisted ? [...created.userIds, adminUid] : [...created.userIds];
  if (delUserIds.length) {
    r = await prisma.userRole.deleteMany({ where: { userId: { in: delUserIds } } });
    console.log(`  user_roles deleteMany: ${r.count}`);
    r = await prisma.user.deleteMany({ where: { id: { in: delUserIds } } });
    console.log(`  users deleteMany: ${r.count}`);
  }

  // ===== 自验证（残留复查） =====
  console.log('  --- 残留复查 ---');
  const checks = [
    ['activities', await prisma.activity.count({ where: { id: { in: created.activityIds } } })],
    ['activity_enrollments', await prisma.activityEnrollment.count({ where: { activityId: { in: created.activityIds } } })],
    ['activity_admins', await prisma.activityAdmin.count({ where: { activityId: { in: created.activityIds } } })],
    ['activity_interests', await prisma.activityInterest.count({ where: { activityId: { in: created.activityIds } } })],
    ['activity_reminders', await prisma.activityReminder.count({ where: { activityId: { in: created.activityIds } } })],
    ['activity_sync_records', await prisma.activitySyncRecord.count({ where: { activityId: { in: created.activityIds } } })],
    ['chat_messages', await prisma.chatMessage.count({ where: { groupId: { in: created.activityIds.map((id) => `activity-${id}`) } } })],
    ['lark_connections', await prisma.larkConnection.count({ where: { id: { in: created.larkConnectionIds } } })],
    ['communities', await prisma.community.count({ where: { id: { in: created.communityIds } } })],
    ['community_members', await prisma.communityMember.count({ where: { communityId: { in: created.communityIds } } })],
    ['notifications(测试用户)', await prisma.notification.count({ where: { userId: { in: created.userIds } } })],
    ['users(测试用户)', await prisma.user.count({ where: { id: { in: created.userIds } } })],
  ];
  if (adminUid) {
    checks.push(['notifications(管理员·本run活动)', await prisma.notification.count({ where: { userId: adminUid, targetId: { in: created.activityIds } } })]);
    if (!adminPreExisted) {
      checks.push(['users+roles(管理员·本run新建)', (await prisma.user.count({ where: { id: adminUid } })) + (await prisma.userRole.count({ where: { userId: adminUid } }))]);
    }
  }
  let leftover = 0;
  for (const [name, n] of checks) {
    if (n !== 0) { leftover += n; console.error(`  ✗ 残留 ${name}: ${n}`); failedCnt += 1; }
  }
  if (leftover === 0) console.log('  ✓ 自验证：所有目标表 0 残留');
  console.log('[cleanup] 清理完成');
}

(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  console.log('[smoke-activity] base =', BASE, 'sfx =', sfx);

  // run 前快照：mock_admin 是否已存在（决定清理范围）
  adminPreExisted = !!(await prisma.user.findUnique({ where: { openid: 'mock_admin' }, select: { id: true } }));

  try {
    // ==================== 登录 ====================
    console.log('\n[setup] 登录 A(圈主/发起人) B D E F ADM(平台管理员)');
    const A = await login(codeFor('A'), `Act_A_${sfx}`);
    created.userIds.push(A.user.id);
    await sleep(14000);
    const B = await login(codeFor('B'), `Act_B_${sfx}`);
    created.userIds.push(B.user.id);
    await sleep(14000);
    const D = await login(codeFor('D'), `Act_D_${sfx}`);
    created.userIds.push(D.user.id);
    await sleep(14000);
    const E = await login(codeFor('E'), `Act_E_${sfx}`);
    created.userIds.push(E.user.id);
    await sleep(14000);
    const F = await login(codeFor('F'), `Act_F_${sfx}`);
    created.userIds.push(F.user.id);
    await sleep(14000);
    const ADM = await login('admin', undefined, 'admin'); // 管理员预存在，不传 nickname 避免改名共享账号
    adminUid = ADM.user.id;
    console.log('  A=', A.user.id, 'B=', B.user.id, 'D=', D.user.id, 'E=', E.user.id, 'F=', F.user.id, 'ADM=', ADM.user.id, `adminPreExisted=${adminPreExisted}`);

    // A 建圈 C1（A=OWNER，active=C1）
    const c = await call('POST', '/community', A.accessToken, { name: `活动测试圈_${sfx}`, category: '校园', region: '杭州', location: '测试校区' });
    assert(c.body.code === 0 && c.body.data.myRole === 'OWNER', 'A 建圈 C1 → OWNER');
    const cid = c.body.data.id;
    created.communityIds.push(cid);
    // B D E 加入 C1（active=C1）；F 不加入（圈外）
    for (const u of [B, D, E]) {
      const j = await call('POST', `/community/${cid}/join`, u.accessToken);
      assert(j.body.code === 0, `${u === B ? 'B' : u === D ? 'D' : 'E'} 加入 C1`);
    }

    // ==================== 活动创建 ====================
    console.log('\n[setup] 创建活动 P1(平台/DIRECT/2人/APPROVED_ONLY/HYBRID) X1(圈子/REVIEW/1人) X2(圈子/DIRECT/1人) X4(圈子/DIRECT/5人)');
    const formP1 = [
      { type: 'text', label: '姓名', required: true, order: 0 },
      { type: 'radio', label: '性别', required: true, options: ['男', '女'], order: 1 },
      { type: 'phone', label: '手机号', required: false, order: 2 },
    ];
    const p1 = await call('POST', '/activities', ADM.accessToken, {
      title: `平台迎新跑_${sfx}`, coverImage: 'https://mock-cos.example.com/cover-p1.png',
      description: `平台活动介绍，含链接 https://example.com/rules ${sfx}`,
      format: 'HYBRID', location: '体育馆', joinLink: 'https://meet.example.com/p1',
      infoVisibility: 'APPROVED_ONLY', joinMode: 'DIRECT', capacity: 2, form: formP1, publish: true,
    });
    assert(p1.body.code === 0 && p1.body.data.status === 'PUBLISHED', 'ADM 创建并发布平台活动 P1');
    const P1 = p1.body.data.id;
    created.activityIds.push(P1);

    const x1 = await call('POST', '/activities', A.accessToken, {
      title: `圈内读书会_${sfx}`, coverImage: 'https://mock-cos.example.com/cover-x1.png',
      description: `读书会介绍 ${sfx}`, format: 'OFFLINE', location: 'X1活动室',
      joinMode: 'REVIEW', capacity: 1,
      form: [
        { type: 'text', label: '姓名', required: true, order: 0 },
        { type: 'image', label: '照片', required: false, order: 1 },
      ],
      communityId: cid, publish: true,
    });
    assert(x1.body.code === 0 && x1.body.data.scope === 'COMMUNITY', 'A 创建并发布圈子活动 X1（COMMUNITY）');
    const X1 = x1.body.data.id;
    created.activityIds.push(X1);

    const x2 = await call('POST', '/activities', A.accessToken, {
      title: `圈内夜跑_${sfx}`, coverImage: 'https://mock-cos.example.com/cover-x2.png',
      description: `夜跑介绍 ${sfx}`, format: 'ONLINE', joinLink: 'https://meet.example.com/x2',
      joinMode: 'DIRECT', capacity: 1, form: [], communityId: cid, publish: true,
    });
    assert(x2.body.code === 0, 'A 创建并发布圈子活动 X2（DIRECT cap1）');
    const X2 = x2.body.data.id;
    created.activityIds.push(X2);

    const x4 = await call('POST', '/activities', A.accessToken, {
      title: `圈内桌游_${sfx}`, coverImage: 'https://mock-cos.example.com/cover-x4.png',
      description: `桌游介绍 ${sfx}`, format: 'OFFLINE', location: 'X4活动室',
      joinMode: 'DIRECT', capacity: 5, communityId: cid, publish: true,
      form: [{ type: 'text', label: '昵称', required: false, order: 0 }],
    });
    assert(x4.body.code === 0, 'A 创建并发布圈子活动 X4（用于取消流程）');
    const X4 = x4.body.data.id;
    created.activityIds.push(X4);

    // 对照：未产生报名前表单可自由改（删字段不锁）
    const x4Edit1 = await call('PUT', `/activities/${X4}`, A.accessToken, {
      title: `圈内桌游_${sfx}`, coverImage: 'https://mock-cos.example.com/cover-x4.png',
      description: `桌游介绍 ${sfx}`, format: 'OFFLINE', location: 'X4活动室',
      joinMode: 'DIRECT', capacity: 5, form: [],
    });
    assert(x4Edit1.body.code === 0, '对照：无报名时删表单字段 → 200（锁定未生效）');

    // ==================== 规则12：权限 ====================
    console.log('\n[规则12] 权限：70009/70010/70008/70007 + 活动管理员可编辑');
    const bad9 = await call('POST', '/activities', B.accessToken, {
      title: `越权_${sfx}`, coverImage: 'c.png', description: 'x', format: 'ONLINE', joinLink: 'l', joinMode: 'DIRECT', communityId: cid,
    });
    assertCode(bad9, 70009, '非圈子管理用户发 COMMUNITY 活动 → 70009');
    const bad10 = await call('POST', '/activities', A.accessToken, {
      title: `越权平台_${sfx}`, coverImage: 'c.png', description: 'x', format: 'ONLINE', joinLink: 'l', joinMode: 'DIRECT',
    });
    assertCode(bad10, 70010, '圈子管理员（非平台）不传 communityId 发 PLATFORM 活动 → 70010');

    const p1Body = {
      title: `平台迎新跑_${sfx}`, coverImage: 'https://mock-cos.example.com/cover-p1.png',
      description: `平台活动介绍，含链接 https://example.com/rules ${sfx}`,
      format: 'HYBRID', location: '体育馆', joinLink: 'https://meet.example.com/p1',
      infoVisibility: 'APPROVED_ONLY', joinMode: 'DIRECT', capacity: 2, form: formP1,
    };
    const bad8Edit = await call('PUT', `/activities/${P1}`, D.accessToken, p1Body);
    assertCode(bad8Edit, 70008, '普通用户 PUT 活动 → 70008');
    const bad8List = await call('GET', `/activities/${P1}/enrollments`, D.accessToken);
    assertCode(bad8List, 70008, '普通用户 GET 报名列表 → 70008');
    const bad8Remind = await call('POST', `/activities/${P1}/remind`, D.accessToken, {});
    assertCode(bad8Remind, 70008, '普通用户 remind → 70008');

    const addAdmin = await call('POST', `/activities/${P1}/admins`, ADM.accessToken, { add: [D.user.id] });
    assert(addAdmin.body.code === 0, '发起人 ADM 增加活动管理员 D');
    const bad7Cancel = await call('POST', `/activities/${P1}/cancel`, D.accessToken);
    assertCode(bad7Cancel, 70007, '活动管理员 cancel → 70007（仅发起人）');
    const bad7Transfer = await call('POST', `/activities/${P1}/transfer`, D.accessToken, { targetUserId: B.user.id });
    assertCode(bad7Transfer, 70007, '活动管理员 transfer → 70007');
    const bad7Admins = await call('POST', `/activities/${P1}/admins`, D.accessToken, { add: [B.user.id] });
    assertCode(bad7Admins, 70007, '活动管理员 admins → 70007');
    const bad7Lark = await call('POST', `/activities/${P1}/lark-config`, D.accessToken, { connectionId: 'x', bitableApp: 'a', bitableTable: 'b' });
    assertCode(bad7Lark, 70007, '活动管理员 lark-config → 70007');
    const okEdit = await call('PUT', `/activities/${P1}`, D.accessToken, p1Body);
    assert(okEdit.body.code === 0 && okEdit.body.data.canManage === true, '活动管理员 D 编辑活动 P1 → 200（BR-010）');
    const bad17 = await call('POST', `/activities/${P1}/transfer`, ADM.accessToken, { targetUserId: F.user.id });
    assertCode(bad17, 70017, '转让给非管理员非平台用户 → 70017');

    // ==================== 规则8：可见范围 ====================
    console.log('\n[规则8] 可见范围：PLATFORM 全员 / COMMUNITY 仅本圈');
    const listF = await call('GET', '/activities', F.accessToken);
    assert((listF.body.data.list || []).some((a) => a.id === P1), '圈外用户 F 列表含平台活动 P1');
    assert(!(listF.body.data.list || []).some((a) => a.id === X1), '圈外用户 F 列表不含圈子活动 X1');
    const detF404 = await call('GET', `/activities/${X1}`, F.accessToken);
    assert(detF404.status === 404 && detF404.body.code === 70001, '圈外用户 F 访问 X1 详情 → 404/70001');
    const detFok = await call('GET', `/activities/${P1}`, F.accessToken);
    assert(detFok.body.code === 0, '圈外用户 F 可访问平台活动 P1 详情');
    const listB = await call('GET', '/activities', B.accessToken);
    assert((listB.body.data.list || []).some((a) => a.id === X1) && (listB.body.data.list || []).some((a) => a.id === P1), '圈内用户 B 列表同时含圈子活动 X1 与平台活动 P1');

    // ==================== 规则9：APPROVED_ONLY 敏感信息 ====================
    console.log('\n[规则9] 地点/参与链接 APPROVED_ONLY：非正式参与人不可见');
    const detF = await call('GET', `/activities/${P1}`, F.accessToken);
    assert(detF.body.data.location === null && detF.body.data.locationVisible === false, 'F（未报名）location=null & locationVisible=false');
    assert(detF.body.data.joinLink === null && detF.body.data.joinLinkVisible === false, 'F joinLink=null & joinLinkVisible=false');
    const detB0 = await call('GET', `/activities/${P1}`, B.accessToken);
    assert(detB0.body.data.location === null && detB0.body.data.joinLink === null, 'B（未报名）location/joinLink 均不可见');

    // ==================== 规则1/10/11：DIRECT 报名 + 三类计数 ====================
    console.log('\n[规则1/10/11] DIRECT 双模式 + 表单校验 + 内容安全放行');
    const fk = detB0.body.data.form; // 服务端生成的字段 key
    const kName = fk.find((f) => f.label === '姓名').key;
    const kGender = fk.find((f) => f.label === '性别').key;
    const kPhone = fk.find((f) => f.label === '手机号').key;

    const eB = await call('POST', `/activities/${P1}/enrollments`, B.accessToken, { data: { [kName]: '张三', [kGender]: '男', [kPhone]: '13800001111' } });
    assert(eB.body.code === 0 && eB.body.data.myStatus === 'APPROVED', 'B 报名 P1（DIRECT 有名额）→ APPROVED');
    const detB1 = await call('GET', `/activities/${P1}`, B.accessToken);
    assert(detB1.body.data.approvedCount === 1, 'approvedCount=1');
    assert(detB1.body.data.location === '体育馆' && detB1.body.data.joinLink === 'https://meet.example.com/p1', 'B（APPROVED）location/joinLink 可见（规则9）');
    assert(detB1.body.data.locationVisible === true && detB1.body.data.joinLinkVisible === true, 'B locationVisible/joinLinkVisible=true');

    const eD = await call('POST', `/activities/${P1}/enrollments`, D.accessToken, { data: { [kName]: '李四', [kGender]: '女' } });
    assert(eD.body.code === 0 && eD.body.data.myStatus === 'APPROVED', 'D 报名 P1 → APPROVED（满额 2/2）');
    const eE = await call('POST', `/activities/${P1}/enrollments`, E.accessToken, { data: { [kName]: '王五', [kGender]: '男' } });
    assert(eE.body.code === 0 && eE.body.data.myStatus === 'WAITLIST', 'E 报名 P1（已满）→ WAITLIST');
    const detP1a = await call('GET', `/activities/${P1}`, ADM.accessToken);
    assert(detP1a.body.data.approvedCount === 2 && detP1a.body.data.waitlistCount === 1 && detP1a.body.data.pendingCount === 0, 'P1 计数：approved=2 pending=0 waitlist=1（分开统计）');

    const dup = await call('POST', `/activities/${P1}/enrollments`, B.accessToken, { data: { [kName]: '张三', [kGender]: '男' } });
    assertCode(dup, 70003, '重复报名 → 70003');
    const badOpt = await call('POST', `/activities/${P1}/enrollments`, F.accessToken, { data: { [kName]: '赵六', [kGender]: '未知' } });
    assertCode(badOpt, 70006, '无效单选值 → 70006');
    const badReq = await call('POST', `/activities/${P1}/enrollments`, F.accessToken, { data: { [kGender]: '男' } });
    assertCode(badReq, 70006, '缺必填「姓名」→ 70006');
    const badPhone = await call('POST', `/activities/${P1}/enrollments`, F.accessToken, { data: { [kName]: '赵六', [kGender]: '男', [kPhone]: '123' } });
    assertCode(badPhone, 70006, '手机号格式不合法 → 70006');

    // ==================== REVIEW 报名（规则1）+ REJECTED 重新提交（规则3） ====================
    console.log('\n[规则1/3] REVIEW 模式 + REJECTED 重新提交');
    const xkName = (await call('GET', `/activities/${X1}`, A.accessToken)).body.data.form.find((f) => f.label === '姓名').key;
    const xkImg = (await call('GET', `/activities/${X1}`, A.accessToken)).body.data.form.find((f) => f.label === '照片').key;
    await sleep(15000); // enroll 限流 10/min，错峰
    const rB = await call('POST', `/activities/${X1}/enrollments`, B.accessToken, { data: { [xkName]: '张三' } });
    assert(rB.body.code === 0 && rB.body.data.myStatus === 'PENDING_REVIEW', 'B 报名 X1（REVIEW）→ PENDING_REVIEW');
    const rD = await call('POST', `/activities/${X1}/enrollments`, D.accessToken, { data: { [xkName]: '李四' } });
    assert(rD.body.code === 0 && rD.body.data.myStatus === 'PENDING_REVIEW', 'D 报名 X1 → PENDING_REVIEW');
    const rE = await call('POST', `/activities/${X1}/enrollments`, E.accessToken, { data: { [xkName]: '王五', [xkImg]: ['https://mock-cos.example.com/photo-e.png'] } });
    assert(rE.body.code === 0 && rE.body.data.myStatus === 'PENDING_REVIEW', 'E 报名 X1（含图片字段，checkImage mock 放行）→ PENDING_REVIEW');
    const detX1a = await call('GET', `/activities/${X1}`, A.accessToken);
    assert(detX1a.body.data.pendingCount === 3, 'X1 pendingCount=3（待审核单独统计）');

    const enrList = await call('GET', `/activities/${X1}/enrollments?status=PENDING_REVIEW`, A.accessToken);
    const eidB = enrList.body.data.list.find((e) => e.userId === B.user.id).id;
    const eidD = enrList.body.data.list.find((e) => e.userId === D.user.id).id;
    const eidE = enrList.body.data.list.find((e) => e.userId === E.user.id).id;
    assert(!!eidB && !!eidD && !!eidE, '发起人 A 查看待审核报名列表（3 条）');

    await call('POST', `/activities/${X1}/enrollments/${eidB}/approve`, A.accessToken);
    const detX1b = await call('GET', `/activities/${X1}`, A.accessToken);
    assert(detX1b.body.data.approvedCount === 1 && detX1b.body.data.pendingCount === 2, 'B 审核通过 → APPROVED（有名额）');
    await call('POST', `/activities/${X1}/enrollments/${eidD}/approve`, A.accessToken);
    const detX1c = await call('GET', `/activities/${X1}`, A.accessToken);
    assert(detX1c.body.data.waitlistCount === 1 && detX1c.body.data.approvedCount === 1, 'D 审核通过但满员 → WAITLIST（approved=1 pending=1 waitlist=1 三类分开）');
    await call('POST', `/activities/${X1}/enrollments/${eidE}/reject`, A.accessToken, { reason: '资料不符' });
    const detE = await call('GET', `/activities/${X1}`, E.accessToken);
    assert(detE.body.data.myStatus === 'REJECTED', 'E 被拒 → REJECTED');
    const rE2 = await call('POST', `/activities/${X1}/enrollments`, E.accessToken, { data: { [xkName]: '王五二' } });
    assert(rE2.body.code === 0 && rE2.body.data.myStatus === 'PENDING_REVIEW', 'REJECTED 重新提交 → PENDING_REVIEW（规则3）');

    // ==================== 规则5：表单结构锁定 ====================
    console.log('\n[规则5] 产生报名后表单结构锁定（携带服务端 key）');
    const curForm = (await call('GET', `/activities/${P1}`, ADM.accessToken)).body.data.form;
    const kkName = curForm.find((f) => f.label === '姓名').key;
    const kkGender = curForm.find((f) => f.label === '性别').key;
    const kkPhone = curForm.find((f) => f.label === '手机号').key;
    const p1FormBody = [curForm[0], curForm[1], curForm[2]]; // 带 key 的当前结构
    const f1 = [p1FormBody[0], p1FormBody[1]]; // 删除手机号
    const lockDel = await call('PUT', `/activities/${P1}`, ADM.accessToken, { ...p1Body, form: f1 });
    assertCode(lockDel, 70006, '删除字段 → 70006');
    const f2 = [p1FormBody[0], { ...p1FormBody[1], type: 'text' }, p1FormBody[2]];
    const lockType = await call('PUT', `/activities/${P1}`, ADM.accessToken, { ...p1Body, form: f2 });
    assertCode(lockType, 70006, '修改字段类型 radio→text → 70006');
    const f3 = [p1FormBody[0], { ...p1FormBody[1], options: ['男'] }, p1FormBody[2]];
    const lockOpt = await call('PUT', `/activities/${P1}`, ADM.accessToken, { ...p1Body, form: f3 });
    assertCode(lockOpt, 70006, '删除既有选项 → 70006');
    const f4 = [...p1FormBody, { type: 'text', label: '紧急联系人', required: true, order: 3 }];
    const lockReq = await call('PUT', `/activities/${P1}`, ADM.accessToken, { ...p1Body, form: f4 });
    assertCode(lockReq, 70006, '新增必填字段 → 70006');
    const f5 = [
      { ...p1FormBody[1], order: 0, placeholder: '请选择性别' }, // 排序 + 提示说明
      { ...p1FormBody[0], order: 1, label: '真实姓名' }, // 说明修改
      { ...p1FormBody[2], order: 2 },
      { type: 'text', label: '备注', required: false, order: 3 }, // 新增选填
    ];
    const okForm = await call('PUT', `/activities/${P1}`, ADM.accessToken, { ...p1Body, form: f5, location: '体育馆2' });
    assert(okForm.body.code === 0, '改说明/排序/新增选填字段 → 200（同时改地点触发重要信息变更通知）');
    const detP1f = await call('GET', `/activities/${P1}`, ADM.accessToken);
    assert(detP1f.body.data.form.some((f) => f.label === '真实姓名' && f.placeholder === undefined) || detP1f.body.data.form.some((f) => f.label === '真实姓名'), '改说明后的表单结构已保存（含「真实姓名」字段）');
    const nBi = await prisma.notification.findFirst({ where: { userId: B.user.id, type: 'activity_info_changed', targetId: P1 } });
    assert(!!nBi, 'P1 地点变更 → 正式参与人 B 收到「活动信息变更」通知');
    const nDi = await prisma.notification.findFirst({ where: { userId: D.user.id, type: 'activity_info_changed', targetId: P1 } });
    assert(!!nDi, 'P1 地点变更 → 正式参与人 D 收到「活动信息变更」通知');

    // ==================== 规则4：APPROVED 改资料 → 复审 ====================
    console.log('\n[规则4] APPROVED 改资料：pendingData 待复审 / 拒绝恢复 / 通过生效');
    const mB1 = await call('PUT', `/activities/${X1}/enrollments`, B.accessToken, { data: { [xkName]: '张三丰' } });
    assert(mB1.body.code === 0, 'B（APPROVED）修改资料 → 200');
    const detBx = await call('GET', `/activities/${X1}`, B.accessToken);
    assert(detBx.body.data.myStatus === 'APPROVED' && detBx.body.data.myEnrollment.pendingReview === true, '资格保留 APPROVED + pendingReview=true');
    assert(detBx.body.data.myEnrollment.data[xkName] === '张三', '生效资料仍为旧值「张三」');
    const detX1d = await call('GET', `/activities/${X1}`, A.accessToken);
    assert(detX1d.body.data.approvedCount === 1, '复审期间名额不变（approvedCount=1）');
    const reList = await call('GET', `/activities/${X1}/enrollments?status=RE_REVIEW`, A.accessToken);
    assert((reList.body.data.list || []).some((e) => e.userId === B.user.id && e.pendingData && e.pendingData[xkName] === '张三丰'), '复审队列 RE_REVIEW 含 B 的新资料');
    await call('POST', `/activities/${X1}/enrollments/${eidB}/reject`, A.accessToken, { reason: '新资料存疑' });
    const detBx2 = await call('GET', `/activities/${X1}`, B.accessToken);
    assert(detBx2.body.data.myEnrollment.pendingReview === false && detBx2.body.data.myEnrollment.data[xkName] === '张三', '复审拒绝 → 恢复原资料「张三」，资格保留');
    await call('PUT', `/activities/${X1}/enrollments`, B.accessToken, { data: { [xkName]: '张三丰2' } });
    await call('POST', `/activities/${X1}/enrollments/${eidB}/approve`, A.accessToken);
    const detBx3 = await call('GET', `/activities/${X1}`, B.accessToken);
    assert(detBx3.body.data.myEnrollment.pendingReview === false && detBx3.body.data.myEnrollment.data[xkName] === '张三丰2' && detBx3.body.data.myStatus === 'APPROVED', '复审通过 → 新资料「张三丰2」生效，仍 APPROVED');

    // ==================== 规则2/3：候补 FIFO + revoke 禁再报 ====================
    console.log('\n[规则2/3] 候补 FIFO 转正 + REVOKED 禁止再报名');
    const eB2 = await call('POST', `/activities/${X2}/enrollments`, B.accessToken, { data: {} });
    assert(eB2.body.code === 0 && eB2.body.data.myStatus === 'APPROVED', 'B 报名 X2（DIRECT cap1）→ APPROVED');
    const eD2 = await call('POST', `/activities/${X2}/enrollments`, D.accessToken, { data: {} });
    assert(eD2.body.code === 0 && eD2.body.data.myStatus === 'WAITLIST', 'D 报名 X2（满员）→ WAITLIST');
    await sleep(200); // 保证 waitlistedAt 严格递增
    const eE2 = await call('POST', `/activities/${X2}/enrollments`, E.accessToken, { data: {} });
    assert(eE2.body.code === 0 && eE2.body.data.myStatus === 'WAITLIST', 'E 报名 X2 → WAITLIST');
    const detB2 = await call('GET', `/activities/${X2}`, B.accessToken);
    const eidB2 = detB2.body.data.myEnrollment.id;
    const rv = await call('POST', `/activities/${X2}/enrollments/${eidB2}/revoke`, A.accessToken, { reason: '违规刷名额' });
    assert(rv.body.code === 0, 'A revoke B 的 X2 报名');
    const detB3 = await call('GET', `/activities/${X2}`, B.accessToken);
    assert(detB3.body.data.myStatus === 'REVOKED' && detB3.body.data.myEnrollment.revokedReason === '违规刷名额', 'B 状态 REVOKED + revokedReason 记录');
    const detD3 = await call('GET', `/activities/${X2}`, D.accessToken);
    assert(detD3.body.data.myStatus === 'APPROVED', '候补首位 D 自动转正 APPROVED（FIFO）');
    const detE3 = await call('GET', `/activities/${X2}`, E.accessToken);
    assert(detE3.body.data.myStatus === 'WAITLIST', '候补第二位 E 仍 WAITLIST');
    const reEnroll = await call('POST', `/activities/${X2}/enrollments`, B.accessToken, { data: {} });
    assertCode(reEnroll, 70004, 'REVOKED 再次报名 → 70004');
    const nD = await prisma.notification.findFirst({ where: { userId: D.user.id, type: 'activity_waitlist_promoted', targetId: X2 } });
    assert(!!nD, 'D 收到「候补转正」站内通知');
    const nE = await prisma.notification.findFirst({ where: { userId: E.user.id, type: 'activity_waitlist_promoted', targetId: X2 } });
    assert(!nE, 'E 未收到候补转正通知');
    const nBv = await prisma.notification.findFirst({ where: { userId: B.user.id, type: 'activity_revoked', targetId: X2 } });
    assert(!!nBv, 'B 收到「参与资格已取消」通知');
    const detX2 = await call('GET', `/activities/${X2}`, A.accessToken);
    assert(detX2.body.data.approvedCount === 1 && detX2.body.data.waitlistCount === 1, 'X2 计数 approved=1 waitlist=1');

    // ==================== 规则4-补：候补转正不采纳未复审新资料 ====================
    console.log('\n[规则4-补] WAITLIST 期间改资料 → 转正只采纳原资料，pendingData 保留待复审');
    const x5 = await call('POST', '/activities', A.accessToken, {
      title: `圈内夜读_${sfx}`, coverImage: 'https://mock-cos.example.com/cover-x5.png',
      description: `夜读介绍 ${sfx}`, format: 'OFFLINE', location: 'X5活动室',
      joinMode: 'REVIEW', capacity: 1,
      form: [{ type: 'text', label: '姓名', required: true, order: 0 }],
      communityId: cid, publish: true,
    });
    assert(x5.body.code === 0, 'A 创建并发布 REVIEW 活动 X5（cap1）');
    const X5 = x5.body.data.id;
    created.activityIds.push(X5);
    const xk5 = (await call('GET', `/activities/${X5}`, A.accessToken)).body.data.form[0].key;
    await call('POST', `/activities/${X5}/enrollments`, B.accessToken, { data: { [xk5]: '张三' } });
    const wBList = await call('GET', `/activities/${X5}/enrollments?status=PENDING_REVIEW`, A.accessToken);
    const eidB5 = wBList.body.data.list.find((e) => e.userId === B.user.id).id;
    await call('POST', `/activities/${X5}/enrollments/${eidB5}/approve`, A.accessToken);
    assert((await call('GET', `/activities/${X5}`, B.accessToken)).body.data.myStatus === 'APPROVED', 'B 报名 X5 并过审 → APPROVED（名额满）');
    const wD = await call('POST', `/activities/${X5}/enrollments`, D.accessToken, { data: { [xk5]: '李四' } });
    assert(wD.body.code === 0 && wD.body.data.myStatus === 'PENDING_REVIEW', 'D 报名 X5 → PENDING_REVIEW');
    const wDList = await call('GET', `/activities/${X5}/enrollments?status=PENDING_REVIEW`, A.accessToken);
    const eidD5 = wDList.body.data.list.find((e) => e.userId === D.user.id).id;
    await call('POST', `/activities/${X5}/enrollments/${eidD5}/approve`, A.accessToken);
    assert((await call('GET', `/activities/${X5}`, D.accessToken)).body.data.myStatus === 'WAITLIST', 'D 审核通过但满员 → WAITLIST');
    const wDm = await call('PUT', `/activities/${X5}/enrollments`, D.accessToken, { data: { [xk5]: '李四丰' } });
    assert(wDm.body.code === 0, 'D（WAITLIST）修改资料');
    const detD5a = await call('GET', `/activities/${X5}`, D.accessToken);
    assert(detD5a.body.data.myStatus === 'WAITLIST' && detD5a.body.data.myEnrollment.pendingReview === true, 'D 仍 WAITLIST + pendingReview=true');
    const cB5 = await call('POST', `/activities/${X5}/enrollments/cancel`, B.accessToken);
    assert(cB5.body.code === 0, 'B 主动取消 X5 报名（释放名额触发转正）');
    const detD5 = await call('GET', `/activities/${X5}`, D.accessToken);
    assert(detD5.body.data.myStatus === 'APPROVED', '候补 D 自动转正 APPROVED');
    assert(detD5.body.data.myEnrollment.data[xk5] === '李四', '转正生效资料仍为原「李四」（未静默采纳未复审新资料）');
    assert(detD5.body.data.myEnrollment.pendingReview === true, '转正后 pendingData 保留 → pendingReview=true');
    const rr5 = await call('GET', `/activities/${X5}/enrollments?status=RE_REVIEW`, A.accessToken);
    const rrD = (rr5.body.data.list || []).find((e) => e.userId === D.user.id);
    assert(!!rrD && rrD.pendingData && rrD.pendingData[xk5] === '李四丰', 'X5 RE_REVIEW 队列含 D 的新资料「李四丰」');
    await call('POST', `/activities/${X5}/enrollments/${eidD5}/approve`, A.accessToken);
    const detD5b = await call('GET', `/activities/${X5}`, D.accessToken);
    assert(detD5b.body.data.myStatus === 'APPROVED' && detD5b.body.data.myEnrollment.pendingReview === false && detD5b.body.data.myEnrollment.data[xk5] === '李四丰', '复审通过 → 新资料「李四丰」生效，仍 APPROVED');

    // ==================== 规则7：群聊 ====================
    console.log('\n[规则7] 群聊权限与只读');
    const cm = await call('POST', `/activities/${X1}/chat/messages`, B.accessToken, { content: '大家好' });
    assert(cm.body.code === 0, 'APPROVED 用户 B 发群消息 → 200');
    const cmE = await call('POST', `/activities/${X1}/chat/messages`, E.accessToken, { content: '带我一个' });
    assertCode(cmE, 70015, 'PENDING 用户 E 发消息 → 70015');
    const cmF = await call('POST', `/activities/${X1}/chat/messages`, F.accessToken, { content: '我是圈外的' });
    assertCode(cmF, 70015, '圈外用户 F 发消息 → 70015');
    const gmB = await call('GET', `/activities/${X1}/chat/messages`, B.accessToken);
    assert(gmB.body.code === 0 && (gmB.body.data.list || []).some((m) => m.content === '大家好' && m.nickname === `Act_B_${sfx}`), 'B 拉取群消息含自己消息与昵称');
    const gmF = await call('GET', `/activities/${X1}/chat/messages`, F.accessToken);
    assertCode(gmF, 70015, '圈外用户 F 拉取群消息 → 70015');

    // ==================== 规则6：手动提醒频率限制 ====================
    console.log('\n[规则6] 手动提醒：仅 APPROVED、24h 一次、候补不收');
    const rm1 = await call('POST', `/activities/${P1}/remind`, ADM.accessToken, {});
    assert(rm1.body.code === 0 && rm1.body.data.total === 2, '提醒全部正式参与人（B+D）→ total=2');
    const rmB = await prisma.notification.findFirst({ where: { userId: B.user.id, type: 'activity_reminder', targetId: P1 } });
    const rmD = await prisma.notification.findFirst({ where: { userId: D.user.id, type: 'activity_reminder', targetId: P1 } });
    assert(!!rmB && !!rmD, 'B/D 收到活动提醒站内通知');
    const rm2 = await call('POST', `/activities/${P1}/remind`, ADM.accessToken, {});
    assertCode(rm2, 70014, '24h 内重复提醒（全部命中限流）→ 70014');
    const rmE = await call('POST', `/activities/${P1}/remind`, ADM.accessToken, { targetUserIds: [E.user.id] });
    assert(rmE.body.code === 0 && rmE.body.data.total === 0, '指定候补用户提醒 → 目标为空（候补不在提醒范围）');
    const rmD2 = await call('POST', `/activities/${P1}/remind`, D.accessToken, {});
    assertCode(rmD2, 70014, '活动管理员 D 也可提醒，同样受频率限制 → 70014');
    const rmList = await call('GET', `/activities/${P1}/reminders`, ADM.accessToken);
    assert(rmList.body.code === 0 && rmList.body.data.total >= 2, '提醒发送记录 ≥2 条');
    const rmErow = await prisma.activityReminder.findFirst({ where: { activityId: P1, userId: E.user.id } });
    assert(!rmErow, '候补 E 无任何提醒记录');

    // ==================== 我的活动 / 兴趣 / 上新弹窗（P1 仍 PUBLISHED） ====================
    console.log('\n[补充] mine 分组 / 兴趣 / 上新弹窗');
    const mineB = await call('GET', '/activities/mine?tab=enrolled', B.accessToken);
    const mineBIds = (mineB.body.data.list || []).map((a) => a.id);
    assert(mineBIds.includes(P1) && mineBIds.includes(X1) && !mineBIds.includes(X2), 'B mine?enrolled 含 P1/X1，不含 REVOKED 的 X2');
    const mineBc = await call('GET', '/activities/mine?tab=cancelled', B.accessToken);
    assert((mineBc.body.data.list || []).some((a) => a.id === X2), 'B mine?cancelled 含被 revoke 的 X2');
    const mineDw = await call('GET', '/activities/mine?tab=waitlist', D.accessToken);
    assert((mineDw.body.data.list || []).some((a) => a.id === X1), 'D mine?waitlist 含 X1');
    const mineEp = await call('GET', '/activities/mine?tab=pending', E.accessToken);
    assert((mineEp.body.data.list || []).some((a) => a.id === X1), 'E mine?pending 含 X1');

    await call('POST', `/activities/${P1}/interest`, B.accessToken, { state: 'INTERESTED' });
    const mineBi = await call('GET', '/activities/mine?tab=interested', B.accessToken);
    assert((mineBi.body.data.list || []).some((a) => a.id === P1), 'B 标记感兴趣 → mine?interested 含 P1');
    const detP1c = await call('GET', `/activities/${P1}`, ADM.accessToken);
    assert(detP1c.body.data.approvedCount === 2, '感兴趣不占名额（approvedCount 仍 2）');
    const naF0 = await call('GET', '/activities/new-arrivals', F.accessToken);
    assert((naF0.body.data.list || []).some((a) => a.id === P1), 'F 上新弹窗含 P1');
    await call('POST', `/activities/${P1}/interest`, F.accessToken, { state: 'NOT_INTERESTED' });
    const naF1 = await call('GET', '/activities/new-arrivals', F.accessToken);
    assert(!(naF1.body.data.list || []).some((a) => a.id === P1) && (naF1.body.data.list || []).length === 0, 'F 标记不感兴趣 → 上新弹窗过滤 P1（无可展示 → 空列表）');
    await call('POST', `/activities/${P1}/interest`, F.accessToken, { state: '' });
    const naF2 = await call('GET', '/activities/new-arrivals', F.accessToken);
    assert((naF2.body.data.list || []).some((a) => a.id === P1), 'F 恢复（state=""）→ 上新弹窗重新含 P1');
    const naB = await call('GET', '/activities/new-arrivals', B.accessToken);
    const naBIds = (naB.body.data.list || []).map((a) => a.id);
    assert(naBIds.length <= 5 && naBIds.includes(P1) && naBIds.includes(X1) && naBIds.includes(X2) && naBIds.includes(X4), 'B 上新弹窗 ≤5、含全部有效活动（P1/X1/X2/X4）');

    // ==================== 规则7：finish(+7天只读) / cancel(立即只读) ====================
    console.log('\n[规则7] finish +7 天 / cancel 立即只读；AC-029 结束后不可报名');
    const fin = await call('POST', `/activities/${P1}/finish`, ADM.accessToken);
    assert(fin.body.code === 0 && fin.body.data.status === 'ENDED', 'ADM 手动结束 P1 → ENDED');
    assert(!!fin.body.data.chat.readonlyAt && fin.body.data.chat.readonly === false, 'P1 chatReadonlyAt=+7天，当前仍可发言');
    const cmB2 = await call('POST', `/activities/${P1}/chat/messages`, B.accessToken, { content: '活动很棒' });
    assert(cmB2.body.code === 0, 'P1 结束未满 7 天，APPROVED 用户仍可发消息');
    const eF2 = await call('POST', `/activities/${P1}/enrollments`, F.accessToken, { data: {} });
    assertCode(eF2, 70002, 'P1 已结束，报名 → 70002 不可报名');
    const naP1gone = await call('GET', '/activities/new-arrivals', B.accessToken);
    assert(!(naP1gone.body.data.list || []).some((a) => a.id === P1), 'P1 ENDED 后不再进入上新弹窗（AC-029）');
    const mineBe = await call('GET', '/activities/mine?tab=ended', B.accessToken);
    assert((mineBe.body.data.list || []).some((a) => a.id === P1), 'P1 已结束归入 mine?ended');

    const eB4 = await call('POST', `/activities/${X4}/enrollments`, B.accessToken, { data: {} });
    assert(eB4.body.code === 0 && eB4.body.data.myStatus === 'APPROVED', 'B 报名 X4 → APPROVED');
    const cx4 = await call('POST', `/activities/${X4}/cancel`, A.accessToken);
    assert(cx4.body.code === 0 && cx4.body.data.status === 'CANCELLED', '发起人 A 取消 X4');
    assert(!!cx4.body.data.chat.readonlyAt && cx4.body.data.chat.readonly === true, 'X4 取消 → 群聊立即只读');
    const cmB4 = await call('POST', `/activities/${X4}/chat/messages`, B.accessToken, { content: '还能说话吗' });
    assertCode(cmB4, 70016, 'X4 取消后发消息 → 70016 只读');
    const eB4b = await call('POST', `/activities/${X4}/enrollments`, D.accessToken, { data: {} });
    assertCode(eB4b, 70002, 'X4 已取消，报名 → 70002');
    const nBc = await prisma.notification.findFirst({ where: { userId: B.user.id, type: 'activity_cancelled', targetId: X4 } });
    assert(!!nBc, 'B 收到「活动已取消」通知');
    const delRoute = await fetch(`${BASE}/activities/${X4}`, { method: 'DELETE', headers: { authorization: `Bearer ${A.accessToken}` } });
    assert(delRoute.status === 404, 'DELETE /activities/:id 路由不存在（BR-012 无删除端点，只能 cancel/delist）');
    const mineBe2 = await call('GET', '/activities/mine?tab=ended', B.accessToken);
    const mineBe2Ids = (mineBe2.body.data.list || []).map((a) => a.id);
    assert(mineBe2Ids.includes(X4) && mineBe2Ids.includes(P1), '终态活动归入 mine?ended（X4 已取消 / P1 已结束）');
    const naX4gone = await call('GET', '/activities/new-arrivals', B.accessToken);
    assert(!(naX4gone.body.data.list || []).some((a) => a.id === X4), 'X4 已取消后不再进入上新弹窗（AC-029）');

    // ==================== 飞书连接与同步（补充） ====================
    console.log('\n[补充] 飞书连接脱敏 / lark-config 发起人专属 / 同步记录');
    const conn = await call('POST', '/lark-connections', A.accessToken, { name: `连接_${sfx}`, appId: 'cli_test', appSecret: 'secretValue123' });
    assert(conn.body.code === 0, 'A 创建飞书连接');
    const connId = conn.body.data.id;
    created.larkConnectionIds.push(connId);
    const connList = await call('GET', '/lark-connections', A.accessToken);
    const connRow = (connList.body.data || []).find((x) => x.id === connId);
    assert(!!connRow && connRow.appSecretMasked.includes('****') && !connRow.appSecretMasked.includes('secretValue123'), '连接密钥脱敏展示');
    const larkD = await call('POST', `/activities/${X1}/lark-config`, D.accessToken, { connectionId: connId, bitableApp: 'appX', bitableTable: 'tblX' });
    assertCode(larkD, 70007, '非发起人配置活动飞书 → 70007（D 需先成为 X1 管理员）');
    const addDx1 = await call('POST', `/activities/${X1}/admins`, A.accessToken, { add: [D.user.id] });
    assert(addDx1.body.code === 0, 'A 增加 D 为 X1 活动管理员');
    const larkD2 = await call('POST', `/activities/${X1}/lark-config`, D.accessToken, { connectionId: connId, bitableApp: 'appX', bitableTable: 'tblX' });
    assertCode(larkD2, 70007, '活动管理员配置飞书仍 → 70007（lark 仅发起人）');
    const larkA = await call('POST', `/activities/${X1}/lark-config`, A.accessToken, { connectionId: connId, bitableApp: 'appX', bitableTable: 'tblX' });
    assert(larkA.body.code === 0 && larkA.body.data.larkSync && larkA.body.data.larkSync.enabled === true, '发起人 A 配置 X1 飞书同步 → larkSync.enabled');
    const eE3 = await call('PUT', `/activities/${X1}/enrollments`, E.accessToken, { data: { [xkName]: '王五三' } });
    assert(eE3.body.code === 0, 'E（PENDING）修改资料 → 触发同步标记');
    await sleep(3000); // pushPending 异步（假凭证 → 失败落 lastError）
    const syncs = await call('GET', `/activities/${X1}/sync-records`, A.accessToken);
    assert(syncs.body.code === 0 && (syncs.body.data || []).length >= 1, '同步记录 ≥1 条');
    const retry = await call('POST', `/activities/${X1}/sync-retry`, A.accessToken);
    assert(retry.body.code === 0, '手动重试同步 → 200');
    const delConn = await call('DELETE', `/lark-connections/${connId}`, A.accessToken);
    assertCode(delConn, 70013, '连接被活动使用中，删除 → 70013');

    if (failedCnt === 0) {
      console.log('\n=== ALL PASSED ===');
    } else {
      console.error(`\n=== FAILED: ${failedCnt} assertion(s) failed ===`);
    }
  } catch (e) {
    failedCnt += 1;
    console.error('\n[FAIL]', e.stack || e.message);
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
  }
  process.exit(failedCnt > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
