import {
  activityDetail,
  enrollActivity,
  updateMyEnrollment,
  type ActivityDetailVo,
  type ActivityFormData,
} from '../../../services/activity';
import { uploadImage } from '../../../services/upload';
import { requestActivityRemindSubscribe } from '../../../services/subscribe-message';

Page({
  data: {
    id: '',
    detail: null as ActivityDetailVo | null,
    values: {} as ActivityFormData,
    uploading: false,
    submitting: false,
    isModify: false,
  },

  onLoad(query: Record<string, string>) {
    this.setData({ id: query.id ?? '' });
  },

  async onShow() {
    if (!this.data.id || this.data.detail) return;
    try {
      const detail = await activityDetail(this.data.id);
      const values: ActivityFormData = {};
      for (const field of detail.form) {
        if (field.type === 'checkbox' || field.type === 'image') values[field.key] = [];
        else values[field.key] = '';
      }
      // 修改模式：回填本人最新提交资料
      if (detail.myEnrollment?.data) {
        for (const [key, value] of Object.entries(detail.myEnrollment.data)) {
          values[key] = value;
        }
      }
      this.setData({ detail, values, isModify: !!detail.myEnrollment });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  onInput(e: WechatMiniprogram.Input) {
    const key = e.currentTarget.dataset.key as string;
    this.setData({ [`values.${key}`]: e.detail.value });
  },

  onDatePick(e: WechatMiniprogram.PickerChange) {
    const key = e.currentTarget.dataset.key as string;
    this.setData({ [`values.${key}`]: e.detail.value as string });
  },

  onRadioPick(e: WechatMiniprogram.TouchEvent) {
    const { key, value } = e.currentTarget.dataset as { key: string; value: string };
    this.setData({ [`values.${key}`]: value });
  },

  onCheckboxToggle(e: WechatMiniprogram.TouchEvent) {
    const { key, value } = e.currentTarget.dataset as { key: string; value: string };
    const current = (this.data.values[key] as string[]) ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    this.setData({ [`values.${key}`]: next });
  },

  async onAddImage(e: WechatMiniprogram.TouchEvent) {
    if (this.data.uploading) return;
    const key = e.currentTarget.dataset.key as string;
    const current = (this.data.values[key] as string[]) ?? [];
    if (current.length >= 9) {
      wx.showToast({ title: '最多 9 张图片', icon: 'none' });
      return;
    }
    try {
      const res = await wx.chooseMedia({ count: 9 - current.length, mediaType: ['image'] });
      this.setData({ uploading: true });
      for (const file of res.tempFiles) {
        const url = await uploadImage(file.tempFilePath, 'common');
        this.setData({ [`values.${key}`]: [...((this.data.values[key] as string[]) ?? []), url] });
      }
    } catch {
      /* toast 已在 request 内或用户取消 */
    } finally {
      this.setData({ uploading: false });
    }
  },

  onRemoveImage(e: WechatMiniprogram.TouchEvent) {
    const { key, index } = e.currentTarget.dataset as { key: string; index: number };
    const current = ((this.data.values[key] as string[]) ?? []).filter((_, i) => i !== index);
    this.setData({ [`values.${key}`]: current });
  },

  onPreviewImage(e: WechatMiniprogram.TouchEvent) {
    const { key, index } = e.currentTarget.dataset as { key: string; index: number };
    const urls = (this.data.values[key] as string[]) ?? [];
    wx.previewImage({ current: urls[index], urls });
  },

  validate(): boolean {
    const d = this.data.detail;
    if (!d) return false;
    for (const field of d.form) {
      const value = this.data.values[field.key];
      const empty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (field.required && empty) {
        wx.showToast({ title: `请填写「${field.label}」`, icon: 'none' });
        return false;
      }
    }
    return true;
  },

  async onSubmit() {
    if (this.data.submitting || !this.validate()) return;
    this.setData({ submitting: true });
    try {
      // 报名场景请求活动提醒订阅授权（AC-015：未授权/未配置不影响站内通知）
      void await requestActivityRemindSubscribe();
      const id = this.data.id;
      if (this.data.isModify) {
        await updateMyEnrollment(id, this.data.values);
        wx.showToast({ title: '资料已提交', icon: 'success' });
      } else {
        await enrollActivity(id, this.data.values);
        wx.showToast({ title: '报名成功', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack(), 800);
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
