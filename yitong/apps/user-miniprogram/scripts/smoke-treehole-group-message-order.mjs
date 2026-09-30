import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const logic = readFileSync(resolve(root, 'pages/treehole/group-detail/index.ts'), 'utf8');
const template = readFileSync(resolve(root, 'pages/treehole/group-detail/index.wxml'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(logic.includes('function formatMessageTime'), 'missing local message time formatter');
assert(logic.includes("].join(' ');"), 'message time must contain a date/time separator');
assert(
  (logic.match(/messages: \[\s*\.\.\.this\.data\.messages,/g) ?? []).length >= 3,
  'WebSocket, text and image messages must append to the existing list',
);
assert(
  logic.includes('messages: append ? [...list, ...this.data.messages] : list'),
  'older history must be prepended',
);
assert(!logic.includes('onReachBottom()'), 'reaching the newest message must not load older pages');
assert(
  (logic.match(/this\.scrollMessagesToBottom\(\)/g) ?? []).length >= 4,
  'initial history and all new message paths must scroll to the bottom',
);
assert(
  template.indexOf('加载更早消息') < template.indexOf('wx:for="{{messages}}"'),
  'load-older control must appear above the message list',
);
assert(template.includes('{{item.timeText}}'), 'template must render formatted local time');
assert(!template.includes('{{item.createdAt}}'), 'template must not render raw ISO timestamps');

console.log('treehole group message order smoke: PASS');
