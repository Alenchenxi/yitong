import { request } from './request';

export interface AdminQueueVo {
  merchants: Array<{
    id: string;
    shopName: string;
    licenseNo: string;
    contactPhone: string;
    status: string;
    userId: string;
    userNickname: string;
    createdAt: string;
  }>;
  reports: Array<{
    id: string;
    targetType: string;
    targetId: string;
    reason: string | null;
    createdAt: string;
  }>;
}

export interface PricingVo {
  duration: 'D30' | 'D90';
  price: string;
  updatedAt: string;
}

export function getQueue() {
  return request<AdminQueueVo>({ url: '/admin/queue' });
}
export function approveMerchant(id: string, reason?: string) {
  return request({ url: `/admin/merchants/${id}/approve`, method: 'POST', data: { reason } });
}
export function rejectMerchant(id: string, reason?: string) {
  return request({ url: `/admin/merchants/${id}/reject`, method: 'POST', data: { reason } });
}
export function batchMerchants(ids: string[], action: 'approve' | 'reject', reason?: string) {
  return request({ url: '/admin/merchants/batch', method: 'POST', data: { ids, action, reason } });
}
export function takedownPost(id: string, reason?: string) {
  return request({ url: `/admin/posts/${id}/takedown`, method: 'POST', data: { reason } });
}
export function takedownAnonPost(id: string, reason?: string) {
  return request({ url: `/admin/anon-posts/${id}/takedown`, method: 'POST', data: { reason } });
}
export function getPricing() {
  return request<PricingVo[]>({ url: '/admin/pricing' });
}

export interface DashboardStats {
  overview: {
    totalUsers: number;
    totalMerchants: number;
    totalPosts: number;
    totalAnonPosts: number;
    totalJobPosts: number;
    publishedJobPosts: number;
    totalApplications: number;
    totalReviews: number;
  };
  today: {
    newPosts: number;
    newAnonPosts: number;
    newApplications: number;
    newUsers: number;
  };
  trend: Array<{ date: string; posts: number; applications: number; newUsers: number }>;
}

export function getStats() {
  return request<DashboardStats>({ url: '/admin/stats' });
}
export function updatePricing(data: { duration: 'D30' | 'D90'; price: number }) {
  return request({ url: '/admin/pricing', method: 'PUT', data });
}

