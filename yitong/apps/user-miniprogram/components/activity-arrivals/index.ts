import type { AppInstance } from '../../app';
import { newArrivals, setInterest, type ActivityListVo } from '../../services/activity';

interface ArrivalCard extends ActivityListVo {
  timeText: string;
  joined: boolean;
  full: boolean;
}

// 活动上新弹窗（specs/features/活动模块.md §4.6）：
// 每次冷启动最多展示一次（app.globalData.activityArrivalsShown 门闩，前后台切换不重复）；
// 最多 5 个最新可报名活动轮播；不感兴趣即从本轮移除并支持即时撤销；无可展示活动不弹。
Component({
  data: {
    show: false,
    list: [] as ArrivalCard[],
    current: 0,
    undoTimer: 0,
    undoName: '',
    undoId: '',
  },

  methods: {
    /** 宿主页面 onShow 时调用；冷启动只真正弹一次 */
    async maybeShow() {
      const app = getApp<AppInstance>();
      if (app.globalData.activityArrivalsShown) return;
      try {
        const res = await newArrivals();
        if (!res.list.length) return; // AC-032 不弹空窗
        app.globalData.activityArrivalsShown = true;
        this.setData({
          show: true,
          current: 0,
          list: res.list.map((a) => this.decorate(a)),
        });
      } catch {
        /* 静默失败 */
      }
    },

    decorate(a: ActivityListVo): ArrivalCard {
      const joined = ['APPROVED', 'WAITLIST', 'PENDING_REVIEW'].includes(a.myStatus ?? '');
      const full = a.capacity !== null && a.approvedCount >= a.capacity;
      return {
        ...a,
        timeText: a.startTime ? formatTime(a.startTime) : '长期活动',
        joined,
        full,
      };
    },

    onSwiperChange(e: WechatMiniprogram.SwiperChange) {
      this.setData({ current: e.detail.current });
    },

    close() {
      this.setData({ show: false });
    },

    noop() {
      /* 阻止冒泡 */
    },

    openDetail(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      this.setData({ show: false });
      wx.navigateTo({ url: `/pages/activity/detail/index?id=${id}` });
    },

    async markInterested(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      try {
        await setInterest(id, 'INTERESTED');
        wx.showToast({ title: '已标记感兴趣', icon: 'none' });
        this.removeCard(id);
      } catch {
        /* toast 已在 request 内 */
      }
    },

    async markNotInterested(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      const card = this.data.list.find((c) => c.id === id);
      try {
        await setInterest(id, 'NOT_INTERESTED');
        this.removeCard(id);
        // 即时撤销（AC-013）：5 秒内可恢复
        this.setData({ undoId: id, undoName: card?.title ?? '' });
        const timer = setTimeout(() => this.setData({ undoId: '', undoName: '' }), 5000);
        this.setData({ undoTimer: timer as unknown as number });
      } catch {
        /* toast 已在 request 内 */
      }
    },

    async undoNotInterested() {
      const id = this.data.undoId;
      if (!id) return;
      clearTimeout(this.data.undoTimer);
      this.setData({ undoId: '', undoName: '' });
      try {
        await setInterest(id, ''); // 恢复：清除不感兴趣标记
        const res = await newArrivals();
        this.setData({ list: res.list.map((a) => this.decorate(a)) });
      } catch {
        /* toast 已在 request 内 */
      }
    },

    removeCard(id: string) {
      const list = this.data.list.filter((c) => c.id !== id);
      if (!list.length) {
        this.setData({ show: false, list });
        return;
      }
      const current = Math.min(this.data.current, list.length - 1);
      this.setData({ list, current });
    },
  },
});

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
