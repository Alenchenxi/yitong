import type { AppInstance } from '../../app';
import { getMyReferralCode, getMyReferralStats, type ReferralRecordVo } from '../../services/referral';

Page({
  data: {
    code: '',
    inviteCount: 0,
    records: [] as ReferralRecordVo[],
    loading: true,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const [codeResp, statsResp] = await Promise.all([getMyReferralCode(), getMyReferralStats()]);
      this.setData({
        code: codeResp.code,
        inviteCount: statsResp.count,
        records: statsResp.records,
      });
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onCopyCode() {
    if (!this.data.code) return;
    wx.setClipboardData({
      data: this.data.code,
      success: () => wx.showToast({ title: '已复制邀请码', icon: 'success' }),
    });
  },

  // 分享给好友（携带邀请码）
  onShareAppMessage() {
    const code = this.data.code;
    return {
      title: '来燚桐找家教/兼职吧！输入我的邀请码 ' + code + ' 一起玩',
      path: `/pages/role-select/index?referralCode=${code}`,
    };
  },

  onShareTimeline() {
    const code = this.data.code;
    return {
      title: '来燚桐找家教/兼职吧！邀请码 ' + code,
      query: `referralCode=${code}`,
    };
  },
});