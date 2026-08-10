interface ApiResult<T> {
  code: number;
  data: T;
  message: string;
}

interface AppGlobalData {
  token: string;
  apiBase: string;
  anonToken?: string; // CR-001 树洞匿名 token
}

// 统一请求封装：注入 token、统一错误提示（与 API 设计规范 §2 对齐）
export function request<T>(opts: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT';
  data?: Record<string, unknown>;
  header?: Record<string, string>; // CR-001 额外 header（如 x-anon-token）
}): Promise<T> {
  const app = getApp<{ globalData: AppGlobalData }>();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${opts.url}`,
      method: opts.method ?? 'GET',
      data: opts.data,
      header: {
        'Content-Type': 'application/json',
        Authorization: app.globalData.token ? `Bearer ${app.globalData.token}` : '',
        ...(opts.header || {}),
      },
      success: (res) => {
        const body = res.data as ApiResult<T>;
        if (body.code === 0) {
          resolve(body.data);
        } else {
          wx.showToast({ title: body.message, icon: 'none' });
          reject(body);
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
        reject(new Error('network error'));
      },
    });
  });
}
