import { request } from './request';

// 活动模块 API（specs/features/活动模块.md）

export interface ActivityFormField {
  key: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'date' | 'phone' | 'wechat' | 'image';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
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
  summary: string;
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
  myStatus: string | null;
}

export interface ActivityDetailVo extends ActivityListVo {
  description: string;
  location: string | null;
  joinLink: string | null;
  infoVisibility: 'PUBLIC' | 'APPROVED_ONLY';
  locationVisible: boolean;
  joinLinkVisible: boolean;
  enrollStartAt: string | null;
  form: ActivityFormField[];
  initiator: { id: string; nickname: string; avatarUrl: string | null };
  adminIds: string[];
  canManage: boolean;
  isInitiator: boolean;
  myInterest: 'INTERESTED' | 'NOT_INTERESTED' | null;
  myEnrollment: {
    id: string;
    status: string;
    data: ActivityFormData | null;
    pendingReview: boolean;
    revokedReason: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  chat: { canChat: boolean; readonly: boolean; readonlyAt: string | null };
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
  pendingData: ActivityFormData | null;
  waitlistedAt: string | null;
  revokedReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// type 而非 interface：对象字面量类型才有隐式索引签名，可直接作为 request body
export type SaveActivityPayload = {
  title: string;
  coverImage: string;
  description: string;
  format: 'OFFLINE' | 'ONLINE' | 'HYBRID';
  location?: string;
  joinLink?: string;
  infoVisibility?: 'PUBLIC' | 'APPROVED_ONLY';
  startTime?: string;
  endTime?: string;
  enrollStartAt?: string;
  enrollEndAt?: string;
  joinMode: 'DIRECT' | 'REVIEW';
  capacity?: number;
  form?: ActivityFormField[];
};

export interface LarkConnectionVo {
  id: string;
  name: string;
  appId: string;
  appSecretMasked: string;
  createdAt: string;
}

export function listActivities(status?: string, limit = 50): Promise<{ list: ActivityListVo[] }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : `?limit=${limit}`;
  return request<{ list: ActivityListVo[] }>({ url: `/activities${q}` });
}

export function newArrivals(): Promise<{ list: ActivityListVo[] }> {
  return request<{ list: ActivityListVo[] }>({ url: '/activities/new-arrivals' });
}

export function myActivities(tab: string): Promise<{ list: ActivityListVo[] }> {
  return request<{ list: ActivityListVo[] }>({ url: `/activities/mine?tab=${tab}` });
}

export function activityDetail(id: string): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}` });
}

export function createActivity(payload: SaveActivityPayload & { communityId?: string; publish?: boolean }): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: '/activities', method: 'POST', data: payload });
}

export function updateActivity(id: string, payload: SaveActivityPayload): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}`, method: 'PUT', data: payload });
}

export function publishActivity(id: string): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/publish`, method: 'POST' });
}

export function cancelActivity(id: string): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/cancel`, method: 'POST' });
}

export function delistActivity(id: string): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/delist`, method: 'POST' });
}

export function finishActivity(id: string): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/finish`, method: 'POST' });
}

export function transferInitiator(id: string, targetUserId: string): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/transfer`, method: 'POST', data: { targetUserId } });
}

export function setActivityAdmins(id: string, add: string[], remove: string[]): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/admins`, method: 'POST', data: { add, remove } });
}

export function setLarkConfig(id: string, data: { connectionId: string; bitableApp: string; bitableTable: string }): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/lark-config`, method: 'POST', data });
}

export function enrollActivity(id: string, data: ActivityFormData): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/enrollments`, method: 'POST', data: { data } });
}

export function updateMyEnrollment(id: string, data: ActivityFormData): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/enrollments`, method: 'PUT', data: { data } });
}

export function cancelMyEnrollment(id: string): Promise<ActivityDetailVo> {
  return request<ActivityDetailVo>({ url: `/activities/${id}/enrollments/cancel`, method: 'POST' });
}

export function listEnrollments(id: string, status: string, page = 1): Promise<{ list: ActivityEnrollmentVo[]; total: number }> {
  return request<{ list: ActivityEnrollmentVo[]; total: number }>({
    url: `/activities/${id}/enrollments?status=${status}&page=${page}`,
  });
}

export function approveEnrollment(id: string, eid: string): Promise<unknown> {
  return request({ url: `/activities/${id}/enrollments/${eid}/approve`, method: 'POST' });
}

export function rejectEnrollment(id: string, eid: string, reason?: string): Promise<unknown> {
  return request({ url: `/activities/${id}/enrollments/${eid}/reject`, method: 'POST', data: { reason } });
}

export function revokeEnrollment(id: string, eid: string, reason: string): Promise<unknown> {
  return request({ url: `/activities/${id}/enrollments/${eid}/revoke`, method: 'POST', data: { reason } });
}

export function setInterest(id: string, state: 'INTERESTED' | 'NOT_INTERESTED' | ''): Promise<unknown> {
  return request({ url: `/activities/${id}/interest`, method: 'POST', data: { state } });
}

export function remindActivity(id: string, targetUserIds?: string[]): Promise<{ total: number; skipped: number }> {
  return request<{ total: number; skipped: number }>({
    url: `/activities/${id}/remind`,
    method: 'POST',
    data: targetUserIds?.length ? { targetUserIds } : {},
  });
}

export function listReminders(id: string, page = 1): Promise<{ list: Array<{ id: string; kind: string; userNickname: string; sentByNickname: string | null; result: string; createdAt: string }>; total: number }> {
  return request({ url: `/activities/${id}/reminders?page=${page}` });
}

export function sendChatMessage(id: string, content: string): Promise<{ id: string; createdAt: string }> {
  return request({ url: `/activities/${id}/chat/messages`, method: 'POST', data: { content } });
}

export function listChatMessages(id: string, cursor?: string): Promise<{
  list: Array<{ id: string; fromId: string; content: string; type: string; nickname: string; avatarUrl: string | null; createdAt: string }>;
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return request({ url: `/activities/${id}/chat/messages${q}` });
}

export function listLarkConnections(): Promise<LarkConnectionVo[]> {
  return request({ url: '/lark-connections' });
}

export function createLarkConnection(data: { name: string; appId: string; appSecret: string }): Promise<{ id: string }> {
  return request({ url: '/lark-connections', method: 'POST', data });
}

export function deleteLarkConnection(id: string): Promise<unknown> {
  return request({ url: `/lark-connections/${id}`, method: 'DELETE' });
}

export function listSyncRecords(id: string): Promise<Array<{ id: string; userNickname: string; status: string; attempts: number; lastError: string | null; syncedAt: string | null; updatedAt: string }>> {
  return request({ url: `/activities/${id}/sync-records` });
}

export function retrySync(id: string): Promise<{ retried: number }> {
  return request({ url: `/activities/${id}/sync-retry`, method: 'POST' });
}
