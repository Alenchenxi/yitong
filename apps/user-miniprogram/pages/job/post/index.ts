import type { AppInstance } from '../../../app';
import {
  createJobPost,
  JOB_CATEGORY_LABELS,
  SETTLEMENT_LABELS,
  type JobCategory,
  type Settlement,
} from '../../../services/job';

interface Opt {
  value: string;
  label: string;
  selected: boolean;
}
interface TagOpt {
  label: string;
  selected: boolean;
}

// P0-17 分类 / 结算方式选项（单选，从枚举标签生成）
const CATEGORY_OPTIONS: Opt[] = (Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]).map((value) => ({
  value,
  label: JOB_CATEGORY_LABELS[value],
  selected: false,
}));
const SETTLEMENT_OPTIONS: Opt[] = (Object.keys(SETTLEMENT_LABELS) as Settlement[]).map((value) => ({
  value,
  label: SETTLEMENT_LABELS[value],
  selected: false,
}));
// P0-17 工作日期 / 工作时段（多选，与后端白名单一致）
const WORK_DATE_OPTIONS: TagOpt[] = ['周一', '周二', '周三', '周四', '周五', '周六', '周日', '可商议'].map((label) => ({
  label,
  selected: false,
}));
const WORK_PERIOD_OPTIONS: TagOpt[] = ['上午', '下午', '晚上', '全天', '可商议'].map((label) => ({
  label,
  selected: false,
}));

Page({
  data: {
    title: '',
    description: '',
    salary: '',
    location: '',
    categoryOptions: CATEGORY_OPTIONS,
    settlementOptions: SETTLEMENT_OPTIONS,
    workDateOptions: WORK_DATE_OPTIONS,
    workPeriodOptions: WORK_PERIOD_OPTIONS,
    headcount: '1',
    urgent: false,
    online: false,
    duration: 'D30',
    submitting: false,
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
  },

  onInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as string;
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },

  pickDuration(e: WechatMiniprogram.TouchEvent) {
    this.setData({ duration: e.currentTarget.dataset.d as 'D30' | 'D90' });
  },

  // P0-17 分类 / 结算（单选）
  pickCategory(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string;
    this.setData({
      categoryOptions: this.data.categoryOptions.map((o) => ({ ...o, selected: o.value === value })),
    });
  },
  pickSettlement(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string;
    this.setData({
      settlementOptions: this.data.settlementOptions.map((o) => ({ ...o, selected: o.value === value })),
    });
  },
  // P0-17 工作日期 / 工作时段（多选）
  toggleWorkDate(e: WechatMiniprogram.TouchEvent) {
    const label = e.currentTarget.dataset.label as string;
    this.setData({ workDateOptions: this.toggleTag(this.data.workDateOptions, label) });
  },
  toggleWorkPeriod(e: WechatMiniprogram.TouchEvent) {
    const label = e.currentTarget.dataset.label as string;
    this.setData({ workPeriodOptions: this.toggleTag(this.data.workPeriodOptions, label) });
  },
  toggleTag(opts: TagOpt[], label: string): TagOpt[] {
    return opts.map((o) => (o.label === label ? { ...o, selected: !o.selected } : o));
  },

  onHeadcountInput(e: WechatMiniprogram.Input) {
    const raw = (e.detail.value as string).replace(/[^0-9]/g, '');
    this.setData({ headcount: raw });
  },
  toggleUrgent() {
    this.setData({ urgent: !this.data.urgent });
  },
  toggleOnline() {
    this.setData({ online: !this.data.online });
  },

  async submit() {
    if (this.data.submitting) return;
    const { title, description, salary, location, duration, headcount, urgent, online } = this.data;
    const category = this.data.categoryOptions.find((o) => o.selected)?.value;
    const settlement = this.data.settlementOptions.find((o) => o.selected)?.value;
    if (!title.trim() || !description.trim() || !salary.trim() || !location.trim()) {
      wx.showToast({ title: '请填完整', icon: 'none' });
      return;
    }
    if (!category || !settlement) {
      wx.showToast({ title: '请选择分类和结算方式', icon: 'none' });
      return;
    }
    const workDates = this.data.workDateOptions.filter((o) => o.selected).map((o) => o.label);
    const workPeriods = this.data.workPeriodOptions.filter((o) => o.selected).map((o) => o.label);
    const hc = Math.max(1, Math.min(999, Number(headcount) || 1));
    this.setData({ submitting: true });
    try {
      const post = await createJobPost({
        title: title.trim(),
        description: description.trim(),
        salary: salary.trim(),
        location: location.trim(),
        category: category as JobCategory,
        settlement: settlement as Settlement,
        workDates,
        workPeriods,
        headcount: hc,
        urgent,
        online,
        duration: duration as 'D30' | 'D90',
      });
      wx.showToast({ title: '创建成功', icon: 'success' });
      // 创建为草稿，跳付费发布（feat/payment）
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/payment/index?jobPostId=${post.id}&duration=${duration}` });
      }, 600);
    } catch {
      /* toast */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