// ===== P1-28 举报处理 =====
export interface AdminReportVo {
  id: string;
  targetType: string;
  targetId: string;
  targetSummary: string;
  reason: string | null;
  status: string;
  result: string | null;
  reporterId: string | null;
  reporterNickname: string;
  reviewerId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
export function listReports(status?: string, page = 1, pageSize = 20) {
  const qs = `?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ''}`;
  return request<{ list: AdminReportVo[]; total: number; page: number; pageSize: number }>({ url: `/admin/reports${qs}` });
}
export function resolveReport(id: string, action: 'approve' | 'reject', result?: string, takedown?: boolean) {
  return request({ url: `/admin/reports/${id}/resolve`, method: 'POST', data: { action, result, takedown } });
}

// ===== P2-05 置顶/加精 + P2-15 兼职精品 =====
export function pinPost(id: string, pinned: boolean) {
  return request({ url: `/admin/posts/${id}/pin`, method: 'POST', data: { pinned } });
}
export function featurePost(id: string, featured: boolean) {
  return request({ url: `/admin/posts/${id}/feature`, method: 'POST', data: { featured } });
}
export function featureJob(id: string, featured: boolean) {
  return request({ url: `/admin/job-posts/${id}/feature`, method: 'POST', data: { featured } });
}
// R4 岗位下架（管理员主动处置，不依赖举报）
export function takedownJobPost(id: string, reason?: string) {
  return request({ url: `/admin/job-posts/${id}/takedown`, method: 'POST', data: { reason } });
}

// ===== C 帖子分页管理（getQueue 精简后独立分页接口）=====
export interface AdminPostVo {
  id: string;
  content: string;
  status: string;
  authorNickname: string;
  circleName: string;
  pinned: boolean;
  featured: boolean;
  createdAt: string;
}
export interface AdminAnonPostVo {
  id: string;
  content: string;
  anonId: string;
  status: string;
  createdAt: string;
}
export function listPostsAdmin(page = 1, pageSize = 20, keyword?: string, status?: string) {
  const qs = `?page=${page}&pageSize=${pageSize}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}${status ? `&status=${status}` : ''}`;
  return request<{ list: AdminPostVo[]; total: number; page: number; pageSize: number }>({ url: `/admin/posts${qs}` });
}
export function listAnonPostsAdmin(page = 1, pageSize = 20) {
  const qs = `?page=${page}&pageSize=${pageSize}`;
  return request<{ list: AdminAnonPostVo[]; total: number; page: number; pageSize: number }>({ url: `/admin/anon-posts${qs}` });
}

// ===== F 评论管理（人工置顶）=====
export interface AdminCommentVo {
  id: string;
  content: string;
  postId: string;
  postTitle: string;
  likeCount: number;
  pinned: boolean;
  createdAt: string;
}
export function listCommentsAdmin(
  postId?: string,
  page = 1,
  pageSize = 20,
  keyword?: string,
  authorId?: string,
  authorNickname?: string,
  postTitleKw?: string,
) {
  const qs = `?page=${page}&pageSize=${pageSize}${postId ? `&postId=${encodeURIComponent(postId)}` : ''}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}${authorId ? `&authorId=${encodeURIComponent(authorId)}` : ''}${authorNickname ? `&authorNickname=${encodeURIComponent(authorNickname)}` : ''}${postTitleKw ? `&postTitleKw=${encodeURIComponent(postTitleKw)}` : ''}`;
  return request<{ list: AdminCommentVo[]; total: number; page: number; pageSize: number }>({ url: `/admin/comments${qs}` });
}
export function pinComment(id: string, pinned: boolean) {
  return request({ url: `/admin/comments/${id}/pin`, method: 'POST', data: { pinned } });
}

// ===== P2-03 活动专题 =====
export interface ActivityTopicVo {
  id: string;
  title: string;
  coverUrl: string | null;
  description: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
}
export function listActivityTopicsAdmin() {
  return request<ActivityTopicVo[]>({ url: '/admin/activity-topics' });
}
export function createActivityTopic(data: { title: string; coverUrl?: string; description?: string; status?: string; sortOrder?: number }) {
  return request({ url: '/admin/activity-topics', method: 'POST', data });
}
export function deleteActivityTopic(id: string) {
  return request({ url: `/admin/activity-topics/${id}`, method: 'DELETE' });
}

// ===== P2-04 话题 =====
export interface TopicVo {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
}
export function listTopicsAdmin() {
  return request<TopicVo[]>({ url: '/admin/topics' });
}
export function createTopic(data: { name: string; description?: string; coverUrl?: string; status?: string; sortOrder?: number }) {
  return request({ url: '/admin/topics', method: 'POST', data });
}
export function deleteTopic(id: string) {
  return request({ url: `/admin/topics/${id}`, method: 'DELETE' });
}

// ===== P2-20 工单 =====
export interface AdminTicketVo {
  id: string;
  userId: string;
  userNickname: string;
  role: string;
  title: string;
  content: string;
  status: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}
export function listTickets(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return request<AdminTicketVo[]>({ url: `/admin/tickets${qs}` });
}
export function replyTicket(id: string, reply: string, close: boolean) {
  return request({ url: `/admin/tickets/${id}/reply`, method: 'POST', data: { reply, close } });
}
export function reopenTicket(id: string) {
  return request({ url: `/admin/tickets/${id}/reopen`, method: 'POST' });
}

// ===== P1-13 树洞标签 =====
export interface AnonTagVo {
  id: string;
  name: string;
  category: string;
  sortOrder: number;
  active: boolean;
}
export function listAnonTagsAdmin(category?: string) {
  const qs = category ? `?category=${category}` : '';
  return request<AnonTagVo[]>({ url: `/admin/anon-tags${qs}` });
}
export function createAnonTag(data: { name: string; category: string; sortOrder?: number; active?: boolean }) {
  return request({ url: '/admin/anon-tags', method: 'POST', data });
}
export function deleteAnonTag(id: string) {
  return request({ url: `/admin/anon-tags/${id}`, method: 'DELETE' });
}
export function updateAnonTag(id: string, data: { name?: string; sortOrder?: number; active?: boolean }) {
  return request({ url: `/admin/anon-tags/${id}`, method: 'PUT', data });
}

// ===== 兼职岗位列表（admin，精品管理）=====
export interface AdminJobPostVo {
  id: string;
  title: string;
  status: string;
  urgent: boolean;
  featured: boolean;
  merchantShopName: string;
  createdAt: string;
}
export function listJobPostsAdmin(limit = 50) {
  return request<AdminJobPostVo[]>({ url: `/admin/job-posts?limit=${limit}` });
}

// ===== 用户管理 =====
export interface AdminUserVo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  banned: boolean;
  mutedUntil: string | null;
  createdAt: string;
}
export function listUsers(keyword?: string) {
  const qs = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return request<AdminUserVo[]>({ url: `/admin/users${qs}` });
}
export function banUser(id: string) {
  return request({ url: `/admin/users/${id}/ban`, method: 'POST' });
}
export function muteUser(id: string, days: number) {
  return request({ url: `/admin/users/${id}/mute`, method: 'POST', data: { days } });
}

// ===== P2-30 管理员自助管理 =====
// 列表里的"管理员账号" Vo；区别于上方的 AdminUserVo（那是用户封禁业务的 User）
export interface ManagerVo {
  id: string;
  username: string;
  openid: string | null;
  createdAt: string;
  linkedUser: { id: string; nickname: string; avatarUrl: string | null } | null;
  isSelf: boolean;
}
// 搜索候选 User（添加弹窗用）：昵称模糊 + 排除已是 admin + 排除封禁
export interface CandidateUserVo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}
export function listAdmins(keyword?: string) {
  const qs = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return request<ManagerVo[]>({ url: `/admin/admins${qs}` });
}
export function searchCandidateUsers(keyword: string) {
  return request<CandidateUserVo[]>({ url: `/admin/users/search?keyword=${encodeURIComponent(keyword)}` });
}
export function createAdmin(userId: string) {
  return request<ManagerVo>({ url: '/admin/admins', method: 'POST', data: { userId } });
}
export function deleteAdmin(id: string) {
  return request<{ id: string; deleted: boolean }>({ url: `/admin/admins/${id}`, method: 'DELETE' });
}
