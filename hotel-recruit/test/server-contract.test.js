const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

test('报名处理不能用局部变量遮蔽 promoterName 查询函数', () => {
  const match = source.match(/async function handleApply[\s\S]*?\n}\n/);
  assert.ok(match, '未找到 handleApply');
  assert.doesNotMatch(match[0], /const promoterName\s*=/);
  assert.match(match[0], /promoterName\(rawInviter\)/);
});

test('已暂停报名的酒店提交被拒绝并返回明确提示', () => {
  const match = source.match(/async function handleApply[\s\S]*?\n}\n/);
  assert.ok(match, '未找到 handleApply');
  assert.match(match[0], /if \(cur\.paused\)/);
  assert.match(match[0], /该酒店已暂停报名/);
});

test('已暂停报名的酒店不能作为备选酒店', () => {
  const match = source.match(/async function handleApply[\s\S]*?\n}\n/);
  assert.ok(match, '未找到 handleApply');
  assert.match(match[0], /if \(bk\.paused\) return sendJSON\(res, 400, \{ ok: false, msg: '备选酒店已暂停报名，请重新选择' \}\)/);
});
