import type { AppInstance } from '../../app';
import { toggleLike, type PostVo } from '../../services/confession';
import { getUserProfile, toggleFollow, type UserProfileVo } from '../../services/follow';

Page({
  data: {
    userId: '',
    profile: null as UserProfileVo | null,
    posts: [] as PostVo[],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: true,
    loadingMore: false,
    followLoading: false,
    loadFailed: false,
  },

  async onLoad(options: { id?: string }) {
    let userId = '';
    try {
      userId = decodeURIComponent(options.id ?? '').trim();
    } catch {
      // Invalid route input is handled by the error state.
    }
    this.setData({ userId });
    await this.loadPage();
  },

  async loadPage() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!this.data.userId) {
      this.setData({ loading: false, loadFailed: true });
      return;
    }
    this.setData({
      loading: true,
      loadFailed: false,
      posts: [],
      page: 1,
      hasMore: true,
    });
    try {
      const profile = await getUserProfile(this.data.userId, 1, this.data.pageSize);
      this.setData({
        profile,
        posts: profile.posts.list,
        page: 1,
        hasMore: profile.posts.list.length < profile.posts.total,
      });
      wx.setNavigationBarTitle({ title: profile.nickname });
    } catch {
      this.setData({ loadFailed: true });
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() {
    this.loadPage();
  },

  onReachBottom() {
    this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore || !this.data.profile) return;
    this.setData({ loadingMore: true });
    try {
      const nextPage = this.data.page + 1;
      const profile = await getUserProfile(this.data.userId, nextPage, this.data.pageSize);
      const posts = [...this.data.posts, ...profile.posts.list];
      this.setData({
        profile: {
          ...this.data.profile,
          following: profile.following,
          followerCount: profile.followerCount,
          followingCount: profile.followingCount,
          postCount: profile.postCount,
        },
        posts,
        page: nextPage,
        hasMore: posts.length < profile.posts.total,
      });
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  async toggleFollow() {
    const profile = this.data.profile;
    if (!profile || profile.isSelf || this.data.followLoading) return;
    this.setData({ followLoading: true });
    try {
      const result = await toggleFollow(profile.userId);
      this.setData({
        'profile.following': result.following,
        'profile.followerCount': Math.max(
          0,
          profile.followerCount + (result.following ? 1 : -1),
        ),
      });
      wx.showToast({ title: result.following ? '已关注' : '已取消关注', icon: 'none' });
    } finally {
      this.setData({ followLoading: false });
    }
  },

  async onLike(e: WechatMiniprogram.CustomEvent) {
    const { id } = e.detail as { id: string };
    const index = this.data.posts.findIndex((post) => post.id === id);
    if (index < 0) return;
    const post = this.data.posts[index];
    const nextLiked = !post.liked;
    this.setData({
      [`posts[${index}].liked`]: nextLiked,
      [`posts[${index}].likeCount`]: Math.max(0, post.likeCount + (nextLiked ? 1 : -1)),
    });
    try {
      const result = await toggleLike(id);
      this.setData({
        [`posts[${index}].liked`]: result.liked,
        [`posts[${index}].likeCount`]: result.likeCount,
      });
    } catch {
      this.setData({
        [`posts[${index}].liked`]: post.liked,
        [`posts[${index}].likeCount`]: post.likeCount,
      });
    }
  },
});
