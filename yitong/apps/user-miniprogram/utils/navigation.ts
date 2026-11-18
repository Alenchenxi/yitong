export interface NavigationLayout {
  navTop: number;
  navHeight: number;
  navRight: number;
}

export function getNavigationLayout(): NavigationLayout {
  const windowInfo = wx.getWindowInfo();
  // 开发者工具个别版本此 API 直接抛错（global.windowMap is not iterable），兜底走默认导航栏尺寸
  let menu: ReturnType<typeof wx.getMenuButtonBoundingClientRect> | undefined;
  try {
    menu = wx.getMenuButtonBoundingClientRect();
  } catch {
    menu = undefined;
  }
  const navTop = windowInfo.statusBarHeight ?? 0;
  const menuValid = !!menu && menu.left > 0 && menu.top >= navTop && menu.width > 0 && menu.height > 0;

  return {
    navTop,
    navHeight: menu && menuValid ? Math.max(40, (menu.top - navTop) * 2 + menu.height) : 44,
    navRight: menu && menuValid ? Math.max(12, windowInfo.screenWidth - menu.left + 8) : 12,
  };
}
