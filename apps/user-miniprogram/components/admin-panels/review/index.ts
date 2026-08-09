// 审核 panel（迁移自 pages/admin/review/index，Page -> Component）
// 5 sub-tab：商家入驻 / 表白墙帖 / 树洞帖 / 评论 / 举报处理
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
  listJobPostsAdmin,
  takedownJobPost,
  type AdminQueueVo,
  type AdminPostVo,
  type AdminAnonPostVo,
  type AdminCommentVo,
  type AdminReportVo,
  type AdminJobPostVo,
} from '../../../services/admin';

type Sub = 'merchant' | 'posts' | 'anon' | 'comments' | 'reports' | 'jobs';
const SUBS: Sub[] = ['merchant', 'posts', 'anon', 'comments', 'reports', 'jobs'];

Component({
  options: { addGlobalClass: true },

  properties: {
    params: {
      type: Object,
      value: {},
      observer(n) {
        this.onParams((n || {}) as Record<string, unknown>);
      },
    },
  },

  data: {
    sub: 'merchant' as Sub,
    // 商家入驻
    queue: null as AdminQueueVo | null,
    merchantStatus: 'PENDING' as 'all' | 'PENDING' | 'APPROVED' | 'REJECTED',
    filteredMerchants: [] as AdminQueueVo['merchants'],
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
    // 岗位（R4）
    jobs: [] as AdminJobPostVo[],
    loading: false,
  },

  methods: {
    // shell 注入 params（带 _ts nonce 保证同值重触发）；可接 sub 预选子 tab
    onParams(params: Record<string, unknown>) {
      const sub = params.sub as Sub | undefined;
      if (sub && SUBS.includes(sub)) {
        this.setData({ sub });
      }
    },

    // 等价原 onShow：requireAuth + 加载当前 sub-tab
    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      void this.load();
    },

    // 原页无 onReachBottom；shell 触底时按当前 sub-tab 分发到对应 loadMore
    onPanelReachBottom() {
      const sub = this.data.sub;
      if (sub === 'posts') this.loadMorePosts();
      else if (sub === 'anon') this.loadMoreAnonPosts();
      else if (sub === 'comments') this.loadMoreComments();
    },

    onPanelPullDown() {
      void this.load().finally(() => wx.stopPullDownRefresh());
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
          this.filterMerchants();
        } else if (sub === 'posts') {
          await this.loadPosts(false);
        } else if (sub === 'anon') {
          await this.loadAnonPosts(false);
        } else if (sub === 'comments') {
          await this.loadComments(false);
        } else if (sub === 'reports') {
          const r = await listReports(this.data.reportStatus);
          this.setData({ reports: r.list });
        } else if (sub === 'jobs') {
          const jobs = await listJobPostsAdmin(50);
          this.setData({ jobs });
        }
      } catch {
        /* toast */
      } finally {
        this.setData({ loading: false });
      }
    },

    // ===== 商家入驻 =====
    switchMerchantStatus(e: WechatMiniprogram.TouchEvent) {
      const s = e.currentTarget.dataset.s as 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';
      this.setData({ merchantStatus: s });
      this.filterMerchants();
    },

    // 按 merchantStatus 在前端过滤 queue（server 端 getQueue 返回全量，前端按 tab 切片）
    filterMerchants() {
      const all = this.data.queue?.merchants ?? [];
      const status = this.data.merchantStatus;
      const filtered = status === 'all' ? all : all.filter((m) => m.status === status);
      this.setData({ filteredMerchants: filtered });
    },

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

    // ===== 岗位（R4 管理员主动下架）=====
    takedownJob(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.showModal({
        title: '下架岗位',
        editable: true,
        placeholderText: '下架理由（可选）',
        success: async (r) => {
          if (r.confirm) {
            await takedownJobPost(id, r.content || undefined);
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
  },
});
