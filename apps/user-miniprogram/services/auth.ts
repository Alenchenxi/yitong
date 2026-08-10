import type { UserInfo } from '../utils/auth';

interface ApiResult<T> {
  code: number;
  data: T;
  message: string;
}

// 三端角色切换 + 实时权限刷新

const ROLE_LABELS: Record<string, string> = {
  USER: '普通用户',
  MERCHANT: '商家',
  ADMIN: '管理员',
};

export function roleLabel(r: string): string {
  return ROLE_LABELS[r] || r;
}

// 所有可选角色（用于渲染切换 UI）
export interface RoleOption {
  key: string;      // USER | MERCHANT | ADMIN
  label: string;    // 用户端 | 商家端 | 管理端
  emoji: string;
  desc: string;
}

export const ALL_ROLES: RoleOption[] = [
  { key: 'USER', label: '用户端', emoji: '👤', desc: '表白墙 · 树洞 · 兼职' },
  { key: 'MERCHANT', label: '商家端', emoji: '🏪', desc: '入驻 · 发岗 · 报名管理' },
  { key: 'ADMIN', label: '管理端', emoji: '⚙', desc: '审核 · 运营 · 封禁' },
];

/**
 * 调 /auth/me 获取实时角色权限，更新 globalData.user.roles + storage。
 * 静默失败（无 toast），返回 roles 数组或 null。
 */
export function refreshRoles(): Promise<string[] | null> {
  return new Promise((resolve) => {
    const app = getApp<{ globalData: { token: string; apiBase: string; user: UserInfo | null } }>();
    wx.request({
      url: `${app.globalData.apiBase}/auth/me`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${app.globalData.token}`,
      },
      success: (r) => {
        const b = r.data as ApiResult<{ roles: string[] }>;
        if (b.code === 0 && b.data?.roles) {
          // 更新内存
          if (app.globalData.user) {
            app.globalData.user.roles = b.data.roles;
          }
          // 同步 storage
          try {
            const cached = wx.getStorageSync('yitong_auth') || {};
            if (cached.user) cached.user.roles = b.data.roles;
            wx.setStorageSync('yitong_auth', cached);
          } catch { /* storage 失败不影响 */ }
          resolve(b.data.roles);
        } else {
          resolve(null);
        }
      },
      fail: () => resolve(null),
    });
  });
}
