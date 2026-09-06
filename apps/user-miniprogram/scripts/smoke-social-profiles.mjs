import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const appJson = JSON.parse(read('app.json'));
const treeholeService = read('services/treehole.ts');
const followService = read('services/follow.ts');
const anonAuthorTs = read('pages/treehole/author/index.ts');
const anonAuthorWxml = read('pages/treehole/author/index.wxml');
const postCardTs = read('components/post-card/post-card.ts');
const postDetailWxml = read('pages/post-detail/index.wxml');
const searchWxml = read('pages/confession-search/index.wxml');
const followListTs = read('pages/follow-list/index.ts');
const followListWxml = read('pages/follow-list/index.wxml');
const notifications = read('components/notifications-view/index.ts');

assert.ok(
  appJson.pages.includes('pages/user-profile/index'),
  '实名用户主页必须注册到 app.json',
);
for (const extension of ['ts', 'wxml', 'wxss', 'json']) {
  const path = fileURLToPath(new URL(`../pages/user-profile/index.${extension}`, import.meta.url));
  assert.ok(existsSync(path), `实名用户主页必须包含 index.${extension}`);
}

assert.match(
  treeholeService,
  /authors\/\$\{encodeURIComponent\(targetAnonId\)\}\/follow/,
  '树洞 service 必须提供匿名作者关注接口',
);
assert.match(anonAuthorTs, /toggleAnonAuthorFollow/, '匿名作者页必须调用关注接口');
assert.match(anonAuthorWxml, /bindtap="toggleFollow"/, '匿名作者页必须展示关注操作');
assert.match(anonAuthorWxml, /author\.followerCount/, '匿名作者页必须展示粉丝数');
assert.match(anonAuthorWxml, /author\.followingCount/, '匿名作者页必须展示关注数');

assert.match(followService, /getUserProfile/, '实名主页 service 必须提供资料接口');
assert.match(followService, /\/users\/\$\{encodeURIComponent\(userId\)\}\/profile/, '实名主页必须调用 profile API');
assert.match(postCardTs, /pages\/user-profile\/index\?id=/, '实名帖子卡作者必须进入用户主页');
assert.match(
  postCardTs,
  /if \(post\?\.isAnonymous\) \{[\s\S]*this\.onTap\(\)/,
  '表白墙匿名帖作者区域必须继续进入帖子详情',
);
assert.match(postDetailWxml, /data-id="\{\{post\.authorId\}\}"/, '详情页作者必须携带用户 ID');
assert.match(postDetailWxml, /data-id="\{\{item\.authorId\}\}"/, '顶级评论作者必须进入用户主页');
assert.match(postDetailWxml, /data-id="\{\{r\.authorId\}\}"/, '回复作者必须进入用户主页');
assert.match(searchWxml, /bindtap="openUserProfile"/, '用户搜索结果必须进入用户主页');
assert.match(followListWxml, /bindtap="openProfile"/, '关注和粉丝列表必须进入对应用户主页');
assert.match(followListWxml, /data-mode="anon-following"/, '关注页必须提供树洞关注分类');
assert.match(followListTs, /listAnonFollowing/, '树洞关注分类必须调用匿名关注列表接口');
assert.match(followListTs, /pages\/treehole\/author\/index\?anonId=/, '树洞关注项必须进入匿名作者主页');
assert.match(
  notifications,
  /targetType === 'user'[\s\S]*pages\/user-profile\/index\?id=/,
  '用户通知必须进入目标用户主页',
);

console.log('social profile contracts: all passed');
