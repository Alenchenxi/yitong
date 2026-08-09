import type { AppInstance } from '../../../app';
import { registerMerchant, reapplyMerchant, getMerchantProfile } from '../../../services/merchant';

Page({
  data: {
    shopName: '',
    licenseNo: '',
    contactPhone: '',
    submitting: false,
    mode: '' as '' | 'resubmit', // 页面模式：resubmit=商家驳回后重新提交
    lastRejectReason: null as string | null, // REJECTED 模式下展示的驳回原因
    title: '商家入驻', // 标题栏 + 页面顶部 title 视图同步
  },

  onLoad(options: Record<string, string | undefined>) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const mode = options?.mode === 'resubmit' ? 'resubmit' : '';
    this.setData({ mode, title: mode === 'resubmit' ? '重新提交资质' : '商家入驻' });
    // 仅 resubmit 模式才动态改导航栏标题（JSON 文件无法做表达式绑定）
    if (mode === 'resubmit') {
      wx.setNavigationBarTitle({ title: '重新提交资质' });
    }

    // 已入驻则按 status 分流：
    //  REJECTED + mode=resubmit → 留在页内回填表单
    //  REJECTED + 无 mode → 跳回商家 shell（用户误点）
    //  非 REJECTED + mode=resubmit → toast 后返回（不让 resubmit 页面被非驳回用户进来）
    //  非 REJECTED + 无 mode → 跳回商家 shell（保持原 register 流程）
    getMerchantProfile()
      .then((m) => {
        if (m.status === 'REJECTED') {
          // 驳回后回填：让商家改完三字段直接提交
          const lastRejectReason = (m && m.lastRejectReason) ?? null;
          this.setData({
            shopName: m.shopName,
            licenseNo: m.licenseNo,
            contactPhone: m.contactPhone,
            lastRejectReason,
          });
          return;
        }
        if (mode === 'resubmit') {
          wx.showToast({ title: '当前状态不支持重新申请', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 600);
          return;
        }
        // 其他状态（PENDING/APPROVED）保持原 redirect 行为
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
    const { shopName, licenseNo, contactPhone, mode } = this.data;
    if (!shopName.trim() || !licenseNo.trim() || !contactPhone.trim()) {
      wx.showToast({ title: '请填完整', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      if (mode === 'resubmit') {
        // 重新提交：不需要切角色 / reLaunch，只是回到 shell 等复审
        await reapplyMerchant({
          shopName: shopName.trim(),
          licenseNo: licenseNo.trim(),
          contactPhone: contactPhone.trim(),
        });
        wx.showToast({ title: '已提交，等待审核', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 800);
        return;
      }
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
      /* toast 已弹（request helper 在非 0 码时自动 showToast） */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
