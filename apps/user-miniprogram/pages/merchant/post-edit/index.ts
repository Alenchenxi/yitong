import type { AppInstance } from '../../../app';

// 发布/编辑岗位独立页（带系统返回箭头）：复用 post-panel 组件的表单逻辑。
// onLoad: options.id 存在 -> 编辑模式（panel 的 params observer 触发 loadPost 回填）；无 id -> 新建空表单。
// 提交成功：编辑保存 -> panel triggerEvent('switchtab') -> onSwitchTab -> navigateBack 回职位列表；
//          新建草稿 -> panel 内 redirectTo 支付页（post-edit 被替换，返回直达职位列表）。
Page({
  data: {
    postParams: {} as Record<string, unknown>,
  },

  onLoad(options: { id?: string } & Record<string, string>) {
    const id = options.id;
    wx.setNavigationBarTitle({ title: id ? '编辑岗位' : '发布岗位' });
    // _ts nonce：与 shell 调用 panel 的口径一致，保证 params observer 触发
    this.setData({ postParams: id ? { id, _ts: Date.now() } : { _ts: Date.now() } });
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
  },

  // post-panel 编辑保存成功后 triggerEvent('switchtab', {tab:'jobs'}) -> 返回上一页（职位列表）
  onSwitchTab() {
    wx.navigateBack();
  },
});
