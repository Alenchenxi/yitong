// 版本更新管理：UpdateManager 检测新版本 → 自定义升级弹窗（P2-81 校园风）→ 确认后 applyUpdate
// 等效重新进入小程序（内存态 / 页面栈清空、代码包换新；storage 登录态等持久化数据保留）
import {
  fetchMpReleaseNotes,
  persistMpReleaseNotes,
  readMpReleaseNotesCache,
} from '../services/app-config';

// P2-82 弹窗前拉更新说明的超时（ms）：拿到数据再弹窗，弱网不能把弹窗拖到微信默认 60s
const NOTES_FETCH_TIMEOUT_MS = 5000;

// P2-84 静默升级告知的上次所见版本基线
const LAST_SEEN_MP_VERSION_KEY = 'yitong_last_seen_mp_version';

/** 升级弹窗状态（utils 层无页面上下文，经订阅广播驱动各页面里的 <update-modal /> 实例） */
export interface UpdateModalState {
  show: boolean;
  /** 当前正式版版本号（wx.getAccountInfoSync().miniProgram.version，开发/体验版为空串） */
  currentVersion: string;
  /** 新版本号：微信 UpdateManager 不提供新包版本，恒为空串（弹窗显示「新版本」） */
  latestVersion: string;
  /** 更新项（管理端「版本更新说明」拆行而来，带 emoji 前缀，最多 3 条） */
  updateLogs: string[];
}

type UpdateModalListener = (state: UpdateModalState) => void;

let updateManager: WechatMiniprogram.UpdateManager | null = null;
// 「稍后」后本次运行不再弹：已下载的新包下次冷启动由微信自动应用（默认兜底）
let updateModalDismissed = false;
// 最近一次「显示中」状态快照：弹窗显示期间前进到新页面时，新页面实例 attach 后补显
let updateModalSnapshot: UpdateModalState | null = null;
const updateModalListeners = new Set<UpdateModalListener>();

/** <update-modal /> 组件 attached 时订阅广播；返回退订函数（detached 调用） */
export function subscribeUpdateModal(listener: UpdateModalListener): () => void {
  updateModalListeners.add(listener);
  return () => {
    updateModalListeners.delete(listener);
  };
}

/** 弹窗显示期间进入新页面时取快照补显；未在显示返回 null */
export function getUpdateModalSnapshot(): UpdateModalState | null {
  return updateModalSnapshot;
}

/** 「稍后」：隐藏页面栈里所有弹窗实例，并标记本次运行不再重复弹出 */
export function dismissUpdateModal(): void {
  updateModalDismissed = true;
  updateModalSnapshot = null;
  notifyUpdateModal({ show: false, currentVersion: '', latestVersion: '', updateLogs: [] });
}

/** 「重新加载」：applyUpdate 以新包立即重启；无管理器（低版本/演示直开组件）返回 false */
export function applyMpUpdate(): boolean {
  if (!updateManager) return false;
  updateManager.applyUpdate();
  return true;
}

/**
 * P2-82 更新说明拉取成功后调用：弹窗若仍在显示中，原位刷新更新项。
 * 时序兜底：开发者工具「下次编译模拟更新」/真实冷启动时，onUpdateReady 可能早于
 * onShow 的说明拉取完成（首次无缓存），弹窗先回退通用文案，拉到真实说明后原位替换；
 * 已「稍后」关闭或未在显示则忽略。
 */
export function refreshUpdateModalLogs(notes: string): void {
  if (!updateModalSnapshot || updateModalDismissed) return;
  const state: UpdateModalState = { ...updateModalSnapshot, updateLogs: buildUpdateLogs(notes) };
  updateModalSnapshot = state;
  notifyUpdateModal(state);
}

function notifyUpdateModal(state: UpdateModalState): void {
  for (const listener of updateModalListeners) listener(state);
}

// 更新说明行 → emoji 前缀：按关键词映射三大板块，其余用 ✨
function pickLogIcon(line: string): string {
  if (line.includes('表白')) return '❤️';
  if (line.includes('树洞') || line.includes('匿名')) return '💭';
  if (line.includes('兼职') || line.includes('岗位') || line.includes('招聘')) return '💼';
  return '✨';
}

