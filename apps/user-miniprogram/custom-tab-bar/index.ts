import type { AppInstance } from '../app';

interface TabItem {
  pagePath: string;
  text: string;
  iconPath: string;
  selectedIconPath: string;
  anonymousOnly?: boolean;
}

const TAB_ITEMS: TabItem[] = [
  {
    pagePath: '/pages/square/index',
    text: '广场',
    iconPath: '/assets/tabbar/square.png',
    selectedIconPath: '/assets/tabbar/square-active.png',
  },
  {
    pagePath: '/pages/confession/index',
    text: '表白墙',
    iconPath: '/assets/tabbar/confession.png',
    selectedIconPath: '/assets/tabbar/confession-active.png',
  },
  {
    pagePath: '/pages/treehole/index',
    text: '树洞',
    iconPath: '/assets/tabbar/treehole.png',
    selectedIconPath: '/assets/tabbar/treehole-active.png',
    anonymousOnly: true,
  },
  {
    pagePath: '/pages/job/index',
    text: '兼职',
    iconPath: '/assets/tabbar/job.png',
    selectedIconPath: '/assets/tabbar/job-active.png',
  },
  {
    pagePath: '/pages/profile/index',
    text: '我的',
    iconPath: '/assets/tabbar/profile.png',
    selectedIconPath: '/assets/tabbar/profile-active.png',
  },
];
const visibilityUnsubscribers = new WeakMap<object, () => void>();

Component({
  data: {
    selectedPath: '',
    items: TAB_ITEMS.filter((item) => !item.anonymousOnly),
  },

  lifetimes: {
    attached() {
      const app = getApp<AppInstance>();
      const unsubscribe = app.subscribeAnonymousContentVisibility((enabled) => {
        this.setData({
          items: TAB_ITEMS.filter((item) => enabled || !item.anonymousOnly),
        });
        this.syncSelectedPath();
      });
      visibilityUnsubscribers.set(this, unsubscribe);
    },
    detached() {
      visibilityUnsubscribers.get(this)?.();
      visibilityUnsubscribers.delete(this);
    },
  },

  pageLifetimes: {
    show() {
      this.syncSelectedPath();
    },
  },

  methods: {
    syncSelectedPath() {
      const pages = getCurrentPages();
      const route = pages[pages.length - 1]?.route;
      this.setData({ selectedPath: route ? `/${route}` : '' });
    },

    switchTab(e: WechatMiniprogram.TouchEvent) {
      const path = e.currentTarget.dataset.path as string;
      if (!path || path === this.data.selectedPath) return;
      wx.switchTab({ url: path });
    },
  },
});
