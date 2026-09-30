export const ADMIN_PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  MERCHANT_REVIEW: 'merchant.review',
  CONTENT_MODERATE: 'content.moderate',
  REPORT_MANAGE: 'report.manage',
  USER_MANAGE: 'user.manage',
  TICKET_MANAGE: 'ticket.manage',
  GLOBAL_OPERATIONS: 'operations.global',
  BANNER_MANAGE: 'community.banner.manage',
  COMMUNITY_VIEW: 'community.view',
  COMMUNITY_EDIT: 'community.edit',
  COMMUNITY_REVIEW: 'community.review',
  ADMIN_MANAGE: 'admin.manage',
  ADMIN_TYPE_MANAGE: 'admin_type.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type AdminPermissionCode =
  (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

const COMMUNITY_VIEW_DEPENDENCIES = new Set<string>([
  ADMIN_PERMISSIONS.BANNER_MANAGE,
  ADMIN_PERMISSIONS.COMMUNITY_EDIT,
  ADMIN_PERMISSIONS.COMMUNITY_REVIEW,
]);

export function normalizeAdminPermissionCodes(permissionCodes: readonly string[]) {
  const normalized = new Set(permissionCodes.filter(Boolean));
  if ([...normalized].some((code) => COMMUNITY_VIEW_DEPENDENCIES.has(code))) {
    normalized.add(ADMIN_PERMISSIONS.COMMUNITY_VIEW);
  }
  return [...normalized];
}

export const ADMIN_PERMISSION_CATALOG: Array<{
  code: AdminPermissionCode;
  module: string;
  name: string;
  description: string;
  sortOrder: number;
}> = [
  { code: ADMIN_PERMISSIONS.DASHBOARD_VIEW, module: '看板', name: '查看看板', description: '查看平台全局统计', sortOrder: 10 },
  { code: ADMIN_PERMISSIONS.MERCHANT_REVIEW, module: '审核', name: '商家审核', description: '审核商家入驻', sortOrder: 20 },
  { code: ADMIN_PERMISSIONS.CONTENT_MODERATE, module: '审核', name: '圈内内容管理', description: '管理授权圈子内表白墙、树洞和岗位内容', sortOrder: 30 },
  { code: ADMIN_PERMISSIONS.REPORT_MANAGE, module: '审核', name: '举报处理', description: '处理平台举报', sortOrder: 40 },
  { code: ADMIN_PERMISSIONS.GLOBAL_OPERATIONS, module: '运营', name: '全局运营', description: '管理公告、专题、标签、价格和系统设置', sortOrder: 50 },
  { code: ADMIN_PERMISSIONS.BANNER_MANAGE, module: '圈子', name: '圈子广告位', description: '管理授权圈子的广告位', sortOrder: 60 },
  { code: ADMIN_PERMISSIONS.COMMUNITY_VIEW, module: '圈子', name: '查看圈子', description: '查看授权圈子的资料和状态', sortOrder: 70 },
  { code: ADMIN_PERMISSIONS.COMMUNITY_EDIT, module: '圈子', name: '维护圈子', description: '修改授权圈子的名称、图片、简介及启停状态', sortOrder: 80 },
  { code: ADMIN_PERMISSIONS.COMMUNITY_REVIEW, module: '圈子', name: '圈子审核', description: '审核授权范围内的新建圈子', sortOrder: 90 },
  { code: ADMIN_PERMISSIONS.USER_MANAGE, module: '用户', name: '用户管理', description: '封禁和禁言用户', sortOrder: 100 },
  { code: ADMIN_PERMISSIONS.TICKET_MANAGE, module: '用户', name: '工单处理', description: '回复和重开用户工单', sortOrder: 110 },
  { code: ADMIN_PERMISSIONS.ADMIN_MANAGE, module: '权限', name: '管理员管理', description: '新增、调整和删除管理员', sortOrder: 120 },
  { code: ADMIN_PERMISSIONS.ADMIN_TYPE_MANAGE, module: '权限', name: '管理员类型管理', description: '新增、修改和删除管理员类型', sortOrder: 130 },
  { code: ADMIN_PERMISSIONS.AUDIT_VIEW, module: '权限', name: '操作记录', description: '查看管理员操作记录', sortOrder: 140 },
];

export const COMMUNITY_ADMIN_DEFAULT_PERMISSIONS: AdminPermissionCode[] = [
  ADMIN_PERMISSIONS.CONTENT_MODERATE,
  ADMIN_PERMISSIONS.BANNER_MANAGE,
  ADMIN_PERMISSIONS.COMMUNITY_VIEW,
  ADMIN_PERMISSIONS.COMMUNITY_EDIT,
  ADMIN_PERMISSIONS.COMMUNITY_REVIEW,
  ADMIN_PERMISSIONS.AUDIT_VIEW,
];
