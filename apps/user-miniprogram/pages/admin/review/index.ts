import type { AppInstance } from '../../../app';
import {
  getQueue,
  approveMerchant,
  rejectMerchant,
  batchMerchants,
  takedownPost,
  takedownAnonPost,
  pinPost,
  featurePost,
  listPostsAdmin,
  listAnonPostsAdmin,
  listCommentsAdmin,
  pinComment,
  listReports,
  resolveReport,
  type AdminQueueVo,
  type AdminPostVo,
  type AdminAnonPostVo,
  type AdminCommentVo,
  type AdminReportVo,
} from '../../../services/admin';

// 管理端底部 tab：看板 / 审核 / 运营 / 用户 / 我的
const ADMIN_TABS = [
  { path: '/pages/admin/dashboard/index', label: '看板' },
  { path: '/pages/admin/review/index', label: '审核' },
  { path: '/pages/admin/ops/index', label: '运营' },
  { path: '/pages/admin/users/index', label: '用户' },
  { path: '/pages/admin/profile/index', label: '我的' },
];

type Sub = 'merchant' | 'posts' | 'anon' | 'comments' | 'reports';
const SUBS: Sub[] = ['merchant', 'posts', 'anon', 'comments', 'reports'];

Page({
  data: {
    tabs: ADMIN_TABS,
    current: 'pages/admin/review/index',
    sub: 'merchant' as Sub,
    // 商家入驻
    queue: null as AdminQueueVo | null,
    // 表白墙帖
    posts: [] as AdminPostVo[],
    postPage: 0,
    postHasMore: false,
    postKeyword: '',
    postStatus: '',
    // 树洞帖
    anonPosts: [] as AdminAnonPostVo[],
    anonPostPage: 0,
    anonPostHasMore: false,
    // 评论
    comments: [] as AdminCommentVo[],
    commentPage: 0,
    commentHasMore: false,
    commentPostId: '',
    commentKeyword: '',
    commentAuthorId: '',
    commentAuthorNickname: '',
    commentPostTitleKw: '',
    // 举报
    reports: [] as AdminReportVo[],
    reportStatus: 'PENDING',
    loading: false,
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    void this.load();
  },

  switchSub(e: WechatMiniprogram.TouchEvent) {
    const s = e.currentTarget.dataset.sub as Sub;
    if (SUBS.includes(s)) {
      this.setData({ sub: s });
      void this.load();
    }
  },

  async load() {
    this.setData({ loading: true });
    try {
      const sub = this.data.sub;
      if (sub === 'merchant') {
        const queue = await getQueue();
        this.setData({ queue });
      } else if (sub === 'posts') {
        await this.loadPosts(false);
      } else if (sub === 'anon') {
        await this.loadAnonPosts(false);
      } else if (sub === 'comments') {
        await this.loadComments(false);
      } else if (sub === 'reports') {
        const r = await listReports(this.data.reportStatus);
        this.setData({ reports: r.list });
      }
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  // ===== 商家入驻 =====
  approve(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '审核通过',
      editable: true,
      placeholderText: '审核理由（可选）',
      success: async (r) => {
        if (r.confirm) {
          await approveMerchant(id, r.content || undefined);
          wx.showToast({ title: '已通过', icon: 'success' });
          this.load();
        }
      },
    });
  },
  reject(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '审核拒绝',
      editable: true,
      placeholderText: '拒绝理由（可选）',
      success: async (r) => {
        if (r.confirm) {
          await rejectMerchant(id, r.content || undefined);
          wx.showToast({ title: '已拒绝', icon: 'success' });
          this.load();
        }
      },
    });
  },
  batchApprove() {
    const pendingIds = this.data.queue?.merchants.filter((m) => m.status === 'PENDING').map((m) => m.id) ?? [];
    if (pendingIds.length === 0) {
      wx.showToast({ title: '无待审核商家', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '批量通过',
      content: `确定批量通过 ${pendingIds.length} 个待审核商家？`,
      success: async (r) => {
        if (r.confirm) {
          await batchMerchants(pendingIds, 'approve');
          wx.showToast({ title: '批量通过成功', icon: 'success' });
          this.load();
        }
      },
    });
  },

  // ===== 表白墙帖 =====
  async loadPosts(append: boolean) {
    const page = append ? this.data.postPage + 1 : 1;
    const r = await listPostsAdmin(page, 20, this.data.postKeyword || undefined, this.data.postStatus || undefined);
    const posts = append ? [...this.data.posts, ...r.list] : r.list;
    this.setData({ posts, postPage: page, postHasMore: posts.length < r.total });
  },
  loadMorePosts() {
    if (this.data.postHasMore) void this.loadPosts(true);
  },
  switchPostStatus(e: WechatMiniprogram.TouchEvent) {
    this.setData({ postStatus: e.currentTarget.dataset.s as string });
    void this.loadPosts(false);
  },
  onPostKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ postKeyword: e.detail.value });
  },
  searchPosts() {
    void this.loadPosts(false);
  },
  takedown(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '下架帖子',
      editable: true,
      placeholderText: '下架理由（可选）',
      success: async (r) => {
        if (r.confirm) {
          await takedownPost(id, r.content || undefined);
          wx.showToast({ title: '已下架', icon: 'success' });
          this.load();
        }
      },
    });
  },
  togglePin(e: WechatMiniprogram.TouchEvent) {
    const { id, pinned } = e.currentTarget.dataset as { id: string; pinned: boolean };
    void pinPost(id, !pinned).then(() => {
      wx.showToast({ title: !pinned ? '已置顶' : '已取消置顶', icon: 'success' });
      this.load();
    });
  },
  toggleFeature(e: WechatMiniprogram.TouchEvent) {
    const { id, featured } = e.currentTarget.dataset as { id: string; featured: boolean };
    void featurePost(id, !featured).then(() => {
      wx.showToast({ title: !featured ? '已加精' : '已取消加精', icon: 'success' });
      this.load();
    });
  },

  // ===== 树洞帖 =====
  async loadAnonPosts(append: boolean) {
    const page = append ? this.data.anonPostPage + 1 : 1;
    const r = await listAnonPostsAdmin(page, 20);
    const anonPosts = append ? [...this.data.anonPosts, ...r.list] : r.list;
    this.setData({ anonPosts, anonPostPage: page, anonPostHasMore: anonPosts.length < r.total });
  },
  loadMoreAnonPosts() {
    if (this.data.anonPostHasMore) void this.loadAnonPosts(true);
  },
  takedownAnon(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '下架匿名帖',
      editable: true,
      placeholderText: '下架理由（可选）',
      success: async (r) => {
        if (r.confirm) {
          await takedownAnonPost(id, r.content || undefined);
          wx.showToast({ title: '已下架', icon: 'success' });
          this.load();
        }
      },
    });
  },

  // ===== 评论 =====
  async loadComments(append: boolean) {
    const page = append ? this.data.commentPage + 1 : 1;
    const r = await listCommentsAdmin(
      this.data.commentPostId || undefined,
      page,
      20,
      this.data.commentKeyword || undefined,
      this.data.commentAuthorId || undefined,
      this.data.commentAuthorNickname || undefined,
      this.data.commentPostTitleKw || undefined,
    );
    const comments = append ? [...this.data.comments, ...r.list] : r.list;
    this.setData({ comments, commentPage: page, commentHasMore: comments.length < r.total });
  },
  loadMoreComments() {
    if (this.data.commentHasMore) void this.loadComments(true);
  },
  onCommentPostIdInput(e: WechatMiniprogram.Input) {
    this.setData({ commentPostId: e.detail.value });
  },
  onCommentKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ commentKeyword: e.detail.value });
  },
  onAuthorIdInput(e: WechatMiniprogram.Input) {
    this.setData({ commentAuthorId: e.detail.value });
  },
  onAuthorNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ commentAuthorNickname: e.detail.value });
  },
  onPostTitleKwInput(e: WechatMiniprogram.Input) {
    this.setData({ commentPostTitleKw: e.detail.value });
  },
  searchComments() {
    this.setData({ comments: [], commentPage: 0 });
    void this.loadComments(false);
  },
  pinCommentTap(e: WechatMiniprogram.TouchEvent) {
    const { id, pinned } = e.currentTarget.dataset as { id: string; pinned: boolean };
    void pinComment(id, !pinned).then(() => {
      wx.showToast({ title: !pinned ? '已置顶' : '已取消置顶', icon: 'success' });
      void this.loadComments(false);
    });
  },

  // ===== 举报处理 =====
  switchReportStatus(e: WechatMiniprogram.TouchEvent) {
    this.setData({ reportStatus: e.currentTarget.dataset.s as string });
    this.load();
  },
  resolveReportTap(e: WechatMiniprogram.TouchEvent) {
    const { id, action } = e.currentTarget.dataset as { id: string; action: 'approve' | 'reject' };
    const isApprove = action === 'approve';
    wx.showModal({
      title: isApprove ? '举报成立' : '举报驳回',
      editable: true,
      placeholderText: isApprove ? '处理结果（可选），输入"下架"可下架内容' : '驳回原因（可选）',
      success: async (r) => {
        if (r.confirm) {
          const takedown = isApprove && /下架/.test(r.content || '');
          await resolveReport(id, action, r.content || undefined, takedown);
          wx.showToast({ title: '已处理', icon: 'success' });
          this.load();
        }
      },
    });
  },
});
