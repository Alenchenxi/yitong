import { request } from './request';

// 图片上传：wx.chooseMedia 拿到本地路径 → wx.uploadFile 传 /uploads → 返回 {url}
// 注意：uploadFile 不能复用 request 封装（它走 multipart/form-data 而非 JSON），
// 故直接用 wx.uploadFile 并手动注入 Authorization。
export function uploadImage(localPath: string): Promise<string> {
  const app = getApp<{ globalData: { apiBase: string; token: string } }>();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBase}/uploads`,
      filePath: localPath,
      name: 'file',
      header: {
        Authorization: app.globalData.token ? `Bearer ${app.globalData.token}` : '',
      },
      success: (res) => {
        try {
          const body = JSON.parse(res.data) as {
            code: number;
            data?: { url: string };
            message?: string;
          };
          if (body.code === 0 && body.data?.url) {
            resolve(body.data.url);
          } else {
            wx.showToast({ title: body.message ?? '上传失败', icon: 'none' });
            reject(body);
          }
        } catch {
          wx.showToast({ title: '上传失败', icon: 'none' });
          reject(new Error('parse error'));
        }
      },
      fail: () => {
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
        reject(new Error('network error'));
      },
    });
  });
}

// 批量上传（顺序，上传中展示 loading）
export async function uploadImages(localPaths: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const p of localPaths) {
    // eslint-disable-next-line no-await-in-loop
    const url = await uploadImage(p);
    urls.push(url);
  }
  return urls;
}
