import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(resolve(root, 'components/admin-panels/users/index.wxml'), 'utf8');
const styles = readFileSync(resolve(root, 'components/admin-panels/users/index.wxss'), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `缺少 ${selector} 样式规则`);
  return match[1];
}

assert.match(
  template,
  /class="adm-item adm-candidate-item"[\s\S]*class="adm-item-sub adm-candidate-id"/,
  '候选管理员列表必须使用独立的行与长 ID 样式钩子',
);

const panel = rule('.adm-dialog-panel');
assert.match(panel, /box-sizing\s*:\s*border-box/, '弹窗宽高必须包含 padding，不能超出视口');
assert.match(panel, /overflow\s*:\s*hidden/, '弹窗内容必须裁切在面板边界内');

const list = rule('.adm-dialog-list');
assert.match(list, /min-height\s*:\s*0/, '候选列表必须允许在 flex 容器内收缩');
assert.match(list, /width\s*:\s*100%/, '候选列表宽度不得超过弹窗内容区');
assert.match(list, /box-sizing\s*:\s*border-box/, '候选列表尺寸必须包含自身盒模型');

const candidate = rule('.adm-candidate-item');
assert.match(candidate, /width\s*:\s*100%/, '每条候选记录必须限制在列表宽度内');
assert.match(candidate, /box-sizing\s*:\s*border-box/, '候选记录的 padding 和边框不得撑大列表');

const candidateId = rule('.adm-candidate-id');
assert.match(candidateId, /overflow\s*:\s*hidden/, '长用户 ID 不得穿出候选记录');
assert.match(candidateId, /text-overflow\s*:\s*ellipsis/, '长用户 ID 应在可用宽度内省略显示');
assert.match(candidateId, /white-space\s*:\s*nowrap/, '长用户 ID 应保持单行并省略');

console.log('admin add dialog layout smoke: ok');
