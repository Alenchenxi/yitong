import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'app.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const postCreateSource = readFileSync(resolve(root, 'pages/post-create/index.ts'), 'utf8');
const compiledPostCreate = ts.transpileModule(postCreateSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const anonymousContentUtilsSource = readFileSync(resolve(root, 'utils/anonymous-content.ts'), 'utf8');
const compiledAnonymousContentUtils = ts.transpileModule(anonymousContentUtilsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

let app;
let fetchCount = 0;
let remoteEnabled = true;
let failNextFetch = true;
let holdNextFetch = false;
let resolveHeldFetch;
let postCreatePageConfig;
const persistedValues = [];
const guardedExitUrls = [];
const guardedExitCompletions = [];

const sandbox = {
  App(config) {
    app = config;
  },
  getCurrentPages: () => [],
  module: { exports: {} },
  exports: {},
  console,
  Promise,
  setTimeout,
  clearTimeout,
  wx: {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
    reLaunch: () => {},
  },
  require(id) {
    if (id === './utils/auth') {
      return {
        loginWithRole: async () => {},
        switchRole: async () => {},
        restoreAuth(instance) {
          instance.globalData.token = 'test-token';
          instance.globalData.currentRole = 'USER';
          return true;
        },
        clearAuth: () => {},
      };
    }
    if (id === './services/treehole') {
      return { getAnonymousToken: async () => {} };
    }
    if (id === './services/app-config') {
      return {
        readAnonymousContentVisibilityCache: () => false,
        persistAnonymousContentVisibility: (enabled) => persistedValues.push(enabled),
        fetchAnonymousContentVisibility: async () => {
          fetchCount += 1;
          if (failNextFetch) {
            failNextFetch = false;
            throw new Error('temporary network failure');
          }
          if (holdNextFetch) {
            holdNextFetch = false;
            return new Promise((resolveFetch) => {
              resolveHeldFetch = resolveFetch;
            });
          }
          return remoteEnabled;
        },
      };
    }
    throw new Error(`Unexpected module: ${id}`);
  },
};

vm.runInNewContext(compiled, sandbox, { filename: 'app.ts' });
assert.ok(app, 'app.ts must register the application');

vm.runInNewContext(compiledPostCreate, {
  Page(config) {
    postCreatePageConfig = config;
  },
  getApp: () => app,
  module: { exports: {} },
  exports: {},
  console,
  setTimeout,
  clearTimeout,
  wx: {
    getStorageSync: () => null,
    removeStorageSync: () => {},
  },
  require(id) {
    if (id === '../../services/confession') {
      return {
        listCircles: async () => [],
        createPost: async () => {},
        editPost: async () => {},
      };
    }
    if (id === '../../services/upload') {
      return {
        uploadImages: async () => [],
        uploadImage: async () => '',
        uploadVideo: async () => '',
      };
    }
    if (id === '../../utils/anonymous-content') {
      return {
        bindAnonymousContentVisibility: (owner, listener) => {
          owner.visibilityUnsubscribe = app.subscribeAnonymousContentVisibility(listener);
        },
        unbindAnonymousContentVisibility: (owner) => {
          owner.visibilityUnsubscribe?.();
          owner.visibilityUnsubscribe = null;
        },
      };
    }
    throw new Error(`Unexpected post-create module: ${id}`);
  },
}, { filename: 'pages/post-create/index.ts' });
assert.ok(postCreatePageConfig, 'post-create must register the page');

const anonymousContentUtils = {};
vm.runInNewContext(compiledAnonymousContentUtils, {
  getApp: () => app,
  module: { exports: anonymousContentUtils },
  exports: anonymousContentUtils,
  WeakMap,
  wx: {
    switchTab: ({ url, complete }) => {
      guardedExitUrls.push(url);
      if (complete) guardedExitCompletions.push(complete);
    },
  },
}, { filename: 'utils/anonymous-content.ts' });

app.onLaunch({ query: {} });
app.onShow({ query: {} });
assert.equal(
  await app.getAnonymousContentVisibility(),
  true,
  'a transient failure during initial foreground entry must retry and recover',
);
assert.equal(fetchCount, 2, 'initial foreground refresh must retry one transient failure');
assert.deepEqual(persistedValues, [true]);

remoteEnabled = false;
app.onShow({ query: {} });
assert.equal(await app.getAnonymousContentVisibility(), false);
assert.equal(fetchCount, 3, 're-entering the mini program must refresh remote visibility');

const postCreatePage = {
  ...postCreatePageConfig,
  data: { ...postCreatePageConfig.data },
  setData(patch) {
    Object.assign(this.data, patch);
  },
};
await postCreatePage.onLoad({});
assert.equal(postCreatePage.data.showAnonymousPublish, false);

remoteEnabled = true;
app.onShow({ query: {} });
assert.equal(await app.getAnonymousContentVisibility(), true);
assert.equal(fetchCount, 4);
assert.deepEqual(persistedValues, [true, false, true]);
assert.equal(
  postCreatePage.data.showAnonymousPublish,
  true,
  'a retained post-create page must react to visibility refreshed by App.onShow',
);
postCreatePage.onUnload();

const anonymousOnlyPage = {};
anonymousContentUtils.bindAnonymousContentPageGuard(anonymousOnlyPage);
app.setAnonymousContentVisibility(false);
assert.deepEqual(guardedExitUrls, ['/pages/square/index']);
guardedExitCompletions.shift()?.();
anonymousContentUtils.unbindAnonymousContentVisibility(anonymousOnlyPage);
app.setAnonymousContentVisibility(true);

guardedExitUrls.length = 0;
holdNextFetch = true;
remoteEnabled = false;
anonymousContentUtils.bindAnonymousContentPageGuard(anonymousOnlyPage);
app.onShow({ query: {} });
const concurrentRequire = anonymousContentUtils.requireAnonymousContentVisibility();
resolveHeldFetch(false);
assert.equal(await concurrentRequire, false);
await app.getAnonymousContentVisibility();
assert.deepEqual(
  guardedExitUrls,
  ['/pages/square/index'],
  'a retained guard and concurrent onShow require must share one pending exit',
);
guardedExitCompletions.shift()?.();
anonymousContentUtils.unbindAnonymousContentVisibility(anonymousOnlyPage);
app.setAnonymousContentVisibility(true);
remoteEnabled = true;

holdNextFetch = true;
const fetchCountBeforeRace = fetchCount;
app.onShow({ query: {} });
app.onShow({ query: {} });
assert.equal(fetchCount, fetchCountBeforeRace + 1, 'concurrent foreground events must share one request');

app.setAnonymousContentVisibility(true);
resolveHeldFetch(false);
await app.getAnonymousContentVisibility();

assert.equal(
  await app.getAnonymousContentVisibility(),
  true,
  'an older remote response must not overwrite a newer admin toggle',
);
assert.deepEqual(persistedValues, [true, false, true, false, true, false, true, true]);

console.log('anonymous content foreground refresh smoke: ok');
