/**
 * P1-18 smoke：树洞语音消息（录音上传 + type=voice 消息 + 时长 + 历史）
 * 前置：server 正常运行（mock/真 MinIO 均可，上传返回 url 即可）
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
  console.log('[P1-18 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `VcA_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `VcB_${sfx}`);

  const atA = await call('POST', `/treehole/anonymous-token`, A.accessToken);
  const atB = await call('POST', `/treehole/anonymous-token`, B.accessToken);
  const tokA = atA.body.data.anonToken;
  const tokB = atB.body.data.anonToken;
  const anonB = atB.body.data.anonId;
  const anonA = atA.body.data.anonId;

  // A 入队，B 撮合
  const mA = await call('POST', `/treehole/match`, tokA);
  assert(mA.body.data.waiting === true, 'A 入队 waiting');
  const mB = await call('POST', `/treehole/match`, tokB);
  assert(mB.body.data.waiting === false, 'B 撮合 A');

  // 1) 语音上传（multipart，audio/mpeg）
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.alloc(2048, 1)], { type: 'audio/mpeg' }), 'voice.mp3');
  const up = await fetch(`${BASE}/uploads/voice?type=voice`, {
    method: 'POST',
    headers: { authorization: `Bearer ${A.accessToken}` },
    body: fd,
  });
  const upj = await up.json();
  assert(upj.code === 0 && typeof upj.data?.url === 'string', `语音上传返回 url (${upj.data?.url ?? upj.message})`);
  const voiceUrl = upj.data.url;
  assert(voiceUrl.includes('/voice/'), 'url 落在 voice 文件夹');

  // 2) 非法 mimetype 被拒
  const fd2 = new FormData();
  fd2.append('file', new Blob([Buffer.alloc(128, 1)], { type: 'text/plain' }), 'x.txt');
  const up2 = await fetch(`${BASE}/uploads/voice`, {
    method: 'POST',
    headers: { authorization: `Bearer ${A.accessToken}` },
    body: fd2,
  });
  const up2j = await up2.json();
  assert(up2j.code === 90004, `非法语音类型被拒 90004 got ${up2j.code}`);

  // 3) A 发语音消息（type=voice, duration=5）
  const s1 = await call('POST', `/treehole/messages`, tokA, { peerAnonId: anonB, content: voiceUrl, type: 'voice', duration: 5 });
  assert(s1.body.code === 0, 'A 发语音消息成功');
  assert(s1.body.data.type === 'voice', '返回 type=voice');
  assert(s1.body.data.duration === 5, `返回 duration=5 got ${s1.body.data.duration}`);

  // 4) 时长校验：缺 duration / 0 / 61 均 30004
  const bad1 = await call('POST', `/treehole/messages`, tokA, { peerAnonId: anonB, content: voiceUrl, type: 'voice' });
  assert(bad1.body.code === 30004, `缺 duration 被拒 30004 got ${bad1.body.code}`);
  const bad2 = await call('POST', `/treehole/messages`, tokA, { peerAnonId: anonB, content: voiceUrl, type: 'voice', duration: 0 });
  assert(bad2.body.code === 30004, `duration=0 被拒 30004 got ${bad2.body.code}`);
  const bad3 = await call('POST', `/treehole/messages`, tokA, { peerAnonId: anonB, content: voiceUrl, type: 'voice', duration: 61 });
  assert(bad3.body.code === 30004, `duration=61 被拒 30004 got ${bad3.body.code}`);

  // 5) B 拉历史：语音消息带 type + duration + url
  const hist = await call('GET', `/treehole/messages?peerAnonId=${encodeURIComponent(anonA)}`, tokB);
  assert(hist.body.code === 0, 'B 拉历史');
  const vm = hist.body.data.list.find((m) => m.type === 'voice');
  assert(!!vm, '历史含语音消息');
  assert(vm.duration === 5, `历史 duration=5 got ${vm.duration}`);
  assert(vm.content === voiceUrl, '历史 content = 语音 url');

  // 6) 文字/图片消息回归
  const s2 = await call('POST', `/treehole/messages`, tokB, { peerAnonId: anonA, content: 'hello', type: 'text' });
  assert(s2.body.code === 0 && s2.body.data.type === 'text', '文字消息回归');
  const s3 = await call('POST', `/treehole/messages`, tokB, { peerAnonId: anonA, content: 'https://example.com/a.png', type: 'image' });
  assert(s3.body.code === 0 && s3.body.data.type === 'image', '图片消息回归');

  console.log('\n[P1-18 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-18 smoke] STOPPED:', e.message);
  process.exit(1);
});
