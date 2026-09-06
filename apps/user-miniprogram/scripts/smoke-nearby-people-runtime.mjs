import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(scriptDir, '../components/nearby-people/index.ts');

function createComponent(wxMock, nearbyMock = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  let definition;
  const enableCalls = [];
  const defaults = {
    getNearbyPresence: async () => ({ enabled: false, locatedAt: null }),
    enableNearbyPresence: async (...args) => {
      enableCalls.push(args);
      return { enabled: true, locatedAt: new Date().toISOString() };
    },
    disableNearbyPresence: async () => ({ enabled: false }),
    listNearbyPeople: async () => ({ enabled: true, list: [], nextCursor: null, hasMore: false }),
    ...nearbyMock,
  };
  vm.runInNewContext(
    compiled,
    {
      Component(value) {
        definition = value;
      },
      wx: wxMock,
      console,
      require(moduleId) {
        if (moduleId.endsWith('/services/nearby')) return defaults;
        if (moduleId.endsWith('/services/follow'))
          return { toggleFollow: async () => ({ following: true }) };
        if (moduleId.endsWith('/services/treehole')) {
          return {
            hasAnonToken: () => true,
            getAnonymousToken: async () => ({ nickname: '匿名用户' }),
            toggleAnonAuthorFollow: async () => ({ following: true }),
          };
        }
        return {};
      },
      exports: {},
      module: { exports: {} },
    },
    { filename: sourcePath },
  );
  assert.ok(definition, '附近的人必须注册 Component');
  const component = {
    properties: { channel: 'confession' },
    data: structuredClone(definition.data),
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  for (const [name, method] of Object.entries(definition.methods)) {
    component[name] = method.bind(component);
  }
  return { component, definition, enableCalls };
}

function createWxMock(overrides = {}) {
  return {
    canIUse: () => false,
    getSetting: ({ success }) => success({ authSetting: {} }),
    getFuzzyLocation: ({ success }) => success({ longitude: 120.1551, latitude: 30.2741 }),
    showModal: () => {},
    showToast: () => {},
    stopPullDownRefresh: () => {},
    openSetting: () => {},
    openAppAuthorizeSetting: () => {},
    navigateTo: () => {},
    ...overrides,
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

async function testExplicitConsentBeforeSaving() {
  let enableModal;
  const wxMock = createWxMock({
    showModal: (options) => {
      enableModal = options;
    },
  });
  const { component, enableCalls } = createComponent(wxMock);

  component.enableFromButton();
  assert.equal(enableCalls.length, 0, '用户确认前不得保存位置');
  assert.equal(enableModal?.confirmText, '同意开启', '首次开启必须显示明确同意操作');
  enableModal.success({ confirm: true, cancel: false });
  await flush();
  await flush();
  assert.equal(enableCalls.length, 1, '用户确认后必须保存模糊位置');
  assert.equal(component.data.enabled, true, '保存成功后必须更新开启状态');
}

async function testMiniProgramPermissionCanRecover() {
  let permissionModal;
  let fuzzyCalls = 0;
  let permissionEnabled = false;
  const wxMock = createWxMock({
    getSetting: ({ success }) =>
      success({
        authSetting: { 'scope.userFuzzyLocation': permissionEnabled },
      }),
    showModal: (options) => {
      permissionModal = options;
    },
    openSetting: ({ success }) => {
      permissionEnabled = true;
      success({ authSetting: { 'scope.userFuzzyLocation': true } });
    },
    getFuzzyLocation: ({ success }) => {
      fuzzyCalls += 1;
      success({ longitude: 120.1551, latitude: 30.2741 });
    },
  });
  const { component } = createComponent(wxMock);

  component.requestLocation(true, true);
  assert.equal(fuzzyCalls, 0, '已拒绝小程序权限时不得直接定位');
  permissionModal.success({ confirm: true, cancel: false });
  await flush();
  assert.equal(fuzzyCalls, 1, '在设置中开启权限后必须自动重新定位');
}

async function testAuthorizedScopeDenialUsesSystemSettingsAndRetries() {
  let systemModal;
  let fuzzyCalls = 0;
  let appSettingsCalls = 0;
  const wxMock = createWxMock({
    canIUse: (api) => api === 'openAppAuthorizeSetting',
    getSetting: ({ success }) => success({ authSetting: { 'scope.userFuzzyLocation': true } }),
    getFuzzyLocation: ({ fail, success }) => {
      fuzzyCalls += 1;
      if (fuzzyCalls === 1) fail({ errMsg: 'getFuzzyLocation:fail auth deny' });
      else success({ longitude: 120.1551, latitude: 30.2741 });
    },
    showModal: (options) => {
      systemModal = options;
    },
    openAppAuthorizeSetting: () => {
      appSettingsCalls += 1;
    },
  });
  const { component, definition } = createComponent(wxMock);

  component.requestLocation(true, true);
  assert.equal(systemModal?.title, '系统定位权限未开启');
  assert.equal(component.data.locationAction, 'appSettings');
  systemModal.success({ confirm: true, cancel: false });
  assert.equal(appSettingsCalls, 1, '支持时必须打开微信系统授权设置');
  definition.pageLifetimes.show.call(component);
  await flush();
  await flush();
  assert.equal(fuzzyCalls, 2, '从系统设置返回后必须自动重试定位');
}

await testExplicitConsentBeforeSaving();
await testMiniProgramPermissionCanRecover();
await testAuthorizedScopeDenialUsesSystemSettingsAndRetries();
console.log('nearby people runtime smoke: PASS');
