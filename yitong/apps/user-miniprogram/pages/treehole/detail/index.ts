import type { AppInstance } from '../../../app';
import {
  getAnonymousToken,
  getPost,
  hasAnonToken,
  getAnonId,
  toggleAnonPostLike,
  blockAnon,
  listAnonComments,
  createAnonComment,
  toggleAnonCommentLike,
  type AnonPostVo,
  type AnonCommentVo,
} from '../../../services/treehole';
import { formatTime } from '../../../utils/auth';
import {
  bindAnonymousContentPageGuard,
  requireAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../../utils/anonymous-content';

type AnonCommentView = AnonCommentVo & { timeText: string; anonShort: string };

Page({
  data: {
    id: '',
    post: null as (AnonPostVo & { timeText: string; anonShort: string }) | null,
    isAuthor: false, // 当前匿名态是否为帖子作者
    loading: false,
    // 评论
    comments: [] as AnonCommentView[],
    commentPage: 1,
    commentTotal: 0,
    hasMoreComments: true,
    loadingComments: false,
    commentText: '',
    sendingComment: false,
    commentFocus: false, // focus=1 落地时聚焦评论区输入条
    needAnon: false, // 无 anonToken 时显示匿名引导（不再静默签发）
  },

  async onLoad(query: Record<string, string | undefined>) {
    if (!await requireAnonymousContentVisibility()) return;
    bindAnonymousContentPageGuard(this);
    const id = query.id ?? '';
    const focus = query.focus === '1';
    this.setData({ id, commentFocus: focus });
    // 无 anonToken 时引导用户显式初始化匿名身份（转发落地 / 评论都需要）
    if (hasAnonToken()) {
      this.load();
    } else {
      this.setData({ needAnon: true });
    }
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  // 显式初始化匿名身份：requireAuth 换 user token → 签发 anonToken → 加载正文与评论
  async initAnon() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    try {
      await getAnonymousToken();
      this.setData({ needAnon: false });
      await this.load();
    } catch {
      /* toast 已内置 */
    }
  },

  async load() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!this.data.id) {
      wx.showToast({ title: '帖子不存在', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const post = await getPost(this.data.id);
      this.setData({
        post: {
          ...post,
          timeText: formatTime(post.createdAt),
          anonShort: post.anonId.slice(0, 10),
        },
        isAuthor: getAnonId() === post.anonId,
      });
      await this.loadComments(1);
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadComments(page: number) {
    if (this.data.loadingComments) return;
    if (!this.data.id) return;
    if (page > 1 && !this.data.hasMoreComments) return;
    this.setData({ loadingComments: true });
    try {
      const resp = await listAnonComments(this.data.id, page, 20);
      const views = resp.list.map((c) => ({
        ...c,
        timeText: formatTime(c.createdAt),
        anonShort: c.authorAnonId.slice(0, 8),
      }));
      this.setData({
        comments: page === 1 ? views : [...this.data.comments, ...views],
        commentPage: page,
        commentTotal: resp.total,
        hasMoreComments: this.data.comments.length + views.length < resp.total,
      });
    } catch {
      /* toast */
    } finally {
      this.setData({ loadingComments: false });
    }
  },

  onReachBottom() {
    if (this.data.hasMoreComments) this.loadComments(this.data.commentPage + 1);
  },

  onCommentInput(e: WechatMiniprogram.Input) {
    this.setData({ commentText: e.detail.value });
  },

  // 树洞评论平铺无回复：创建成功 prepend + 帖子评论数 +1
  async sendComment() {
    const text = this.data.commentText.trim();
    if (!text || this.data.sendingComment) return;
    this.setData({ sendingComment: true });
    try {
      const c = await createAnonComment(this.data.id, text);
      const view: AnonCommentView = {
        ...c,
        timeText: formatTime(c.createdAt),
        anonShort: c.authorAnonId.slice(0, 8),
      };
      const post = this.data.post;
      this.setData({
        comments: [view, ...this.data.comments],
        commentTotal: this.data.commentTotal + 1,
        hasMoreComments: true,
        commentText: '',
        post: post ? { ...post, commentCount: post.commentCount + 1 } : post,
      });
      wx.showToast({ title: '评论成功', icon: 'success' });
    } catch {
      /* toast */
    } finally {
      this.setData({ sendingComment: false });
    }
  },

  // 评论点赞：乐观更新 + 失败回滚（平铺列表，无回复层级）
  async onCommentLike(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset as { id: string };
    const idx = this.data.comments.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const comment = this.data.comments[idx];
    const nextLiked = !comment.liked;
    const nextCount = Math.max(0, comment.likeCount + (nextLiked ? 1 : -1));
    this.setData({
      [`comments[${idx}].liked`]: nextLiked,
      [`comments[${idx}].likeCount`]: nextCount,
    });
    try {
      const r = await toggleAnonCommentLike(id);
      this.setData({
        [`comments[${idx}].liked`]: r.liked,
        [`comments[${idx}].likeCount`]: r.likeCount,
      });
    } catch {
      this.setData({
        [`comments[${idx}].liked`]: comment.liked,
        [`comments[${idx}].likeCount`]: comment.likeCount,
      });
    }
  },

  async onLike() {
    const post = this.data.post;
    if (!post) return;
    const nextLiked = !post.liked;
    const nextCount = Math.max(0, post.likeCount + (nextLiked ? 1 : -1));
    this.setData({
      'post.liked': nextLiked,
      'post.likeCount': nextCount,
    });
    try {
      const r = await toggleAnonPostLike(post.id);
      this.setData({
        'post.liked': r.liked,
        'post.likeCount': r.likeCount,
      });
    } catch {
      this.setData({
        'post.liked': post.liked,
        'post.likeCount': post.likeCount,
      });
    }
  },

  previewImage(e: WechatMiniprogram.TouchEvent) {
    const src = e.currentTarget.dataset.src as string;
    const images = this.data.post?.images ?? [];
    if (src && images.length > 0) {
      wx.previewImage({ current: src, urls: images });
    }
  },

  goAuthor() {
    const anonId = this.data.post?.anonId;
    if (anonId) {
      wx.navigateTo({ url: `/pages/treehole/author/index?anonId=${encodeURIComponent(anonId)}` });
    }
  },

  // 内容推广：作者提升曝光（付费置顶；树洞帖真实用户以 access token 付费，库内 AnonymousPost 仍 0 uid）
  onBoost() {
    const post = this.data.post;
    if (!post) return;
    wx.navigateTo({ url: `/pages/boost/index?type=anon_post&id=${post.id}` });
  },

  // P0-16 屏蔽此用户（帖子作者）：屏蔽后互相隔离，屏蔽即返回广场
  blockAuthor() {
    const post = this.data.post;
    if (!post) return;
    wx.showModal({
      title: '屏蔽此用户',
      content: '屏蔽后将互相看不到帖子、不再匹配、不能聊天。',
      confirmText: '屏蔽',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await blockAnon(post.anonId);
          wx.showToast({ title: '已屏蔽', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        } catch {
          /* toast */
        }
      },
    });
  },

  // 转发给微信好友：详情页转发按钮 + 右上角菜单分享
  onShareAppMessage() {
    const post = this.data.post;
    return {
      title: post ? post.content.slice(0, 20) : '树洞匿名分享',
      path: `/pages/treehole/detail/index?id=${this.data.id}`,
    };
  },
});
