import type { AppInstance } from '../../../app';
import { getJobPost, getMyResume, applyJob, type JobPostVo, type ResumeVo } from '../../../services/job';
import { requestJobStatusSubscribe } from '../../../services/subscribe-message';

Page({
  data: {
    postId: '',
    post: null as JobPostVo | null,
    resume: null as ResumeVo | null,
    answers: [] as string[],
    applying: false,
    loaded: false,
  },

  async onLoad(query: Record<string, string | undefined>) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.setData({ postId: query.id ?? '' });
    await this.load();
  },

  async onShow() {
    // 从简历页返回后刷新简历
    if (this.data.postId && this.data.loaded) await this.loadResume();
  },

  async load() {
    if (!this.data.postId) return;
    try {
      const [post, resume] = await Promise.all([getJobPost(this.data.postId), getMyResume()]);
      this.setData({
        post,
        resume,
        answers: (post.questions ?? []).map(() => ''),
        loaded: true,
      });
    } catch {
      /* toast */
    }
  },

  async loadResume() {
    try {
      const resume = await getMyResume();
      this.setData({ resume });
    } catch {
      /* toast */
    }
  },

  onAnswerInput(e: WechatMiniprogram.Input) {
    const idx = Number(e.currentTarget.dataset.idx);
    const answers = [...this.data.answers];
    answers[idx] = e.detail.value;
    this.setData({ answers });
  },

  goResume() {
    wx.navigateTo({ url: '/pages/resume/index' });
  },

  async submit() {
    if (this.data.applying || !this.data.post) return;
    const questions = this.data.post.questions ?? [];
    for (let i = 0; i < questions.length; i += 1) {
      const a = this.data.answers[i] ?? '';
      if (!a.trim()) {
        wx.showToast({ title: `请回答第 ${i + 1} 题`, icon: 'none' });
        return;
      }
    }
    this.setData({ applying: true });
    try {
      await requestJobStatusSubscribe();
      await applyJob(this.data.postId, {
        resumeId: this.data.resume?.id,
        answers: questions.length > 0 ? this.data.answers.map((a) => (a ?? '').trim()) : undefined,
      });
      wx.showToast({ title: '报名成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch {
      /* 40002 重复报名 toast 已弹 */
    } finally {
      this.setData({ applying: false });
    }
  },
});
