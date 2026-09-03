// P1-08 + P1-11 我的表白墙：6 tab（我的发布/我的点赞/我的收藏/我的评论/我的草稿/我的私密）
import type { AppInstance } from '../../app';
import {
  listMyPosts,
  listMyLikedPosts,
  listMyCommentedPosts,
  listMyDrafts,
  listMyPrivate,
  type PostVo,
} from '../../services/confession';
import { listAllFavorites } from '../../services/favorite';
import { formatTime } from '../../utils/auth';
import {
  bindAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../utils/anonymous-content';

type Tab = 'posts' | 'liked' | 'favorites' | 'commented' | 'drafts' | 'private';

interface PageData {
  activeTab: Tab;
  posts: Array<PostVo & { timeText: string }>;
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  anonymousContentEnabled: boolean;
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
    anonymousContentEnabled: false,
  } as PageData,

  onLoad() {
    bindAnonymousContentVisibility(this, (enabled) => {
      this.updateAnonymousContentVisibility(enabled);
    });
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  updateAnonymousContentVisibility(enabled: boolean) {
    this.setData({
      anonymousContentEnabled: enabled,
      posts: enabled ? this.data.posts : this.data.posts.filter((post) => !post.isAnonymous),
    });
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.updateAnonymousContentVisibility(await app.getAnonymousContentVisibility());
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
        list = r.list; total = r.list.length;
      } else if (tab === 'liked') {
        const r = await listMyLikedPosts(1, this.data.pageSize);
        list = r.list; total = r.total;
      } else if (tab === 'commented') {
        const r = await listMyCommentedPosts(1, this.data.pageSize);
        list = r.list; total = r.total;
      } else if (tab === 'drafts') {
        const r = await listMyDrafts(1, this.data.pageSize);
        list = r.list; total = r.total;
      } else if (tab === 'private') {
        const r = await listMyPrivate(1, this.data.pageSize);
        list = r.list; total = r.total;
      } else {
        // favorites：返回的是 FavoriteItem[]，需拼装成 PostVo 形式（仅展示 id+收藏时间）
        const favorites = await listAllFavorites('post');
        const visibleFavorites = this.data.anonymousContentEnabled
          ? favorites
          : favorites.filter((favorite) => !favorite.targetAnonymous);
        list = [];
        total = visibleFavorites.length;
        this.setData({
          posts: visibleFavorites.map((fav) => ({
            id: fav.targetId,
            circleId: '',
            authorId: '',
            authorNickname: '—',
            authorAvatarUrl: null,
            content: `(收藏于 ${formatTime(fav.createdAt)})`,
            images: [],
            tags: [],
            isAnonymous: fav.targetAnonymous,
            videoUrl: null,
            videoCover: null,
            likeCount: 0,
            liked: false,
            commentCount: 0,
            viewCount: 0,
            visibility: 'PUBLIC' as const,
            pinned: false,
            featured: false,
            boosted: false,
            boostUntil: null,
            publishAt: null,
            createdAt: fav.createdAt,
            editedAt: null,
            timeText: formatTime(fav.createdAt),
          })),
          loading: false,
          hasMore: false,
          total: visibleFavorites.length,
        });
        return;
      }
      const visibleList = this.data.anonymousContentEnabled
        ? list
        : list.filter((post) => !post.isAnonymous);
      this.setData({
        posts: toViews(visibleList),
        total,
        hasMore: list.length < total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    if (this.data.activeTab === 'posts' || this.data.activeTab === 'favorites') {
      // posts/favorites 暂不分页
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
        list = r.list; total = r.total;
      } else if (tab === 'commented') {
        const r = await listMyCommentedPosts(nextPage, this.data.pageSize);
        list = r.list; total = r.total;
      } else if (tab === 'drafts') {
        const r = await listMyDrafts(nextPage, this.data.pageSize);
        list = r.list; total = r.total;
      } else if (tab === 'private') {
        const r = await listMyPrivate(nextPage, this.data.pageSize);
        list = r.list; total = r.total;
      }
      const visibleList = this.data.anonymousContentEnabled
        ? list
        : list.filter((post) => !post.isAnonymous);
      const combined = [...this.data.posts, ...toViews(visibleList)];
      this.setData({
        posts: combined,
        page: nextPage,
        total,
        hasMore: list.length > 0 && nextPage * this.data.pageSize < total,
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
    // P1-11 draft 在我的草稿 tab 下不可点（草稿状态 getPost 仍可读，因 author=me）；允许正常导航
    wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
  },

  continueDraft(e: WechatMiniprogram.TouchEvent) {
    // P1-11 我的草稿：点击继续编辑
    const id = e.currentTarget.dataset.id as string;
    const post = this.data.posts.find((p) => p.id === id);
    if (!post) return;
    wx.setStorageSync('yitong_edit_post_draft', post);
    wx.navigateTo({ url: `/pages/post-create/index?editId=${id}` });
  },
});
