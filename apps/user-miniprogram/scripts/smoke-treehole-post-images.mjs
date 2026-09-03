import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const postTs = read('pages/treehole/post/index.ts');
const postWxml = read('pages/treehole/post/index.wxml');
const postWxss = read('pages/treehole/post/index.wxss');
const treeholeTs = read('pages/treehole/index.ts');
const treeholeWxml = read('pages/treehole/index.wxml');
const treeholeWxss = read('pages/treehole/index.wxss');
const mineTs = read('pages/my-anon-posts/index.ts');
const mineWxml = read('pages/my-anon-posts/index.wxml');
const mineWxss = read('pages/my-anon-posts/index.wxss');
const detailTs = read('pages/treehole/detail/index.ts');
const detailWxml = read('pages/treehole/detail/index.wxml');

assert.match(
  postTs,
  /const MAX_IMAGE_COUNT = 3;/,
  'treehole posts must allow at most three images',
);
assert.match(
  postTs,
  /const MAX_IMAGE_SIZE = 5 \* 1024 \* 1024;/,
  'client limit must match the current 5MB upload endpoint',
);
assert.match(
  postTs,
  /wx\.chooseMedia\(\{[\s\S]*count: remaining,[\s\S]*mediaType: \['image'\][\s\S]*sourceType: \['album', 'camera'\]/,
  'the picker must choose only images from album or camera and respect remaining slots',
);
assert.match(
  postTs,
  /file\.size <= MAX_IMAGE_SIZE/,
  'oversized images must be rejected before upload',
);
assert.match(
  postTs,
  /wx\.previewImage\(\{[\s\S]*urls: this\.data\.imagePaths/,
  'selected images must be previewable',
);
assert.match(
  postTs,
  /removeImage[\s\S]*filter\(\(_, itemIndex\) => itemIndex !== index\)/,
  'selected images must be removable',
);
assert.match(
  postTs,
  /await uploadImages\(this\.data\.imagePaths, 'anon'\)/,
  'images must use the anonymous upload namespace',
);
assert.match(
  postTs,
  /createPost\(\{[\s\S]*images[\s\S]*\}\)/,
  'uploaded image URLs must be sent with the anonymous post',
);
assert.match(
  postWxml,
  /wx:for="\{\{imagePaths\}\}"[\s\S]*bindtap="previewImage"/,
  'selected image thumbnails must render and preview',
);
assert.match(postWxml, /catchtap="removeImage"/, 'each selected image must be removable');
assert.match(
  postWxml,
  /imagePaths\.length < maxImageCount[\s\S]*bindtap="chooseImages"/,
  'the add button must disappear at the limit',
);
assert.match(
  postWxss,
  /grid-template-columns:\s*repeat\(3, 1fr\)/,
  'the composer must use the established stable three-column grid',
);
assert.match(postWxss, /aspect-ratio:\s*1/, 'composer image tiles must remain square');

for (const [name, ts, wxml, wxss] of [
  ['treehole feed', treeholeTs, treeholeWxml, treeholeWxss],
  ['my anonymous posts', mineTs, mineWxml, mineWxss],
]) {
  assert.match(
    ts,
    /previewImage\(e: WechatMiniprogram\.TouchEvent\)/,
    name + ' must expose image preview',
  );
  assert.match(
    wxml,
    /wx:if="\{\{item\.images\.length > 0\}\}"[\s\S]*wx:for="\{\{item\.images\}\}"[\s\S]*catchtap="previewImage"/,
    name + ' must render published images',
  );
  assert.match(
    wxss,
    /grid-template-columns:\s*repeat\(3, 1fr\)/,
    name + ' must use a stable image grid',
  );
}

assert.match(
  detailTs,
  /previewImage\(e: WechatMiniprogram\.TouchEvent\)/,
  'treehole detail must expose image preview',
);
assert.match(
  detailWxml,
  /wx:for="\{\{post\.images\}\}"[\s\S]*catchtap="previewImage"/,
  'treehole detail images must be previewable',
);

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compiled = ts.transpileModule(postTs, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

let pageDefinition;
let chooseOptions;
let uploadCalls = 0;
let createCalls = 0;
let submittedPayload;
const toasts = [];
const previews = [];
const loadingTitles = [];

const module = { exports: {} };
const sandbox = {
  module,
  exports: module.exports,
  require(specifier) {
    if (specifier === '../../../services/treehole') {
      return {
        hasAnonToken: () => true,
        getAnonymousToken: async () => ({
          anonToken: 'anon-token',
          anonId: 'anon-id',
          nickname: '匿名用户',
        }),
        getAnonTags: async () => ({ mood: [], personality: [], interest: [] }),
        createPost: async (payload) => {
          createCalls += 1;
          submittedPayload = payload;
          return {};
        },
      };
    }
    if (specifier === '../../../services/upload') {
      return {
        uploadImages: async (paths, type) => {
          uploadCalls += 1;
          assert.deepEqual(Array.from(paths), ['local-a', 'local-b']);
          assert.equal(type, 'anon');
          return ['https://cdn/a.jpg', 'https://cdn/b.jpg'];
        },
      };
    }
    if (specifier === '../../../utils/anonymous-content') {
      return {
        bindAnonymousContentPageGuard() {},
        requireAnonymousContentVisibility: async () => true,
        unbindAnonymousContentVisibility() {},
      };
    }
    return {};
  },
  Page(definition) {
    pageDefinition = definition;
  },
  getApp() {
    return { requireAuth: () => true };
  },
  wx: {
    chooseMedia(options) {
      chooseOptions = options;
    },
    showToast(options) {
      toasts.push(options);
    },
    previewImage(options) {
      previews.push(options);
    },
    showLoading(options) {
      loadingTitles.push(options.title);
    },
    hideLoading() {},
    navigateBack() {},
  },
  setTimeout() {
    return 0;
  },
};

vm.runInNewContext(compiled, sandbox);
assert.ok(pageDefinition, 'treehole post page must register');

const page = {
  data: structuredClone(pageDefinition.data),
  setData(patch) {
    Object.assign(this.data, patch);
  },
};

pageDefinition.chooseImages.call(page);
assert.equal(chooseOptions.count, 3);
chooseOptions.success({
  tempFiles: [
    { tempFilePath: 'local-a', size: 1024 },
    { tempFilePath: 'too-large', size: 5 * 1024 * 1024 + 1 },
  ],
});
assert.deepEqual(Array.from(page.data.imagePaths), ['local-a']);
assert.equal(toasts.at(-1)?.title, '单张图片不能超过 5MB');

pageDefinition.previewImage.call(page, { currentTarget: { dataset: { src: 'local-a' } } });
assert.deepEqual(Array.from(previews.at(-1).urls), ['local-a']);

pageDefinition.removeImage.call(page, { currentTarget: { dataset: { index: 0 } } });
assert.equal(page.data.imagePaths.length, 0);

Object.assign(page.data, {
  content: '  匿名图文动态  ',
  imagePaths: ['local-a', 'local-b'],
  selectedMood: '开心',
});
const firstSubmit = pageDefinition.submit.call(page);
const duplicateSubmit = pageDefinition.submit.call(page);
await Promise.all([firstSubmit, duplicateSubmit]);

assert.equal(uploadCalls, 1, 'duplicate taps must not upload twice');
assert.equal(createCalls, 1, 'duplicate taps must not create twice');
assert.deepEqual(JSON.parse(JSON.stringify(submittedPayload)), {
  content: '匿名图文动态',
  mood: '开心',
  images: ['https://cdn/a.jpg', 'https://cdn/b.jpg'],
});
assert.deepEqual(loadingTitles, ['上传图片...', '发布中...']);
assert.equal(page.data.submitting, false);

console.log('treehole post images smoke: ok');
