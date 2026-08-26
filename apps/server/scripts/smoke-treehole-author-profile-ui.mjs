import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
  console.log(`  PASS ${message}`);
}

const appJson = JSON.parse(read('apps/user-miniprogram/app.json'));
const service = read('apps/user-miniprogram/services/treehole.ts');
const authorTs = read('apps/user-miniprogram/pages/treehole/author/index.ts');
const authorWxml = read('apps/user-miniprogram/pages/treehole/author/index.wxml');
const treeholeTs = read('apps/user-miniprogram/pages/treehole/index.ts');
const treeholeWxml = read('apps/user-miniprogram/pages/treehole/index.wxml');
const detailTs = read('apps/user-miniprogram/pages/treehole/detail/index.ts');
const detailWxml = read('apps/user-miniprogram/pages/treehole/detail/index.wxml');
const squareTs = read('apps/user-miniprogram/pages/square/index.ts');
const squareWxml = read('apps/user-miniprogram/pages/square/index.wxml');
const postCardTs = read('apps/user-miniprogram/components/post-card/post-card.ts');
const postCardWxml = read('apps/user-miniprogram/components/post-card/post-card.wxml');
const chatWxml = read('apps/user-miniprogram/pages/treehole/chat/index.wxml');

assert(appJson.pages.includes('pages/treehole/author/index'), 'app.json 注册匿名作者主页');
assert(service.includes('/treehole/authors/${encodeURIComponent(targetAnonId)}'), '作者资料接口编码 anonId');
assert(service.includes('/treehole/authors/${encodeURIComponent(targetAnonId)}/posts'), '作者动态接口编码 anonId');
assert(service.includes('/treehole/authors/${encodeURIComponent(targetAnonId)}/chat'), '作者直聊接口编码 anonId');
assert((authorWxml.match(/class="chat-fab"/g) ?? []).length === 1, '作者主页底部只有一个聊天悬浮按钮');
assert(authorTs.includes('startAnonAuthorChat(this.data.anonId)'), '聊天按钮先创建或复用有效直聊会话');
assert(
  authorTs.includes('matchId=${encodeURIComponent(result.matchId)}&peerAnonId=${encodeURIComponent(result.peerAnonId)}'),
  '直聊携带 matchId 与 peerAnonId 进入聊天页',
);
assert(authorWxml.includes('{{author.nickname}}') && authorWxml.includes('wx:for="{{posts}}"'), '作者主页展示匿名昵称和动态列表');
assert(treeholeWxml.includes('catchtap="goAuthor"') && treeholeTs.includes('encodeURIComponent(anonId)'), '树洞首页作者可点击并安全跳转');
assert(detailWxml.includes('catchtap="goAuthor"') && detailTs.includes('encodeURIComponent(anonId)'), '树洞详情作者可点击并安全跳转');
assert(postCardWxml.includes('catchtap="onAuthor"') && postCardTs.includes("this.triggerEvent('author'"), '匿名帖子卡派发作者点击事件');
assert(squareWxml.includes('bind:author="goAnonAuthor"') && squareTs.includes('goAnonAuthor'), '广场树洞帖子接入作者主页');
assert(
  chatWxml.includes("wx:if=\"{{matchKind === 'RANDOM'}}\"") && chatWxml.includes("matchKind === 'DIRECT'"),
  '直接聊天隐藏跳过并显示会话标识',
);

console.log(`\nsmoke-treehole-author-profile-ui: ${passed} passed`);
