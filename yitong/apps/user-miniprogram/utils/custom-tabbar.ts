interface CustomTabBarInstance {
  setData(data: { selectedPath?: string; hidden?: boolean }): void;
}

interface PageWithCustomTabBar {
  getTabBar?: () => CustomTabBarInstance | null;
}

export function syncCustomTabBar(page: unknown, selectedPath: string): void {
  const tabBar = (page as PageWithCustomTabBar).getTabBar?.();
  tabBar?.setData({ selectedPath });
}


export function setCustomTabBarHidden(page: unknown, hidden: boolean): void {
  const tabBar = (page as PageWithCustomTabBar).getTabBar?.();
  tabBar?.setData({ hidden });
}
