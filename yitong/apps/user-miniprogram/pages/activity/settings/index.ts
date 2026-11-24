import {
  activityDetail,
  setActivityAdmins,
  transferInitiator,
  type ActivityDetailVo,
} from '../../../services/activity';
import { searchUsers, type UserSearchItem } from '../../../services/confession';

// 活动设置（仅发起人）：活动管理员管理 + 转让发起人，自报名管理页独立成页（2026-11-24）
Page({
  data: {
    id: '',
    detail: null as ActivityDetailVo | null,
    adminList: [] as UserSearchItem[],
    adminKw: '',
    adminResults: [] as UserSearchItem[],
    transferKw: '',
    transferResults: [] as UserSearchItem[],
    transferTarget: null as UserSearchItem | null,
  },

  onLoad(query: Record<string, string>) {
    this.setData({ id: query.id ?? '' });
  },

  onShow() {
    void this.load();
  },

  async load() {
    try {
      const d = await activityDetail(this.data.id);
      if (!d.isInitiator) {
        wx.showToast({ title: '仅活动发起人可设置', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 600);
        return;
      }
      this.setData({ detail: d, adminList: d.admins });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  tip(message: string): false {
    wx.showToast({ title: message, icon: 'none' });
    return false;
  },

  onAdminKwInput(e: WechatMiniprogram.Input) {
    const kw = e.detail.value;
    // 清空搜索条件时同步清空结果列表
    if (!kw.trim()) {
      this.setData({ adminKw: kw, adminResults: [] });
      return;
    }
    this.setData({ adminKw: kw });
  },

  async searchAdmins() {
    const q = this.data.adminKw.trim();
    if (!q) {
      this.setData({ adminResults: [] });
      return;
    }
    try {
      const r = await searchUsers(q, 20);
      this.setData({ adminResults: r.list });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  pickAdmin(e: WechatMiniprogram.TouchEvent) {
    const u = this.data.adminResults[Number(e.currentTarget.dataset.index)];
    if (!u) return;
    if (this.data.adminList.some((a) => a.id === u.id)) return this.tip('该用户已是管理员');
    // 与后端 SetActivityAdminsDto ArrayMaxSize(20) 对齐
    if (this.data.adminList.length >= 20) return this.tip('管理员最多 20 个');
    this.setData({ adminList: [...this.data.adminList, u] });
  },

  removeAdminChip(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    this.setData({ adminList: this.data.adminList.filter((a) => a.id !== id) });
  },

  async saveAdmins() {
    const d = this.data.detail;
    if (!d) return;
    const ids = this.data.adminList.map((u) => u.id);
    const add = ids.filter((id) => !d.adminIds.includes(id));
    const remove = d.adminIds.filter((id) => !ids.includes(id));
    if (!add.length && !remove.length) {
      wx.showToast({ title: '无变更', icon: 'none' });
      return;
    }
    try {
      await setActivityAdmins(d.id, add, remove);
      wx.showToast({ title: '已保存', icon: 'success' });
      await this.load();
    } catch {
      /* toast 已在 request 内 */
    }
  },

  onTransferKwInput(e: WechatMiniprogram.Input) {
    const kw = e.detail.value;
    // 清空搜索条件时同步清空结果列表
    if (!kw.trim()) {
      this.setData({ transferKw: kw, transferResults: [] });
      return;
    }
    this.setData({ transferKw: kw });
  },

  async searchTransfer() {
    const q = this.data.transferKw.trim();
    if (!q) {
      this.setData({ transferResults: [] });
      return;
    }
    try {
      const r = await searchUsers(q, 20);
      this.setData({ transferResults: r.list });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  pickTransferTarget(e: WechatMiniprogram.TouchEvent) {
    const u = this.data.transferResults[Number(e.currentTarget.dataset.index)];
    if (!u) return;
    this.setData({ transferTarget: u });
  },

  clearTransferTarget() {
    this.setData({ transferTarget: null });
  },

  async doTransfer() {
    const d = this.data.detail;
    const t = this.data.transferTarget;
    if (!d || !t) return this.tip('请先搜索并选择目标用户');
    const { confirm } = await wx.showModal({ title: '转让发起人', content: `确定将发起人转让给「${t.nickname}」吗？` });
    if (!confirm) return;
    try {
      await transferInitiator(d.id, t.id);
      wx.showToast({ title: '已转让', icon: 'success' });
      this.setData({ transferTarget: null, transferKw: '', transferResults: [] });
      // 转让后当前用户可能不再具备发起人权限，重载驱动页面守卫回退
      await this.load();
    } catch {
      /* toast 已在 request 内 */
    }
  },
});
