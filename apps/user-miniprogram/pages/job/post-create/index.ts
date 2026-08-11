import {
  createJobPost,
  getJobTemplate,
  type JobPostVoExt,
  type JobTemplateVo,
} from '../../../services/job';

interface PeriodOpt {
  label: string;
  selected: boolean;
}

// 智能生成流程(2026-08-10):截图 2 落地
Page({
  data: {
    selectedKey: '' as string,
    categoryLabel: '' as string,
    locationCity: '' as string,

    form: {
      title: '',
      description: '',
      requirements: '',
      salary: '',
      location: '',
      contactWechat: '',
      headcount: '1',
      duration: 'D30' as 'D30' | 'D90',
      settlement: 'DAILY' as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'COMPLETION',
      locationPoiId: '',
      locationLng: 0,
      locationLat: 0,
      locationCity: '',
    },
    settlements: [
      { value: 'DAILY', label: '日结' },
      { value: 'WEEKLY', label: '周结' },
      { value: 'MONTHLY', label: '月结' },
      { value: 'COMPLETION', label: '完工结' },
    ] as Array<{ value: string; label: string }>,
    workPeriodOptions: [
      { label: '上午', selected: false },
      { label: '下午', selected: false },
      { label: '晚上', selected: false },
      { label: '全天', selected: false },
      { label: '可商议', selected: false },
    ] as PeriodOpt[],
    showMore: false,
    attractivenessLabel: '吸引力计算中…',
    seed: 0,
    submitting: false,
  },

  onLoad(opts: Record<string, string>) {
    this.setData({
      selectedKey: opts.selectedKey ?? '',
      categoryLabel: decodeURIComponent(opts.categoryLabel ?? ''),
      // city 经 encodeURIComponent 编码传入(publish.onNext),必须 decode;
      // 否则中文城市编码后(如 %E5%8C%97%E4%BA%AC=24字符)超 CreateJobPostDto.locationCity @MaxLength(20) -> 创建 400,
      // 且顶部 chip 显示 %E5%8C%97... 乱码
      locationCity: decodeURIComponent(opts.city ?? ''),
      'form.location': decodeURIComponent(opts.address ?? ''),
      'form.locationPoiId': opts.poiId ?? '',
      'form.locationLng': Number(opts.lng ?? 0),
      'form.locationLat': Number(opts.lat ?? 0),
      'form.locationCity': decodeURIComponent(opts.city ?? ''),
    });
    this.generate();
  },

  async generate() {
    const { selectedKey, form, seed, locationCity } = this.data;
    if (!selectedKey) return;
    try {
      const data: JobTemplateVo = await getJobTemplate({
        key: selectedKey,
        location: locationCity || form.location,
        headcount: Number(form.headcount) || 1,
        seed,
      });
      this.setData({
        'form.title': data.title,
        'form.description': data.description,
        'form.salary': data.salary,
        'form.settlement': (data.settlementHint || 'COMPLETION') as
          | 'DAILY'
          | 'WEEKLY'
          | 'MONTHLY'
          | 'COMPLETION',
        // 智能生成流程:存 categoryMapTo 用于 createPost 落库
        '_categoryMapTo': data.categoryMapTo,
        attractivenessLabel: data.attractiveness.label,
        seed: data.nextSeed,
      });
    } catch {
      wx.showToast({ title: '智能生成失败', icon: 'none' });
    }
  },

  onFieldInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as string;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onRefreshTitle() {
    this.generate();
  },
  onRefreshDescription() {
    this.generate();
  },
  onClearDescription() {
    this.setData({ 'form.description': '' });
  },

  onPickSettlement(e: WechatMiniprogram.TouchEvent) {
    const v = e.currentTarget.dataset.value as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'COMPLETION';
    this.setData({ 'form.settlement': v });
  },
  onTogglePeriod(e: WechatMiniprogram.TouchEvent) {
    const label = e.currentTarget.dataset.label as string;
    const opts = this.data.workPeriodOptions.map((o) =>
      o.label === label ? { ...o, selected: !o.selected } : o,
    );
    this.setData({ workPeriodOptions: opts });
  },
  onPickDuration(e: WechatMiniprogram.TouchEvent) {
    const d = e.currentTarget.dataset.d as 'D30' | 'D90';
    this.setData({ 'form.duration': d });
  },
  onToggleMore() {
    this.setData({ showMore: !this.data.showMore });
  },
  onChangeLocation() {
    wx.navigateBack({ delta: 1 });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const f = this.data.form;
    if (!f.title.trim() || !f.description.trim() || !f.salary.trim() || !f.location.trim()) {
      wx.showToast({ title: '请填完整', icon: 'none' });
      return;
    }
    const workPeriods = this.data.workPeriodOptions.filter((o) => o.selected).map((o) => o.label);
    const headcount = Math.max(1, Math.min(999, Number(f.headcount) || 1));
    // 类别:模板响应 categoryMapTo 回填(已从智能生成接口拿到的枚举值)
    const mappedCategory = (f as Record<string, unknown>)._categoryMapTo as string | undefined;
    const category = (mappedCategory || 'LONG_TERM') as
      | 'CATERING' | 'RETAIL' | 'PROMOTION' | 'EXHIBITION' | 'TUTORING'
      | 'CAMPUS_AGENT' | 'ONLINE' | 'SURVEY' | 'INTERNSHIP' | 'LONG_TERM';
    this.setData({ submitting: true });
    try {
      const post: JobPostVoExt = await createJobPost({
        title: f.title.trim(),
        description: f.description.trim(),
        requirements: f.requirements.trim() || undefined,
        salary: f.salary.trim(),
        location: f.location.trim(),
        locationPoiId: f.locationPoiId || undefined,
        locationLng: f.locationLng || undefined,
        locationLat: f.locationLat || undefined,
        locationCity: f.locationCity || undefined,
        category,
        settlement: f.settlement,
        workPeriods,
        headcount,
        duration: f.duration,
      });
      wx.redirectTo({ url: `/pages/payment/index?jobPostId=${post.id}&duration=${f.duration}` });
    } catch (e) {
      console.error('createJobPost failed:', e);
      // request.ts 已弹后端真实错误;不再用"创建失败"覆盖,便于排查
    } finally {
      this.setData({ submitting: false });
    }
  },
});