import type { AppInstance } from '../app';

// 用户端兼职板块开关守卫：与 utils/anonymous-content.ts 同构。
// 差异：pages/job/publish、pages/job/post-create 是商家发岗流程，pages/job/chat、
// pages/job/detail 商家端也会进入（candidates 面板），因此守卫只对 user 角色生效，
// 商家 / 管理角色不受开关影响。
const visibilityUnsubscribers = new WeakMap<object, () => void>();
let jobModuleExitPending = false;

function isUserRole(app: AppInstance): boolean {
  const role = app.globalData.currentRole.toLowerCase();
  return role === 'user' || role === '';
}

export function bindJobModuleVisibility(
  owner: object,
  listener: (enabled: boolean) => void,
): void {
  visibilityUnsubscribers.get(owner)?.();
  const unsubscribe = getApp<AppInstance>().subscribeJobModuleVisibility(listener);
  visibilityUnsubscribers.set(owner, unsubscribe);
}

export function unbindJobModuleVisibility(owner: object): void {
  visibilityUnsubscribers.get(owner)?.();
  visibilityUnsubscribers.delete(owner);
}

function exitJobModulePage(): void {
  if (jobModuleExitPending) return;
  jobModuleExitPending = true;
  wx.switchTab({
    url: '/pages/square/index',
    complete: () => {
      jobModuleExitPending = false;
    },
  });
}

// 页面级守卫：兼职板块关闭时 user 角色退出当前兼职页（商家/管理放行）。
export function bindJobModulePageGuard(owner: object): void {
  bindJobModuleVisibility(owner, (enabled) => {
    const app = getApp<AppInstance>();
    if (!enabled && isUserRole(app)) exitJobModulePage();
  });
}

// 页面主动检查：未登录先走 requireAuth；板块关闭且为 user 角色时退出并返回 false（商家/管理放行）。
export async function requireJobModuleVisibility(): Promise<boolean> {
  const app = getApp<AppInstance>();
  if (!app.requireAuth()) return false;
  if (await app.getJobModuleVisibility()) return true;
  if (isUserRole(app)) {
    exitJobModulePage();
    return false;
  }
  return true;
}
