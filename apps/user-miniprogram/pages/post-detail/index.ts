import type { AppInstance } from '../../app';
import { getPost, listComments, createComment, toggleLike, reportPost, type PostVo, type CommentVo } from '../../services/confession';
import { checkFavorite, toggleFavorite } from '../../services/favorite';
import { formatTime } from '../../utils/auth';

type PostVoView = PostVo & { timeText: string; imgLayout: '' | 'one' | 'two' | 'three'; favorited?: boolean };

interface PageData {
  post: PostVoView | null;
  comments: CommentVo[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  commentText: string;
  sending: boolean;
  commentList: Array<CommentVo & { timeText: string }>;
  focus: boolean;
}

function calcImgLayout(n: number): '' | 'one' | 'two' | 'three' {
  if (n <= 0) return '';
  if (n === 1) return 'one';
  if (n <= 4) return 'two';
  return 'three';
}

function toPostView(p: PostVo, favorited?: boolean): PostVoView {
  return { ...p, favorited, timeText: formatTime(p.createdAt), imgLayout: calcImgLayout(p.images.length) };
}

Page({
  data: {
    post: null,
    comments: [],
    commentList: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    loading: false,
    commentText: '',
    sending: false,
    focus: false,
  } as PageData,

  onLoad(options: { id?: string; focus?: string }) {
    if (!options?.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.postId = options.id;
    if (options.focus === '1') {
      this.setData({ focus: true });
    }
    this.load();
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (this.postId && this.data.post) {
      // 返回时刷新点赞/评论数
      this.refreshPost();
    }
  },

  postId: '',

  async load() {
    this.setData({ loading: true });
    try {
      const [post, commentsResp] = await Promise.all([
        getPost(this.postId),
        listComments(this.postId, 1, this.data.pageSize),
      ]);
      const favorite = await checkFavorite('post', this.postId).catch(() => null);
      this.setData({
        post: toPostView(post, favorite?.favorited ?? false),
        comments: commentsResp.list,
        commentList: commentsResp.list.map((c) => ({ ...c, timeText: formatTime(c.createdAt) })),
        total: commentsResp.total,
        page: 1,
        hasMore: commentsResp.list.length < commentsResp.total,
      });
    } catch {
      // toast
    } finally {
      this.setData({ loading: false });
    }
  },

  async refreshPost() {
    try {
      const p = await getPost(this.postId);
      const favorite = await checkFavorite('post', this.postId).catch(() => null);
      this.setData({ post: toPostView(p, favorite?.favorited ?? this.data.post?.favorited ?? false) });
    } catch {
      // ignore
    }
  },

  previewImage(e: WechatMiniprogram.TouchEvent) {
    const { src } = e.currentTarget.dataset as { src: string };
    const imgs = this.data.post?.images ?? [];
    wx.previewImage({ current: src, urls: imgs });
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore || this.data.sending) return;
    this.setData({ loading: true });
    try {
      const nextPage = this.data.page + 1;
      const resp = await listComments(this.postId, nextPage, this.data.pageSize);
      this.setData({
        comments: [...this.data.comments, ...resp.list],
        commentList: [
          ...this.data.commentList,
          ...resp.list.map((c) => ({ ...c, timeText: formatTime(c.createdAt) })),
        ],
        page: nextPage,
        total: resp.total,
        hasMore: this.data.comments.length + resp.list.length < resp.total,
      });
    } catch {
      // ignore
    } finally {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadMore();
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ commentText: e.detail.value });
  },

  async sendComment() {
    const text = this.data.commentText.trim();
    if (!text || this.data.sending) return;
    this.setData({ sending: true });
    try {
      const c = await createComment(this.postId, text);
      const newList = [{ ...c, timeText: formatTime(c.createdAt) }, ...this.data.commentList];
      const post = this.data.post;
      this.setData({
        commentList: newList,
        comments: [c, ...this.data.comments],
        total: this.data.total + 1,
        commentText: '',
        post: post ? { ...post, commentCount: post.commentCount + 1 } : post,
      });
      wx.showToast({ title: '评论成功', icon: 'success' });
    } catch {
      // toast
    } finally {
      this.setData({ sending: false });
    }
  },

  async onLike() {
    if (!this.data.post) return;
    const p = this.data.post;
    const nextLiked = !p.liked;
    const nextCount = p.likeCount + (nextLiked ? 1 : -1);
    this.setData({
      'post.liked': nextLiked,
      'post.likeCount': Math.max(0, nextCount),
    });
    try {
      await toggleLike(p.id);
    } catch {
      this.setData({ 'post.liked': p.liked, 'post.likeCount': p.likeCount });
    }
  },

  async onFavorite() {
    if (!this.data.post) return;
    const p = this.data.post;
    try {
      const r = await toggleFavorite({ targetType: 'post', targetId: p.id });
      this.setData({ 'post.favorited': r.favorited });
      wx.showToast({ title: r.favorited ? '已收藏' : '已取消', icon: 'success' });
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onReport() {
    wx.showModal({
      title: '举报',
      content: '确定举报此帖子？',
      success: async (r) => {
        if (r.confirm) {
          try {
            await reportPost(this.postId);
            wx.showToast({ title: '已举报', icon: 'success' });
          } catch {
            /* toast */
          }
        }
      },
    });
  },
});
