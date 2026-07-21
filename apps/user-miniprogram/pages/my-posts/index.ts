// P1-08 我的表白墙：4 tab（我的发布/我的点赞/我的收藏/我的评论）
import type { AppInstance } from '../../app';
import { listMyPosts, listMyLikedPosts, listMyCommentedPosts, type PostVo } from '../../services/confession';
import { listFavorites } from '../../services/favorite';
import { formatTime } from '../../utils/auth';

type Tab = 'posts' | 'liked' | 'favorites' | 'commented';

interface PageData {
  activeTab: Tab;
  posts: Array<PostVo & { timeText: string }>;
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

function toViews(arr: PostVo[]) {
  return arr.map((p) => ({ ...p, timeText: formatTime(p.createdAt) }));
}

Page({
  data: {
    activeTab: 'posts',
    posts: [],
    loading: true,
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
  } as PageData,

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.reload();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as Tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    this.reload();
  },

  async reload() {
    const tab = this.data.activeTab;
    this.setData({ posts: [], page: 1, total: 0, hasMore: true, loading: true });
    try {
      let list: PostVo[] = [];
      let total = 0;
      if (tab === 'posts') {
        const r = await listMyPosts();
        list = r.list;
        total = r.list.length;
      } else if (tab === 'liked') {
        const r = await listMyLikedPosts(1, this.data.pageSize);
        list = r.list;
        total = r.total;
      } else if (tab === 'commented') {
        const r = await listMyCommentedPosts(1, this.data.pageSize);
        list = r.list;
        total = r.total;
      } else {
        // favorites：返回的是 FavoriteItem[]，需拼装成 PostVo 形式（这里仅展示 targetId 列表，待 P1-08 进一步补详情跳转）
        const r = await listFavorites('post', 1, this.data.pageSize);
        // 仅展示 id 列表作为占位（前端不重新拉详情避免 N+1）
        list = [];
        total = r.total;
        this.setData({
          posts: r.list.map((fav) => ({
            id: fav.targetId,
            circleId: '',
            authorId: '',
            authorNickname: '—',
            authorAvatarUrl: null,
            content: `(收藏于 ${formatTime(fav.createdAt)})`,
            images: [],
            tags: [],
            isAnonymous: false,
            videoUrl: null,
            videoCover: null,
            likeCount: 0,
            liked: false,
            commentCount: 0,
            createdAt: fav.createdAt,
            timeText: formatTime(fav.createdAt),
          })),
          loading: false,
          hasMore: r.list.length < r.total,
          total: r.total,
        });
        return;
      }
      this.setData({
        posts: toViews(list),
        total,
        hasMore: list.length < total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore || this.data.activeTab === 'posts' || this.data.activeTab === 'favorites') {
      // posts 接口 /posts/mine 限一次性 50 条，不分页；favorites 暂不分页加载（列表已分页）
      return;
    }
    this.setData({ loading: true });
    try {
      const nextPage = this.data.page + 1;
      const tab = this.data.activeTab;
      let list: PostVo[] = [];
      let total = 0;
      if (tab === 'liked') {
        const r = await listMyLikedPosts(nextPage, this.data.pageSize);
        list = r.list;
        total = r.total;
      } else if (tab === 'commented') {
        const r = await listMyCommentedPosts(nextPage, this.data.pageSize);
        list = r.list;
        total = r.total;
      }
      const combined = [...this.data.posts, ...toViews(list)];
      this.setData({
        posts: combined,
        page: nextPage,
        total,
        hasMore: combined.length < total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadMore();
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
  },
});
