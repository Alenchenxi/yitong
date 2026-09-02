// P1-14 树洞问卷页：选类型 -> 逐题答 -> 提交 -> 结果标签
import type { AppInstance } from '../../../app';
import {
  getQuestionnaire,
  submitQuestionnaire,
  type QuizBank,
  type QuestionnaireType,
} from '../../../services/treehole';
import { requireAnonymousContentVisibility } from '../../../utils/anonymous-content';

const TYPES: Array<{ key: QuestionnaireType; title: string; desc: string; icon: string }> = [
  { key: 'personality', title: '性格测试', desc: '测测你的匿名性格画像', icon: '🧠' },
  { key: 'interest', title: '兴趣测试', desc: '发现你的兴趣标签', icon: '🎯' },
  { key: 'values', title: '三观问卷', desc: '了解你的价值取向', icon: '⚖️' },
  { key: 'mood', title: '心情问卷', desc: '记录此刻的心情状态', icon: '🌙' },
];

interface PageData {
  stage: 'select' | 'quiz' | 'result';
  types: typeof TYPES;
  bank: QuizBank | null;
  // answers: { [questionId]: optionId }
  answers: Record<string, string>;
  current: number; // 当前题号
  submitting: boolean;
  resultTags: string[];
}

Page({
  data: {
    stage: 'select',
    types: TYPES,
    bank: null,
    answers: {},
    current: 0,
    submitting: false,
    resultTags: [],
  } as PageData,

  async onLoad(options: { type?: string }) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    // 支持 ?type=xxx 直接进入对应问卷
    if (options?.type) {
      await this.startQuiz(options.type as QuestionnaireType);
    }
  },

  async pickType(e: WechatMiniprogram.TouchEvent) {
    const type = e.currentTarget.dataset.type as QuestionnaireType;
    await this.startQuiz(type);
  },

  async startQuiz(type: QuestionnaireType) {
    try {
      const bank = await getQuestionnaire(type);
      this.setData({ stage: 'quiz', bank, answers: {}, current: 0 });
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  pickOption(e: WechatMiniprogram.TouchEvent) {
    const { qid, oid } = e.currentTarget.dataset as { qid: string; oid: string };
    const answers = { ...this.data.answers, [qid]: oid };
    this.setData({ answers });
    // 自动翻下一题
    const bank = this.data.bank;
    if (!bank) return;
    const idx = bank.questions.findIndex((q) => q.id === qid);
    if (idx < bank.questions.length - 1) {
      setTimeout(() => this.setData({ current: idx + 1 }), 200);
    }
  },

  prev() {
    if (this.data.current > 0) this.setData({ current: this.data.current - 1 });
  },
  next() {
    const bank = this.data.bank;
    if (!bank) return;
    if (this.data.current < bank.questions.length - 1) {
      this.setData({ current: this.data.current + 1 });
    }
  },

  async submit() {
    const bank = this.data.bank;
    if (!bank || this.data.submitting) return;
    // 校验全部已答
    const unanswered = bank.questions.filter((q) => !this.data.answers[q.id]);
    if (unanswered.length > 0) {
      wx.showToast({ title: `还有 ${unanswered.length} 题未答`, icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const answers = bank.questions.map((q) => ({
        questionId: q.id,
        optionId: this.data.answers[q.id]!,
      }));
      const r = await submitQuestionnaire(bank.type, answers);
      this.setData({ stage: 'result', resultTags: r.resultTags });
      wx.showToast({ title: '已生成画像', icon: 'success' });
    } catch {
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  backToSelect() {
    this.setData({ stage: 'select', bank: null, answers: {}, current: 0, resultTags: [] });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/treehole/profile/index' });
  },
});
