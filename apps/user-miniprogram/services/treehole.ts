import { request } from './request';

// 树洞匿名接口：用 anonToken 鉴权（独立于 user access token）

export interface AnonPostVo {
  id: string;
  anonId: string;
  content: string;
  images: string[];
  mood: string | null; // P0-13 情绪分类
  likeCount: number;
  liked: boolean;
  createdAt: string;
}

export interface AnonTokenResp {
  anonId: string;
  anonToken: string;
  nickname: string;
}

export interface ImCredential {
  loginUserId: string;
  loginToken: string;
  wsUrl: string;
}

export interface MatchResp {
  matchId?: string;
  peerAnonId?: string;
  imCredential?: ImCredential;
  waiting: boolean;
  matchScore?: number;   // P1-15 规则匹配度 0-100
  matchedTags?: string[]; // P1-15 命中标签
  peerTags?: string[];    // P1-15 peer 展示标签
  expireAt?: string | null; // P1-17 过期时间 ISO
}

export interface PartyResp {
  roomId: string;
  imCredential: ImCredential;
}

export interface AnonMessageVo {
  id: string;
  fromId: string;
  toId: string;
  content: string;
  type: string; // P0-14 text / image；P1-18 + voice
  duration: number | null; // P1-18 语音时长（秒），仅 type=voice
  createdAt: string;
}

let anonToken = '';
let anonId = '';

interface AppLike {
  globalData: { apiBase: string };
}

export function hasAnonToken() {
  return !!anonToken;
}
export function getAnonId() {
  return anonId;
}
export function clearAnonToken() {
  anonToken = '';
  anonId = '';
}

// 换匿名 token（用 user access token 调）
export function getAnonymousToken(): Promise<AnonTokenResp> {
  return new Promise((resolve, reject) => {
    const app = getApp<AppLike>();
    wx.request({
      url: `${app.globalData.apiBase}/treehole/anonymous-token`,
      method: 'POST',
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${(getApp() as any).globalData.token}` },
      success: (r) => {
        const b = r.data as { code: number; data?: AnonTokenResp; message?: string };
        if (b.code === 0 && b.data) {
          anonToken = b.data.anonToken;
          anonId = b.data.anonId;
          resolve(b.data);
        } else {
          wx.showToast({ title: b.message ?? '匿名态获取失败', icon: 'none' });
          reject(new Error(b.message ?? 'fail'));
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(new Error('network'));
      },
    });
  });
}

function anonRequest<T>(opts: { url: string; method: 'GET' | 'POST' | 'DELETE'; data?: unknown }): Promise<T> {
  return new Promise((resolve, reject) => {
    const app = getApp<AppLike>();
    wx.request({
      url: `${app.globalData.apiBase}${opts.url}`,
      method: opts.method,
      data: opts.data as WechatMiniprogram.IAnyObject | undefined,
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonToken}` },
      success: (r) => {
        const b = r.data as { code: number; data?: T; message?: string };
        if (b.code === 0 && b.data !== undefined) {
          resolve(b.data as T);
        } else {
          wx.showToast({ title: b.message ?? '请求失败', icon: 'none' });
          reject(new Error(b.message ?? 'fail'));
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(new Error('network'));
      },
    });
  });
}

