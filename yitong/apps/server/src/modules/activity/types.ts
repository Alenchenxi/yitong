// 活动模块 VO / 表单类型（specs/features/活动模块.md）

// 自定义报名表单字段（Activity.form Json 数组元素）；key 为稳定标识，产生报名后锁定结构
export interface ActivityFormField {
  key: string; // f_<cuid 短码>，创建时服务端生成
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'date' | 'phone' | 'wechat' | 'image';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // radio / checkbox 选项文案（存值即文案）
  order: number;
}

export type ActivityFormData = Record<string, string | string[]>;

export interface ActivityListVo {
  id: string;
  scope: 'PLATFORM' | 'COMMUNITY';
  communityId: string | null;
  communityName: string | null;
  title: string;
  coverImage: string;
  summary: string; // 简介（上新弹窗/列表卡片用，截断）
  format: 'OFFLINE' | 'ONLINE' | 'HYBRID';
  startTime: string | null;
  endTime: string | null;
  enrollEndAt: string | null;
  joinMode: 'DIRECT' | 'REVIEW';
  capacity: number | null;
  approvedCount: number;
  pendingCount: number;
  waitlistCount: number;
  status: string;
  publishedAt: string | null;
  myStatus: string | null; // 本人报名状态（含 interest 的 INTERESTED/NOT_INTERESTED 不在此列）
}

export interface ActivityDetailVo extends ActivityListVo {
  description: string;
  location: string | null;
  joinLink: string | null;
  infoVisibility: 'PUBLIC' | 'APPROVED_ONLY';
  // 敏感信息（地点/参与链接）仅正式参与人或管理者可见，其余为受限提示文案
  locationVisible: boolean;
  joinLinkVisible: boolean;
  enrollStartAt: string | null;
  form: ActivityFormField[];
  initiator: { id: string; nickname: string; avatarUrl: string | null };
  adminIds: string[];
  canManage: boolean; // 活动管理员或发起人
  isInitiator: boolean;
  myInterest: 'INTERESTED' | 'NOT_INTERESTED' | null;
  myEnrollment: {
    id: string;
    status: string;
    data: ActivityFormData | null; // 本人最新提交资料
    pendingReview: boolean; // 有待复审新资料
    revokedReason: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  chat: {
    canChat: boolean; // 正式参与人或管理者
    readonly: boolean;
    readonlyAt: string | null;
  };
  larkSync: { enabled: boolean } | null;
}

export interface ActivityEnrollmentVo {
  id: string;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string | null;
  wechat: string | null;
  status: string;
  data: ActivityFormData;
  pendingData: ActivityFormData | null; // 待复审新资料（复审队列展示）
  waitlistedAt: string | null;
  revokedReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 活动群聊 groupId 规则（复用 chat_messages.group_id，实名 uid 场景）
export function activityChatGroupId(activityId: string): string {
  return `activity-${activityId}`;
}
