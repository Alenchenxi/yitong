import { request } from './request';

interface SubscribeTemplates {
  jobApply: string | null;
  jobStatus: string | null;
  tmplIds: string[];
}

let cachedTemplates: SubscribeTemplates | null = null;

export async function requestJobApplySubscribe() {
  return requestSubscribe('jobApply');
}

export async function requestJobStatusSubscribe() {
  return requestSubscribe('jobStatus');
}

async function requestSubscribe(key: 'jobApply' | 'jobStatus') {
  if (!wx.requestSubscribeMessage) return false;
  const templates = await getSubscribeTemplates().catch(() => null);
  const tmplId = templates?.[key];
  if (!tmplId) return false;

  return new Promise<boolean>((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: (res) => resolve(res[tmplId] === 'accept'),
      fail: () => resolve(false),
    });
  });
}

async function getSubscribeTemplates() {
  if (cachedTemplates) return cachedTemplates;
  cachedTemplates = await request<SubscribeTemplates>({ url: '/notifications/subscribe-templates' });
  return cachedTemplates;
}
