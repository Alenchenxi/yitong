import type { AppInstance } from '../app';

interface TabItem {
  pagePath: string;
  text: string;
  iconPath: string;
  selectedIconPath: string;
  anonymousOnly?: boolean;
  jobOnly?: boolean;
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
    jobOnly: true,
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
    hidden: false,
    items: TAB_ITEMS.filter((item) => !item.anonymousOnly && !item.jobOnly),
  },

  lifetimes: {
    attached() {
      const app = getApp<AppInstance>();
      // 匿名内容与兼职板块两个平台开关共同决定 tab 项显隐（订阅时会先回放当前值）
      let anonymousContentEnabled = false;
      let jobModuleEnabled = false;
      const recompute = () => {
        this.setData({
          items: TAB_ITEMS.filter((item) =>
            (anonymousContentEnabled || !item.anonymousOnly)
            && (jobModuleEnabled || !item.jobOnly)),
        });
        this.syncSelectedPath();
      };
      const unsubscribers = [
        app.subscribeAnonymousContentVisibility((enabled) => {
          anonymousContentEnabled = enabled;
          recompute();
        }),
        app.subscribeJobModuleVisibility((enabled) => {
          jobModuleEnabled = enabled;
          recompute();
        }),
      ];
      visibilityUnsubscribers.set(this, () => {
        for (const unsubscribe of unsubscribers) unsubscribe();
      });
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
