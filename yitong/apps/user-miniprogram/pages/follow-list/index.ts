// P1-09 我的关注 / 我的粉丝 tab 列表
import type { AppInstance } from '../../app';
import { myFollowing, myFollowers, toggleFollow, type FollowUserItem } from '../../services/follow';
import {
  getAnonymousToken,
  hasAnonToken,
  listAnonFollowing,
  toggleAnonAuthorFollow,
  type AnonFollowItem,
} from '../../services/treehole';
import { formatTime } from '../../utils/auth';

type Mode = 'following' | 'anon-following' | 'followers';

interface FollowListItem {
  key: string;
  userId: string;
  anonId: string;
  nickname: string;
  avatarUrl: string | null;
  avatarText: string;
  followedAt: string;
  timeText: string;
}

interface PageData {
  mode: Mode;
  list: FollowListItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  anonymousContentEnabled: boolean;
  emptyText: string;
}

function titleForMode(mode: Mode): string {
  if (mode === 'followers') return '我的粉丝';
  if (mode === 'anon-following') return '树洞关注';
  return '我的关注';
}

function emptyTextForMode(mode: Mode): string {
  if (mode === 'followers') return '还没有粉丝';
  if (mode === 'anon-following') return '还没有关注树洞用户';
  return '还没关注任何人';
}

function mapUserItem(item: FollowUserItem): FollowListItem {
  return {
    key: `user:${item.userId}`,
    userId: item.userId,
    anonId: '',
    nickname: item.nickname,
    avatarUrl: item.avatarUrl,
    avatarText: item.nickname[0] || '友',
    followedAt: item.followedAt,
    timeText: formatTime(item.followedAt),
  };
}

function mapAnonItem(item: AnonFollowItem): FollowListItem {
  return {
    key: `anon:${item.anonId}`,
    userId: '',
    anonId: item.anonId,
    nickname: item.nickname,
    avatarUrl: null,
    avatarText: item.avatar || '🌙',
    followedAt: item.followedAt,
    timeText: formatTime(item.followedAt),
  };
}

Page({
  data: {
    mode: 'following',
    list: [],
    loading: true,
    page: 1,
    pageSize: 30,
    total: 0,
    hasMore: true,
    anonymousContentEnabled: false,
    emptyText: '还没关注任何人',
  } as PageData,

  onLoad(options: { mode?: string }) {
    const anonymousContentEnabled = getApp<AppInstance>().globalData.anonymousContentEnabled;
    const requestedMode = options?.mode as Mode;
    const mode: Mode = requestedMode === 'followers'
      ? 'followers'
      : requestedMode === 'anon-following' && anonymousContentEnabled
        ? 'anon-following'
        : 'following';
    this.setData({
      mode,
      anonymousContentEnabled,
      emptyText: emptyTextForMode(mode),
    });
    wx.setNavigationBarTitle({ title: titleForMode(mode) });
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const anonymousContentEnabled = await app.getAnonymousContentVisibility();
    const mode = !anonymousContentEnabled && this.data.mode === 'anon-following'
      ? 'following'
      : this.data.mode;
    this.setData({
      anonymousContentEnabled,
      mode,
      emptyText: emptyTextForMode(mode),
    });
    wx.setNavigationBarTitle({ title: titleForMode(mode) });
    await this.reload();
  },

  async fetchPage(page: number): Promise<{ list: FollowListItem[]; total: number }> {
    if (this.data.mode === 'anon-following') {
      if (!hasAnonToken()) await getAnonymousToken();
      const result = await listAnonFollowing(page, this.data.pageSize);
      return { list: result.list.map(mapAnonItem), total: result.total };
    }
    const fn = this.data.mode === 'followers' ? myFollowers : myFollowing;
    const result = await fn(page, this.data.pageSize);
    return { list: result.list.map(mapUserItem), total: result.total };
  },

  async reload() {
    this.setData({ list: [], page: 1, total: 0, hasMore: true, loading: true });
    try {
      const result = await this.fetchPage(1);
      this.setData({
        list: result.list,
        total: result.total,
        hasMore: result.list.length < result.total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  switchMode(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as Mode;
    if (mode === this.data.mode) return;
    if (mode === 'anon-following' && !this.data.anonymousContentEnabled) return;
    this.setData({ mode, emptyText: emptyTextForMode(mode) });
    wx.setNavigationBarTitle({ title: titleForMode(mode) });
    this.reload();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const nextPage = this.data.page + 1;
      const result = await this.fetchPage(nextPage);
      const combined = [...this.data.list, ...result.list];
      this.setData({
        list: combined,
        page: nextPage,
        total: result.total,
        hasMore: combined.length < result.total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadMore();
  },

  // 实名关注和树洞匿名关注均可从列表直接取关。
  async unfollow(e: WechatMiniprogram.TouchEvent) {
    if (this.data.mode === 'followers') return;
    const key = e.currentTarget.dataset.key as string;
    const item = this.data.list.find((candidate) => candidate.key === key);
    if (!item) return;
    try {
      if (this.data.mode === 'anon-following') {
        await toggleAnonAuthorFollow(item.anonId);
      } else {
        await toggleFollow(item.userId);
      }
      this.setData({
        list: this.data.list.filter((candidate) => candidate.key !== key),
        total: Math.max(0, this.data.total - 1),
      });
      wx.showToast({ title: '已取关', icon: 'none' });
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  openProfile(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as string;
    const item = this.data.list.find((candidate) => candidate.key === key);
    if (!item) return;
    if (item.anonId) {
      wx.navigateTo({
        url: `/pages/treehole/author/index?anonId=${encodeURIComponent(item.anonId)}`,
      });
      return;
    }
    wx.navigateTo({
      url: `/pages/user-profile/index?id=${encodeURIComponent(item.userId)}`,
    });
  },
});
