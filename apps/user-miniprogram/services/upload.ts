import { handleResponseAuth } from './auth-error';

export type UploadType = 'common' | 'posts' | 'anon' | 'avatars' | 'merchant' | 'voice' | 'community' | 'banner';

// 通用上传：wx.chooseMedia 拿到本地路径 -> wx.uploadFile 传 /uploads(图片) /uploads/video(视频) /uploads/voice(语音) -> 返回 {url}
// 注意：uploadFile 不能复用 request 封装（它走 multipart/form-data 而非 JSON），
// 故直接用 wx.uploadFile 并手动注入 Authorization。
// 鉴权失败（10001/10002）→ 清登录态 + 跳 role-select
function uploadFile(
  localPath: string,
  type: UploadType,
  endpoint: 'uploads' | 'uploads/video' | 'uploads/voice',
): Promise<string> {
  const app = getApp<{ globalData: { apiBase: string; token: string } }>();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBase}/${endpoint}?type=${type}`,
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
            handleResponseAuth(body);
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

// 图片上传
export function uploadImage(localPath: string, type: UploadType = 'common'): Promise<string> {
  return uploadFile(localPath, type, 'uploads');
}

// 视频上传（mp4，≤50MB）
export function uploadVideo(localPath: string, type: UploadType = 'common'): Promise<string> {
  return uploadFile(localPath, type, 'uploads/video');
}

// P1-18 语音上传（mp3/m4a/aac/wav，≤2MB），默认 voice 文件夹
export function uploadVoice(localPath: string, type: UploadType = 'voice'): Promise<string> {
  return uploadFile(localPath, type, 'uploads/voice');
}

// 批量上传图片（顺序，上传中展示 loading）
export async function uploadImages(localPaths: string[], type: UploadType = 'common'): Promise<string[]> {
  const urls: string[] = [];
  for (const p of localPaths) {
    // eslint-disable-next-line no-await-in-loop
    const url = await uploadImage(p, type);
    urls.push(url);
  }
  return urls;
}
