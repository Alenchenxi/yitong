// 版本更新管理：UpdateManager 检测新版本 → 弹窗提示 → 确认后 applyUpdate 以新包重启
// 等效重新进入小程序（内存态 / 页面栈清空、代码包换新；storage 登录态等持久化数据保留）
import { readMpReleaseNotesCache } from '../services/app-config';

/**
 * P2-78/P2-79 注册小程序版本更新监听（app.ts onLaunch 调一次）。
 *
 * 微信在冷启动时自动向后台检测已发布新版本并后台下载（UpdateManager 机制）：
 * - onUpdateReady：新包下载完成 → 弹窗提示；用户确认「重新加载」→ applyUpdate()
 *   立即以新包重启小程序（相当于重新进入，运行时缓存全部刷新）；
 * - 用户点「稍后」不强弹：已下载的新包在下次冷启动时由微信自动应用（默认兜底）；
 * - onUpdateFailed：新包下载失败 → 提示网络原因，下次启动自动重试。
 *
 * P2-79 弹窗展示管理端配置的「版本更新说明」（app.ts onShow 拉取并缓存到 storage，
 * 此处读缓存拼接；缓存为空时回退通用文案）。
 */
export function setupUpdateManager(): void {
  // 低版本基础库（<2.3.0）无此 API：静默跳过，仍走微信默认的冷启动整包更新
  if (!wx.canIUse('getUpdateManager')) return;
  const manager = wx.getUpdateManager();

  manager.onUpdateReady(() => {
    const notes = readMpReleaseNotesCache().trim();
    wx.showModal({
      title: '发现新版本',
      content: notes
        ? `新版本已准备就绪，重新加载后立即生效。\n\n本次更新：\n${notes}`
        : '新版本已准备就绪，重新加载后立即生效（相当于重新进入小程序）。',
      confirmText: '重新加载',
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm) {
          manager.applyUpdate();
        }
      },
    });
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
