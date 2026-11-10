import { activityDetail, listReminders, remindActivity, type ActivityDetailVo } from '../../../services/activity';

const KIND_TEXT: Record<string, string> = {
  AUTO_3D: '自动·前三天',
  AUTO_1D: '自动·前一天',
  MANUAL: '手动',
};

const RESULT_TEXT: Record<string, string> = {
  sent: '已发送',
  skipped_no_template: '未配置模板',
  skipped_rate_limited: '24h 限频跳过',
  skipped_already_sent: '已发过',
  failed: '失败',
};

Page({
  data: {
    id: '',
    detail: null as ActivityDetailVo | null,
    records: [] as Array<{ id: string; kind: string; kindText: string; userNickname: string; sentByNickname: string | null; resultText: string; createdAt: string }>,
    total: 0,
    page: 1,
    hasMore: false,
    sending: false,
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

  async reload() {
    try {
      const [detail, res] = await Promise.all([
        this.data.detail ? Promise.resolve(this.data.detail) : activityDetail(this.data.id),
        listReminders(this.data.id, 1),
      ]);
      this.setData({
        detail,
        page: 1,
        records: res.list.map((r) => ({ ...r, kindText: KIND_TEXT[r.kind] ?? r.kind, resultText: RESULT_TEXT[r.result] ?? r.result })),
        total: res.total,
        hasMore: res.list.length >= 20,
      });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  async loadMore() {
    try {
      const res = await listReminders(this.data.id, this.data.page + 1);
      this.setData({
        page: this.data.page + 1,
        records: [...this.data.records, ...res.list.map((r) => ({ ...r, kindText: KIND_TEXT[r.kind] ?? r.kind, resultText: RESULT_TEXT[r.result] ?? r.result }))],
        hasMore: res.list.length >= 20,
      });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  // 固定手动提醒：全部正式参与人（同人同活动 24h 一次，AC-016/038）
  async onRemindAll() {
    if (this.data.sending) return;
    const { confirm } = await wx.showModal({
      title: '发送提醒',
      content: '将向全部正式参与人发送活动提醒（每人 24 小时内最多一次），确定发送吗？',
    });
    if (!confirm) return;
    this.setData({ sending: true });
    try {
      const res = await remindActivity(this.data.id);
      wx.showToast({ title: `已发送（跳过 ${res.skipped} 人）`, icon: 'none' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ sending: false });
    }
  },
});
