import type { AppInstance } from '../../app';
import {
  bindAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../utils/anonymous-content';
import {
  bindJobModuleVisibility,
  unbindJobModuleVisibility,
} from '../../utils/job-module';

// 用户角色描述随两个平台开关变化（树洞受匿名内容开关、兼职受兼职板块开关控制）
function userRoleDesc(anonymousContentEnabled: boolean, jobModuleEnabled: boolean): string {
  const parts = ['表白墙'];
  if (anonymousContentEnabled) parts.push('树洞');
  if (jobModuleEnabled) parts.push('兼职');
  return parts.join(' · ');
}

Page({
  data: {
    loading: false,
    pendingRole: '',
    referralCode: '',
    referralTip: '',
    anonymousContentEnabled: false,
    jobModuleEnabled: false,
    userRoleDesc: '表白墙',
  },

  async onLoad(options: { referralCode?: string }) {
    const applyDesc = (anonymousContentEnabled: boolean, jobModuleEnabled: boolean) => {
      this.setData({
        anonymousContentEnabled,
        jobModuleEnabled,
        userRoleDesc: userRoleDesc(anonymousContentEnabled, jobModuleEnabled),
      });
    };
    bindAnonymousContentVisibility(this, (enabled) => {
      applyDesc(enabled, this.data.jobModuleEnabled);
    });
    bindJobModuleVisibility(this, (enabled) => {
      applyDesc(this.data.anonymousContentEnabled, enabled);
    });
    const app = getApp<AppInstance>();
    const [anonymousContentEnabled, jobModuleEnabled] = await Promise.all([
      app.getAnonymousContentVisibility(),
      app.getJobModuleVisibility(),
    ]);
    applyDesc(anonymousContentEnabled, jobModuleEnabled);
    // 分享落地：携带 referralCode（仅对新用户首次注册生效）
    if (options?.referralCode) {
      this.setData({
        referralCode: options.referralCode,
        referralTip: `你通过邀请码 ${options.referralCode} 进入`,
      });
    }
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
    unbindJobModuleVisibility(this);
  },

  async chooseRole(e: WechatMiniprogram.TouchEvent) {
    const role = e.currentTarget.dataset.role as 'user' | 'merchant' | 'admin';
    if (this.data.loading) return;
    this.setData({ loading: true, pendingRole: role });
    const app = getApp<AppInstance>();
    try {
      await app.loginWithRole(role, this.data.referralCode || undefined);
      if (app.globalData.pendingCommunityInviteId) {
        // 邀请请求因登录过期回到本页时，登录成功后继续切回用户广场消费邀请。
        app.routeCommunityInviteToSquare();
      } else {
        // 按角色分流落地页（与 onLaunch 恢复登录态共用 routeToRoleHome，避免逻辑漂移）
        app.routeToRoleHome(role);
      }
    } catch {
      // toast 已在 loginWithRole 内
    } finally {
      this.setData({ loading: false, pendingRole: '' });
    }
  },
});
