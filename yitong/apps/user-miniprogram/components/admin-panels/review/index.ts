// 审核 panel（迁移自 pages/admin/review/index，Page -> Component）
// 5 sub-tab：商家入驻 / 表白墙帖 / 树洞帖 / 评论 / 举报处理
import type { AppInstance } from '../../../app';
import {
  getQueue,
  getModerationContexts,
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
  restorePost,
  restoreAnonPost,
  restoreJobPost,
  type AdminQueueVo,
  type AdminPostVo,
  type AdminAnonPostVo,
  type AdminCommentVo,
  type AdminReportVo,
  type AdminJobPostVo,
  type AdminModerationScope,
  type ModerationContextsVo,
} from '../../../services/admin';

type Sub = 'merchant' | 'posts' | 'anon' | 'comments' | 'reports' | 'jobs';
const SUBS: Sub[] = ['merchant', 'posts', 'anon', 'comments', 'reports', 'jobs'];
const SUB_LABELS: Record<Sub, string> = {
  merchant: '商家入驻',
  posts: '表白墙帖',
  anon: '树洞帖',
  comments: '评论',
  reports: '举报处理',
  jobs: '岗位',
};

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
    allowedSubs: [] as Sub[],
    subLabels: SUB_LABELS,
    moderationScopes: [] as ModerationContextsVo['scopes'],
    moderationCommunities: [] as ModerationContextsVo['communities'],
    moderationCommunityOptions: [] as Array<{ id: string; name: string }>,
    moderationScope: 'COMMUNITY' as AdminModerationScope,
    moderationCommunityId: '',
    moderationCommunityIndex: 0,
    isPlatformAdmin: false,
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
    reportPage: 0,
    reportHasMore: false,
    // 岗位（R4）
    jobs: [] as AdminJobPostVo[],
    jobPage: 0,
    jobHasMore: false,
    loading: false,
    loadingMore: false,
    requestVersion: 0,
  },

  methods: {
    beginRequest() {
      const requestVersion = this.data.requestVersion + 1;
      this.setData({ requestVersion, loading: false, loadingMore: false });
      return requestVersion;
    },

    isCurrentRequest(requestVersion: number) {
      return requestVersion === this.data.requestVersion;
    },
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
      const access = app.globalData.adminAccess;
      if (!access) return;
      const can = (permission: string) =>
        access.isPlatform || access.permissions.includes(permission);
      const allowedSubs = SUBS.filter((sub) => {
        if (sub === 'merchant') return can('merchant.review');
        if (sub === 'reports') return can('report.manage');
        return can('content.moderate');
      });
      const sub = allowedSubs.includes(this.data.sub) ? this.data.sub : allowedSubs[0];
      if (!sub) return;
      this.setData({ allowedSubs, sub, isPlatformAdmin: access.isPlatform });
      if (can('content.moderate') || can('report.manage')) {
        void this.ensureModerationContexts().then(() => this.load());
      } else {
        void this.load();
      }
    },

    async ensureModerationContexts() {
      if (this.data.moderationScopes.length > 0) return;
      const contexts = await getModerationContexts();
      const scope = contexts.scopes.some((item) => item.scope === 'PLATFORM') ? 'PLATFORM' : 'COMMUNITY';
      this.setData({
        moderationScopes: contexts.scopes,
        moderationCommunities: contexts.communities,
        moderationCommunityOptions: [{ id: '', name: '全部授权圈子' }, ...contexts.communities],
        moderationScope: scope,
        moderationCommunityId: '',
        moderationCommunityIndex: 0,
      });
    },

    moderationQuery() {
      return {
        scope: this.data.moderationScope,
        communityId: this.data.moderationScope === 'COMMUNITY'
          ? (this.data.moderationCommunityId || undefined)
          : undefined,
      };
    },

    switchModerationScope(e: WechatMiniprogram.TouchEvent) {
      const scope = e.currentTarget.dataset.scope as AdminModerationScope;
      if (!this.data.moderationScopes.some((item) => item.scope === scope)) return;
      this.setData({ moderationScope: scope, moderationCommunityId: '', moderationCommunityIndex: 0 });
      void this.load();
    },

    onModerationCommunityChange(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value) || 0;
      const selected = this.data.moderationCommunityOptions[index];
      this.setData({ moderationCommunityIndex: index, moderationCommunityId: selected?.id ?? '' });
      void this.load();
    },

    // 原页无 onReachBottom；shell 触底时按当前 sub-tab 分发到对应 loadMore
    onPanelReachBottom() {
      const sub = this.data.sub;
      if (sub === 'posts') this.loadMorePosts();
      else if (sub === 'anon') this.loadMoreAnonPosts();
      else if (sub === 'comments') this.loadMoreComments();
      else if (sub === 'reports') this.loadMoreReports();
      else if (sub === 'jobs') this.loadMoreJobs();
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
      const requestVersion = this.beginRequest();
      this.setData({ loading: true });
      try {
        const sub = this.data.sub;
        if (sub === 'merchant') {
          const queue = await getQueue();
          if (!this.isCurrentRequest(requestVersion)) return;
          this.setData({ queue });
          this.filterMerchants();
        } else if (sub === 'posts') {
          await this.loadPosts(false, requestVersion);
        } else if (sub === 'anon') {
          await this.loadAnonPosts(false, requestVersion);
        } else if (sub === 'comments') {
          await this.loadComments(false, requestVersion);
        } else if (sub === 'reports') {
          await this.loadReports(false, requestVersion);
        } else if (sub === 'jobs') {
          await this.loadJobs(false, requestVersion);
        }
      } catch {
        /* toast */
      } finally {
        if (this.isCurrentRequest(requestVersion)) this.setData({ loading: false });
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
    async loadPosts(append: boolean, requestVersion?: number) {
      const activeRequestVersion = requestVersion ?? this.beginRequest();
      const page = append ? this.data.postPage + 1 : 1;
      const keyword = this.data.postKeyword || undefined;
      const status = this.data.postStatus || undefined;
      const query = this.moderationQuery();
      const r = await listPostsAdmin(page, 20, keyword, status, query);
      if (!this.isCurrentRequest(activeRequestVersion)) return;
      const posts = append ? [...this.data.posts, ...r.list] : r.list;
      this.setData({ posts, postPage: page, postHasMore: posts.length < r.total });
    },
    loadMorePosts() {
      if (!this.data.postHasMore || this.data.loading || this.data.loadingMore) return;
      const requestVersion = this.beginRequest();
      this.setData({ loadingMore: true });
      void this.loadPosts(true, requestVersion).finally(() => {
        if (this.isCurrentRequest(requestVersion)) this.setData({ loadingMore: false });
      });
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
    async loadAnonPosts(append: boolean, requestVersion?: number) {
      const activeRequestVersion = requestVersion ?? this.beginRequest();
      const page = append ? this.data.anonPostPage + 1 : 1;
      const query = this.moderationQuery();
      const r = await listAnonPostsAdmin(page, 20, query);
      if (!this.isCurrentRequest(activeRequestVersion)) return;
      const anonPosts = append ? [...this.data.anonPosts, ...r.list] : r.list;
      this.setData({ anonPosts, anonPostPage: page, anonPostHasMore: anonPosts.length < r.total });
    },
    loadMoreAnonPosts() {
      if (!this.data.anonPostHasMore || this.data.loading || this.data.loadingMore) return;
      const requestVersion = this.beginRequest();
      this.setData({ loadingMore: true });
      void this.loadAnonPosts(true, requestVersion).finally(() => {
        if (this.isCurrentRequest(requestVersion)) this.setData({ loadingMore: false });
      });
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
    async loadJobs(append: boolean, requestVersion?: number) {
      const activeRequestVersion = requestVersion ?? this.beginRequest();
      const page = append ? this.data.jobPage + 1 : 1;
      const query = this.moderationQuery();
      const r = await listJobPostsAdmin(page, 20, query);
      if (!this.isCurrentRequest(activeRequestVersion)) return;
      const jobs = append ? [...this.data.jobs, ...r.list] : r.list;
      this.setData({ jobs, jobPage: page, jobHasMore: jobs.length < r.total });
    },

    loadMoreJobs() {
      if (!this.data.jobHasMore || this.data.loading || this.data.loadingMore) return;
      const requestVersion = this.beginRequest();
      this.setData({ loadingMore: true });
      void this.loadJobs(true, requestVersion).finally(() => {
        if (this.isCurrentRequest(requestVersion)) this.setData({ loadingMore: false });
      });
    },

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

    restorePostTap(e: WechatMiniprogram.TouchEvent) {
      const { id, version } = e.currentTarget.dataset as { id: string; version: number };
      void restorePost(id, Number(version)).then(() => {
        wx.showToast({ title: '已恢复', icon: 'success' });
        return this.loadPosts(false);
      }).catch(() => this.loadPosts(false));
    },

    restoreAnonPostTap(e: WechatMiniprogram.TouchEvent) {
      const { id, version } = e.currentTarget.dataset as { id: string; version: number };
      void restoreAnonPost(id, Number(version)).then(() => {
        wx.showToast({ title: '已恢复', icon: 'success' });
        return this.loadAnonPosts(false);
      }).catch(() => this.loadAnonPosts(false));
    },

    restoreJobPostTap(e: WechatMiniprogram.TouchEvent) {
      const { id, version } = e.currentTarget.dataset as { id: string; version: number };
      void restoreJobPost(id, Number(version)).then(() => {
        wx.showToast({ title: '已恢复', icon: 'success' });
        return this.load();
      }).catch(() => this.load());
    },

    // ===== 评论 =====
    async loadComments(append: boolean, requestVersion?: number) {
      const activeRequestVersion = requestVersion ?? this.beginRequest();
      const page = append ? this.data.commentPage + 1 : 1;
      const postId = this.data.commentPostId || undefined;
      const keyword = this.data.commentKeyword || undefined;
      const authorId = this.data.commentAuthorId || undefined;
      const authorNickname = this.data.commentAuthorNickname || undefined;
      const postTitle = this.data.commentPostTitleKw || undefined;
      const r = await listCommentsAdmin(postId, page, 20, keyword, authorId, authorNickname, postTitle);
      if (!this.isCurrentRequest(activeRequestVersion)) return;
      const comments = append ? [...this.data.comments, ...r.list] : r.list;
      this.setData({ comments, commentPage: page, commentHasMore: comments.length < r.total });
    },
    loadMoreComments() {
      if (!this.data.commentHasMore || this.data.loading || this.data.loadingMore) return;
      const requestVersion = this.beginRequest();
      this.setData({ loadingMore: true });
      void this.loadComments(true, requestVersion).finally(() => {
        if (this.isCurrentRequest(requestVersion)) this.setData({ loadingMore: false });
      });
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
    async loadReports(append: boolean, requestVersion?: number) {
      const activeRequestVersion = requestVersion ?? this.beginRequest();
      const page = append ? this.data.reportPage + 1 : 1;
      const status = this.data.reportStatus;
      const query = this.moderationQuery();
      const r = await listReports(status, page, 20, query);
      if (!this.isCurrentRequest(activeRequestVersion)) return;
      const reports = append ? [...this.data.reports, ...r.list] : r.list;
      this.setData({ reports, reportPage: page, reportHasMore: reports.length < r.total });
    },

    loadMoreReports() {
      if (!this.data.reportHasMore || this.data.loading || this.data.loadingMore) return;
      const requestVersion = this.beginRequest();
      this.setData({ loadingMore: true });
      void this.loadReports(true, requestVersion).finally(() => {
        if (this.isCurrentRequest(requestVersion)) this.setData({ loadingMore: false });
      });
    },

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
