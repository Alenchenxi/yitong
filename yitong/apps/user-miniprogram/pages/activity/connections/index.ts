import {
  activityDetail,
  createLarkConnection,
  deleteLarkConnection,
  listLarkConnections,
  listSyncRecords,
  retrySync,
  setLarkConfig,
  type ActivityDetailVo,
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
    // 同步目标配置（发起人）
    detail: null as ActivityDetailVo | null,
    canConfig: false,
    configured: false,
    cfgConnectionId: '',
    cfgApp: '',
    cfgTable: '',
    cfgIndex: -1,
    cfgStableKey: '',
    stableOptions: [] as Array<{ key: string; label: string }>,
    stableLabel: '稳定数据项：报名编号（默认）',
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
        const detail = await activityDetail(this.data.activityId).catch(() => null);
        if (detail) {
          const stableOptions = [{ key: '', label: '稳定数据项：报名编号（默认）' }]
            .concat(detail.form.map((f) => ({ key: f.key, label: `稳定数据项：${f.label}` })));
          const stableKey = detail.larkStableKey ?? '';
          this.setData({
            detail,
            canConfig: detail.canManage,
            configured: !!detail.larkConnectionId,
            cfgConnectionId: detail.larkConnectionId ?? '',
            cfgApp: detail.larkBitableApp ?? '',
            cfgTable: detail.larkBitableTable ?? '',
            cfgIndex: detail.larkConnectionId ? connections.findIndex((c) => c.id === detail.larkConnectionId) : -1,
            cfgStableKey: stableKey,
            stableOptions,
            stableLabel: stableOptions.find((o) => o.key === stableKey)?.label ?? stableOptions[0]!.label,
          });
        }
        const records = await listSyncRecords(this.data.activityId);
        this.setData({
          syncRecords: records.map((r) => ({ ...r, statusText: STATUS_TEXT[r.status] ?? r.status })),
        });
      }
    } catch {
      /* toast 已在 request 内 */
    }
  },

  onCfgConnectionPick(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    const picked = this.data.connections[idx];
    this.setData({ cfgIndex: idx, cfgConnectionId: picked?.id ?? '' });
  },

  onCfgInput(e: WechatMiniprogram.Input) {
    const key = e.currentTarget.dataset.key as 'cfgApp' | 'cfgTable';
    this.setData({ [key]: e.detail.value } as never);
  },

  onCfgStablePick(e: WechatMiniprogram.PickerChange) {
    const picked = this.data.stableOptions[Number(e.detail.value)];
    if (!picked) return;
    this.setData({ cfgStableKey: picked.key, stableLabel: picked.label });
  },

  async onSaveCfg() {
    if (this.data.submitting) return;
    const { cfgConnectionId, cfgApp, cfgTable, cfgStableKey } = this.data;
    if (!cfgConnectionId || !cfgApp.trim() || !cfgTable.trim()) {
      wx.showToast({ title: '请选择连接并填全两个表格参数', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await setLarkConfig(this.data.activityId, {
        connectionId: cfgConnectionId,
        bitableApp: cfgApp.trim(),
        bitableTable: cfgTable.trim(),
        stableKey: cfgStableKey || undefined,
      });
      wx.showToast({ title: '同步配置已保存', icon: 'success' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ submitting: false });
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
