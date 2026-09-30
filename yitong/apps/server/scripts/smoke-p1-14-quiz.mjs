/**
 * P1-14 smoke：树洞问卷（题库 / 提交 / 结果入画像 / 答题记录）
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
  console.log('[P1-14 smoke] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  const A = await login(`qz-A-${sfx}-aaaa`, `QzA_${sfx}`);

  // 1) 获取题库
  const bank = await call('GET', `/treehole/questionnaire?type=personality`);
  assert(bank.body.code === 0, 'GET questionnaire personality');
  assert(bank.body.data.questions.length === 5, '5 题');
  assert(bank.body.data.questions[0].options.length >= 2, '每题 >=2 选项');

  // 非法 type -> 30007
  const badType = await call('GET', `/treehole/questionnaire?type=unknown`);
  assert(badType.body.code === 30007, `非法 type 30007 got ${badType.body.code}`);

  // 2) 提交 personality 问卷（全选 a 选项）
  const answers = bank.body.data.questions.map((q) => ({
    questionId: q.id,
    optionId: q.options[0].id,
  }));
  const submit = await call('POST', `/treehole/questionnaire/submit`, A.accessToken, {
    type: 'personality', answers,
  });
  assert(submit.body.code === 0, 'submit personality');
  assert(submit.body.data.resultTags.length > 0, '有结果标签');
  assert(submit.body.data.resultTags.length <= 3, 'top3 以内');
  // 画像已更新
  assert(submit.body.data.profile.personalityTags.length > 0, 'profile.personalityTags 已更新');

  // 3) 空答案 -> 30008
  const empty = await call('POST', `/treehole/questionnaire/submit`, A.accessToken, {
    type: 'personality', answers: [],
  });
  assert(empty.body.code === 30008, `空答案 30008 got ${empty.body.code}`);

  // 4) 非法 questionId -> 30009
  const badQ = await call('POST', `/treehole/questionnaire/submit`, A.accessToken, {
    type: 'personality',
    answers: [{ questionId: 'noexist', optionId: 'a' }],
  });
  assert(badQ.body.code === 30009, `非法 questionId 30009 got ${badQ.body.code}`);

  // 5) mood 问卷 -> moodState 更新（top1）
  const moodBank = await call('GET', `/treehole/questionnaire?type=mood`);
  const moodAnswers = moodBank.body.data.questions.map((q) => ({
    questionId: q.id, optionId: q.options[0].id,
  }));
  const moodSubmit = await call('POST', `/treehole/questionnaire/submit`, A.accessToken, {
    type: 'mood', answers: moodAnswers,
  });
  assert(moodSubmit.body.code === 0, 'submit mood');
  assert(typeof moodSubmit.body.data.profile.moodState === 'string' && moodSubmit.body.data.profile.moodState.length > 0, 'moodState 已更新（top1）');
  assert(moodSubmit.body.data.resultTags.length === 1, 'mood 结果 top1');

  // 6) interest 问卷 -> interestTags 更新
  const intBank = await call('GET', `/treehole/questionnaire?type=interest`);
  const intAnswers = intBank.body.data.questions.map((q) => ({
    questionId: q.id, optionId: q.options[0].id,
  }));
  const intSubmit = await call('POST', `/treehole/questionnaire/submit`, A.accessToken, {
    type: 'interest', answers: intAnswers,
  });
  assert(intSubmit.body.code === 0, 'submit interest');
  assert(intSubmit.body.data.profile.interestTags.length > 0, 'interestTags 已更新');

  // 7) values 问卷 -> personalityTags 合并（不覆盖之前 personality 结果）
  const beforePersonality = intSubmit.body.data.profile.personalityTags; // 之前 submit 时拿到的
  const valBank = await call('GET', `/treehole/questionnaire?type=values`);
  const valAnswers = valBank.body.data.questions.map((q) => ({
    questionId: q.id, optionId: q.options[0].id,
  }));
  const valSubmit = await call('POST', `/treehole/questionnaire/submit`, A.accessToken, {
    type: 'values', answers: valAnswers,
  });
  assert(valSubmit.body.code === 0, 'submit values');
  // values 结果合并到 personalityTags，应包含之前的或新增的
  assert(valSubmit.body.data.profile.personalityTags.length > 0, 'values 合并后 personalityTags 非空');

  // 8) profile 查询确认画像持久化
  const prof = await call('GET', `/treehole/profile`, A.accessToken);
  assert(prof.body.code === 0, 'GET profile');
  assert(prof.body.data.personalityTags.length > 0, 'profile 持久化 personalityTags');
  assert(prof.body.data.interestTags.length > 0, 'profile 持久化 interestTags');

  console.log('\n[P1-14 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-14 smoke] STOPPED:', e.message);
  process.exit(1);
});
