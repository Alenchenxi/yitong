import type { AppInstance } from '../../app';
import {
  listFavorites,
  deleteFavorite,
  type FavoriteTargetType,
  type FavoriteVo,
} from '../../services/favorite';

type TabKey = FavoriteTargetType | 'all';

async function listAllFavorites(targetType?: FavoriteTargetType): Promise<FavoriteVo[]> {
  const favorites: FavoriteVo[] = [];
  let page = 1;

  while (true) {
    const response = await listFavorites(targetType, page, 50);
    favorites.push(...response.list);
    if (
      response.list.length === 0
      || favorites.length >= response.total
      || response.list.length < response.pageSize
    ) {
      break;
    }
    page += 1;
  }

  return favorites;
}

Page({
  data: {
    tab: 'all' as TabKey,
    items: [] as FavoriteVo[],
    total: 0,
    loading: false,
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.reload();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const t = (e.currentTarget.dataset.tab as TabKey) ?? 'all';
    if (t === this.data.tab) return;
    this.setData({ tab: t });
    this.reload();
  },

  async reload() {
    this.setData({ loading: true });
    try {
      const targetType = this.data.tab === 'all' ? undefined : (this.data.tab as FavoriteTargetType);
      const favorites = await listAllFavorites(targetType);
      const visibleItems = favorites.filter((item) => item.targetType !== 'anon_post');
      this.setData({ items: visibleItems, total: visibleItems.length });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  async onUnfavorite(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    try {
      await deleteFavorite(id);
      wx.showToast({ title: '已取消收藏', icon: 'success' });
      this.reload();
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 跳转到对应目标详情（按 targetType 路由）
  goTarget(e: WechatMiniprogram.TouchEvent) {
    const { type, id } = e.currentTarget.dataset as { type: FavoriteTargetType; id: string };
    if (type === 'post') {
      wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
    } else if (type === 'job_post') {
      wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
    }
  },

  // 暴露供 wxml 使用的辅助函数
  typeLabel(t: FavoriteTargetType): string {
    if (t === 'post') return '表白墙';
    return '兼职';
  },
});
