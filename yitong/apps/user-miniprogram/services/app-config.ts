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

// P2-79 小程序版本更新说明：管理端发版时填写，更新弹窗展示（空串=通用文案）
const MP_RELEASE_NOTES_CACHE_KEY = 'yitong_mp_release_notes';

interface MpReleaseNotesResponse {
  notes: string;
}

export function readMpReleaseNotesCache(): string {
  const cached = wx.getStorageSync(MP_RELEASE_NOTES_CACHE_KEY);
  return typeof cached === 'string' ? cached : '';
}

export function persistMpReleaseNotes(notes: string): void {
  wx.setStorageSync(MP_RELEASE_NOTES_CACHE_KEY, notes);
}

// P2-82 timeoutMs：升级弹窗前的拉取传 5s 超时（拿到数据再弹窗，弱网不拖弹窗）；不传走默认超时
export function fetchMpReleaseNotes(timeoutMs?: number): Promise<string> {
  return request<MpReleaseNotesResponse>({
    url: '/app-config/mp-release-notes',
    data: { cacheBust: Date.now() },
    header: { 'Cache-Control': 'no-cache' },
    silent: true,
    timeout: timeoutMs,
  }).then((response) => (typeof response.notes === 'string' ? response.notes : ''));
}
