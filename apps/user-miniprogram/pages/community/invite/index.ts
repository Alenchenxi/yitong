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
      const codePath = await this.writeCodeFile(id, code);
      const imagePath = await this.createInvitePoster(community, codePath).catch(() => codePath);
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


  async createInvitePoster(community: CommunityVo, codePath: string): Promise<string> {
    const logoPath = community.logo ? await this.resolveImagePath(community.logo) : '';
    const title = `燚桐-${community.name}`;
    const canvasId = 'invitePoster';
    const width = 750;
    const height = 1060;
    const ctx = wx.createCanvasContext(canvasId, this);

    ctx.setFillStyle('#FFFFFF');
    ctx.fillRect(0, 0, width, height);
    ctx.setFillStyle('#F9C801');
    ctx.fillRect(0, 0, width, 250);

    ctx.setFillStyle('#FFFFFF');
    ctx.beginPath();
    ctx.arc(375, 125, 72, 0, Math.PI * 2);
    ctx.fill();
    if (logoPath) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(375, 125, 62, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoPath, 313, 63, 124, 124);
      ctx.restore();
    } else {
      ctx.setFillStyle('#1D2129');
      ctx.setFontSize(58);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(community.name.slice(0, 1), 375, 127);
    }

    ctx.setFillStyle('#1D2129');
    ctx.setTextAlign('center');
    ctx.setTextBaseline('normal');
    let fontSize = 40;
    ctx.setFontSize(fontSize);
    while (fontSize > 26 && ctx.measureText(title).width > 640) {
      fontSize -= 2;
      ctx.setFontSize(fontSize);
    }
    const displayTitle = ctx.measureText(title).width > 640 ? `${title.slice(0, 16)}...` : title;
    ctx.fillText(displayTitle, 375, 310);

    ctx.setFillStyle('#F5F6F8');
    ctx.fillRect(110, 350, 530, 530);
    ctx.drawImage(codePath, 135, 375, 480, 480);

    ctx.setFillStyle('#4E5969');
    ctx.setFontSize(30);
    ctx.fillText('微信扫一扫，加入这个圈子', 375, 950);
    ctx.setFillStyle('#86909C');
    ctx.setFontSize(24);
    ctx.fillText('燚桐校园生活', 375, 1000);

    return new Promise((resolve, reject) => {
      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId,
          x: 0,
          y: 0,
          width,
          height,
          destWidth: width * 2,
          destHeight: height * 2,
          fileType: 'png',
          success: (result) => resolve(result.tempFilePath),
          fail: reject,
        }, this);
      });
    });
  },

  resolveImagePath(src: string): Promise<string> {
    return new Promise((resolve) => {
      wx.getImageInfo({
        src,
        success: (result) => resolve(result.path),
        fail: () => resolve(''),
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
    this.openImageShareMenu();
  },

  shareToFriend() {
    const path = this.data.imagePath;
    if (!path) return;
    const wxApi = wx as typeof wx & {
      shareImageToGroup?: (options: {
        imagePath: string;
        needShowEntrance?: boolean;
        entrancePath?: string;
        success?: () => void;
        fail?: (error: { errMsg?: string }) => void;
      }) => void;
    };
    // 3.7.8+ 直接打开好友选择页发送图片，避免 open-type=share 发送小程序卡片。
    if (typeof wxApi.shareImageToGroup !== 'function') {
      wx.showModal({
        title: '暂不支持直接转发',
        content: '当前微信版本无法直接打开好友列表，请先保存二维码图片后发送。',
        showCancel: false,
      });
      return;
    }
    wxApi.shareImageToGroup({
      imagePath: path,
      needShowEntrance: false,
      fail: (error) => this.handleShareFailure(error),
    });
  },

  openImageShareMenu() {
    const path = this.data.imagePath;
    const wxApi = wx as typeof wx & {
      showShareImageMenu?: (options: {
        path: string;
        needShowEntrance?: boolean;
        entrancePath?: string;
        success?: () => void;
        fail?: (error: { errMsg?: string }) => void;
      }) => void;
    };
    if (!path) return;
    if (typeof wxApi.showShareImageMenu !== 'function') {
      wx.showModal({
        title: '暂不支持图片分享',
        content: '当前微信版本不支持直接分享二维码，请先保存图片后发送。',
        showCancel: false,
      });
      return;
    }
    wxApi.showShareImageMenu({
      path,
      needShowEntrance: false,
      fail: (error) => this.handleShareFailure(error),
    });
  },

  handleShareFailure(error: { errMsg?: string }) {
    const errMsg = error?.errMsg ?? '';
    if (errMsg.includes('cancel')) return;
    if (/(not support|unsupported|不支持)/i.test(errMsg)) {
      wx.showToast({ title: '当前微信基础库不支持图片分享，请升级微信', icon: 'none' });
      return;
    }
    if (/(invalid|path|image|图片|参数)/i.test(errMsg)) {
      wx.showToast({ title: '二维码图片无效，请重新生成', icon: 'none' });
      return;
    }
    wx.showToast({ title: '分享失败，请稍后重试或先保存图片', icon: 'none' });
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