import { request } from './request';

// P0-17 岗位分类 / 结算方式（与后端枚举对齐）
export type JobCategory =
  | 'CATERING'
  | 'RETAIL'
  | 'PROMOTION'
  | 'EXHIBITION'
  | 'TUTORING'
  | 'CAMPUS_AGENT'
  | 'ONLINE'
  | 'SURVEY'
  | 'INTERNSHIP'
  | 'LONG_TERM';
export type Settlement = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'COMPLETION';

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  CATERING: '餐饮',
  RETAIL: '零售',
  PROMOTION: '促销',
  EXHIBITION: '展会',
  TUTORING: '家教',
  CAMPUS_AGENT: '校园代理',
  ONLINE: '线上兼职',
  SURVEY: '问卷/调研',
  INTERNSHIP: '实习',
  LONG_TERM: '长期兼职',
};
export const SETTLEMENT_LABELS: Record<Settlement, string> = {
  DAILY: '日结',
  WEEKLY: '周结',
  MONTHLY: '月结',
  COMPLETION: '完工结',
};

export interface JobPostVo {
  id: string;
  merchantId: string;
  merchantShopName: string;
  title: string;
  description: string;
  requirements: string | null; // P0-19 任职要求
  salary: string;
  salaryAmount: number | null; // P0-18 薪资数额（auto-parse，范围筛选用）
  location: string;
  category: JobCategory | null; // P0-17 分类
  settlement: Settlement | null; // P0-17 结算方式
  workDates: string[]; // P0-17 工作日期
  workPeriods: string[]; // P0-17 工作时段
  headcount: number; // P0-17 招聘人数
  urgent: boolean; // P0-17 急招
  online: boolean; // P0-17 是否可线上
  questions: string[]; // P0-21 报名问题
  duration: 'D30' | 'D90';
  expireAt: string;
  status: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED';
  createdAt: string;
  // M3-06 仅 mine=1 列表返回：当前岗的 PENDING 报名数
  pendingApplicationCount?: number;
  // M3-05 主动下架时间（null=未下架）
  takenDownAt?: string | null;
  // M3-04 编辑返回扩展：编辑前状态、是否需要重新发布
  editedFromStatus?: string;
  needsRepublish?: boolean;
  // 用户端"最近"tab：距离（km，仅 sort=nearest 时返回）
  distance?: number;
}

