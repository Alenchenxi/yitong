import {
  activityDetail,
  createLarkConnection,
  deleteLarkConnection,
  listLarkConnections,
  listSyncRecords,
  resolveBitable,
  retrySync,
  setLarkConfig,
  updateLarkConnection,
  verifyLarkConfig,
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
    // 新建/编辑连接表单（editingId 空 = 新建；secret 编辑留空 = 不修改）
    formVisible: false,
    editingId: '',
    formName: '',
    formAppId: '',
    formAppSecret: '',
    submitting: false,
    // 同步目标配置（发起人）：与发布页一致的粘贴链接识别流程，用户不接触 token 概念
    detail: null as ActivityDetailVo | null,
    canConfig: false,
    configured: false,
    cfgConnectionId: '',
    cfgConnectionName: '',
    cfgApp: '',
    cfgTable: '',
    cfgUrl: '',
    cfgTables: [] as Array<{ tableId: string; name: string }>,
    cfgTableName: '',
    resolvingCfg: false,
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
          this.setData({
            detail,
            canConfig: detail.canManage,
            configured: !!detail.larkConnectionId,
            cfgConnectionId: detail.larkConnectionId ?? '',
            cfgConnectionName: detail.larkConnectionId ? connections.find((c) => c.id === detail.larkConnectionId)?.name ?? '已选择连接' : '',
            cfgApp: detail.larkBitableApp ?? '',
            cfgTable: detail.larkBitableTable ?? '',
            cfgUrl: '',
            cfgTables: [],
            cfgTableName: '',
          });
          void this.refreshCfgTables();
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

  /** 已配置活动回显表名：用存储的 app/table 合成链接走识别拉表列表（失败静默回退显示原 table 值） */
  async refreshCfgTables() {
    const { cfgConnectionId, cfgApp, cfgTable } = this.data;
    if (!cfgConnectionId || !cfgApp) return;
    try {
      const r = await resolveBitable({
        connectionId: cfgConnectionId,
        url: `https://feishu.cn/base/${cfgApp}${cfgTable ? `?table=${cfgTable}` : ''}`,
      });
      const picked = r.tables.find((t) => t.tableId === cfgTable) ?? null;
      this.setData({ cfgTables: r.tables, cfgTableName: picked?.name ?? (cfgTable || '') });
    } catch {
      this.setData({ cfgTableName: cfgTable });
    }
  },

  onCfgConnectionPick(e: WechatMiniprogram.PickerChange) {
    const picked = this.data.connections[Number(e.detail.value)];
    // 换连接后原识别结果作废，需重新识别选表
    this.setData({
      cfgConnectionId: picked?.id ?? '',
      cfgConnectionName: picked?.name ?? '',
      cfgApp: '',
      cfgTable: '',
      cfgTableName: '',
      cfgUrl: '',
      cfgTables: [],
    });
  },

  onCfgUrlInput(e: WechatMiniprogram.Input) {
    const url = e.detail.value;
    if (!url.trim()) {
      this.setData({ cfgUrl: url, cfgTables: [], cfgTableName: '' });
      return;
    }
    this.setData({ cfgUrl: url });
  },

  async onCfgResolve() {
    const { cfgConnectionId, cfgUrl, resolvingCfg } = this.data;
    if (resolvingCfg) return;
    if (!cfgConnectionId) {
      wx.showToast({ title: '请先选择飞书连接', icon: 'none' });
      return;
    }
    if (!cfgUrl.trim()) {
      wx.showToast({ title: '请先粘贴多维表格链接', icon: 'none' });
      return;
    }
    this.setData({ resolvingCfg: true });
    try {
      const r = await resolveBitable({ connectionId: cfgConnectionId, url: cfgUrl.trim() });
      const picked = r.tables.find((t) => t.tableId === r.tableId) ?? null;
      this.setData({
        cfgApp: r.appToken,
        cfgTables: r.tables,
        cfgTable: picked?.tableId ?? '',
        cfgTableName: picked?.name ?? '',
      });
      wx.showToast({ title: `已识别：${r.tables.length} 个数据表`, icon: 'none' });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ resolvingCfg: false });
    }
  },

  onCfgTablePick(e: WechatMiniprogram.PickerChange) {
    const picked = this.data.cfgTables[Number(e.detail.value)];
    this.setData({ cfgTable: picked?.tableId ?? '', cfgTableName: picked?.name ?? '' });
  },

  async onSaveCfg() {
    if (this.data.submitting) return;
    const { cfgConnectionId, cfgApp, cfgTable } = this.data;
    if (!cfgConnectionId || !cfgApp || !cfgTable) {
      wx.showToast({ title: '请选择连接、识别链接并选择数据表', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      // 保存前强校验：连接凭证 → app_token 可达 → table 在数据表列表（失败时后端细分原因 toast 阻断）
      await verifyLarkConfig({ connectionId: cfgConnectionId, bitableApp: cfgApp, bitableTable: cfgTable });
      await setLarkConfig(this.data.activityId, {
        connectionId: cfgConnectionId,
        bitableApp: cfgApp,
        bitableTable: cfgTable,
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
    if (this.data.formVisible) {
      this.setData({ formVisible: false });
      return;
    }
    this.setData({ formVisible: true, editingId: '', formName: '', formAppId: '', formAppSecret: '' });
  },

  onEdit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const conn = this.data.connections.find((c) => c.id === id);
    if (!conn) return;
    this.setData({ formVisible: true, editingId: id, formName: conn.name, formAppId: conn.appId, formAppSecret: '' });
  },

  onFormInput(e: WechatMiniprogram.Input) {
    const key = e.currentTarget.dataset.key as 'formName' | 'formAppId' | 'formAppSecret';
    this.setData({ [key]: e.detail.value } as never);
  },

  async onSaveConn() {
    if (this.data.submitting) return;
    const { editingId, formName, formAppId, formAppSecret } = this.data;
    if (!formName.trim() || !formAppId.trim()) {
      wx.showToast({ title: '请完整填写连接信息', icon: 'none' });
      return;
    }
    if (!editingId && !formAppSecret.trim()) {
      wx.showToast({ title: '新建需填写 app_secret', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      if (editingId) {
        await updateLarkConnection(editingId, {
          name: formName.trim(),
          appId: formAppId.trim(),
          appSecret: formAppSecret.trim() || undefined,
        });
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        await createLarkConnection({ name: formName.trim(), appId: formAppId.trim(), appSecret: formAppSecret.trim() });
        wx.showToast({ title: '已创建', icon: 'success' });
      }
      this.setData({ formVisible: false, editingId: '', formName: '', formAppId: '', formAppSecret: '' });
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
