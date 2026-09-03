import { request } from './request';

const ANONYMOUS_CONTENT_CACHE_KEY = 'yitong_anonymous_content_enabled';

interface AnonymousContentVisibilityResponse {
  anonymousContentEnabled: boolean;
}

export function readAnonymousContentVisibilityCache(): boolean {
  return wx.getStorageSync(ANONYMOUS_CONTENT_CACHE_KEY) === true;
}

export function persistAnonymousContentVisibility(enabled: boolean): void {
  wx.setStorageSync(ANONYMOUS_CONTENT_CACHE_KEY, enabled);
}

export function fetchAnonymousContentVisibility(): Promise<boolean> {
  return request<AnonymousContentVisibilityResponse>({
    url: '/app-config/anonymous-content',
    data: { cacheBust: Date.now() },
    header: { 'Cache-Control': 'no-cache' },
    silent: true,
  }).then((response) => response.anonymousContentEnabled === true);
}
