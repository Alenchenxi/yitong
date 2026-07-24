/**
 * 被禁言者输入区数据链路 smoke。
 * 场景：A 建群，B 加入；A 禁言 B 3 天；A/B 详情均能读到未来 ISO mutedUntil；A 解禁后 A/B 详情均为 null。
 * 该脚本只验证后端数据契约，前端 load() 据此计算 myMutedText 并切换输入区三态。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';

async function call(method, path, token, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

function assertIsoFuture(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} 是非空字符串`);
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value), `${label} 是 ISO 字符串（${value}）`);
  const timestamp = new Date(value).getTime();
  assert(Number.isFinite(timestamp), `${label} 可被 new Date() 解析`);
  assert(timestamp > Date.now(), `${label} 在未来（${value}）`);
}

async function login(code, nickname) {
  const result = await call('POST', '/auth/wx-login', '', {
    code,
    role: 'user',
    nickname,
  });
  assert(result.status >= 200 && result.status < 300 && result.body.code === 0, `${nickname} 登录成功`);
  return result.body.data;
}

function memberOf(detail, anonId) {
  return detail.members.find((member) => member.anonId === anonId) ?? null;
}

(async () => {
  console.log('[muted-input smoke] base =', BASE);
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const A = await login(`muted-a-${suffix}`, `MutedOwner_${suffix}`);
  const B = await login(`muted-b-${suffix}`, `MutedMember_${suffix}`);

  const anonAResult = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const anonBResult = await call('POST', '/treehole/anonymous-token', B.accessToken);
  assert(anonAResult.status === 201 && anonAResult.body.code === 0, 'A 获取匿名 token');
  assert(anonBResult.status === 201 && anonBResult.body.code === 0, 'B 获取匿名 token');
  const anonA = anonAResult.body.data;
  const anonB = anonBResult.body.data;

  const create = await call('POST', '/treehole/groups', anonA.anonToken, {
    name: `muted-${suffix}`,
    maxMembers: 10,
  });
  assert(create.status === 201 && create.body.code === 0, 'A 建群');
  const groupId = create.body.data.id;

  const join = await call('POST', `/treehole/groups/${groupId}/join`, anonB.anonToken);
  assert(join.status === 201 && join.body.code === 0, 'B 加入群');

  const mute = await call(
    'POST',
    `/treehole/groups/${groupId}/members/${anonB.anonId}/mute`,
    anonA.anonToken,
    { days: 3 },
  );
  assert(mute.status === 201 && mute.body.code === 0, 'A 禁言 B 3 天');
  assertIsoFuture(mute.body.data.mutedUntil, '禁言响应 mutedUntil');

  const detailAAfterMute = await call('GET', `/treehole/groups/${groupId}`, anonA.anonToken);
  assert(detailAAfterMute.status === 200 && detailAAfterMute.body.code === 0, 'A 获取禁言后群详情');
  const memberBFromA = memberOf(detailAAfterMute.body.data, anonB.anonId);
  assert(memberBFromA !== null, 'A 侧群详情包含 B');
  assertIsoFuture(memberBFromA.mutedUntil, 'A 侧 B.mutedUntil');

  const detailBAfterMute = await call('GET', `/treehole/groups/${groupId}`, anonB.anonToken);
  assert(detailBAfterMute.status === 200 && detailBAfterMute.body.code === 0, 'B 获取禁言后群详情');
  const memberBFromB = memberOf(detailBAfterMute.body.data, anonB.anonId);
  assert(memberBFromB !== null, 'B 侧群详情包含自己');
  assertIsoFuture(memberBFromB.mutedUntil, 'B 侧自己 mutedUntil');

  const unmute = await call(
    'POST',
    `/treehole/groups/${groupId}/members/${anonB.anonId}/mute`,
    anonA.anonToken,
    { days: 0 },
  );
  assert(unmute.status === 201 && unmute.body.code === 0, 'A 解除 B 禁言');
  assert(unmute.body.data.mutedUntil === null, '解除禁言响应 mutedUntil 为 null');

  const detailAAfterUnmute = await call('GET', `/treehole/groups/${groupId}`, anonA.anonToken);
  assert(detailAAfterUnmute.status === 200 && detailAAfterUnmute.body.code === 0, 'A 获取解禁后群详情');
  const memberBAfterAUnmute = memberOf(detailAAfterUnmute.body.data, anonB.anonId);
  assert(memberBAfterAUnmute?.mutedUntil === null, 'A 侧 B.mutedUntil 为 null');

  const detailBAfterUnmute = await call('GET', `/treehole/groups/${groupId}`, anonB.anonToken);
  assert(detailBAfterUnmute.status === 200 && detailBAfterUnmute.body.code === 0, 'B 获取解禁后群详情');
  const memberBAfterBUnmute = memberOf(detailBAfterUnmute.body.data, anonB.anonId);
  assert(memberBAfterBUnmute?.mutedUntil === null, 'B 侧自己 mutedUntil 为 null');

  console.log('\n[muted-input smoke] ALL PASSED');
})().catch((error) => {
  console.error('\n[muted-input smoke] FAILED:', error.message);
  process.exitCode = 1;
});