export interface JobListResult {
  list: JobPostVo[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface JobAppVo {
  id: string;
  jobPostId: string;
  jobPostTitle: string;
  userId: string;
  userNickname: string;
  resumeId: string | null; // P0-21 报名所附简历
  answers: Array<{ question: string; answer: string }> | null; // P0-21 报名问题回答
  resume: { name: string; phone: string; selfIntro: string | null; skills: string[] } | null; // P0-21 简历快照（商家查看）
  status: 'PENDING' | 'ACCEPTED' | 'DONE' | 'CANCELLED' | 'REJECTED';
  createdAt: string;
}

// P0-21 简历（一人一份）
export interface ResumeVo {
  id: string;
  name: string;
  phone: string;
  selfIntro: string | null;
  skills: string[];
  availabilities: string[];
  experience: string | null;
  completeness: number; // P1-21 完整度 0-100
  missingFields: string[]; // P1-21 缺失字段中文标签
  updatedAt: string;
}

// P1-22 简历投递记录
export interface ResumeApplicationVo {
  id: string;
  jobPostId: string;
  jobPostTitle: string;
  merchantShopName: string;
  status: 'PENDING' | 'ACCEPTED' | 'DONE' | 'CANCELLED' | 'REJECTED';
  hasResume: boolean;
  createdAt: string;
}

export interface JobReviewVo {
  id: string;
  applicationId: string;
  reviewerId: string;
  direction: 'stu_to_merchant' | 'merchant_to_stu'; // P1-26
  rating: number;
  content: string;
  createdAt: string;
}

export function createJobPost(data: {
  title: string;
  description: string;
  requirements?: string; // P0-19 任职要求
  salary: string;
  location: string;
  category: JobCategory;
  settlement: Settlement;
  workDates?: string[];
  workPeriods?: string[];
  headcount?: number;
  urgent?: boolean;
  online?: boolean;
  questions?: string[]; // P0-21 报名问题
  duration: 'D30' | 'D90';
  // 智能生成流程(2026-08-10):百度地图结构化字段;后端 createPost 强制必填
  locationPoiId?: string;
  locationLng?: number;
  locationLat?: number;
  locationCity?: string;
}) {
  return request<JobPostVoExt>({ url: '/job-posts', method: 'POST', data });
}

export interface JobListFilter {
  cursor?: string;
  mine?: boolean;
  urgent?: boolean;
  keyword?: string; // P0-18 关键词
  category?: JobCategory; // P0-18 分类
  settlement?: Settlement; // P0-18 结算方式
  location?: string; // P0-18 工作地点
  salaryMin?: number; // P0-18 薪资下限
  salaryMax?: number; // P0-18 薪资上限
  online?: boolean; // P0-18 仅看线上
  status?: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED'; // M3-03 商家岗位状态筛选
  // 用户端"最近"tab
  sort?: 'nearest';
  userLng?: number;
  userLat?: number;
}

export function listJobPosts(filter: JobListFilter = {}) {
  const params: string[] = [];
  if (filter.mine) params.push('mine=1');
  if (filter.urgent) params.push('urgent=1');
  if (filter.online) params.push('online=1');
  if (filter.keyword) params.push(`keyword=${encodeURIComponent(filter.keyword)}`);
  if (filter.category) params.push(`category=${filter.category}`);
  if (filter.settlement) params.push(`settlement=${filter.settlement}`);
  if (filter.location) params.push(`location=${encodeURIComponent(filter.location)}`);
  if (filter.salaryMin !== undefined) params.push(`salaryMin=${filter.salaryMin}`);
  if (filter.salaryMax !== undefined) params.push(`salaryMax=${filter.salaryMax}`);
  if (filter.status) params.push(`status=${filter.status}`);
  if (filter.sort) params.push(`sort=${filter.sort}`);
  if (filter.userLng !== undefined) params.push(`userLng=${filter.userLng}`);
  if (filter.userLat !== undefined) params.push(`userLat=${filter.userLat}`);
  params.push('limit=20');
  if (filter.cursor) params.push(`cursor=${encodeURIComponent(filter.cursor)}`);
  return request<JobListResult>({ url: `/job-posts?${params.join('&')}` });
}

export function recommendJobs() {
  return request<JobPostVo[]>({ url: '/job-posts/recommend' });
}

export function getJobPost(id: string) {
  return request<JobPostVo>({ url: `/job-posts/${id}` });
}

// M3-04 编辑岗位（所有字段 optional，duration 不可改）
export function updateJobPost(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    requirements: string;
    salary: string;
    location: string;
    category: JobCategory;
    settlement: Settlement;
    workDates: string[];
    workPeriods: string[];
    headcount: number;
    urgent: boolean;
    online: boolean;
    questions: string[];
  }>,
) {
  return request<JobPostVo>({ url: `/job-posts/${id}`, method: 'PUT', data });
}

// M3-05 主动下架岗位（仅 PUBLISHED 可下架）
export function takeDownJobPost(id: string) {
  return request<JobPostVo>({ url: `/job-posts/${id}/take-down`, method: 'POST' });
}

// M3-07 商家硬删草稿（仅 PENDING 状态可删；非 PENDING 请走 takeDownJobPost）
export function deleteJobPost(id: string) {
  return request<{ deleted: boolean }>({ url: `/job-posts/${id}`, method: 'DELETE' });
}

// M3-07 单岗位数据（曝光/报名/转化率 + 时间范围），商家仅查自己岗位
export interface PostStatsVo {
  exposureCount: number;
  applicationCount: number;
  conversionRate: number; // 0-100
  range: DashboardRange;
}
export function getJobPostStats(id: string, range: DashboardRange = 'month') {
  return request<PostStatsVo>({ url: `/job-posts/${id}/stats?range=${range}` });
}

// M3-07 详情页 chip 文案：第一 chip 固定「兼职」（纯展示，不绑字段）；第二 chip 走结算方式映射
export interface PostChipLabels {
  first: string; // 「兼职」
  second: string; // SETTLEMENT_LABELS[post.settlement] | 「完工结算」
}
export function getPostChipLabels(post: JobPostVo): PostChipLabels {
  // 决策 A：first 纯展示写死「兼职」；second 优先展示「完工结算」否则用枚举映射
  const first = '兼职';
  let second = '可商议';
  if (post.settlement) {
    second = post.settlement === 'COMPLETION' ? '完工结算' : SETTLEMENT_LABELS[post.settlement];
  }
  return { first, second };
}

export function applyJob(postId: string, data: { resumeId?: string; answers?: string[] } = {}) {
  return request<JobAppVo>({ url: `/job-posts/${postId}/applications`, method: 'POST', data });
}

// P0-21 简历
export function getMyResume() {
  return request<ResumeVo | null>({ url: '/resume' });
}

export function upsertResume(data: {
  name: string;
  phone: string;
  selfIntro?: string;
  skills?: string[];
  availabilities?: string[];
  experience?: string;
}) {
  return request<ResumeVo>({ url: '/resume', method: 'PUT', data });
}

// P1-22 简历投递记录
export function listResumeApplications() {
  return request<ResumeApplicationVo[]>({ url: '/resume/applications' });
}

// P0-19 举报岗位
export function reportJob(postId: string, reason?: string) {
  return request<{ reported: boolean }>({ url: `/job-posts/${postId}/report`, method: 'POST', data: { reason } });
}

// P1-27 举报商家
export function reportMerchant(merchantId: string, reason?: string) {
  return request<{ reported: boolean }>({ url: `/merchants/${merchantId}/report`, method: 'POST', data: { reason } });
}

// P1-27 报名投诉（学生本人或岗位所属商家）
export function reportApplication(appId: string, reason?: string) {
  return request<{ reported: boolean }>({ url: `/applications/${appId}/report`, method: 'POST', data: { reason } });
}

export function listPostApplications(postId: string) {
  return request<JobAppVo[]>({ url: `/job-posts/${postId}/applications` });
}

export function listPostReviews(postId: string) {
  return request<JobReviewVo[]>({ url: `/job-posts/${postId}/reviews` });
}

export function listMyApplications() {
  return request<JobAppVo[]>({ url: '/applications/me' });
}

export function transitionApp(appId: string, action: 'accept' | 'complete' | 'reject') {
  return request<JobAppVo>({ url: `/applications/${appId}/transition`, method: 'POST', data: { action } });
}

// P1-23 学生取消报名（仅 PENDING 状态可取消）
export function cancelApp(appId: string) {
  return request<JobAppVo>({ url: `/applications/${appId}/cancel`, method: 'POST' });
}

// P0-23 批量录用/拒绝
export function batchTransitionApps(postId: string, ids: string[], action: 'accept' | 'reject') {
  return request<{ processed: Array<{ id: string; ok: boolean; status?: string; error?: string }> }>({
    url: `/job-posts/${postId}/applications/batch`,
    method: 'POST',
    data: { ids, action },
  });
}

export function reviewApp(appId: string, data: { rating: number; content: string }) {
  return request<JobReviewVo>({ url: `/applications/${appId}/review`, method: 'POST', data });
}

// P1-26 商家评价学生（仅商家拥有岗位，application DONE + 未评过）
export function merchantReviewApp(appId: string, data: { rating: number; content: string }) {
  return request<JobReviewVo>({ url: `/applications/${appId}/merchant-review`, method: 'POST', data });
}

// P2-16 商家招聘数据看板（时间范围筛选）
export type DashboardRange = 'day' | 'week' | 'month' | 'all';

export interface MerchantDashboardVo {
  viewCount: number;
  applicationCount: number;
  pendingCount: number;
  acceptedCount: number;
  completedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  conversionRate: number;
  range: DashboardRange;
}

export function getMerchantDashboard(range: DashboardRange = 'all') {
  return request<MerchantDashboardVo>({ url: `/merchant/dashboard?range=${range}` });
}

// ===== 智能生成流程(2026-08-10)=====

export interface JobPostVoExt extends JobPostVo {
  locationPoiId: string | null;
  locationLng: number | null;
  locationLat: number | null;
  locationCity: string | null;
}

export interface JobCategoryGridItem {
  key: string;
  label: string;
  icon: string;
  mapTo: string | null;
}

// 类别网格(GET /job-categories)
export function getJobCategories() {
  return request<{ items: JobCategoryGridItem[] }>({ url: '/job-categories' });
}

export interface AttractivenessVo {
  score: number;
  percentile: number;
  label: string;
}

export interface JobTemplateVo {
  title: string;
  description: string;
  salary: string;
  settlementHint: string;
  categoryMapTo: string | null;
  attractiveness: AttractivenessVo;
  refreshCount: number;
  nextSeed: number;
}

// 智能生成(GET /job-posts/template)
export function getJobTemplate(params: {
  key: string;
  location?: string;
  headcount?: number;
  salaryType?: 'fixed' | 'range';
  salaryAmount?: number;
  seed?: number;
}) {
  const q: string[] = [`key=${encodeURIComponent(params.key)}`];
  if (params.location) q.push(`location=${encodeURIComponent(params.location)}`);
  if (params.headcount !== undefined) q.push(`headcount=${params.headcount}`);
  if (params.salaryType) q.push(`salaryType=${params.salaryType}`);
  if (params.salaryAmount !== undefined) q.push(`salaryAmount=${params.salaryAmount}`);
  if (params.seed !== undefined) q.push(`seed=${params.seed}`);
  return request<JobTemplateVo>({ url: `/job-posts/template?${q.join('&')}` });
}

export interface PoiInfoVo {
  poiId: string;
  address: string;
  lng: number;
  lat: number;
  city: string;
}

// 百度地图正向地理编码(GET /job-posts/geocode)
export function geocode(address: string) {
  return request<PoiInfoVo>({ url: `/job-posts/geocode?address=${encodeURIComponent(address)}` });
}

// poiId 反查(GET /job-posts/poi-detail)
export function getPoiDetail(poiId: string) {
  return request<PoiInfoVo>({ url: `/job-posts/poi-detail?poiId=${encodeURIComponent(poiId)}` });
}

// ===== M3-08 曝光 + 重新发布 =====

// M3-08 曝光上报：前端 onShow 批量上报当前可见岗位 ID，后端按 (postId, userId, hourBucket) 去重
export function recordJobImpressions(postIds: string[]) {
  return request<{ recorded: number }>({ url: '/job-posts/impressions', method: 'POST', data: { postIds } });
}

// M3-08 重新发布：PUBLISHED/TAKEN_DOWN/EXPIRED → PENDING（强制重付）
export function republishJobPost(id: string) {
  return request<{ id: string; status: 'PENDING'; duration: 'D30' | 'D90' }>({ url: `/job-posts/${id}/republish`, method: 'POST' });
}
