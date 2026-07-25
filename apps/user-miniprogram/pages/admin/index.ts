import type { AppInstance } from '../../app';
import {
  getQueue,
  approveMerchant,
  rejectMerchant,
  batchMerchants,
  takedownPost,
  takedownAnonPost,
  getPricing,
  updatePricing,
  getStats,
  listReports,
  resolveReport,
  pinPost,
  featurePost,
  featureJob,
  listTickets,
  replyTicket,
  reopenTicket,
  listUsers,
  banUser,
  muteUser,
  listActivityTopicsAdmin,
  createActivityTopic,
  deleteActivityTopic,
  listTopicsAdmin,
  createTopic,
  deleteTopic,
  listAnonTagsAdmin,
  createAnonTag,
  deleteAnonTag,
  updateAnonTag,
  listJobPostsAdmin,
  listPostsAdmin,
  listAnonPostsAdmin,
  listCommentsAdmin,
  pinComment,
  type AdminQueueVo,
  type AdminPostVo,
  type AdminAnonPostVo,
  type AdminCommentVo,
  type PricingVo,
  type DashboardStats,
  type AdminReportVo,
  type AdminTicketVo,
  type AdminUserVo,
  type ActivityTopicVo,
  type TopicVo,
  type AnonTagVo,
  type AdminJobPostVo,
} from '../../services/admin';
import {
  listAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AdminAnnouncementVo,
} from '../../services/announcement';

type Tab = 'queue' | 'stats' | 'pricing' | 'announce' | 'reports' | 'tickets' | 'users' | 'activity' | 'topic' | 'tags' | 'jobs' | 'comments';

