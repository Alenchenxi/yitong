/* eslint-disable no-console */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const miniRoot = path.resolve(here, '../../user-miniprogram');

const [matchesTs, matchesWxml, chatTs, chatWxml, serviceTs] = await Promise.all([
  readFile(path.join(miniRoot, 'pages/treehole/matches/index.ts'), 'utf8'),
  readFile(path.join(miniRoot, 'pages/treehole/matches/index.wxml'), 'utf8'),
  readFile(path.join(miniRoot, 'pages/treehole/chat/index.ts'), 'utf8'),
  readFile(path.join(miniRoot, 'pages/treehole/chat/index.wxml'), 'utf8'),
  readFile(path.join(miniRoot, 'services/treehole.ts'), 'utf8'),
]);
const restoreFailureBody = chatTs.match(/handleRestoreFailure\([^)]*\)\s*\{([\s\S]*?)\n  \},/)?.[1] ?? '';

const checks = [
  ['历史卡片绑定 matchId', matchesWxml.includes('data-match-id="{{item.id}}"')],
  ['历史卡片绑定 peerAnonId', matchesWxml.includes('data-peer-anon-id="{{item.peerAnonId}}"')],
  ['历史路由同时传两个编码 ID', /matchId=\$\{encodeURIComponent\(matchId\)\}&peerAnonId=\$\{encodeURIComponent\(peerAnonId\)\}/.test(matchesTs)],
  ['聊天页 onLoad 接收路由参数', /async onLoad\(options: \{ matchId\?: string; peerAnonId\?: string \}\)/.test(chatTs)],
  ['聊天页调用指定匹配恢复接口', chatTs.includes('await resumeAnonMatch(matchId)')],
  ['恢复结果校验 matchId', chatTs.includes('result.matchId !== matchId')],
  ['恢复结果校验 peerAnonId', chatTs.includes('result.peerAnonId !== peerAnonId')],
  ['首帧在路由判定前不展示随机匹配页', chatTs.includes('pageReady: false') && chatWxml.includes('wx:if="{{!pageReady}}"')],
  ['恢复期间不展示随机匹配页', chatWxml.includes('wx:elif="{{restoring}}"') && chatWxml.includes('wx:elif="{{!matched}}"')],
  ['恢复失败返回前保持恢复界面', !restoreFailureBody.includes('restoring: false')],
  ['匿名凭证失败不落入随机匹配', /catch\s*\{\s*if \(hasResumeParams\) this\.handleRestoreFailure/.test(chatTs)],
  ['冷启动匿名凭证用于恢复请求', /const requestAnonToken = app\.globalData\.anonToken \|\| anonToken/.test(serviceTs) && serviceTs.includes('Bearer ${requestAnonToken}')],
  ['客户端恢复接口使用 GET 且不触发 match', /resumeAnonMatch[\s\S]*method: 'GET'/.test(serviceTs)],
];

let failed = 0;
for (const [label, ok] of checks) {
  if (ok) {
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

if (failed > 0) process.exit(1);
console.log(`\nmatch-history-resume UI smoke: ${checks.length} passed`);