export function listPosts(
  cursor?: string,
  sort?: 'latest' | 'recommend',
  mood?: string,
): Promise<{ list: AnonPostVo[]; nextCursor: string | null; hasMore: boolean }> {
  const params = ['limit=20'];
  if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`);
  if (sort) params.push(`sort=${sort}`);
  if (mood) params.push(`mood=${encodeURIComponent(mood)}`);
  return anonRequest({ url: `/treehole/posts?${params.join('&')}`, method: 'GET' });
}

export function getPost(id: string): Promise<AnonPostVo> {
  return anonRequest({ url: `/treehole/posts/${id}`, method: 'GET' });
}

export function createPost(data: { content: string; images?: string[]; mood?: string }): Promise<AnonPostVo> {
  return anonRequest({ url: '/treehole/posts', method: 'POST', data });
}

export function matchAnon(): Promise<MatchResp> {
  return anonRequest({ url: '/treehole/match', method: 'POST' });
}

// P1-16 匹配历史
export interface MatchHistoryItem {
  id: string;
  peerAnonId: string;
  peerNickname: string;
  peerAvatar: string | null;
  peerTags: string[];
  matchScore: number;
  matchedTags: string[];
  status: string;
  expireAt: string | null; // P1-17
  createdAt: string;
}
export interface MatchHistoryResult {
  list: MatchHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function listAnonMatches(page = 1, pageSize = 20): Promise<MatchHistoryResult> {
  return anonRequest({ url: `/treehole/matches?page=${page}&pageSize=${pageSize}`, method: 'GET' });
}

// P1-16 跳过/不喜欢当前匹配 + 重新匹配
export function skipAnonMatch(matchId: string): Promise<MatchResp> {
  return anonRequest({ url: `/treehole/matches/${matchId}/skip`, method: 'POST' });
}

export function toggleAnonPostLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  return anonRequest({ url: `/treehole/posts/${postId}/like`, method: 'POST' });
}

export function joinParty(): Promise<PartyResp> {
  return anonRequest({ url: '/treehole/party/join', method: 'POST' });
}

// ===== P2-07~P2-09 树洞群聊 =====
export interface AnonGroupVo {
  id: string;
  name: string;
  avatarUrl: string | null;
  description: string | null;
  tags: string[];
  maxMembers: number;
  isPrivate: boolean;
  ownerAnonId: string;
  status: string;
  memberCount: number;
  isMember: boolean;
  createdAt: string;
}

export interface AnonGroupMemberVo {
  anonId: string;
  nickname: string;
  avatar: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  mutedUntil: string | null;
  joinedAt: string;
}

export interface AnonGroupDetailVo extends AnonGroupVo {
  announcement: string | null;
  imCredential: ImCredential | null; // P2-11 成员连 WS 用
  members: AnonGroupMemberVo[];
}

export function listAnonGroups(sort: 'recommend' | 'latest' | 'hot' = 'recommend', tag?: string, limit = 20): Promise<AnonGroupVo[]> {
  const qs = `?sort=${sort}&limit=${limit}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`;
  return anonRequest({ url: `/treehole/groups${qs}`, method: 'GET' });
}

export function createAnonGroup(data: {
  name: string;
  avatarUrl?: string;
  description?: string;
  tags?: string[];
  announcement?: string;
  maxMembers?: number;
  isPrivate?: boolean;
}): Promise<AnonGroupVo> {
  return anonRequest({ url: '/treehole/groups', method: 'POST', data });
}

export function getAnonGroup(id: string): Promise<AnonGroupDetailVo> {
  return anonRequest({ url: `/treehole/groups/${id}`, method: 'GET' });
}

export function joinAnonGroup(id: string): Promise<{ joined: boolean }> {
  return anonRequest({ url: `/treehole/groups/${id}/join`, method: 'POST' });
}

export function leaveAnonGroup(id: string): Promise<{ left: boolean; disbanded?: boolean }> {
  return anonRequest({ url: `/treehole/groups/${id}/leave`, method: 'POST' });
}

// B3 群主转交
export function transferGroupOwner(id: string, targetAnonId: string): Promise<{ newOwner: string }> {
  return anonRequest({ url: `/treehole/groups/${id}/transfer`, method: 'POST', data: { targetAnonId } });
}

// P2-10 群成员管理
export function setGroupMemberRole(id: string, anonId: string, role: 'ADMIN' | 'MEMBER'): Promise<{ anonId: string; role: string }> {
  return anonRequest({ url: `/treehole/groups/${id}/members/${anonId}/role`, method: 'POST', data: { role } });
}

export function kickGroupMember(id: string, anonId: string): Promise<{ kicked: boolean; anonId: string }> {
  return anonRequest({ url: `/treehole/groups/${id}/members/${anonId}/kick`, method: 'POST' });
}

// days=0 解除禁言
export function muteGroupMember(id: string, anonId: string, days: number): Promise<{ mutedUntil: string | null }> {
  return anonRequest({ url: `/treehole/groups/${id}/members/${anonId}/mute`, method: 'POST', data: { days } });
}

export function listMyAnonGroups(): Promise<AnonGroupVo[]> {
  return anonRequest({ url: '/treehole/groups/mine', method: 'GET' });
}

// ===== P2-11 群聊消息 =====
export interface GroupMessageVo {
  id: string;
  fromId: string;
  toId: string | null;
  content: string;
  type: string;
  duration: number | null;
  groupId: string | null;
  deleted: boolean;
  createdAt: string;
}

export function sendGroupMessage(groupId: string, content: string, type = 'text'): Promise<GroupMessageVo> {
  return anonRequest({ url: `/treehole/groups/${groupId}/messages`, method: 'POST', data: { content, type } });
}

export function listGroupMessages(
  groupId: string,
  cursor?: string,
  limit = 50,
): Promise<{ list: GroupMessageVo[]; nextCursor: string | null; hasMore: boolean }> {
  const qs = `?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return anonRequest({ url: `/treehole/groups/${groupId}/messages${qs}`, method: 'GET' });
}

