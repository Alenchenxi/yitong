// 朋友圈单页模式（scene 1154）：未登录上下文，数据接口不可用、页面跳转被平台禁用
export function isSinglePageMode(): boolean {
  try {
    return wx.getLaunchOptionsSync().scene === 1154;
  } catch {
    return false;
  }
}
