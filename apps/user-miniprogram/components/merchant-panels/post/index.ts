// 商家 shell 发布岗位 panel：发布 / 编辑岗位表单。
// onParams(params)：params.id 存在 -> 加载岗位编辑回填；无 id -> 保持当前表单态（点「发布」tab 首次进入为空表单新建）。
// 提交成功：编辑保存 -> resetForm 重置空表单 + switchtab jobs（post-edit 页 onSwitchTab navigateBack）；新建草稿 -> redirectTo 支付页。
import type { AppInstance } from '../../../app';
import {
  createJobPost,
  updateJobPost,
  getJobPost,
  JOB_CATEGORY_LABELS,
  SETTLEMENT_LABELS,
  type JobCategory,
  type Settlement,
  type JobPostVo,
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

Component({
  options: {
    addGlobalClass: true,
  },

  properties: {
    params: {
      type: Object,
      value: {},
      observer(n) {
        this.onParams((n || {}) as Record<string, unknown>);
      },
    },
  },

  data: {
    // M3-04 编辑模式
    editId: '' as string,
    isEdit: false as boolean,
    editingDuration: '' as string, // 编辑模式 duration 只读
    // 表单字段
    title: '',
    description: '',
    requirements: '',
    salary: '',
    // 2026-08-11:location 改为只读 + 选点返填(poiId/lng/lat/city + 地址)
    location: '',
    locationPoiId: '',
    locationLng: 0,
    locationLat: 0,
    locationCity: '',
    categoryOptions: CATEGORY_OPTIONS,
    settlementOptions: SETTLEMENT_OPTIONS,
    workDateOptions: WORK_DATE_OPTIONS,
    workPeriodOptions: WORK_PERIOD_OPTIONS,
    headcount: '1',
    urgent: false,
    online: false,
    questions: [] as string[],
    questionInput: '',
    duration: 'D30',
    submitting: false,
  },

  methods: {
    // shell 注入参数（params 带 _ts nonce）：id 存在 -> 编辑回填；无 id -> 不动表单态
    onParams(params: Record<string, unknown>) {
      const id = params.id as string | undefined;
      if (id) {
        this.setData({ editId: id, isEdit: true });
        this.loadPost(id);
      }
      // 无 id：保持当前表单态（点「发布」tab 首次进入为空表单新建）
    },

    // shell onShow 调用：保留 requireAuth；post panel 不重置表单，保持当前编辑态
    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
    },

    // M3-04 加载岗位详情回填表单
    async loadPost(id: string) {
      wx.showLoading({ title: '加载中' });
      try {
        const post: JobPostVo = await getJobPost(id);
        // 回填单选/多选状态
        const categoryOptions = this.data.categoryOptions.map((o) => ({ ...o, selected: o.value === post.category }));
        const settlementOptions = this.data.settlementOptions.map((o) => ({ ...o, selected: o.value === post.settlement }));
        const workDateOptions = this.data.workDateOptions.map((o) => ({ ...o, selected: post.workDates.includes(o.label) }));
        const workPeriodOptions = this.data.workPeriodOptions.map((o) => ({ ...o, selected: post.workPeriods.includes(o.label) }));
        const ext = post as JobPostVo & { locationPoiId?: string | null; locationLng?: number | null; locationLat?: number | null; locationCity?: string | null };
        this.setData({
          title: post.title,
          description: post.description,
          requirements: post.requirements ?? '',
          salary: post.salary,
          location: post.location,
          locationPoiId: ext.locationPoiId ?? '',
          locationLng: ext.locationLng ?? 0,
          locationLat: ext.locationLat ?? 0,
          locationCity: ext.locationCity ?? '',
          categoryOptions,
          settlementOptions,
          workDateOptions,
          workPeriodOptions,
          headcount: String(post.headcount),
          urgent: post.urgent,
          online: post.online,
          questions: post.questions ?? [],
          duration: post.duration,
          editingDuration: post.duration,
        });
      } catch {
        wx.showToast({ title: '加载岗位失败', icon: 'none' });
      } finally {
        wx.hideLoading();
      }
    },

    // 重置空表单（等价回到新建态）：编辑保存成功后调用
    resetForm() {
      this.setData({
        editId: '',
        isEdit: false,
        editingDuration: '',
        title: '',
        description: '',
        requirements: '',
        salary: '',
        location: '',
        locationPoiId: '',
        locationLng: 0,
        locationLat: 0,
        locationCity: '',
        categoryOptions: CATEGORY_OPTIONS.map((o) => ({ ...o })),
        settlementOptions: SETTLEMENT_OPTIONS.map((o) => ({ ...o })),
        workDateOptions: WORK_DATE_OPTIONS.map((o) => ({ ...o })),
        workPeriodOptions: WORK_PERIOD_OPTIONS.map((o) => ({ ...o })),
        headcount: '1',
        urgent: false,
        online: false,
        questions: [],
        questionInput: '',
        duration: 'D30',
        submitting: false,
      });
    },

    // 2026-08-11:点击选点 → 跳 publish 页选完返回回填
    onPickLocation() {
      wx.navigateTo({ url: '/pages/job/publish/index?from=merchant' });
    },

    // 监听 publish 页回填(redirectTo / navigateBack)—— 通过页面栈读 route 参数
    _pageShowListener() {
      const pages = getCurrentPages();
      // 找到当前页面栈顶(merchant 里嵌的 panel,page 是 merchant/index)
      const cur = pages[pages.length - 1];
      if (!cur) return;
      const opts = (cur as { options?: Record<string, string> }).options || {};
      if (opts.poiId && opts.lng && opts.lat) {
        this.setData({
          location: opts.address ?? '',
          locationPoiId: opts.poiId,
          locationLng: Number(opts.lng),
          locationLat: Number(opts.lat),
          locationCity: opts.city ?? '',
        });
      }
    },

    onInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as string;
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },

    pickDuration(e: WechatMiniprogram.TouchEvent) {
      // M3-04 编辑模式 duration 不可改
      if (this.data.isEdit) return;
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

    // P0-21 报名问题（动态增删）
    onQuestionInput(e: WechatMiniprogram.Input) {
      this.setData({ questionInput: e.detail.value });
    },
    addQuestion() {
      const q = this.data.questionInput.trim();
      if (!q) return;
      if (this.data.questions.includes(q)) {
        this.setData({ questionInput: '' });
        return;
      }
      this.setData({ questions: [...this.data.questions, q], questionInput: '' });
    },
    removeQuestion(e: WechatMiniprogram.TouchEvent) {
      const idx = Number(e.currentTarget.dataset.idx);
      this.setData({ questions: this.data.questions.filter((_, i) => i !== idx) });
    },

    async submit() {
      if (this.data.submitting) return;
      const { title, description, requirements, salary, location, locationPoiId, locationLng, locationLat, locationCity, duration, headcount, urgent, online, isEdit, editId } = this.data;
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
      // 2026-08-11:新增岗位必须 4 字段(poiId/lng/lat/city)都锁定,否则 40003
      if (!isEdit && (!locationPoiId || locationLng === 0 || locationLat === 0 || !locationCity)) {
        wx.showToast({ title: '请先选择工作地点', icon: 'none' });
        return;
      }
      const workDates = this.data.workDateOptions.filter((o) => o.selected).map((o) => o.label);
      const workPeriods = this.data.workPeriodOptions.filter((o) => o.selected).map((o) => o.label);
      const hc = Math.max(1, Math.min(999, Number(headcount) || 1));
      this.setData({ submitting: true });
      try {
        if (isEdit && editId) {
          // M3-04 编辑岗位
          await updateJobPost(editId, {
            title: title.trim(),
            description: description.trim(),
            requirements: requirements.trim() || undefined,
            salary: salary.trim(),
            location: location.trim(),
            category: category as JobCategory,
            settlement: settlement as Settlement,
            workDates,
            workPeriods,
            headcount: hc,
            urgent,
            online,
            questions: this.data.questions,
          });
          wx.showToast({ title: '已保存', icon: 'success' });
          // 提交成功：reset 空表单（回到新建态）+ 切回职位列表看更新
          setTimeout(() => {
            this.resetForm();
            this.triggerEvent('switchtab', { tab: 'jobs' });
          }, 600);
        } else {
          // 创建草稿(2026-08-11:补齐 4 字段)
          const post = await createJobPost({
            title: title.trim(),
            description: description.trim(),
            requirements: requirements.trim() || undefined,
            salary: salary.trim(),
            location: location.trim(),
            locationPoiId,
            locationLng,
            locationLat,
            locationCity,
            category: category as JobCategory,
            settlement: settlement as Settlement,
            workDates,
            workPeriods,
            headcount: hc,
            urgent,
            online,
            questions: this.data.questions.length > 0 ? this.data.questions : undefined,
            duration: duration as 'D30' | 'D90',
          });
          wx.showToast({ title: '创建成功', icon: 'success' });
          // 创建为草稿,跳付费发布(redirectTo:post-edit 页被支付页替换,返回直达职位列表)
          setTimeout(() => {
            wx.redirectTo({ url: `/pages/payment/index?jobPostId=${post.id}&duration=${duration}` });
          }, 600);
        }
      } catch (e) {
        // 2026-08-11:catch 错误不再静默,显示具体消息
        const msg = (e as { message?: string })?.message || '提交失败,请重试';
        wx.showModal({
          title: '提交失败',
          content: msg,
          showCancel: false,
          confirmText: '我知道了',
        });
      } finally {
        this.setData({ submitting: false });
      }
    },
  },
});
