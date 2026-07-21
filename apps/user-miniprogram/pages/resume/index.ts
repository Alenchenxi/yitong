import type { AppInstance } from '../../app';
import { getMyResume, upsertResume } from '../../services/job';

const AVAILABILITIES = ['周末', '工作日晚上', '全天', '寒暑假', '节假日'];

Page({
  data: {
    name: '',
    phone: '',
    selfIntro: '',
    experience: '',
    skillInput: '',
    skills: [] as string[],
    availOpts: AVAILABILITIES.map((a) => ({ label: a, selected: false })),
    saving: false,
    loaded: false,
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.load();
  },

  async load() {
    try {
      const r = await getMyResume();
      if (r) {
        this.setData({
          name: r.name,
          phone: r.phone,
          selfIntro: r.selfIntro ?? '',
          experience: r.experience ?? '',
          skills: r.skills,
          availOpts: AVAILABILITIES.map((a) => ({ label: a, selected: r.availabilities.includes(a) })),
        });
      }
      this.setData({ loaded: true });
    } catch {
      /* toast */
    }
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
        selfIntro: this.data.selfIntro.trim() || undefined,
        skills: this.data.skills,
        availabilities: this.data.availOpts.filter((o) => o.selected).map((o) => o.label),
        experience: this.data.experience.trim() || undefined,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch {
      /* toast */
    } finally {
      this.setData({ saving: false });
    }
  },
});
