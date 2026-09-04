import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const miniProgramRoot = path.resolve(scriptDir, '..');
const pageSourcePath = path.join(miniProgramRoot, 'pages/job/publish/index.ts');
const pageTemplatePath = path.join(miniProgramRoot, 'pages/job/publish/index.wxml');

function createPage(wxMock) {
  const source = fs.readFileSync(pageSourcePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  let definition;
  const sandbox = {
    Page(value) {
      definition = value;
    },
    wx: wxMock,
    getApp() {
      return { globalData: {} };
    },
    console,
    clearTimeout,
    setTimeout,
    require(moduleId) {
      if (moduleId.endsWith('/services/job')) {
        return { getJobCategories: async () => ({ items: [] }) };
      }
      if (moduleId.endsWith('/services/place-suggest')) {
        return {
          suggestPlaces: async () => [],
          reverseGeocode: async (lng, lat) => ({
            address: '测试地点',
            poiId: 'test-poi',
            lng,
            lat,
            city: '杭州',
          }),
        };
      }
      if (moduleId.endsWith('/services/community')) {
        return { listCommunities: async () => [] };
      }
      return {};
    },
    exports: {},
    module: { exports: {} },
  };

  vm.runInNewContext(compiled, sandbox, { filename: pageSourcePath });
  assert.ok(definition, '发布岗位页必须注册 Page');

  const page = {
    data: structuredClone(definition.data),
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  for (const [key, value] of Object.entries(definition)) {
    if (typeof value === 'function') page[key] = value.bind(page);
  }
  page.loadCategories = async () => {};
  page.loadCommunities = async () => {};
  return page;
}

function createWxMock(overrides = {}) {
  return {
    canIUse: () => true,
    getSetting: ({ success }) => success({ authSetting: {} }),
    getFuzzyLocation: ({ success }) => success({ latitude: 30.2741, longitude: 120.1551 }),
    showModal: () => {},
    showToast: () => {},
    openSetting: () => {},
    openAppAuthorizeSetting: () => {},
    ...overrides,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function testDeniedUserCanOpenSettingsAndResumeLocation() {
  let fuzzyLocationCalls = 0;
  let permissionModal;
  let openSettingCalls = 0;
  const wxMock = createWxMock({
    getSetting: ({ success }) => success({ authSetting: { 'scope.userFuzzyLocation': false } }),
    getFuzzyLocation: ({ success }) => {
      fuzzyLocationCalls += 1;
      success({ latitude: 30.2741, longitude: 120.1551 });
    },
    showModal: (options) => {
      permissionModal = options;
    },
    openSetting: ({ success }) => {
      openSettingCalls += 1;
      success({ authSetting: { 'scope.userFuzzyLocation': true } });
    },
  });
  const page = createPage(wxMock);

  page.onLoad();
  assert.equal(fuzzyLocationCalls, 0, '已拒绝定位时不应重复触发无效定位请求');
  assert.equal(permissionModal?.confirmText, '去开启', '已拒绝定位时应向用户提供“去开启”操作');
  assert.match(permissionModal?.content ?? '', /定位权限/, '设置引导必须解释定位权限用途');

  permissionModal.success({ confirm: true, cancel: false });
  await flushPromises();
  assert.equal(openSettingCalls, 1, '用户确认后必须打开小程序授权设置');
  assert.equal(fuzzyLocationCalls, 1, '用户开启权限后必须自动重新定位');
}

async function testFirstRequestAndAuthorizedUserBothLocate() {
  for (const fuzzyPermission of [undefined, true]) {
    let fuzzyLocationCalls = 0;
    const wxMock = createWxMock({
      getSetting: ({ success }) =>
        success({
          authSetting:
            fuzzyPermission === undefined ? {} : { 'scope.userFuzzyLocation': fuzzyPermission },
        }),
      getFuzzyLocation: ({ success }) => {
        fuzzyLocationCalls += 1;
        success({ latitude: 30.2741, longitude: 120.1551 });
      },
    });
    const page = createPage(wxMock);

    page.onLoad();
    await flushPromises();
    assert.equal(
      fuzzyLocationCalls,
      1,
      fuzzyPermission === undefined ? '首次申请必须调用模糊定位以触发授权' : '已授权用户必须直接定位',
    );
  }
}

async function testPrivacyAuthorizationPrecedesLocation() {
  const events = [];
  const wxMock = createWxMock({
    canIUse: (api) => api === 'getPrivacySetting' || api === 'requirePrivacyAuthorize',
    getPrivacySetting: ({ success }) => {
      events.push('privacy-setting');
      success({ needAuthorization: true });
    },
    requirePrivacyAuthorize: ({ success }) => {
      events.push('privacy-authorize');
      success();
    },
    getFuzzyLocation: ({ success }) => {
      events.push('location');
      success({ latitude: 30.2741, longitude: 120.1551 });
    },
  });
  const page = createPage(wxMock);

  page.onLoad();
  await flushPromises();
  assert.deepEqual(
    events,
    ['privacy-setting', 'privacy-authorize', 'location'],
    '需要隐私授权时必须先获得同意再请求定位',
  );
}

async function testPrivacyDenialKeepsManualFallback() {
  let fuzzyLocationCalls = 0;
  let privacyAuthorized = false;
  let privacyContractCalls = 0;
  const wxMock = createWxMock({
    canIUse: (api) => api === 'getPrivacySetting' || api === 'requirePrivacyAuthorize',
    getPrivacySetting: ({ success }) => success({ needAuthorization: !privacyAuthorized }),
    requirePrivacyAuthorize: ({ fail }) => fail({ errMsg: 'privacy deny' }),
    openPrivacyContract: () => {
      privacyContractCalls += 1;
      privacyAuthorized = true;
    },
    getFuzzyLocation: () => {
      fuzzyLocationCalls += 1;
    },
  });
  const page = createPage(wxMock);

  page.onLoad();
  assert.equal(fuzzyLocationCalls, 0, '隐私授权失败时不得继续请求定位');
  assert.equal(page.data.locationPermissionAction, 'privacy', '隐私授权失败时必须提供隐私说明入口');
  assert.equal(page.data.locating, false, '隐私授权失败时必须结束定位加载状态');

  page.onLocationPermissionAction();
  assert.equal(privacyContractCalls, 1, '用户点击后必须打开微信隐私保护指引');
  page.onShow();
  assert.equal(fuzzyLocationCalls, 1, '从隐私指引返回后必须自动重新定位');
}

async function testPrivacySettingFailureDoesNotStartLocation() {
  let fuzzyLocationCalls = 0;
  const wxMock = createWxMock({
    canIUse: (api) => api === 'getPrivacySetting' || api === 'requirePrivacyAuthorize',
    getPrivacySetting: ({ fail }) => fail({ errMsg: 'getPrivacySetting:fail timeout' }),
    requirePrivacyAuthorize: () => {},
    getFuzzyLocation: () => {
      fuzzyLocationCalls += 1;
    },
  });
  const page = createPage(wxMock);

  page.onLoad();
  assert.equal(fuzzyLocationCalls, 0, '隐私授权状态查询失败时不得继续请求定位');
  assert.equal(page.data.locationPermissionAction, 'retry', '隐私授权状态查询失败时必须提供重试入口');
  assert.match(page.data.locationErrMsg, /隐私授权状态/, '失败提示必须说明隐私授权状态未确认');
}

async function testSystemPermissionUsesSupportedAppSettingsApi() {
  let systemModal;
  let openAppSettingCalls = 0;
  const wxMock = createWxMock({
    getSetting: ({ success }) => success({ authSetting: { 'scope.userFuzzyLocation': true } }),
    getFuzzyLocation: ({ fail }) => fail({ errMsg: 'getFuzzyLocation:fail system permission denied' }),
    showModal: (options) => {
      systemModal = options;
    },
    canIUse: (api) => api === 'openAppAuthorizeSetting',
    openAppAuthorizeSetting: () => {
      openAppSettingCalls += 1;
    },
  });
  const page = createPage(wxMock);

  page.onLoad();
  assert.equal(systemModal?.confirmText, '去设置', '系统定位关闭时应提供“去设置”操作');
  systemModal.success({ confirm: true, cancel: false });
  assert.equal(openAppSettingCalls, 1, '客户端支持时必须打开微信系统授权设置');
}

async function testAuthorizedScopeAuthDenialIsTreatedAsSystemPermission() {
  let systemModal;
  const wxMock = createWxMock({
    getSetting: ({ success }) => success({ authSetting: { 'scope.userFuzzyLocation': true } }),
    getFuzzyLocation: ({ fail }) => fail({ errMsg: 'getFuzzyLocation:fail auth deny' }),
    showModal: (options) => {
      systemModal = options;
    },
  });
  const page = createPage(wxMock);

  page.onLoad();
  assert.equal(systemModal?.title, '系统定位权限未开启', '小程序权限已开启时的 auth deny 应识别为系统权限问题');
  assert.equal(page.data.locationPermissionAction, 'appSettings', '系统权限问题应提供 App 设置入口');
}

async function testUnsupportedAppSettingsApiShowsManualIosPath() {
  const modals = [];
  const wxMock = createWxMock({
    getSetting: ({ success }) => success({ authSetting: { 'scope.userFuzzyLocation': true } }),
    getFuzzyLocation: ({ fail }) => fail({ errMsg: 'getFuzzyLocation:fail system permission denied' }),
    canIUse: () => false,
    showModal: (options) => modals.push(options),
  });
  const page = createPage(wxMock);

  page.onLoad();
  modals[0].success({ confirm: true, cancel: false });
  assert.equal(modals.length, 2, '无法打开系统设置时必须继续显示手动操作路径');
  assert.match(modals[1].content, /iPhone 设置.*定位服务.*微信/, '手动引导必须包含完整 iPhone 设置路径');
}

async function testReturningFromAppSettingsRetriesLocation() {
  let fuzzyLocationCalls = 0;
  let appSettingModal;
  const wxMock = createWxMock({
    getSetting: ({ success }) => success({ authSetting: { 'scope.userFuzzyLocation': true } }),
    getFuzzyLocation: ({ fail, success }) => {
      fuzzyLocationCalls += 1;
      if (fuzzyLocationCalls === 1) {
        fail({ errMsg: 'getFuzzyLocation:fail system permission denied' });
      } else {
        success({ latitude: 30.2741, longitude: 120.1551 });
      }
    },
    showModal: (options) => {
      appSettingModal = options;
    },
    canIUse: (api) => api === 'openAppAuthorizeSetting',
  });
  const page = createPage(wxMock);

  page.onLoad();
  appSettingModal.success({ confirm: true, cancel: false });
  page.onShow();
  await flushPromises();
  assert.equal(fuzzyLocationCalls, 2, '从系统设置返回后必须自动重新检查并定位');
}

async function testGenericFailureCanRetryAndManualSearchRemainsAvailable() {
  const wxMock = createWxMock({
    getFuzzyLocation: ({ fail }) => fail({ errMsg: 'getFuzzyLocation:fail timeout' }),
  });
  const page = createPage(wxMock);

  page.onLoad();
  assert.equal(page.data.locationPermissionAction, 'retry', '普通定位失败时必须提供重新定位操作');
  assert.match(page.data.locationErrMsg, /手动搜索/, '普通定位失败提示必须说明手动搜索兜底');

  const template = fs.readFileSync(pageTemplatePath, 'utf8');
  assert.match(template, /bindinput="onSearchInput"/, '定位失败时页面仍必须保留手动地点搜索');
  assert.match(template, /bindtap="onLocationPermissionAction"/, '定位失败提示必须展示对应恢复操作');
}

await testFirstRequestAndAuthorizedUserBothLocate();
await testDeniedUserCanOpenSettingsAndResumeLocation();
await testPrivacyAuthorizationPrecedesLocation();
await testPrivacySettingFailureDoesNotStartLocation();
await testPrivacyDenialKeepsManualFallback();
await testSystemPermissionUsesSupportedAppSettingsApi();
await testAuthorizedScopeAuthDenialIsTreatedAsSystemPermission();
await testUnsupportedAppSettingsApiShowsManualIosPath();
await testReturningFromAppSettingsRetriesLocation();
await testGenericFailureCanRetryAndManualSearchRemainsAvailable();
console.log('job publish location permission smoke: PASS');
