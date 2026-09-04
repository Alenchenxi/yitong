import type { AppInstance } from '../../app';
import { getMyResume, upsertResume, listResumeApplications, type ResumeApplicationVo } from '../../services/job';

const AVAILABILITIES = ['周末', '工作日晚上', '全天', '寒暑假', '节假日'];

const APP_STATUS_TEXT: Record<string, string> = {
  PENDING: '待处理',
  ACCEPTED: '已录用',
  DONE: '已完成',
  CANCELLED: '已取消',
  REJECTED: '未录用',
};

Page({
  data: {
    name: '',
    phone: '',
    wechat: '',
    selfIntro: '',
    experience: '',
    skillInput: '',
    skills: [] as string[],
    availOpts: AVAILABILITIES.map((a) => ({ label: a, selected: false })),
    saving: false,
    loaded: false,
    // P1-21 完整度
    completeness: 0,
    missingFields: [] as string[],
    hasResume: false,
    // P1-22 投递记录
    applications: [] as Array<ResumeApplicationVo & { statusText: string }>,
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.load();
  },

  async onShow() {
    // 从报名页返回后刷新投递记录
    if (this.data.loaded) await this.loadApplications();
  },

  async load() {
    try {
      const r = await getMyResume();
      if (r) {
        this.setData({
          name: r.name,
          phone: r.phone,
          wechat: r.wechat ?? '',
          selfIntro: r.selfIntro ?? '',
          experience: r.experience ?? '',
          skills: r.skills,
          availOpts: AVAILABILITIES.map((a) => ({ label: a, selected: r.availabilities.includes(a) })),
          completeness: r.completeness,
          missingFields: r.missingFields,
          hasResume: true,
        });
      } else {
        this.setData({ completeness: 0, missingFields: ['姓名', '联系方式', '自我介绍', '技能', '空闲时间', '工作经历'], hasResume: false });
      }
      this.setData({ loaded: true });
      await this.loadApplications();
    } catch {
      /* toast */
    }
  },

  // P1-22 加载投递记录
  async loadApplications() {
    try {
      const apps = await listResumeApplications();
      this.setData({
        applications: apps.map((a) => ({ ...a, statusText: APP_STATUS_TEXT[a.status] ?? a.status })),
      });
    } catch {
      /* ignore */
    }
  },

  goJobDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },

  onInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as string;
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },
  onSkillInput(e: WechatMiniprogram.Input) {
    this.setData({ skillInput: e.detail.value });
  },
  addSkill() {
    const s = this.data.skillInput.trim();
    if (!s) return;
    if (this.data.skills.includes(s)) {
      this.setData({ skillInput: '' });
      return;
    }
    this.setData({ skills: [...this.data.skills, s], skillInput: '' });
  },
  removeSkill(e: WechatMiniprogram.TouchEvent) {
    const s = e.currentTarget.dataset.s as string;
    this.setData({ skills: this.data.skills.filter((x) => x !== s) });
  },
  toggleAvail(e: WechatMiniprogram.TouchEvent) {
    const label = e.currentTarget.dataset.label as string;
    this.setData({
      availOpts: this.data.availOpts.map((o) => (o.label === label ? { ...o, selected: !o.selected } : o)),
    });
  },

  async save() {
    if (this.data.saving) return;
    const name = this.data.name.trim();
    const phone = this.data.phone.trim();
    if (!name || !phone) {
      wx.showToast({ title: '请填姓名和电话', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await upsertResume({
        name,
        phone,
        wechat: this.data.wechat.trim() || undefined,
        selfIntro: this.data.selfIntro.trim() || undefined,
        skills: this.data.skills,
        availabilities: this.data.availOpts.filter((o) => o.selected).map((o) => o.label),
        experience: this.data.experience.trim() || undefined,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      // P1-21 保存后刷新完整度 + 投递记录
      await this.load();
      setTimeout(() => wx.navigateBack(), 600);
    } catch {
      /* toast */
    } finally {
      this.setData({ saving: false });
    }
  },
});
