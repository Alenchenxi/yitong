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
    // 已入驻则跳商家 shell「我的」tab
    getMerchantProfile()
      .then(() => {
        wx.redirectTo({ url: '/pages/merchant/index?tab=profile' });
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
    const app = getApp<AppInstance>();
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
      if (m.status === 'APPROVED') {
        // dev 自动审核通过：切商家角色 + 进商家 shell（switchRole await 落盘 token 后再 reLaunch，无弹窗）
        await app.switchRole('merchant');
        setTimeout(() => wx.reLaunch({ url: '/pages/merchant/index' }), 800);
      } else {
        // 待审核：返回上一页
        setTimeout(() => wx.navigateBack(), 800);
      }
    } catch {
      /* toast 已弹 */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
