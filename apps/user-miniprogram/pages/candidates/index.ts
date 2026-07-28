import type { AppInstance } from '../../app';

// 商家端底部 tab：候选人 / 职位 / 发布 / 消息 / 我的
const MERCHANT_TABS = [
  { path: '/pages/candidates/index', label: '候选人' },
  { path: '/pages/job/manage/index', label: '职位' },
  { path: '/pages/job/post/index', label: '发布' },
  { path: '/pages/notifications/index', label: '消息' },
  { path: '/pages/merchant/profile/index', label: '我的' },
];

Page({
  data: {
    tabs: MERCHANT_TABS,
    current: 'pages/candidates/index',
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
  },
});