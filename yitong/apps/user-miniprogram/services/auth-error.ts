// 登录失效统一处理：服务端鉴权失败（10001/10002）时清本地登录态并跳 role-select
// 设计：所有"用 user access token"调用的入口都应接入（含 request.ts 统一封装、upload.ts、im.ts 内部 request、treehole.getAnonymousToken）
// 范围：10001 未登录/用户不存在 + 10002 登录已过期/token 无效
// 不在范围：10003 无权限（角色被撤销/越权，不算"用户失效"）、10005 账号封禁（重新登录也会被拒）
// 不在范围：anonRequest（树洞匿名 token，与 user 鉴权解耦，独立错误码段 3xxxx）

import { clearAuth } from '../utils/auth';

interface AppGlobalData {
  token: string;
  refreshToken: string;
  user: unknown;
  currentRole: string;
  apiBase: string;
  anonToken: string;
  anonId: string;
}

// 与 app.ts logout() 保持一致
const ROLE_SELECT_PATH = '/pages/role-select/index';
// 单次小程序生命周期内只触发一次 reLaunch，避免并发请求时多次跳转
let reloginScheduled = false;

function isOnRoleSelect(): boolean {
  try {
    const pages = getCurrentPages();
    if (!pages || pages.length === 0) return false;
    const cur = pages[pages.length - 1];
    return !!cur?.route && cur.route.includes('role-select');
  } catch (e) {
    return false;
  }
}

export function handleAuthExpired() {
  if (reloginScheduled) return;
  reloginScheduled = true;
  try {
    const app = getApp<{ globalData: AppGlobalData }>();
    clearAuth(app as any);
  } catch (e) {
    // 容错：清 storage 失败也不阻断跳转
  }
  if (!isOnRoleSelect()) {
    wx.reLaunch({ url: ROLE_SELECT_PATH });
  }
}

export function isAuthExpiredCode(code: number): boolean {
  return code === 10001 || code === 10002;
}

// 便捷封装：传入响应体，若命中鉴权失效则触发清态 + 跳登录页
export function handleResponseAuth(body: { code?: number } | null | undefined) {
  if (body && typeof body.code === 'number' && isAuthExpiredCode(body.code)) {
    handleAuthExpired();
  }
}
