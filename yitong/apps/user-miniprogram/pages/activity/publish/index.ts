import {
  activityDetail,
  createActivity,
  getActivityPublishScope,
  listLarkConnections,
  publishActivity,
  setActivityAdmins,
  setLarkConfig,
  transferInitiator,
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
    bitableApp: '',
    bitableTable: '',
    adminIdsInput: '',
    transferInput: '',
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
    }
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
          form: d.form,
        },
        communityId: d.communityId ?? '',
        adminIdsInput: d.adminIds.join(','),
      });
      if (d.isInitiator) {
        try {
          const conns = await listLarkConnections();
          this.setData({ connections: conns });
        } catch { /* 非阻断 */ }
      }
    } catch {
      /* toast 已在 request 内 */
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
    form.push({
      key: '',
      type,
      label: `字段${form.length + 1}`,
      required: false,
      placeholder: '',
      options: type === 'radio' || type === 'checkbox' ? ['选项1'] : undefined,
      order: form.length,
    });
    this.setData({ 'form.form': form });
  },

  onFieldInput(e: WechatMiniprogram.Input) {
    const { index, key } = e.currentTarget.dataset as { index: number; key: string };
    this.setData({ [`form.form[${index}].${key}`]: e.detail.value });
  },

  onFieldOptionsInput(e: WechatMiniprogram.Input) {
    const index = Number(e.currentTarget.dataset.index);
    const options = e.detail.value.split(/[，,]/).map((s) => s.trim()).filter(Boolean);
    this.setData({ [`form.form[${index}].options`]: options });
  },

  onFieldRequiredToggle(e: WechatMiniprogram.SwitchChange) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ [`form.form[${index}].required`]: e.detail.value });
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

  // ===== 高级配置（编辑模式） =====

  onAdminIdsInput(e: WechatMiniprogram.Input) {
    this.setData({ adminIdsInput: e.detail.value });
  },

  onTransferInput(e: WechatMiniprogram.Input) {
    this.setData({ transferInput: e.detail.value });
  },

  async saveAdmins() {
    const d = this.data.editing;
    if (!d) return;
    const add = this.data.adminIdsInput.split(/[，,]/).map((s) => s.trim()).filter(Boolean)
      .filter((id) => !d.adminIds.includes(id));
    const remove = d.adminIds.filter((id) => !this.data.adminIdsInput.split(/[，,]/).map((s) => s.trim()).includes(id));
    if (!add.length && !remove.length) {
      wx.showToast({ title: '无变更', icon: 'none' });
      return;
    }
    try {
      await setActivityAdmins(d.id, add, remove);
      wx.showToast({ title: '已保存', icon: 'success' });
      await this.loadDetail(d.id);
    } catch {
      /* toast 已在 request 内 */
    }
  },

  async doTransfer() {
    const d = this.data.editing;
    const target = this.data.transferInput.trim();
    if (!d || !target) return;
    const { confirm } = await wx.showModal({ title: '转让发起人', content: `确定将发起人转让给 ${target} 吗？` });
    if (!confirm) return;
    try {
      await transferInitiator(d.id, target);
      wx.showToast({ title: '已转让', icon: 'success' });
      await this.loadDetail(d.id);
    } catch {
      /* toast 已在 request 内 */
    }
  },

  onConnectionPick(e: WechatMiniprogram.PickerChange) {
    this.setData({ connectionId: this.data.connections[Number(e.detail.value)]?.id ?? '' });
  },

  onLarkInput(e: WechatMiniprogram.Input) {
    const key = e.currentTarget.dataset.key as 'bitableApp' | 'bitableTable';
    this.setData({ [key]: e.detail.value } as never);
  },

  async saveLark() {
    const d = this.data.editing;
    if (!d || !this.data.connectionId || !this.data.bitableApp || !this.data.bitableTable) {
      wx.showToast({ title: '请完整填写飞书配置', icon: 'none' });
      return;
    }
    try {
      await setLarkConfig(d.id, {
        connectionId: this.data.connectionId,
        bitableApp: this.data.bitableApp,
        bitableTable: this.data.bitableTable,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  goConnections() {
    wx.navigateTo({ url: '/pages/activity/connections/index' });
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
      if ((field.type === 'radio' || field.type === 'checkbox') && !(field.options ?? []).length) {
        return this.tip(`「${field.label}」至少需要一个选项`);
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
      form: f.form.map((field, i) => ({ ...field, order: i })),
    };
  },

  async onSubmit(e: WechatMiniprogram.TouchEvent) {
    if (this.data.submitting || !this.validate()) return;
    const publish = (e.currentTarget.dataset.publish as string) === '1';
    this.setData({ submitting: true });
    try {
      const payload = this.buildPayload();
      if (this.data.id) {
        await updateActivity(this.data.id, payload);
        if (publish && this.data.editing?.status === 'DRAFT') await publishActivity(this.data.id);
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        await createActivity({ ...payload, communityId: this.data.isPlatform ? undefined : this.data.communityId || undefined, publish });
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
