interface CustomTabBarInstance {
  setData(data: { selectedPath: string }): void;
}

interface PageWithCustomTabBar {
  getTabBar?: () => CustomTabBarInstance | null;
}

export function syncCustomTabBar(page: unknown, selectedPath: string): void {
  const tabBar = (page as PageWithCustomTabBar).getTabBar?.();
  tabBar?.setData({ selectedPath });
}
