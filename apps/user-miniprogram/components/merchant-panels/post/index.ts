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
import { chooseLocation } from '../../../utils/choose-location';

interface Opt {
  value: string;
  label: string;
  icon?: string;
  selected: boolean;
}
interface TagOpt {
  label: string;
  selected: boolean;
}

// P0-17 分类 / 结算方式选项（单选，从枚举标签生成）
const CATEGORY_OPTIONS: Opt[] = [
  ...(Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]).map((value) => ({
    value,
    label: JOB_CATEGORY_LABELS[value],
    selected: false,
  })),
  { value: 'CUSTOM', label: '自定义', icon: '💼', selected: false },
];
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
    // P2-79 去百度地图:location 只读 + wx.chooseLocation 直选返填(name+address 拼接展示文本)
    location: '',
    locationName: '', // 选点名称,兼作「已选点」标志(空=未选)
    locationLng: 0,
    locationLat: 0,
    categoryOptions: CATEGORY_OPTIONS,
    customSelected: false,
    customCategory: '',
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
        const customSelected = !!post.customCategory?.trim();
        const categoryOptions = this.data.categoryOptions.map((o) => ({
          ...o,
          selected: customSelected ? o.value === 'CUSTOM' : o.value === post.category,
        }));
        const settlementOptions = this.data.settlementOptions.map((o) => ({ ...o, selected: o.value === post.settlement }));
        const workDateOptions = this.data.workDateOptions.map((o) => ({ ...o, selected: post.workDates.includes(o.label) }));
        const workPeriodOptions = this.data.workPeriodOptions.map((o) => ({ ...o, selected: post.workPeriods.includes(o.label) }));
        this.setData({
          title: post.title,
          description: post.description,
          requirements: post.requirements ?? '',
          salary: post.salary,
          location: post.location,
          // P2-79:编辑回填只回显地址文本;坐标不回填表单(重选才带新坐标,编辑提交本就只传文本)
          locationName: '',
          locationLng: 0,
          locationLat: 0,
          categoryOptions,
          customSelected,
          customCategory: post.customCategory ?? '',
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
        locationName: '',
        locationLng: 0,
        locationLat: 0,
        categoryOptions: CATEGORY_OPTIONS.map((o) => ({ ...o })),
        customSelected: false,
        customCategory: '',
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

    // P2-79 去百度地图:直调 wx.chooseLocation 地图选点(修复原「跳 publish 页回填」断头路:
    // from=merchant 参数 publish 页从不读取、_pageShowListener 无调用方,选点回填走不通)
    async onPickLocation() {
      const loc = await chooseLocation();
      if (!loc) return;
      this.setData({
        locationName: loc.name,
        location: `${loc.name} ${loc.address}`.trim(),
        locationLng: loc.lng,
        locationLat: loc.lat,
      });
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
      // P2-77 编辑模式分类不可改（与发布时长同规则）
      if (this.data.isEdit) return;
      const value = e.currentTarget.dataset.value as string;
      const customSelected = value === 'CUSTOM';
      this.setData({
        categoryOptions: this.data.categoryOptions.map((o) => ({ ...o, selected: o.value === value })),
        customSelected,
        customCategory: customSelected ? this.data.customCategory : '',
      });
    },
    onCustomCategoryInput(e: WechatMiniprogram.Input) {
      this.setData({ customCategory: e.detail.value });
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
      const { title, description, requirements, salary, location, locationName, locationLng, locationLat, duration, headcount, urgent, online, isEdit, editId, customCategory } = this.data;
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
      if (category === 'CUSTOM' && !customCategory.trim()) {
        wx.showToast({ title: '请输入岗位类型', icon: 'none' });
        return;
      }
      const persistedCategory = (category === 'CUSTOM' ? 'LONG_TERM' : category) as JobCategory;
      const persistedCustomCategory = category === 'CUSTOM' ? customCategory.trim() : '';
      // P2-79:新增岗位必须经地图选点(locationName 为选点标志);编辑只需地址文本(历史行为)
      if (!isEdit && (!location.trim() || !locationName)) {
        wx.showToast({ title: '请先选择工作地点', icon: 'none' });
        return;
      }
      const workDates = this.data.workDateOptions.filter((o) => o.selected).map((o) => o.label);
      const workPeriods = this.data.workPeriodOptions.filter((o) => o.selected).map((o) => o.label);
      const hc = Math.max(1, Math.min(999, Number(headcount) || 1));
      this.setData({ submitting: true });
      try {
        if (isEdit && editId) {
          // M3-04 编辑岗位（P2-77：title/分类创建后不可改，不随编辑提交）
          await updateJobPost(editId, {
            description: description.trim(),
            requirements: requirements.trim() || undefined,
            salary: salary.trim(),
            location: location.trim(),
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
          // 创建草稿(P2-79:坐标 GCJ-02 原值直传,服务端转 BD-09;城市服务端解析)
          const post = await createJobPost({
            title: title.trim(),
            description: description.trim(),
            requirements: requirements.trim() || undefined,
            salary: salary.trim(),
            location: location.trim(),
            locationLng,
            locationLat,
            category: persistedCategory,
            customCategory: persistedCustomCategory || undefined,
            isCustomCategory: category === 'CUSTOM',
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
