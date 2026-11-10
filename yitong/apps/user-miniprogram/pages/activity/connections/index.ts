import {
  createLarkConnection,
  deleteLarkConnection,
  listLarkConnections,
  listSyncRecords,
  retrySync,
  type LarkConnectionVo,
} from '../../../services/activity';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待同步',
  SYNCED: '同步成功',
  FAILED: '同步失败',
};

Page({
  data: {
    activityId: '',
    connections: [] as LarkConnectionVo[],
    syncRecords: [] as Array<{ id: string; userNickname: string; status: string; statusText: string; attempts: number; lastError: string | null; updatedAt: string }>,
    // 新建连接表单
    formVisible: false,
    formName: '',
    formAppId: '',
    formAppSecret: '',
    submitting: false,
  },

  onLoad(query: Record<string, string>) {
    this.setData({ activityId: query.activityId ?? '' });
  },

  onShow() {
    void this.reload();
  },

  async reload() {
    try {
      const connections = await listLarkConnections();
      this.setData({ connections });
      if (this.data.activityId) {
        const records = await listSyncRecords(this.data.activityId);
        this.setData({
          syncRecords: records.map((r) => ({ ...r, statusText: STATUS_TEXT[r.status] ?? r.status })),
        });
      }
    } catch {
      /* toast 已在 request 内 */
    }
  },

  toggleForm() {
    this.setData({ formVisible: !this.data.formVisible });
  },

  onFormInput(e: WechatMiniprogram.Input) {
    const key = e.currentTarget.dataset.key as 'formName' | 'formAppId' | 'formAppSecret';
    this.setData({ [key]: e.detail.value } as never);
  },

  async onCreate() {
    if (this.data.submitting) return;
    const { formName, formAppId, formAppSecret } = this.data;
    if (!formName.trim() || !formAppId.trim() || !formAppSecret.trim()) {
      wx.showToast({ title: '请完整填写连接信息', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await createLarkConnection({ name: formName.trim(), appId: formAppId.trim(), appSecret: formAppSecret.trim() });
      wx.showToast({ title: '已创建', icon: 'success' });
      this.setData({ formVisible: false, formName: '', formAppId: '', formAppSecret: '' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ submitting: false });
    }
  },

  async onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const { confirm } = await wx.showModal({ title: '删除连接', content: '确定删除该飞书连接吗？' });
    if (!confirm) return;
    try {
      await deleteLarkConnection(id);
      wx.showToast({ title: '已删除', icon: 'success' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    }
  },

  async onRetry() {
    try {
      const res = await retrySync(this.data.activityId);
      wx.showToast({ title: `已重试 ${res.retried} 条`, icon: 'none' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    }
  },
});
