import type { AppInstance } from '../../app';
import {
  getPost,
  listComments,
  listReplies,
  locateComment,
  createComment,
  toggleLike,
  toggleCommentLike,
  reportPost,
  editPost,
  deletePost,
  type PostVo,
  type CommentVo,
} from '../../services/confession';
import { checkFavorite, toggleFavorite } from '../../services/favorite';
import { toggleFollow } from '../../services/follow';
import { formatTime } from '../../utils/auth';

type PostVoView = PostVo & { timeText: string; imgLayout: '' | 'one' | 'two' | 'three'; favorited?: boolean; following?: boolean };

// P1-01 回复分页：replyPage=下一个待加载页（1=尚未展开，先拉第 1 页替换预览）；replyLoading=展开加载中
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
  replyCount: number;
  likeCount: number;
  liked: boolean;
  pinned: boolean;
  replyPage: number;
  replyLoading: boolean;
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
  anchorId: string; // P1-01 定位高亮的评论/回复 id
  isAuthor: boolean; // P1-10 当前用户是否为帖子作者
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
    replyPage: 1,
    replyLoading: false,
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
    anchorId: '',
    isAuthor: false,
  } as PageData,

  postId: '',
  anchorCommentId: '',

  onLoad(options: { id?: string; focus?: string; commentId?: string }) {
    if (!options?.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.postId = options.id;
    if (options.focus === '1') {
      this.setData({ focus: true });
    }
    // P1-01 跳转定位：从消息/我的评论进入时带 commentId
    this.anchorCommentId = options.commentId ?? '';
    this.load();
  },

  // P1-10 作者编辑帖子
  onEdit() {
    const p = this.data.post;
    if (!p) return;
    wx.setStorageSync('yitong_edit_post_draft', { ...p });
    wx.navigateTo({ url: `/pages/post-create/index?editId=${p.id}` });
  },

  // 内容推广：作者提升曝光（付费置顶）
  onBoost() {
    const p = this.data.post;
    if (!p) return;
    wx.navigateTo({ url: `/pages/boost/index?type=post&id=${p.id}` });
  },

  // P1-10 作者删除帖子（软删）
  onDelete() {
    const p = this.data.post;
    if (!p) return;
    wx.showModal({
      title: '删除帖子',
      content: '确定删除吗？删除后无法恢复（仅你可见，已下架）。',
      success: async (r) => {
        if (r.confirm) {
          try {
            await deletePost(p.id);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack({ delta: 1 }), 600);
          } catch {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
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
      const post = await getPost(this.postId);
      const anonymousContentEnabled = await getApp<AppInstance>().getAnonymousContentVisibility();
      if (post.isAnonymous && !anonymousContentEnabled) {
        wx.showToast({ title: '匿名内容暂未开放', icon: 'none' });
        wx.switchTab({ url: '/pages/confession/index' });
        return;
      }
      const commentsResp = await listComments(this.postId, 1, this.data.pageSize);
      const favorite = await checkFavorite('post', this.postId).catch(() => null);
      const meId = (getApp<AppInstance>().globalData.user?.id ?? '') as string;
      this.setData({
        post: toPostView(post, favorite?.favorited ?? false),
        commentList: commentsResp.list.map(toCommentView),
        total: commentsResp.total,
        page: 1,
        hasMore: commentsResp.list.length < commentsResp.total,
        isAuthor: !!post.authorId && post.authorId === meId,
      });
      if (this.anchorCommentId) {
        await this.locateAnchor(this.anchorCommentId);
      }
    } catch {
      // toast
    } finally {
      this.setData({ loading: false });
    }
  },

  // P1-01 定位：locate 找到目标评论所在页 -> 补齐分页 -> 展开所属 thread 全部回复 -> 滚动高亮
  async locateAnchor(commentId: string) {
    try {
      const loc = await locateComment(this.postId, commentId, this.data.pageSize);
      // 补齐顶级评论分页直到目标页
      while (this.data.page < loc.page) {
        const nextPage = this.data.page + 1;
        const resp = await listComments(this.postId, nextPage, this.data.pageSize);
        this.setData({
          commentList: [...this.data.commentList, ...resp.list.map(toCommentView)],
          page: nextPage,
          total: resp.total,
          hasMore: this.data.commentList.length + resp.list.length < resp.total,
        });
      }
      // 展开目标 thread 的全部回复
      await this.expandAllReplies(loc.threadRootId);
      this.setData({ anchorId: commentId });
      // 等渲染后滚动到锚点
      setTimeout(() => {
        wx.pageScrollTo({ selector: `#c-${commentId}`, duration: 300, offsetTop: -160 });
      }, 300);
    } catch {
      wx.showToast({ title: '评论不存在或已删除', icon: 'none' });
    }
  },

  // P1-01 展开某顶级评论的全部回复（分页拉取直至完整）
  async expandAllReplies(threadRootId: string) {
    const thread = this.data.commentList.find((c) => c.id === threadRootId);
    if (!thread) return;
    const views: CommentView[] = [];
    let page = 1;
    for (;;) {
      const resp = await listReplies(this.postId, threadRootId, page, 10);
      views.push(...resp.list.map((r) => toCommentView(r)));
      if (views.length >= resp.total || resp.list.length === 0) break;
      page += 1;
    }
    this.setData({
      commentList: this.data.commentList.map((c) =>
        c.id === threadRootId ? { ...c, replies: views, replyPage: page + 1 } : c,
      ),
    });
  },

  // P1-01 回复分页：查看全部 / 展开更多回复
  async loadMoreReplies(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset as { id: string };
    const thread = this.data.commentList.find((c) => c.id === id);
    if (!thread || thread.replyLoading) return;
    this.setData({
      commentList: this.data.commentList.map((c) =>
        c.id === id ? { ...c, replyLoading: true } : c,
      ),
    });
    try {
      // replyPage=1 时拉第 1 页替换预览（预览仅前 3 条），否则追加
      const resp = await listReplies(this.postId, id, thread.replyPage, 10);
      const fetched = resp.list.map((r) => toCommentView(r));
      const replies = thread.replyPage === 1 ? fetched : [...thread.replies, ...fetched];
      this.setData({
        commentList: this.data.commentList.map((c) =>
          c.id === id ? { ...c, replies, replyPage: c.replyPage + 1, replyLoading: false } : c,
        ),
      });
    } catch {
      this.setData({
        commentList: this.data.commentList.map((c) =>
          c.id === id ? { ...c, replyLoading: false } : c,
        ),
      });
    }
  },

  async refreshPost() {
    try {
      const p = await getPost(this.postId);
      const anonymousContentEnabled = await getApp<AppInstance>().getAnonymousContentVisibility();
      if (p.isAnonymous && !anonymousContentEnabled) {
        wx.switchTab({ url: '/pages/confession/index' });
        return;
      }
      const favorite = await checkFavorite('post', this.postId).catch(() => null);
      const meId = (getApp<AppInstance>().globalData.user?.id ?? '') as string;
      this.setData({
        post: toPostView(p, favorite?.favorited ?? this.data.post?.favorited ?? false),
        isAuthor: !!p.authorId && p.authorId === meId,
      });
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
        // 回复：追加到对应顶级评论的 replies 并更新回复总数
        const list = this.data.commentList.map((item) =>
          item.id === reply.parentId
            ? { ...item, replies: [...item.replies, view], replyCount: item.replyCount + 1 }
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

  // P1-02 评论点赞（含回复）。乐观更新 + 失败回滚

  // P1-02 评论点赞（含回复）。乐观更新 + 失败回滚
  async onCommentLike(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset as { id: string };
    const list = this.data.commentList;
    const update = (arr: CommentView[]): { next: CommentView[]; found: { liked: boolean; likeCount: number } | null } => {
      let found: { liked: boolean; likeCount: number } | null = null;
      const next = arr.map((c) => {
        if (c.id === id && c.parentId === null) {
          const liked = !c.liked;
          const likeCount = Math.max(0, c.likeCount + (liked ? 1 : -1));
          found = { liked, likeCount };
          return { ...c, liked, likeCount };
        }
        if (c.replies.length > 0) {
          let touched = false;
          const replies = c.replies.map((r) => {
            if (r.id === id) {
              const liked = !r.liked;
              const likeCount = Math.max(0, r.likeCount + (liked ? 1 : -1));
              found = { liked, likeCount };
              touched = true;
              return { ...r, liked, likeCount };
            }
            return r;
          });
          if (touched) return { ...c, replies };
        }
        return c;
      });
      return { next, found };
    };
    const { next, found } = update(list);
    if (!found) return;
    this.setData({ commentList: next });
    try {
      const r = await toggleCommentLike(id);
      // 用服务端返回值对齐（防并发偏差）
      const align = (arr: CommentView[]): CommentView[] =>
        arr.map((c) => {
          if (c.id === id && c.parentId === null) return { ...c, liked: r.liked, likeCount: r.likeCount };
          if (c.replies.length > 0) {
            const replies = c.replies.map((rr) => (rr.id === id ? { ...rr, liked: r.liked, likeCount: r.likeCount } : rr));
            return { ...c, replies };
          }
          return c;
        });
      this.setData({ commentList: align(this.data.commentList) });
    } catch {
      // 回滚到乐观更新之前
      this.setData({ commentList: list });
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

  // 转发给微信好友：详情页转发按钮 + 右上角菜单分享都走这里
  onShareAppMessage() {
    const p = this.data.post;
    return {
      title: p ? p.content.slice(0, 20) : '表白墙',
      path: `/pages/post-detail/index?id=${this.postId}`,
    };
  },
});
