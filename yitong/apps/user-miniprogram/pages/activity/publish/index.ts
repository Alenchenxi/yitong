import {
  activityDetail,
  createActivity,
  getActivityPublishScope,
  listLarkConnections,
  myActivityDraft,
  resolveBitable,
  verifyLarkConfig,
  publishActivity,
  setLarkConfig,
  updateActivity,
  type ActivityDetailVo,
  type ActivityFormField,
  type LarkConnectionVo,
} from '../../../services/activity';
import { getActiveCommunity } from '../../../services/community';
import { uploadImage } from '../../../services/upload';
import { chooseLocation } from '../../../utils/choose-location';

const FIELD_TYPES: Array<{ value: ActivityFormField['type']; label: string }> = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'radio', label: '单选' },
  { value: 'checkbox', label: '多选' },
  { value: 'date', label: '日期' },
  { value: 'phone', label: '手机号' },
  { value: 'wechat', label: '微信号' },
  { value: 'image', label: '图片上传' },
];

const FORMATS = [
  { value: 'OFFLINE', label: '线下' },
  { value: 'ONLINE', label: '线上' },
  { value: 'HYBRID', label: '线上+线下' },
];

// 日期时间选择状态：ISO 前端拆 date + time 两个 picker
interface FormState {
  title: string;
  coverImage: string;
  description: string;
  format: 'OFFLINE' | 'ONLINE' | 'HYBRID';
  location: string;
  joinLink: string;
  infoVisibility: 'PUBLIC' | 'APPROVED_ONLY';
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  enrollStartDate: string;
  enrollStartTime: string;
  enrollEndDate: string;
  enrollEndTime: string;
  joinMode: 'DIRECT' | 'REVIEW';
  capacity: string;
  form: ActivityFormField[];
}

const EMPTY_FORM: FormState = {
  title: '',
  coverImage: '',
  description: '',
  format: 'OFFLINE',
  location: '',
  joinLink: '',
  infoVisibility: 'PUBLIC',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  enrollStartDate: '',
  enrollStartTime: '',
  enrollEndDate: '',
  enrollEndTime: '',
  joinMode: 'DIRECT',
  capacity: '',
  form: [],
};

function splitIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function joinIso(date: string, time: string): string | undefined {
  if (!date) return undefined;
  // 本地时区 ISO
  const d = new Date(`${date}T${time || '00:00'}:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

Page({
  data: {
    id: '',
    editing: null as ActivityDetailVo | null,
    form: { ...EMPTY_FORM },
    fieldTypes: FIELD_TYPES,
    formats: FORMATS,
    communities: [] as Array<{ id: string; name: string }>,
    communityId: '',
    communityName: '',
    isPlatform: false,
    connections: [] as LarkConnectionVo[],
    connectionId: '',
    connectionName: '',
    // 飞书链接识别：larkUrl 为粘贴的链接，识别后 larkTables 供选表，bitableApp/Table 为内部存值
    larkUrl: '',
    larkTables: [] as Array<{ tableId: string; name: string }>,
    bitableTableName: '',
    bitableBaseName: '',
    resolving: false,
    bitableApp: '',
    bitableTable: '',
    newFieldTypeIndex: 0,
    uploading: false,
    submitting: false,
  },

  async onLoad(query: Record<string, string>) {
    // 发布范围：走 /activities/publish-scope 服务端口径（adminAccess 仅 admin 角色可刷新，用户角色下不可靠）
    try {
      const scope = await getActivityPublishScope();
      this.setData({ isPlatform: scope.platform, communities: scope.communities });
      if (!query.id && !scope.platform && !this.data.communityId) {
        const active = await getActiveCommunity().catch(() => null);
        const hit = scope.communities.find((c) => c.id === active?.id);
        if (hit) this.setData({ communityId: hit.id, communityName: hit.name });
      }
    } catch {
      /* toast 已在 request 内 */
    }
    if (query.id) {
      this.setData({ id: query.id });
      await this.loadDetail(query.id);
      return;
    }
    // 创建模式：有未发布草稿则自动载入（进入编辑草稿状态）
    const draft = await myActivityDraft().catch(() => null);
    if (draft?.id) {
      this.setData({ id: draft.id });
      await this.loadDetail(draft.id);
    }
  },

  async onShow() {
    // 连接列表每次显示时刷新：从「管理飞书连接」新建返回后 picker 才能看到新连接
    const conns = await listLarkConnections().catch(() => []);
    this.setData({ connections: conns });
  },

  async loadDetail(id: string) {
    try {
      const d = await activityDetail(id);
      const start = splitIso(d.startTime);
      const end = splitIso(d.endTime);
      const es = splitIso(d.enrollStartAt);
      const ee = splitIso(d.enrollEndAt);
      this.setData({
        editing: d,
        form: {
          title: d.title,
          coverImage: d.coverImage,
          description: d.description,
          format: d.format,
          location: d.location ?? '',
          joinLink: d.joinLink ?? '',
          infoVisibility: d.infoVisibility,
          startDate: start.date,
          startTime: start.time,
          endDate: end.date,
          endTime: end.time,
          enrollStartDate: es.date,
          enrollStartTime: es.time,
          enrollEndDate: ee.date,
          enrollEndTime: ee.time,
          joinMode: d.joinMode,
          capacity: d.capacity === null ? '' : String(d.capacity),
          form: d.form.map((f) =>
            (f.type === 'radio' || f.type === 'checkbox') && !f.options ? { ...f, options: [] } : f,
          ),
        },
        communityId: d.communityId ?? '',
        // 飞书同步配置回显
        connectionId: d.larkConnectionId ?? '',
        // 回显所选连接名称（onLoad 已先拉取连接列表）
        connectionName: this.data.connections.find((c) => c.id === d.larkConnectionId)?.name ?? '',
        bitableApp: d.larkBitableApp ?? '',
        bitableTable: d.larkBitableTable ?? '',
        // 识别结果重置，随后异步拉表列表回显表名
        larkUrl: '',
        larkTables: [],
        bitableTableName: '',
        bitableBaseName: '',
      });
      void this.refreshLarkTables();
    } catch {
      /* toast 已在 request 内 */
    }
  },

  /** 编辑回显：已有 app/table 配置时自动识别拉取数据表列表并回显表名（失败静默保留原 table 值） */
  async refreshLarkTables() {
    const { connectionId, bitableApp, bitableTable } = this.data;
    if (!connectionId || !bitableApp) return;
    try {
      const r = await resolveBitable({
        connectionId,
        url: `https://feishu.cn/base/${bitableApp}${bitableTable ? `?table=${bitableTable}` : ''}`,
      });
      const picked = r.tables.find((t) => t.tableId === bitableTable) ?? null;
      this.setData({ larkTables: r.tables, bitableTableName: picked?.name ?? (bitableTable || ''), bitableBaseName: r.baseName });
    } catch {
      this.setData({ bitableTableName: bitableTable });
    }
  },

  onInput(e: WechatMiniprogram.Input) {
    const key = e.currentTarget.dataset.key as keyof FormState;
    this.setData({ [`form.${key}`]: e.detail.value });
  },

  pickFormat(e: WechatMiniprogram.TouchEvent) {
    this.setData({ 'form.format': e.currentTarget.dataset.value as FormState['format'] });
  },

  pickJoinMode(e: WechatMiniprogram.TouchEvent) {
    this.setData({ 'form.joinMode': e.currentTarget.dataset.value as FormState['joinMode'] });
  },

  pickVisibility(e: WechatMiniprogram.TouchEvent) {
    this.setData({ 'form.infoVisibility': e.currentTarget.dataset.value as FormState['infoVisibility'] });
  },

  pickCommunity(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    const picked = this.data.communities[idx];
    this.setData({ communityId: picked?.id ?? '', communityName: picked?.name ?? '' });
  },

  // 地图选点（复用 utils/choose-location 的 wx.chooseLocation 封装，与 job 发岗同款；取消/失败静默）
  // 活动地点只存文本（模型无坐标字段），取 POI 名，坐标不入库
  async onChooseLocation() {
    const loc = await chooseLocation();
    if (!loc) return;
    this.setData({ 'form.location': loc.name || loc.address });
  },

  onDatePick(e: WechatMiniprogram.PickerChange) {
    const key = e.currentTarget.dataset.key as keyof FormState;
    this.setData({ [`form.${key}`]: e.detail.value as string });
  },

  onTimePick(e: WechatMiniprogram.PickerChange) {
    const key = e.currentTarget.dataset.key as keyof FormState;
    this.setData({ [`form.${key}`]: e.detail.value as string });
  },

  async onChooseCover() {
    if (this.data.uploading) return;
    try {
      const res = await wx.chooseMedia({ count: 1, mediaType: ['image'] });
      this.setData({ uploading: true });
      const url = await uploadImage(res.tempFiles[0]!.tempFilePath, 'activity');
      this.setData({ 'form.coverImage': url });
    } catch {
      /* 用户取消或 toast 已在 request 内 */
    } finally {
      this.setData({ uploading: false });
    }
  },

  // ===== 报名表单构建器 =====

  onFieldTypePick(e: WechatMiniprogram.PickerChange) {
    this.setData({ newFieldTypeIndex: Number(e.detail.value) });
  },

  addField() {
    const type = FIELD_TYPES[this.data.newFieldTypeIndex]!.value;
    const form = this.data.form.form;
    // 手机号/微信号字段名默认取类型名；占位文本预填「请填写{字段名}」（改字段名时自动跟随，见 onFieldInput）
    const label = type === 'phone' ? '手机号' : type === 'wechat' ? '微信号' : `字段${form.length + 1}`;
    form.push({
      key: '',
      type,
      label,
      required: false,
      placeholder: `请填写${label}`,
      options: type === 'radio' || type === 'checkbox' ? [''] : undefined,
      order: form.length,
    });
    this.setData({ 'form.form': form });
  },

  onFieldInput(e: WechatMiniprogram.Input) {
    const { index, key } = e.currentTarget.dataset as { index: number; key: string };
    // 占位文本处于「请填写{旧字段名}」自动形态时跟随字段名更新，手动改过则不联动
    if (key === 'label') {
      const field = this.data.form.form[index];
      if (field && field.placeholder === `请填写${field.label}`) {
        this.setData({ [`form.form[${index}].placeholder`]: `请填写${e.detail.value}` });
      }
    }
    this.setData({ [`form.form[${index}].${key}`]: e.detail.value });
  },

  onOptionInput(e: WechatMiniprogram.Input) {
    const { index, optIndex } = e.currentTarget.dataset as { index: number; optIndex: number };
    this.setData({ [`form.form[${index}].options[${optIndex}]`]: e.detail.value });
  },

  onOptionAdd(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const field = this.data.form.form[index];
    if (!field || (field.options ?? []).length >= 20) return this.tip('选项最多 20 个');
    this.setData({ [`form.form[${index}].options[${(field.options ?? []).length}]`]: '' });
  },

  onOptionRemove(e: WechatMiniprogram.TouchEvent) {
    const { index, optIndex } = e.currentTarget.dataset as { index: number; optIndex: number };
    const field = this.data.form.form[index];
    if (!field) return;
    this.setData({ [`form.form[${index}].options`]: (field.options ?? []).filter((_, i) => i !== optIndex) });
  },

  onFieldRequiredToggle(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const current = this.data.form.form[index]?.required ?? false;
    this.setData({ [`form.form[${index}].required`]: !current });
  },

  moveField(e: WechatMiniprogram.TouchEvent) {
    const { index, dir } = e.currentTarget.dataset as { index: number; dir: number };
    const form = this.data.form.form;
    const target = index + dir;
    if (target < 0 || target >= form.length) return;
    const moved = form.splice(index, 1)[0]!;
    form.splice(target, 0, moved);
    this.setData({ 'form.form': form.map((f, i) => ({ ...f, order: i })) });
  },

  removeField(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const form = this.data.form.form.filter((_, i) => i !== index);
    this.setData({ 'form.form': form.map((f, i) => ({ ...f, order: i })) });
  },

  onConnectionPick(e: WechatMiniprogram.PickerChange) {
    const picked = this.data.connections[Number(e.detail.value)];
    this.setData({ connectionId: picked?.id ?? '', connectionName: picked?.name ?? '' });
  },

  // ===== 飞书链接识别：粘贴 /base/ 或 /wiki/ 链接，自动解析 app_token 并按名称选数据表 =====

  onLarkUrlInput(e: WechatMiniprogram.Input) {
    const url = e.detail.value;
    // 清空链接时重置识别结果
    if (!url.trim()) {
      this.setData({ larkUrl: url, larkTables: [], bitableTableName: '', bitableBaseName: '' });
      return;
    }
    this.setData({ larkUrl: url });
  },

  async resolveLark() {
    const { connectionId, larkUrl, resolving } = this.data;
    if (resolving) return;
    if (!connectionId) return this.tip('请先选择飞书连接');
    if (!larkUrl.trim()) return this.tip('请先粘贴多维表格链接');
    this.setData({ resolving: true });
    try {
      const r = await resolveBitable({ connectionId, url: larkUrl.trim() });
      const picked = r.tables.find((t) => t.tableId === r.tableId) ?? null;
      this.setData({
        bitableApp: r.appToken,
        larkTables: r.tables,
        bitableTable: picked?.tableId ?? '',
        bitableTableName: picked?.name ?? '',
        bitableBaseName: r.baseName,
      });
      wx.showToast({ title: `已识别：${r.tables.length} 个数据表`, icon: 'none' });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ resolving: false });
    }
  },

  onTablePick(e: WechatMiniprogram.PickerChange) {
    const picked = this.data.larkTables[Number(e.detail.value)];
    this.setData({ bitableTable: picked?.tableId ?? '', bitableTableName: picked?.name ?? '' });
  },

  goConnections() {
    // 带上活动 id：同步状态/目标配置卡片依赖它渲染
    const q = this.data.id ? `?activityId=${this.data.id}` : '';
    wx.navigateTo({ url: `/pages/activity/connections/index${q}` });
  },

  // ===== 提交 =====

  validate(): boolean {
    const f = this.data.form;
    if (!f.title.trim()) return this.tip('请填写活动名称');
    if (!f.coverImage) return this.tip('请上传活动首图');
    if (!f.description.trim()) return this.tip('请填写活动介绍');
    if ((f.format === 'OFFLINE' || f.format === 'HYBRID') && !f.location.trim()) return this.tip('请填写活动地点');
    if ((f.format === 'ONLINE' || f.format === 'HYBRID') && !f.joinLink.trim()) return this.tip('请填写参与方式或链接');
    if (!this.data.isPlatform && !this.data.id && !this.data.communityId) return this.tip('请选择所属圈子');
    for (const field of f.form) {
      if (!field.label.trim()) return this.tip('表单字段名称不能为空');
      // 保留列名：与飞书同步固定列撞名的字段会被跳过不同步，创建时即拦截
      if (['报名编号', '用户', '状态', '报名时间', '更新时间'].includes(field.label.trim())) {
        return this.tip(`字段名「${field.label}」是同步保留列名，请换个名称`);
      }
      if ((field.type === 'radio' || field.type === 'checkbox') && !(field.options ?? []).some((o) => o.trim())) {
        return this.tip(`「${field.label}」至少需要一个非空选项`);
      }
    }
    if (f.capacity && (!Number.isInteger(Number(f.capacity)) || Number(f.capacity) < 1)) {
      return this.tip('人数上限须为正整数');
    }
    return true;
  },

  tip(message: string): false {
    wx.showToast({ title: message, icon: 'none' });
    return false;
  },

  buildPayload() {
    const f = this.data.form;
    return {
      title: f.title.trim(),
      coverImage: f.coverImage,
      description: f.description.trim(),
      format: f.format,
      location: f.location.trim() || undefined,
      joinLink: f.joinLink.trim() || undefined,
      infoVisibility: f.infoVisibility,
      startTime: joinIso(f.startDate, f.startTime),
      endTime: joinIso(f.endDate, f.endTime),
      enrollStartAt: joinIso(f.enrollStartDate, f.enrollStartTime),
      enrollEndAt: joinIso(f.enrollEndDate, f.enrollEndTime),
      joinMode: f.joinMode,
      capacity: f.capacity ? Number(f.capacity) : undefined,
      form: f.form.map((field, i) => ({
        ...field,
        order: i,
        // 空选项行静默丢弃，存值即文案
        options: field.options ? field.options.map((o) => o.trim()).filter(Boolean) : undefined,
      })),
    };
  },

  async onSubmit(e: WechatMiniprogram.TouchEvent) {
    if (this.data.submitting || !this.validate()) return;
    const publish = (e.currentTarget.dataset.publish as string) === '1';
    this.setData({ submitting: true });
    try {
      const payload = this.buildPayload();
      // 创建/保存前强校验飞书同步配置：填了才验，失败时后端细分原因已 toast 并抛错阻断提交
      if (this.data.connectionId && this.data.bitableApp && this.data.bitableTable) {
        await verifyLarkConfig({
          connectionId: this.data.connectionId,
          bitableApp: this.data.bitableApp,
          bitableTable: this.data.bitableTable,
        });
      }
      if (this.data.id) {
        await updateActivity(this.data.id, payload);
        // 编辑与创建语义一致：已填飞书配置随保存/发布一并落库（失败不阻断）
        if (this.data.connectionId && this.data.bitableApp && this.data.bitableTable) {
          await setLarkConfig(this.data.id, {
            connectionId: this.data.connectionId,
            bitableApp: this.data.bitableApp,
            bitableTable: this.data.bitableTable,
          }).catch(() => undefined);
        }
        if (publish && this.data.editing?.status === 'DRAFT') await publishActivity(this.data.id);
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        const created = await createActivity({ ...payload, communityId: this.data.isPlatform ? undefined : this.data.communityId || undefined, publish });
        // 创建时一并保存飞书同步配置（选填；失败不阻断创建）
        if (this.data.connectionId && this.data.bitableApp && this.data.bitableTable) {
          await setLarkConfig(created.id, {
            connectionId: this.data.connectionId,
            bitableApp: this.data.bitableApp,
            bitableTable: this.data.bitableTable,
          }).catch(() => undefined);
        }
        wx.showToast({ title: publish ? '已发布' : '已存草稿', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack(), 800);
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
