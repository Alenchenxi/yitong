import type { AppInstance } from '../../../app';
import { registerMerchant, reapplyMerchant, getMerchantProfile } from '../../../services/merchant';

// 本页多由商家 shell `wx.redirectTo` 进入（未入驻探测），此时页面栈只有本页，
// wx.navigateBack() 会失败并把用户卡死在入驻页 —— 统一走这个兜底：
// 有上一页才 navigateBack，否则 reLaunch 回商家 shell。
function backOrShell(tab = 'profile') {
  if (getCurrentPages().length > 1) {
    wx.navigateBack();
    return;
  }
  wx.reLaunch({ url: `/pages/merchant/index?tab=${tab}` });
}

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
    //  REJECTED（不论有无 mode）→ 留在页内回填表单，并强制切到 resubmit 模式：
    //    带 mode 进来是 profile 的「重新提交资质」；不带 mode 进来（如误点「去入驻」）
    //    若保持 register 模式，提交会被后端 60001「已入驻」拒掉且页内无出口，成为死胡同。
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
            mode: 'resubmit',
            title: '重新提交资质',
          });
          wx.setNavigationBarTitle({ title: '重新提交资质' });
          return;
        }
        if (mode === 'resubmit') {
          wx.showToast({ title: '当前状态不支持重新申请', icon: 'none' });
          setTimeout(() => backOrShell(), 600);
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
        setTimeout(() => backOrShell(), 800);
        return;
      }
      const m = await registerMerchant({
        shopName: shopName.trim(),
        licenseNo: licenseNo.trim(),
        contactPhone: contactPhone.trim(),
      });
      if (m.status === 'APPROVED') {
        // 审核直通（dev 自动过审）：切商家角色 + 进商家 shell
        // switchRole 失败不阻断跳转（此前 await 抛错会被 catch 吞掉、页面原地卡死）：
        // 商家接口只校验 merchants 行存在，不校验 JWT role，原 token 也能正常用 shell。
        wx.showToast({ title: '入驻成功', icon: 'success' });
        await app.switchRole('merchant').catch(() => {
          /* 角色切换失败仍进商家端，下次冷启动由 role-select 重新登录纠正 */
        });
        setTimeout(() => wx.reLaunch({ url: '/pages/merchant/index' }), 800);
      } else {
        // 待审核（prod 正常路径）：不再 navigateBack（本页常是栈底，会卡死），
        // 直接进商家 shell「我的」tab，由认证状态卡展示「审核中」。
        wx.showToast({ title: '已提交，等待审核', icon: 'success' });
        setTimeout(() => wx.reLaunch({ url: '/pages/merchant/index?tab=profile' }), 800);
      }
    } catch {
      /* toast 已弹（request helper 在非 0 码时自动 showToast） */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