export function revokeGroupMessage(groupId: string, msgId: string): Promise<GroupMessageVo> {
  return anonRequest({ url: `/treehole/groups/${groupId}/messages/${msgId}/revoke`, method: 'POST' });
}

export function sendAnonMessage(
  peerAnonId: string,
  content: string,
  type?: string,
  duration?: number,
): Promise<AnonMessageVo> {
  return anonRequest({ url: '/treehole/messages', method: 'POST', data: { peerAnonId, content, type, duration } });
}

export function listAnonMessages(
  peerAnonId: string,
  cursor?: string,
): Promise<{ list: AnonMessageVo[]; nextCursor: string | null; hasMore: boolean }> {
  const qs = `?peerAnonId=${encodeURIComponent(peerAnonId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return anonRequest({ url: `/treehole/messages${qs}`, method: 'GET' });
}

// P0-16 黑名单/屏蔽（anonToken 鉴权）：屏蔽 / 取消屏蔽 / 我的屏蔽列表
export interface AnonBlockVo {
  blockedAnonId: string;
  createdAt: string;
}

export function blockAnon(blockedAnonId: string): Promise<{ blocked: boolean }> {
  return anonRequest({ url: '/treehole/blocks', method: 'POST', data: { blockedAnonId } });
}

export function unblockAnon(blockedAnonId: string): Promise<{ blocked: boolean }> {
  return anonRequest({ url: `/treehole/blocks/${encodeURIComponent(blockedAnonId)}`, method: 'DELETE' });
}

export function listAnonBlocks(): Promise<{ list: AnonBlockVo[] }> {
  return anonRequest({ url: '/treehole/blocks', method: 'GET' });
}

// 我的匿名帖（用 user access token，非 anon）
export function listMyAnonPosts() {
  return request<{ list: AnonPostVo[] }>({ url: '/treehole/posts/mine' });
}

// P0-12 匿名身份资料（用 user access token，非 anon）
export interface AnonProfileVo {
  nickname: string;
  avatar: string | null;
  personalityTags: string[];
  interestTags: string[];
  moodState: string | null;
}

export function getAnonProfile(): Promise<AnonProfileVo> {
  return request<AnonProfileVo>({ url: '/treehole/profile' });
}

export function updateAnonProfile(data: {
  nickname?: string;
  avatar?: string;
  personalityTags?: string[];
  interestTags?: string[];
  moodState?: string;
}): Promise<AnonProfileVo> {
  return request<AnonProfileVo>({
    url: '/treehole/profile',
    method: 'PUT',
    data: {
      nickname: data.nickname,
      avatar: data.avatar,
      personalityTags: data.personalityTags,
      interestTags: data.interestTags,
      moodState: data.moodState,
    },
  });
}

// P1-13 树洞标签库（个性/兴趣/心情三类，按 category 分组）
export interface AnonTagItem {
  id: string;
  name: string;
  sortOrder: number;
}
export interface AnonTagLibrary {
  personality: AnonTagItem[];
  interest: AnonTagItem[];
  mood: AnonTagItem[];
}

export function getAnonTags(): Promise<AnonTagLibrary> {
  return request<AnonTagLibrary>({ url: '/treehole/tags' });
}

// P1-14 问卷
export type QuestionnaireType = 'personality' | 'interest' | 'values' | 'mood';

export interface QuizOption { id: string; text: string; tags: string[]; }
export interface QuizQuestion { id: string; text: string; options: QuizOption[]; }
export interface QuizBank {
  type: QuestionnaireType;
  title: string;
  desc: string;
  questions: QuizQuestion[];
}

export function getQuestionnaire(type: QuestionnaireType): Promise<QuizBank> {
  return request<QuizBank>({ url: `/treehole/questionnaire?type=${type}` });
}

export interface QuizSubmitResult {
  type: string;
  resultTags: string[];
  profile: AnonProfileVo;
}

export function submitQuestionnaire(
  type: QuestionnaireType,
  answers: { questionId: string; optionId: string }[],
): Promise<QuizSubmitResult> {
  return request<QuizSubmitResult>({
    url: '/treehole/questionnaire/submit',
    method: 'POST',
    data: { type, answers },
  });
}
