import { getCommunity, getCommunityInviteCode, type CommunityInviteCodeVo, type CommunityVo } from '../../../services/community';

interface InvitePageData {
  community: CommunityVo | null;
  imagePath: string;
  loading: boolean;
  saving: boolean;
  error: string;
}

Page({
  data: {
    community: null,
    imagePath: '',
    loading: true,
    saving: false,
    error: '',
  } as InvitePageData,

  onLoad(options: Record<string, string | undefined>) {
    const id = options.id;
    if (!id) {
      this.setData({ loading: false, error: '圈子参数无效' });
      return;
    }
    void this.load(id);
  },

  async load(id: string) {
    try {
      const [community, code] = await Promise.all([
        getCommunity(id),
        getCommunityInviteCode(id),
      ]);
      const imagePath = await this.writeCodeFile(id, code);
      this.setData({ community, imagePath, loading: false });
    } catch {
      this.setData({ loading: false, error: '邀请二维码生成失败，请稍后重试' });
    }
  },

  writeCodeFile(id: string, code: CommunityInviteCodeVo): Promise<string> {
    return new Promise((resolve, reject) => {
      const filePath = `${wx.env.USER_DATA_PATH}/community-invite-${id}.png`;
      wx.getFileSystemManager().writeFile({
        filePath,
        data: code.imageBase64,
        encoding: 'base64',
        success: () => resolve(filePath),
        fail: reject,
      });
    });
  },

  saveImage() {
    const path = this.data.imagePath;
    if (!path || this.data.saving) return;
    this.setData({ saving: true });
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (error) => {
        if (error.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片到相册',
            success: (result) => {
              if (result.confirm) wx.openSetting({});
            },
          });
        }
      },
      complete: () => this.setData({ saving: false }),
    });
  },

  shareImage() {
    const path = this.data.imagePath;
    const wxApi = wx as typeof wx & {
      showShareImageMenu?: (options: { path: string; success?: () => void; fail?: () => void }) => void;
    };
    if (!path) return;
    if (typeof wxApi.showShareImageMenu !== 'function') {
      wx.showToast({ title: '当前版本请先保存图片', icon: 'none' });
      return;
    }
    wxApi.showShareImageMenu({
      path,
      fail: () => wx.showToast({ title: '分享失败，请先保存图片', icon: 'none' }),
    });
  },

  onShareAppMessage() {
    const community = this.data.community;
    return {
      title: community ? `邀请你加入「${community.name}」圈子` : '邀请你加入圈子',
      path: community ? `/pages/square/index?inviteCommunityId=${encodeURIComponent(community.id)}` : '/pages/square/index',
      imageUrl: community?.backgroundImage || community?.logo || undefined,
    };
  },
});