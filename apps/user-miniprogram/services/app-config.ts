import { request } from './request';

const ANONYMOUS_CONTENT_CACHE_KEY = 'yitong_anonymous_content_enabled';
const JOB_MODULE_CACHE_KEY = 'yitong_job_module_enabled';

interface AnonymousContentVisibilityResponse {
  anonymousContentEnabled: boolean;
}

interface JobModuleVisibilityResponse {
  jobEnabled: boolean;
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

export function readJobModuleVisibilityCache(): boolean {
  return wx.getStorageSync(JOB_MODULE_CACHE_KEY) === true;
}

export function persistJobModuleVisibility(enabled: boolean): void {
  wx.setStorageSync(JOB_MODULE_CACHE_KEY, enabled);
}

export function fetchJobModuleVisibility(): Promise<boolean> {
  return request<JobModuleVisibilityResponse>({
    url: '/app-config/job',
    data: { cacheBust: Date.now() },
    header: { 'Cache-Control': 'no-cache' },
    silent: true,
  }).then((response) => response.jobEnabled === true);
}
