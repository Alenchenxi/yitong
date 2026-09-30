import { request } from './request';

export interface MyCodeVo {
  code: string;
  createdAt: string;
}

export interface ReferralRecordVo {
  refereeId: string;
  refereeNickname: string;
  refereeAvatarUrl: string | null;
  createdAt: string;
}

export interface MyStatsVo {
  count: number;
  records: ReferralRecordVo[];
}

export function getMyReferralCode() {
  return request<MyCodeVo>({ url: '/referrals/my-code' });
}

export function getMyReferralStats() {
  return request<MyStatsVo>({ url: '/referrals/my-stats' });
}