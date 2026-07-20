import type { AppInstance } from '../../app';
import { getPost, listComments, createComment, toggleLike, reportPost, type PostVo, type CommentVo } from '../../services/confession';
import { checkFavorite, toggleFavorite } from '../../services/favorite';
import { toggleFollow } from '../../services/follow';
import { formatTime } from '../../utils/auth';

type PostVoView = PostVo & { timeText: string; imgLayout: '' | 'one' | 'two' | 'three'; favorited?: boolean; following?: boolean };

interface CommentView {
  id: string;
  postId: string;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl: string | null;
  content: string;
  parentId: string | null;
  replyToNickname: string | null;
  replies: CommentView[];
  createdAt: string;
  timeText: string;
}

// P0-10 回复态：parentId=顶级评论；replyToId=被回复的具体评论（回复顶级评论作者时 undefined）；nickname=展示用
interface ReplyState {
  parentId: string;
  replyToId?: string;
  nickname: string;
}

interface PageData {
  post: PostVoView | null;
  commentList: CommentView[];
  page: number;
  pageSize: number;
  total: number; // 顶级评论数（分页用）
  hasMore: boolean;
  loading: boolean;
  commentText: string;
  sending: boolean;
  focus: boolean;
  reply: ReplyState | null;
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

function toCommentView(c: CommentVo): CommentView {
  return {
    ...c,
    timeText: formatTime(c.createdAt),
    replies: (c.replies ?? []).map((r) => toCommentView(r)),
  };
}

Page({
  data: {
    post: null,
    commentList: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    loading: false,
    commentText: '',
    sending: false,
    focus: false,
    reply: null,
  } as PageData,

  postId: '',

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
        commentList: commentsResp.list.map(toCommentView),
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
      const newViews = resp.list.map(toCommentView);
      this.setData({
        commentList: [...this.data.commentList, ...newViews],
        page: nextPage,
        total: resp.total,
        hasMore: this.data.commentList.length + newViews.length < resp.total,
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

  // P0-10 回复：点"回复"设回复态（parentId=顶级评论；回复某条回复时带 replyToId）
  startReply(e: WechatMiniprogram.TouchEvent) {
    const { parentId, replyToId, nickname } = e.currentTarget.dataset as {
      parentId: string;
      replyToId?: string;
      nickname: string;
    };
    this.setData({ reply: { parentId, replyToId, nickname }, focus: true });
  },
  cancelReply() {
    this.setData({ reply: null });
  },

  async sendComment() {
    const text = this.data.commentText.trim();
    if (!text || this.data.sending) return;
    const reply = this.data.reply;
    this.setData({ sending: true });
    try {
      const c = await createComment(this.postId, text, {
        parentId: reply?.parentId,
        replyToId: reply?.replyToId,
      });
      const view = toCommentView(c);
      const post = this.data.post;
      if (reply) {
        // 回复：追加到对应顶级评论的 replies
        const list = this.data.commentList.map((item) =>
          item.id === reply.parentId
            ? { ...item, replies: [...item.replies, view] }
            : item,
        );
        this.setData({
          commentList: list,
          commentText: '',
          reply: null,
          post: post ? { ...post, commentCount: post.commentCount + 1 } : post,
        });
      } else {
        // 顶级评论：prepend
        this.setData({
          commentList: [view, ...this.data.commentList],
          total: this.data.total + 1,
          commentText: '',
          post: post ? { ...post, commentCount: post.commentCount + 1 } : post,
        });
      }
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

  async onFollow() {
    if (!this.data.post || !this.data.post.authorId) return;
    try {
      const r = await toggleFollow(this.data.post.authorId);
      this.setData({ 'post.following': r.following });
      wx.showToast({ title: r.following ? '已关注' : '已取关', icon: 'none' });
    } catch {
      /* toast */
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