Page({
  data: {
    tab: 'queue' as Tab,
    queue: null as AdminQueueVo | null,
    pricing: [] as PricingVo[],
    stats: null as DashboardStats | null,
    announcements: [] as AdminAnnouncementVo[],
    loading: false,
    editingDuration: '',
    editingPrice: '',
    annTitle: '',
    annContent: '',
    // 举报
    reports: [] as AdminReportVo[],
    reportStatus: 'PENDING',
    // 工单
    tickets: [] as AdminTicketVo[],
    ticketStatus: 'OPEN',
    // 用户
    users: [] as AdminUserVo[],
    userKeyword: '',
    // 活动专题
    activityTopics: [] as ActivityTopicVo[],
    actTitle: '',
    actDesc: '',
    // 话题
    topics: [] as TopicVo[],
    topicName: '',
    topicDesc: '',
    // 标签
    anonTags: [] as AnonTagVo[],
    tagName: '',
    tagCategory: 'personality',
    // 岗位（精品管理）
    jobPosts: [] as AdminJobPostVo[],
    // C 帖子分页
    posts: [] as AdminPostVo[],
    postPage: 0,
    postHasMore: false,
    postKeyword: '',
    anonPosts: [] as AdminAnonPostVo[],
    anonPostPage: 0,
    anonPostHasMore: false,
    // F 评论管理
    comments: [] as AdminCommentVo[],
    commentPage: 0,
    commentHasMore: false,
    commentPostId: '',
    // D 标签编辑
    tagFilterCat: '',
    tagSort: '',
    editingTagId: '',
    editingTagName: '',
    editingTagSort: '',
    // C 帖子状态筛选
    postStatus: '',
    // B 评论 keyword 筛选
    commentKeyword: '',
    commentAuthorId: '',
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      if (this.data.tab === 'queue') {
        const queue = await getQueue();
        this.setData({ queue });
        void this.loadPosts();
        void this.loadAnonPosts();
      } else if (this.data.tab === 'pricing') {
        const pricing = await getPricing();
        this.setData({ pricing });
      } else if (this.data.tab === 'announce') {
        const announcements = await listAllAnnouncements();
        this.setData({ announcements });
      } else if (this.data.tab === 'reports') {
        const r = await listReports(this.data.reportStatus);
        this.setData({ reports: r.list });
      } else if (this.data.tab === 'tickets') {
        const tickets = await listTickets(this.data.ticketStatus);
        this.setData({ tickets });
      } else if (this.data.tab === 'users') {
        const users = await listUsers(this.data.userKeyword || undefined);
        this.setData({ users });
      } else if (this.data.tab === 'activity') {
        const activityTopics = await listActivityTopicsAdmin();
        this.setData({ activityTopics });
      } else if (this.data.tab === 'topic') {
        const topics = await listTopicsAdmin();
        this.setData({ topics });
      } else if (this.data.tab === 'tags') {
        const anonTags = await listAnonTagsAdmin(this.data.tagFilterCat || undefined);
        this.setData({ anonTags });
      } else if (this.data.tab === 'jobs') {
        const jobPosts = await listJobPostsAdmin();
        this.setData({ jobPosts });
      } else if (this.data.tab === 'comments') {
        void this.loadComments();
      } else {
        const stats = await getStats();
        this.setData({ stats });
      }
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: e.currentTarget.dataset.tab as Tab });
    this.load();
  },

  async approve(e: WechatMiniprogram.TouchEvent) {
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

  async reject(e: WechatMiniprogram.TouchEvent) {
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

  async batchApprove() {
    const pendingIds = this.data.queue?.merchants
      .filter((m) => m.status === 'PENDING')
      .map((m) => m.id) ?? [];
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

  async takedown(e: WechatMiniprogram.TouchEvent) {
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

  async takedownAnon(e: WechatMiniprogram.TouchEvent) {
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

  startEdit(e: WechatMiniprogram.TouchEvent) {
    const { dur, price } = e.currentTarget.dataset as { dur: string; price: string };
    this.setData({ editingDuration: dur, editingPrice: price });
  },

  onPriceInput(e: WechatMiniprogram.Input) {
    this.setData({ editingPrice: e.detail.value });
  },

  async savePrice() {
    if (!this.data.editingDuration || !this.data.editingPrice) return;
    await updatePricing({
      duration: this.data.editingDuration as 'D30' | 'D90',
      price: Number(this.data.editingPrice),
    });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ editingDuration: '', editingPrice: '' });
    this.load();
  },

  cancelEdit() {
    this.setData({ editingDuration: '', editingPrice: '' });
  },

  // 公告管理
  onAnnInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'annTitle' | 'annContent';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },

  async createAnn() {
    if (!this.data.annTitle.trim() || !this.data.annContent.trim()) {
      wx.showToast({ title: '请填标题和内容', icon: 'none' });
      return;
    }
    await createAnnouncement({ title: this.data.annTitle.trim(), content: this.data.annContent.trim() });
    wx.showToast({ title: '已发布', icon: 'success' });
    this.setData({ annTitle: '', annContent: '' });
    this.load();
  },

  async toggleAnn(e: WechatMiniprogram.TouchEvent) {
    const { id, active } = e.currentTarget.dataset as { id: string; active: boolean };
    await updateAnnouncement(id, { active: !active });
    this.load();
  },

  async deleteAnn(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '删除公告',
      content: '确定删除？',
      success: async (r) => {
        if (r.confirm) {
          await deleteAnnouncement(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        }
      },
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

  // ===== 工单 =====
  switchTicketStatus(e: WechatMiniprogram.TouchEvent) {
    this.setData({ ticketStatus: e.currentTarget.dataset.s as string });
    this.load();
  },
  replyTicketTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '回复工单',
      editable: true,
      placeholderText: '回复内容',
      confirmText: '回复并关闭',
      success: async (r) => {
        if (r.confirm && r.content?.trim()) {
          await replyTicket(id, r.content.trim(), true);
          wx.showToast({ title: '已回复并关闭', icon: 'success' });
          this.load();
        }
      },
    });
  },
  replyTicketKeepTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '回复并保留处理中',
      editable: true,
      placeholderText: '回复内容（工单保持处理中）',
      confirmText: '回复',
      success: async (r) => {
        if (r.confirm && r.content?.trim()) {
          await replyTicket(id, r.content.trim(), false);
          wx.showToast({ title: '已回复（处理中）', icon: 'success' });
          this.load();
        }
      },
    });
  },

  async reopenTicketTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    wx.showModal({
      title: '重开工单',
      content: '重开后回复内容将被清空，需重新回复。确定？',
      confirmColor: '#F9C801',
      success: async (r) => {
        if (r.confirm) {
          await reopenTicket(id);
          wx.showToast({ title: '已重开', icon: 'success' });
          this.load();
        }
      },
    });
  },

  // ===== 用户管理 =====
  onUserKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ userKeyword: e.detail.value });
  },
  searchUsers() {
    this.load();
  },
  banUserTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '封禁用户',
      content: '封禁后用户无法登录，确定？',
      confirmColor: '#E63946',
      success: async (r) => {
        if (r.confirm) {
          await banUser(id);
          wx.showToast({ title: '已封禁', icon: 'success' });
          this.load();
        }
      },
    });
  },
  muteUserTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const isMuted = !!(e.currentTarget.dataset.muted as string);
    if (isMuted) {
      muteUser(id, 0).then(() => {
        wx.showToast({ title: '已解除禁言', icon: 'success' });
        this.load();
      });
      return;
    }
    wx.showModal({
      title: '禁言',
      editable: true,
      placeholderText: '禁言天数（1-365）',
      success: async (r) => {
        if (r.confirm) {
          const days = Number(r.content) || 1;
          await muteUser(id, days);
          wx.showToast({ title: `已禁言 ${days} 天`, icon: 'success' });
          this.load();
        }
      },
    });
  },

  // ===== 活动专题 =====
  onActInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'actTitle' | 'actDesc';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },
  async createAct() {
    if (!this.data.actTitle.trim()) {
      wx.showToast({ title: '请填标题', icon: 'none' });
      return;
    }
    await createActivityTopic({ title: this.data.actTitle.trim(), description: this.data.actDesc.trim() || undefined, status: 'PUBLISHED' });
    wx.showToast({ title: '已创建', icon: 'success' });
    this.setData({ actTitle: '', actDesc: '' });
    this.load();
  },
  deleteAct(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '删除专题',
      content: '确定删除？关联帖关系会一并清除。',
      success: async (r) => {
        if (r.confirm) {
          await deleteActivityTopic(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        }
      },
    });
  },

  // ===== 话题 =====
  onTopicInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'topicName' | 'topicDesc';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },
  async createTopic() {
    if (!this.data.topicName.trim()) {
      wx.showToast({ title: '请填话题名', icon: 'none' });
      return;
    }
    await createTopic({ name: this.data.topicName.trim(), description: this.data.topicDesc.trim() || undefined, status: 'PUBLISHED' });
    wx.showToast({ title: '已创建', icon: 'success' });
    this.setData({ topicName: '', topicDesc: '' });
    this.load();
  },
  deleteTopic(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '删除话题',
      content: '确定删除？帖子关联会置空。',
      success: async (r) => {
        if (r.confirm) {
          await deleteTopic(id);
          wx.showToast({ title: '已删除', icon: 'success' });
          this.load();
        }
      },
    });
  },

  // ===== 树洞标签 =====
  onTagInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'tagName' | 'tagSort';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },
  pickTagCat(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tagCategory: e.currentTarget.dataset.c as string });
  },
  async createTag() {
    if (!this.data.tagName.trim()) {
      wx.showToast({ title: '请填标签名', icon: 'none' });
      return;
    }
    await createAnonTag({ name: this.data.tagName.trim(), category: this.data.tagCategory, sortOrder: Number(this.data.tagSort) || 0 });
    wx.showToast({ title: '已创建', icon: 'success' });
    this.setData({ tagName: '', tagSort: '' });
    this.load();
  },
  deleteTag(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '停用标签',
      content: '停用后标签将从用户画像消失，历史标签字符串保留但不再有效。确定？',
      success: async (r) => {
        if (r.confirm) {
          await deleteAnonTag(id);
          wx.showToast({ title: '已停用', icon: 'success' });
          this.load();
        }
      },
    });
  },
  async toggleTag(e: WechatMiniprogram.TouchEvent) {
    const { id, active } = e.currentTarget.dataset as { id: string; active: boolean };
    await updateAnonTag(id, { active: !active });
    wx.showToast({ title: !active ? '已启用' : '已停用', icon: 'success' });
    this.load();
  },

  // ===== 帖子置顶/加精（在审核队列 tab 操作）=====
  async togglePin(e: WechatMiniprogram.TouchEvent) {
    const { id, pinned } = e.currentTarget.dataset as { id: string; pinned: boolean };
    await pinPost(id, !pinned);
    wx.showToast({ title: !pinned ? '已置顶' : '已取消置顶', icon: 'success' });
    this.load();
  },
  async toggleFeature(e: WechatMiniprogram.TouchEvent) {
    const { id, featured } = e.currentTarget.dataset as { id: string; featured: boolean };
    await featurePost(id, !featured);
    wx.showToast({ title: !featured ? '已加精' : '已取消加精', icon: 'success' });
    this.load();
  },

  // ===== 岗位精品（jobs tab）=====
  async toggleJobFeature(e: WechatMiniprogram.TouchEvent) {
    const { id, featured } = e.currentTarget.dataset as { id: string; featured: boolean };
    await featureJob(id, !featured);
    wx.showToast({ title: !featured ? '已设精品' : '已取消精品', icon: 'success' });
    this.load();
  },

  // ===== C 帖子分页 =====
  async loadPosts(append = false) {
    const page = append ? this.data.postPage + 1 : 1;
    const r = await listPostsAdmin(page, 20, this.data.postKeyword || undefined, this.data.postStatus || undefined);
    const posts = append ? [...this.data.posts, ...r.list] : r.list;
    this.setData({ posts, postPage: page, postHasMore: posts.length < r.total });
  },
  loadMorePosts() {
    if (this.data.postHasMore) this.loadPosts(true);
  },
  switchPostStatus(e: WechatMiniprogram.TouchEvent) {
    this.setData({ postStatus: e.currentTarget.dataset.s as string });
    this.loadPosts(false);
  },
  onPostKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ postKeyword: e.detail.value });
  },
  searchPosts() {
    this.loadPosts(false);
  },
  async loadAnonPosts(append = false) {
    const page = append ? this.data.anonPostPage + 1 : 1;
    const r = await listAnonPostsAdmin(page, 20);
    const anonPosts = append ? [...this.data.anonPosts, ...r.list] : r.list;
    this.setData({ anonPosts, anonPostPage: page, anonPostHasMore: anonPosts.length < r.total });
  },
  loadMoreAnonPosts() {
    if (this.data.anonPostHasMore) this.loadAnonPosts(true);
  },

  // ===== F 评论管理 =====
  async loadComments(append = false) {
    const page = append ? this.data.commentPage + 1 : 1;
    const r = await listCommentsAdmin(this.data.commentPostId || undefined, page, 20, this.data.commentKeyword || undefined, this.data.commentAuthorId || undefined);
    const comments = append ? [...this.data.comments, ...r.list] : r.list;
    this.setData({ comments, commentPage: page, commentHasMore: comments.length < r.total });
  },
  loadMoreComments() {
    if (this.data.commentHasMore) this.loadComments(true);
  },
  onCommentKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ commentKeyword: e.detail.value });
  },
  onCommentAuthorIdInput(e: WechatMiniprogram.Input) {
    this.setData({ commentAuthorId: e.detail.value });
  },
  onCommentPostIdInput(e: WechatMiniprogram.Input) {
    this.setData({ commentPostId: e.detail.value });
  },
  searchComments() {
    this.setData({ comments: [], commentPage: 0 });
    this.loadComments(false);
  },
  async pinCommentTap(e: WechatMiniprogram.TouchEvent) {
    const { id, pinned } = e.currentTarget.dataset as { id: string; pinned: boolean };
    await pinComment(id, !pinned);
    wx.showToast({ title: !pinned ? '已置顶' : '已取消置顶', icon: 'success' });
    this.loadComments(false);
  },

  // ===== D 标签编辑/筛选 =====
  switchTagCat(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tagFilterCat: e.currentTarget.dataset.c as string });
    this.load();
  },
  startEditTag(e: WechatMiniprogram.TouchEvent) {
    const { id, name, sort } = e.currentTarget.dataset as { id: string; name: string; sort: number };
    this.setData({ editingTagId: id, editingTagName: name, editingTagSort: String(sort) });
  },
  onEditTagInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'editingTagName' | 'editingTagSort';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },
  async saveTag() {
    if (!this.data.editingTagName.trim()) {
      wx.showToast({ title: '请填标签名', icon: 'none' });
      return;
    }
    await updateAnonTag(this.data.editingTagId, { name: this.data.editingTagName.trim(), sortOrder: Number(this.data.editingTagSort) || 0 });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ editingTagId: '', editingTagName: '', editingTagSort: '' });
    this.load();
  },
  cancelEditTag() {
    this.setData({ editingTagId: '', editingTagName: '', editingTagSort: '' });
  },
});
