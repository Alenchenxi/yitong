const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

test('推广报表包含尚无访问和报名数据的已注册推广员', () => {
  const match = source.match(/const codes = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(match, '未找到报表推广码集合');
  assert.match(match[1], /Object\.keys\(inviters\)/, '缺少手工配置推广员');
  assert.match(match[1], /Object\.keys\(autoInviters\)/, '缺少自助注册推广员');
  assert.match(match[1], /Object\.keys\(applies\)/, '缺少已有报名的推广码');
  assert.match(match[1], /Object\.keys\(visits\)/, '缺少已有访问的推广码');
});
