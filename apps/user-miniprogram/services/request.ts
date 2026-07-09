interface ApiResult<T> {
  code: number;
  data: T;
  message: string;
}

interface AppGlobalData {
  token: string;
  apiBase: string;
}

// 统一请求封装：注入 token、统一错误提示（与 API 设计规范 §2 对齐）
export function request<T>(opts: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT';
  data?: Record<string, unknown>;
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
