import type { AppInstance } from '../app';

export async function requireAnonymousContentVisibility(): Promise<boolean> {
  const app = getApp<AppInstance>();
  if (!app.requireAuth()) return false;
  if (await app.getAnonymousContentVisibility()) return true;
  wx.switchTab({ url: '/pages/square/index' });
  return false;
}
