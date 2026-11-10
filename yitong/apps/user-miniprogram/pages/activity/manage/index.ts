import {
  activityDetail,
  approveEnrollment,
  listEnrollments,
  remindActivity,
  rejectEnrollment,
  revokeEnrollment,
  type ActivityDetailVo,
  type ActivityEnrollmentVo,
} from '../../../services/activity';

const QUEUE_TABS: Array<{ key: string; label: string }> = [
  { key: 'PENDING_REVIEW', label: '待审核' },
  { key: 'RE_REVIEW', label: '资料复审' },
  { key: 'APPROVED', label: '正式参与人' },
  { key: 'WAITLIST', label: '候补' },
  { key: 'CANCELLED', label: '已取消' },
  { key: 'REVOKED', label: '已取消资格' },
  { key: 'REJECTED', label: '已拒绝' },
];

Page({
  data: {
    id: '',
    detail: null as ActivityDetailVo | null,
    tabs: QUEUE_TABS,
    activeTab: 'PENDING_REVIEW',
    list: [] as ActivityEnrollmentVo[],
    total: 0,
    page: 1,
    hasMore: false,
    loading: false,
    // 资料弹层
    viewing: null as ActivityEnrollmentVo | null,
    viewPending: false,
    viewingEntries: [] as Array<{ label: string; value: string }>,
    viewingPendingEntries: [] as Array<{ label: string; value: string }>,
    rejectId: '',
    rejectReason: '',
    revokeId: '',
    revokeReason: '',
    submitting: false,
  },

  onLoad(query: Record<string, string>) {
    this.setData({ id: query.id ?? '' });
  },

  onShow() {
    void this.reload();
  },

  onReachBottom() {
    if (this.data.hasMore) void this.loadMore();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as string;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key, page: 1 });
    void this.reload();
  },

  async reload() {
    this.setData({ page: 1 });
    try {
      const [detail, res] = await Promise.all([
        this.data.detail ? Promise.resolve(this.data.detail) : activityDetail(this.data.id),
        listEnrollments(this.data.id, this.data.activeTab, 1),
      ]);
      this.setData({ detail, list: res.list, total: res.total, hasMore: res.list.length >= 20 });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  async loadMore() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await listEnrollments(this.data.id, this.data.activeTab, this.data.page + 1);
      this.setData({
        page: this.data.page + 1,
        list: [...this.data.list, ...res.list],
        hasMore: res.list.length >= 20,
      });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ loading: false });
    }
  },

  viewData(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset as { id: string; pending: boolean };
    const item = this.data.list.find((x) => x.id === id) ?? null;
    if (!item) return;
    const labelOf = (key: string) => this.data.detail?.form.find((f) => f.key === key)?.label ?? key;
    const entriesOf = (data: Record<string, string | string[]> | null) =>
      data ? Object.entries(data).map(([key, value]) => ({ label: labelOf(key), value: Array.isArray(value) ? value.join('、') : String(value ?? '') })) : [];
    this.setData({
      viewing: item,
      viewingEntries: entriesOf(item.data),
      viewingPendingEntries: entriesOf(item.pendingData),
    });
  },

  closeView() {
    this.setData({ viewing: null });
  },

  async onApprove(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      await approveEnrollment(this.data.id, id);
      wx.showToast({ title: '已通过', icon: 'success' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ submitting: false });
    }
  },

  openReject(e: WechatMiniprogram.TouchEvent) {
    this.setData({ rejectId: e.currentTarget.dataset.id as string, rejectReason: '' });
  },

  onRejectInput(e: WechatMiniprogram.Input) {
    this.setData({ rejectReason: e.detail.value });
  },

  closeReject() {
    this.setData({ rejectId: '' });
  },

  async doReject() {
    if (!this.data.rejectId) return;
    try {
      await rejectEnrollment(this.data.id, this.data.rejectId, this.data.rejectReason.trim() || undefined);
      wx.showToast({ title: '已拒绝', icon: 'success' });
      this.setData({ rejectId: '' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    }
  },

  openRevoke(e: WechatMiniprogram.TouchEvent) {
    this.setData({ revokeId: e.currentTarget.dataset.id as string, revokeReason: '' });
  },

  onRevokeInput(e: WechatMiniprogram.Input) {
    this.setData({ revokeReason: e.detail.value });
  },

  closeRevoke() {
    this.setData({ revokeId: '' });
  },

  // 取消资格必填原因 + 二次确认（AC-023）
  async doRevoke() {
    const reason = this.data.revokeReason.trim();
    if (!this.data.revokeId) return;
    if (!reason) {
      wx.showToast({ title: '请填写取消原因', icon: 'none' });
      return;
    }
    const { confirm } = await wx.showModal({ title: '取消参与资格', content: `确定取消该用户资格？原因：${reason}` });
    if (!confirm) return;
    try {
      await revokeEnrollment(this.data.id, this.data.revokeId, reason);
      wx.showToast({ title: '已取消资格', icon: 'success' });
      this.setData({ revokeId: '' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    }
  },

  // 指定参与人手动提醒（AC-016/038：同人同活动 24h 一次，候补不在提醒对象中）
  async onRemindOne(e: WechatMiniprogram.TouchEvent) {
    const { id, uid, name } = e.currentTarget.dataset as { id: string; uid: string; name: string };
    const { confirm } = await wx.showModal({ title: '发送提醒', content: `向「${name}」发送活动提醒（24 小时内最多一次），确定发送吗？` });
    if (!confirm) return;
    try {
      const res = await remindActivity(this.data.id, [uid]);
      wx.showToast({ title: res.skipped > 0 ? '该用户 24h 内已提醒过' : '已发送', icon: 'none' });
    } catch {
      /* toast 已在 request 内 */
    }
  },
});
