import { request } from './request';

interface SubscribeTemplates {
  jobApply: string | null;
  jobStatus: string | null;
  activityRemind: string | null;
  tmplIds: string[];
}

let cachedTemplates: SubscribeTemplates | null = null;

export async function requestJobApplySubscribe() {
  return requestSubscribe('jobApply');
}

export async function requestJobStatusSubscribe() {
  return requestSubscribe('jobStatus');
}

export async function requestActivityRemindSubscribe() {
  return requestSubscribe('activityRemind');
}

async function requestSubscribe(key: 'jobApply' | 'jobStatus' | 'activityRemind') {
  if (!wx.requestSubscribeMessage) return false;
  const templates = await getSubscribeTemplates().catch(() => null);
  const tmplId = templates?.[key];
  if (!tmplId) return false;

  const accepted = await new Promise<boolean>((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: (res) => resolve(res[tmplId] === 'accept'),
      fail: () => resolve(false),
    });
  });
  if (accepted) return true;
  // 用户勾选过「总是保持以上选择+拒绝」或关闭订阅消息总开关后，微信不再弹窗且直接返回拒绝——
  // 检测到历史拒绝时弹确认框，引导去设置重新开启（再次报名需重新确认）
  if (!(await isPermanentlyRejected(tmplId))) return false;
  const { confirm } = await wx.showModal({
    title: '订阅提醒',
    content: '您之前选择了不接收订阅消息，将无法收到报名与审核结果提醒，是否前往设置重新开启？',
    confirmText: '去设置',
  });
  if (confirm) await wx.openSetting({});
  return false;
}

/** 该模板是否处于「总是拒绝/已封禁」或订阅消息总开关关闭（此时 requestSubscribeMessage 不再弹窗） */
function isPermanentlyRejected(tmplId: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.getSetting({
      withSubscriptions: true,
      success: (res) => {
        const item = res.subscriptionsSetting.itemSettings?.[tmplId];
        resolve(res.subscriptionsSetting.mainSwitch === false || item === 'reject' || item === 'ban');
      },
      fail: () => resolve(false),
    });
  });
}

async function getSubscribeTemplates() {
  if (cachedTemplates) return cachedTemplates;
  cachedTemplates = await request<SubscribeTemplates>({ url: '/notifications/subscribe-templates' });
  return cachedTemplates;
}
