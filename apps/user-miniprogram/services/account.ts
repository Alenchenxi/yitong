import { request } from './request';

export interface AccountVo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  gender: string | null;
  birthday: string | null;
  phone: string | null;
  wechat: string | null;
}

export function getAccount() {
  return request<AccountVo>({ url: '/auth/account' });
}

export function updateAccount(data: { nickname?: string; gender?: string; birthday?: string; phone?: string; wechat?: string }) {
  return request<AccountVo>({ url: '/auth/account', method: 'PUT', data });
}

export function deleteAccount() {
  return request<{ deleted: boolean }>({ url: '/auth/account', method: 'DELETE' });
}
