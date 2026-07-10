import type { AppInstance } from '../../../app';
import { registerMerchant, getMerchantProfile } from '../../../services/merchant';

Page({
  data: {
    shopName: '',
    licenseNo: '',
    contactPhone: '',
    submitting: false,
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    // 已入驻则跳资料页
    getMerchantProfile()
      .then(() => {
        wx.redirectTo({ url: '/pages/merchant/profile/index' });
      })
      .catch(() => {
        /* 未入驻，留在本页 */
      });
  },

  onInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'shopName' | 'licenseNo' | 'contactPhone';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },

  async submit() {
    if (this.data.submitting) return;
    const { shopName, licenseNo, contactPhone } = this.data;
    if (!shopName.trim() || !licenseNo.trim() || !contactPhone.trim()) {
      wx.showToast({ title: '请填完整', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const m = await registerMerchant({
        shopName: shopName.trim(),
        licenseNo: licenseNo.trim(),
        contactPhone: contactPhone.trim(),
      });
      wx.showToast({ title: '入驻成功', icon: 'success' });
      // dev 模式自动审核通过，提示可切换商家角色
      setTimeout(() => {
        if (m.status === 'APPROVED') {
          wx.showModal({
            title: '入驻已通过',
            content: '可到「我的-切换角色」切换为商家',
            showCancel: false,
            success: () => wx.navigateBack(),
          });
        } else {
          wx.navigateBack();
        }
      }, 800);
    } catch {
      /* toast 已弹 */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
