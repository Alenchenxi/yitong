export interface NavigationLayout {
  navTop: number;
  navHeight: number;
  navRight: number;
}

export function getNavigationLayout(): NavigationLayout {
  const system = wx.getSystemInfoSync();
  const menu = wx.getMenuButtonBoundingClientRect();
  const navTop = system.statusBarHeight ?? 0;
  const menuValid = menu.left > 0 && menu.top >= navTop && menu.width > 0 && menu.height > 0;

  return {
    navTop,
    navHeight: menuValid ? Math.max(40, (menu.top - navTop) * 2 + menu.height) : 44,
    navRight: menuValid ? Math.max(12, system.screenWidth - menu.left + 8) : 12,
  };
}
