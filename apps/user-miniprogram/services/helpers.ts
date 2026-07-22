// P2-18 电话联系保护：列表/卡片展示脱敏（138****5678），详情（用户本人/录用商家）看完整
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone.length < 7) return phone || '';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

// P2-23 运营位配置：聚合运营位状态（已通过独立端点提供：公告/今日上头/精品岗位/活动专题/校园话题）
export interface OpsSpots {
  announcements: boolean; // GET /announcements
  todayHit: boolean; // GET /posts/today-hit
  featuredJobs: boolean; // GET /job-posts/featured
  activityTopics: boolean; // GET /activity-topics
  topics: boolean; // GET /topics
  groups: boolean; // GET /treehole/groups
  hotKeywords: boolean; // GET /search/hot
  salaryGuarantee: boolean; // GET /support/salary-guarantee
}
