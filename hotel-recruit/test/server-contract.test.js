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