// 管理端更新说明（≤300 字自由文本）→ 弹窗更新项：按换行/分号拆行最多 3 条；空说明回退通用文案
function buildUpdateLogs(notes: string): string[] {
  const lines = notes
    .split(/\r?\n|[；;]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const logs = (lines.length > 0 ? lines : ['体验优化与问题修复']).slice(0, 3);
  return logs.map((line) => `${pickLogIcon(line)}  ${line}`);
}

/**
 * P2-82 先拉更新说明再弹窗：拿到接口数据后展示（内容最准，成功同时落缓存）；
 * 拉取失败 toast 提示用户，再回落缓存说明（缓存也为空时组件回退通用文案）。
 */
async function showUpdateModal(): Promise<void> {
  let notes = readMpReleaseNotesCache();
  try {
    const fetched = await fetchMpReleaseNotes(NOTES_FETCH_TIMEOUT_MS);
    persistMpReleaseNotes(fetched);
    notes = fetched;
  } catch {
    // 接口拉取失败（含 5s 超时）：提示用户后展示缓存说明
    wx.showToast({ title: '更新说明获取失败，已展示缓存内容', icon: 'none', duration: 2000 });
  }
  const state: UpdateModalState = {
    show: true,
    // 正式版可得当前版本号（开发/体验版为空 → 弹窗显示「当前版本」）；新版本号微信不提供
    currentVersion: wx.getAccountInfoSync().miniProgram.version,
    latestVersion: '',
    updateLogs: buildUpdateLogs(notes),
  };
  updateModalSnapshot = state;
  notifyUpdateModal(state);
}

/**
 * P2-84 静默升级告知：微信可能在会话销毁后的冷启动直接换包（onUpdateReady 无机会触发，
 * 升级弹窗必然错过），启动时对比当前版本与 storage 基线，不一致则轻提示一次。
 * 注意升级已发生、无选择权，只做知情；首次使用（无基线）只落基线不提示。
 */
function notifySilentUpdate(): void {
  const version = wx.getAccountInfoSync().miniProgram.version;
  // 开发/体验版无版本号：不提示也不落基线，避免空串污染正式版首启判断
  if (!version) return;
  const lastSeen = wx.getStorageSync(LAST_SEEN_MP_VERSION_KEY);
  wx.setStorageSync(LAST_SEEN_MP_VERSION_KEY, version);
  if (typeof lastSeen === 'string' && lastSeen && lastSeen !== version) {
    wx.showModal({
      title: '已更新至新版本',
      content: buildUpdateLogs(readMpReleaseNotesCache()).join('\n'),
      showCancel: false,
      confirmText: '知道了',
    });
  }
}

/**
 * P2-78/P2-79/P2-81 注册小程序版本更新监听（app.ts onLaunch 调一次）。
 *
 * 微信在冷启动时自动向后台检测已发布新版本并后台下载（UpdateManager 机制）：
 * - onUpdateReady：新包下载完成 → 广播唤起自定义升级弹窗（components/update-modal）；
 *   用户点「重新加载」→ applyUpdate() 立即以新包重启小程序（相当于重新进入，运行时缓存全刷新）；
 * - 用户点「稍后」不强弹：本次运行不再重复弹出，已下载的新包下次冷启动由微信自动应用；
 * - onUpdateFailed：新包下载失败 → 提示网络原因，下次启动自动重试（低频兜底仍用原生弹窗）。
 * - 会话销毁后微信冷启动静默换包（onUpdateReady 无机会触发）→ P2-84 版本对比轻提示告知已升级。
 *
 * P2-79/P2-82 弹窗更新项来自管理端配置的「版本更新说明」：onUpdateReady 先拉接口
 * （5s 超时）拿到数据再弹窗、成功同时落缓存；拉取失败 toast 提示后回落缓存说明
 * （缓存为空回退通用文案）。app.ts onShow 的备份拉取若晚到且成功，经
 * refreshUpdateModalLogs 对仍显示中的弹窗原位刷新。
 */
export function setupUpdateManager(): void {
  // 静默升级告知不依赖 UpdateManager API（平台换包在任何 JS 之前已发生），先于低版本守卫执行
  notifySilentUpdate();
  // 低版本基础库（<2.3.0）无此 API：静默跳过，仍走微信默认的冷启动整包更新
  if (!wx.canIUse('getUpdateManager')) return;
  const manager = wx.getUpdateManager();
  updateManager = manager;

  manager.onUpdateReady(() => {
    if (updateModalDismissed) return;
    void showUpdateModal();
  });

  manager.onUpdateFailed(() => {
    wx.showModal({
      title: '版本更新提示',
      content: '新版本下载失败，可能是网络问题；小程序将在下次启动时自动重试。',
      showCancel: false,
      confirmText: '知道了',
    });
  });
}
