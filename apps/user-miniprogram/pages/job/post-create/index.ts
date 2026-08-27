import {
  createJobPost,
  getJobTemplate,
  type JobPostVoExt,
  type JobTemplateVo,
} from '../../../services/job';
import { listCommunities, type CommunityVo } from '../../../services/community';
import type { AppInstance } from '../../../app';

interface PeriodOpt {
  label: string;
  selected: boolean;
}

// 智能生成流程(2026-08-10):截图 2 落地
Page({
  data: {
    selectedKey: '' as string,
    categoryLabel: '' as string,
    customCategory: '' as string,
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
    // 圈子：发岗归属圈子（下拉选择，默认商家当前圈子）
    communities: [] as CommunityVo[],
    selectedCommunityId: '',
    selectedCommunityName: '',
    selectedCommunityIndex: 0,
    communityLoadFailed: false, // 圈子列表加载失败：字段仍展示，点击重试
    pendingCommunityId: '', // publish 页已选圈子（opts.communityId），加载后优先预选
  },

  onLoad(opts: Record<string, string>) {
    this.setData({
      selectedKey: opts.selectedKey ?? '',
      categoryLabel: decodeURIComponent(opts.categoryLabel ?? ''),
      customCategory: decodeURIComponent(opts.customCategory ?? ''),
      // city 经 encodeURIComponent 编码传入(publish.onNext),必须 decode;
      // 否则中文城市编码后(如 %E5%8C%97%E4%BA%AC=24字符)超 CreateJobPostDto.locationCity @MaxLength(20) -> 创建 400,
      // 且顶部 chip 显示 %E5%8C%97... 乱码
      locationCity: decodeURIComponent(opts.city ?? ''),
      'form.location': decodeURIComponent(opts.address ?? ''),
      'form.locationPoiId': opts.poiId ?? '',
      'form.locationLng': Number(opts.lng ?? 0),
      'form.locationLat': Number(opts.lat ?? 0),
      'form.locationCity': decodeURIComponent(opts.city ?? ''),
      pendingCommunityId: opts.communityId ?? '',
    });
    this.loadCommunities();
    this.generate();
  },

  // 加载圈子供发岗选择：默认当前圈子（app.globalData.activeCommunityId），否则第一个
  // 加载失败不阻断发岗（服务端兜底商家当前圈子），但字段仍展示、可点击重试
  async loadCommunities() {
    try {
      const list = await listCommunities();
      if (list.length === 0) {
        this.setData({ communities: [], communityLoadFailed: true });
        return;
      }
      const app = getApp<AppInstance>();
      const activeId = app.globalData.activeCommunityId;
      // 预选优先级：publish 页所选圈子（pendingCommunityId）> 当前圈子 > 第一个
      const pending = this.data.pendingCommunityId;
      const prefer = list.find((c) => c.id === pending) ?? list.find((c) => c.id === activeId) ?? list[0]!;
      const idx = list.findIndex((c) => c.id === prefer.id);
      this.setData({
        communities: list,
        selectedCommunityId: prefer.id,
        selectedCommunityName: prefer.name,
        selectedCommunityIndex: idx >= 0 ? idx : 0,
        communityLoadFailed: false,
      });
    } catch {
      this.setData({ communityLoadFailed: true });
    }
  },

  onPickCommunity(e: WechatMiniprogram.TouchEvent) {
    // 列表为空（加载失败）：点击重试，不静默失效
    if (this.data.communities.length === 0) {
      this.loadCommunities();
      return;
    }
    const idx = Number(e.detail.value || 0);
    const c = this.data.communities[idx];
    if (c) this.setData({ selectedCommunityId: c.id, selectedCommunityName: c.name, selectedCommunityIndex: idx });
  },

  // 圈子列表为空（加载失败）时，picker 的 bindchange 大概率不触发，用行 tap 兜底触发重载
  onTapCommunityField() {
    if (this.data.communities.length === 0) this.loadCommunities();
  },

  async generate() {
    const { selectedKey, customCategory, form, seed, locationCity } = this.data;
    if (!selectedKey) return;
    try {
      const data: JobTemplateVo = await getJobTemplate({
        key: selectedKey,
        customCategory: selectedKey === 'CUSTOM' ? customCategory.trim() : undefined,
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
        customCategory:
          this.data.selectedKey === 'CUSTOM' ? this.data.customCategory.trim() : undefined,
        isCustomCategory: this.data.selectedKey === 'CUSTOM',
        settlement: f.settlement,
        workPeriods,
        headcount,
        duration: f.duration,
        communityId: this.data.selectedCommunityId || undefined,
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