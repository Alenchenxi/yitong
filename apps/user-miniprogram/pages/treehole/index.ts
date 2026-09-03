import type { AppInstance } from '../../app';
import {
  hasAnonToken,
  getAnonymousToken,
  listPosts,
  toggleAnonPostLike,
  getAnonTags,
  type AnonPostVo,
} from '../../services/treehole';
import { formatTime } from '../../utils/auth';
import { syncCustomTabBar } from '../../utils/custom-tabbar';

type Tab = 'recommend' | 'latest' | 'mood';

Page({
  data: {
    posts: [] as Array<AnonPostVo & { timeText: string; anonShort: string }>,
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
    anonNickname: '',
    activeTab: 'recommend' as Tab,
    moods: [] as string[], // E3 从标签库动态拉取（getAnonTags.mood）
    selectedMood: '',
  },

  async onShow() {
    syncCustomTabBar(this, '/pages/treehole/index');
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await app.getAnonymousContentVisibility()) {
      wx.switchTab({ url: '/pages/square/index' });
      return;
    }
    if (!hasAnonToken()) {
      try {
        const r = await getAnonymousToken();
        this.setData({ anonNickname: r.nickname });
      } catch {
        return;
      }
    } else if (!this.data.anonNickname) {
      getAnonymousToken()
        .then((r) => this.setData({ anonNickname: r.nickname }))
        .catch(() => {});
    }
    if (this.data.moods.length === 0) this.loadMoods();
    if (this.data.posts.length === 0) this.reload();
  },

  // E3 从标签库拉取 mood chips（与 profile/post 同源，后台配置新增 mood 时首页同步）
  async loadMoods() {
    try {
      const lib = await getAnonTags();
      this.setData({ moods: lib.mood.map((t) => t.name) });
    } catch {
      /* 降级：mood tab 无 chips 可选，不影响 recommend/latest */
    }
  },

  async reload() {
    this.setData({ posts: [], nextCursor: null, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const sort: 'latest' | 'recommend' = this.data.activeTab === 'recommend' ? 'recommend' : 'latest';
      const mood = this.data.activeTab === 'mood' && this.data.selectedMood ? this.data.selectedMood : undefined;
      const resp = await listPosts(this.data.nextCursor ?? undefined, sort, mood);
      this.setData({
        posts: [
          ...this.data.posts,
          ...resp.list.map((p) => ({
            ...p,
            timeText: formatTime(p.createdAt),
            anonShort: p.anonId.slice(0, 10),
          })),
        ],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() {
    this.reload();
  },
  onReachBottom() {
    this.loadMore();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const tab = (e.currentTarget.dataset.tab as Tab) ?? 'recommend';
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    this.reload();
  },

  // P0-13 情绪分类筛选（mood tab 下选情绪）
  pickMood(e: WechatMiniprogram.TouchEvent) {
    const mood = e.currentTarget.dataset.mood as string;
    this.setData({ selectedMood: mood === this.data.selectedMood ? '' : mood });
    this.reload();
  },

  goPost() {
    wx.navigateTo({ url: '/pages/treehole/post/index' });
  },
  goMatch() {
    wx.navigateTo({ url: '/pages/treehole/chat/index' });
  },
  goMatches() {
    wx.navigateTo({ url: '/pages/treehole/matches/index' });
  },
  goParty() {
    wx.navigateTo({ url: '/pages/treehole/party/index' });
  },
  goGroups() {
    wx.navigateTo({ url: '/pages/treehole/groups/index' });
  },
  goProfile() {
    wx.navigateTo({ url: '/pages/treehole/profile/index' });
  },
  goQuiz() {
    wx.navigateTo({ url: '/pages/treehole/quiz/index' });
  },
  goMood() {
    wx.navigateTo({ url: '/pages/treehole/quiz/index?type=mood' });
  },
  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/treehole/detail/index?id=${id}` });
  },

  previewImage(e: WechatMiniprogram.TouchEvent) {
    const { id, src } = e.currentTarget.dataset as { id: string; src: string };
    const post = this.data.posts.find((item) => item.id === id);
    if (src && post?.images.length) {
      wx.previewImage({ current: src, urls: post.images });
    }
  },

  goAuthor(e: WechatMiniprogram.TouchEvent) {
    const anonId = e.currentTarget.dataset.anonId as string;
    if (anonId) {
      wx.navigateTo({ url: `/pages/treehole/author/index?anonId=${encodeURIComponent(anonId)}` });
    }
  },

  // 转发给微信好友：列表卡片转发按钮 + 右上角菜单分享
  onShareAppMessage(e: { target?: { dataset?: { id?: string } } }) {
    const id = e?.target?.dataset?.id ?? this.data.posts[0]?.id ?? '';
    return {
      title: '树洞匿名分享',
      path: id ? `/pages/treehole/detail/index?id=${id}` : '/pages/treehole/index',
    };
  },

  // 转发按钮 catchtap 吞冒泡（防卡片 onTap 跳详情）
  onShareTap() {
    // noop
  },

  async onLike(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const idx = this.data.posts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const post = this.data.posts[idx];
    const nextLiked = !post.liked;
    const nextCount = post.likeCount + (nextLiked ? 1 : -1);
    this.setData({
      [`posts[${idx}].liked`]: nextLiked,
      [`posts[${idx}].likeCount`]: Math.max(0, nextCount),
    });
    try {
      await toggleAnonPostLike(id);
    } catch {
      this.setData({
        [`posts[${idx}].liked`]: post.liked,
        [`posts[${idx}].likeCount`]: post.likeCount,
      });
    }
  },
});
