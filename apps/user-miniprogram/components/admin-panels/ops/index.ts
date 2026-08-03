// 管理 shell「运营」panel（迁移自 pages/admin/ops/index，Page -> Component）
// 6 sub-tab（公告/活动专题/话题/树洞标签/岗位精品/单价）逻辑全部保留；
// bottom-tab 上移 shell，panel 不再持有 tabs/current；同端 tab 跳转改 switchtab 事件冒泡 shell。
import type { AppInstance } from '../../../app';
import {
  listActivityTopicsAdmin,
  createActivityTopic,
  deleteActivityTopic,
  listTopicsAdmin,
  createTopic,
  deleteTopic,
  listAnonTagsAdmin,
  createAnonTag,
  deleteAnonTag,
  updateAnonTag,
  listJobPostsAdmin,
  featureJob,
  getPricing,
  updatePricing,
  type ActivityTopicVo,
  type TopicVo,
  type AnonTagVo,
  type AdminJobPostVo,
  type PricingVo,
} from '../../../services/admin';
import {
  listAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AdminAnnouncementVo,
} from '../../../services/announcement';

type Sub = 'announce' | 'activity' | 'topic' | 'tags' | 'jobs' | 'pricing';
const SUBS: Sub[] = ['announce', 'activity', 'topic', 'tags', 'jobs', 'pricing'];

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
    sub: 'announce' as Sub,
    // 公告
    announcements: [] as AdminAnnouncementVo[],
    annTitle: '',
    annContent: '',
    // 活动专题
    activityTopics: [] as ActivityTopicVo[],
    actTitle: '',
    actDesc: '',
    // 话题
    topics: [] as TopicVo[],
    topicName: '',
    topicDesc: '',
    // 树洞标签
    anonTags: [] as AnonTagVo[],
    tagName: '',
    tagCategory: 'personality',
    tagSort: '',
    tagFilterCat: '',
    editingTagId: '',
    editingTagName: '',
    editingTagSort: '',
    // 岗位精品
    jobPosts: [] as AdminJobPostVo[],
    // 单价
    pricing: [] as PricingVo[],
    editingDuration: '',
    editingPrice: '',
    loading: false,
  },

  methods: {
    /** shell 注入参数（带 _ts nonce）；ops 暂不消费 shell params，空实现守接口 */
    onParams(_params: Record<string, unknown>) {
      // no-op：sub-tab 切换由页内 switchSub 处理
    },

    /** 等价原 onShow：requireAuth + 加载当前 sub-tab */
    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      void this.load();
    },

    /** ops 各 sub-tab 均为单页加载（无 cursor 翻页），空实现守接口 */
    onPanelReachBottom() {
      // no-op
    },

    onPanelPullDown() {
      this.load().finally(() => wx.stopPullDownRefresh());
    },

    switchSub(e: WechatMiniprogram.TouchEvent) {
      const s = e.currentTarget.dataset.sub as Sub;
      if (SUBS.includes(s)) {
        this.setData({ sub: s });
        void this.load();
      }
    },

    async load() {
      this.setData({ loading: true });
      try {
        const sub = this.data.sub;
        if (sub === 'announce') {
          this.setData({ announcements: await listAllAnnouncements() });
        } else if (sub === 'activity') {
          this.setData({ activityTopics: await listActivityTopicsAdmin() });
        } else if (sub === 'topic') {
          this.setData({ topics: await listTopicsAdmin() });
        } else if (sub === 'tags') {
          this.setData({ anonTags: await listAnonTagsAdmin(this.data.tagFilterCat || undefined) });
        } else if (sub === 'jobs') {
          this.setData({ jobPosts: await listJobPostsAdmin() });
        } else if (sub === 'pricing') {
          this.setData({ pricing: await getPricing() });
        }
      } catch {
        /* toast */
      } finally {
        this.setData({ loading: false });
      }
    },

    // ===== 公告 =====
    onAnnInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'annTitle' | 'annContent';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },
    async createAnn() {
      if (!this.data.annTitle.trim() || !this.data.annContent.trim()) {
        wx.showToast({ title: '请填标题和内容', icon: 'none' });
        return;
      }
      await createAnnouncement({ title: this.data.annTitle.trim(), content: this.data.annContent.trim() });
      wx.showToast({ title: '已发布', icon: 'success' });
      this.setData({ annTitle: '', annContent: '' });
      this.load();
    },
    async toggleAnn(e: WechatMiniprogram.TouchEvent) {
      const { id, active } = e.currentTarget.dataset as { id: string; active: boolean };
      await updateAnnouncement(id, { active: !active });
      this.load();
    },
    deleteAnn(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.showModal({
        title: '删除公告',
        content: '确定删除？',
        success: async (r) => {
          if (r.confirm) {
            await deleteAnnouncement(id);
            wx.showToast({ title: '已删除', icon: 'success' });
            this.load();
          }
        },
      });
    },

    // ===== 活动专题 =====
    onActInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'actTitle' | 'actDesc';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },
    async createAct() {
      if (!this.data.actTitle.trim()) {
        wx.showToast({ title: '请填标题', icon: 'none' });
        return;
      }
      await createActivityTopic({ title: this.data.actTitle.trim(), description: this.data.actDesc.trim() || undefined, status: 'PUBLISHED' });
      wx.showToast({ title: '已创建', icon: 'success' });
      this.setData({ actTitle: '', actDesc: '' });
      this.load();
    },
    deleteAct(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.showModal({
        title: '删除专题',
        content: '确定删除？关联帖关系会一并清除。',
        success: async (r) => {
          if (r.confirm) {
            await deleteActivityTopic(id);
            wx.showToast({ title: '已删除', icon: 'success' });
            this.load();
          }
        },
      });
    },

    // ===== 话题 =====
    onTopicInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'topicName' | 'topicDesc';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },
    async createTopic() {
      if (!this.data.topicName.trim()) {
        wx.showToast({ title: '请填话题名', icon: 'none' });
        return;
      }
      await createTopic({ name: this.data.topicName.trim(), description: this.data.topicDesc.trim() || undefined, status: 'PUBLISHED' });
      wx.showToast({ title: '已创建', icon: 'success' });
      this.setData({ topicName: '', topicDesc: '' });
      this.load();
    },
    deleteTopic(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.showModal({
        title: '删除话题',
        content: '确定删除？帖子关联会置空。',
        success: async (r) => {
          if (r.confirm) {
            await deleteTopic(id);
            wx.showToast({ title: '已删除', icon: 'success' });
            this.load();
          }
        },
      });
    },

    // ===== 树洞标签 =====
    onTagInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'tagName' | 'tagSort';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },
    pickTagCat(e: WechatMiniprogram.TouchEvent) {
      this.setData({ tagCategory: e.currentTarget.dataset.c as string });
    },
    async createTag() {
      if (!this.data.tagName.trim()) {
        wx.showToast({ title: '请填标签名', icon: 'none' });
        return;
      }
      await createAnonTag({ name: this.data.tagName.trim(), category: this.data.tagCategory, sortOrder: Number(this.data.tagSort) || 0 });
      wx.showToast({ title: '已创建', icon: 'success' });
      this.setData({ tagName: '', tagSort: '' });
      this.load();
    },
    deleteTag(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.showModal({
        title: '停用标签',
        content: '停用后标签将从用户画像消失，历史标签字符串保留但不再有效。确定？',
        success: async (r) => {
          if (r.confirm) {
            await deleteAnonTag(id);
            wx.showToast({ title: '已停用', icon: 'success' });
            this.load();
          }
        },
      });
    },
    async toggleTag(e: WechatMiniprogram.TouchEvent) {
      const { id, active } = e.currentTarget.dataset as { id: string; active: boolean };
      await updateAnonTag(id, { active: !active });
      wx.showToast({ title: !active ? '已启用' : '已停用', icon: 'success' });
      this.load();
    },
    switchTagCat(e: WechatMiniprogram.TouchEvent) {
      this.setData({ tagFilterCat: e.currentTarget.dataset.c as string });
      this.load();
    },
    startEditTag(e: WechatMiniprogram.TouchEvent) {
      const { id, name, sort } = e.currentTarget.dataset as { id: string; name: string; sort: number };
      this.setData({ editingTagId: id, editingTagName: name, editingTagSort: String(sort) });
    },
    onEditTagInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'editingTagName' | 'editingTagSort';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },
    async saveTag() {
      if (!this.data.editingTagName.trim()) {
        wx.showToast({ title: '请填标签名', icon: 'none' });
        return;
      }
      await updateAnonTag(this.data.editingTagId, { name: this.data.editingTagName.trim(), sortOrder: Number(this.data.editingTagSort) || 0 });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editingTagId: '', editingTagName: '', editingTagSort: '' });
      this.load();
    },
    cancelEditTag() {
      this.setData({ editingTagId: '', editingTagName: '', editingTagSort: '' });
    },

    // ===== 岗位精品 =====
    async toggleJobFeature(e: WechatMiniprogram.TouchEvent) {
      const { id, featured } = e.currentTarget.dataset as { id: string; featured: boolean };
      await featureJob(id, !featured);
      wx.showToast({ title: !featured ? '已设精品' : '已取消精品', icon: 'success' });
      this.load();
    },

    // ===== 单价 =====
    startEdit(e: WechatMiniprogram.TouchEvent) {
      const { dur, price } = e.currentTarget.dataset as { dur: string; price: string };
      this.setData({ editingDuration: dur, editingPrice: price });
    },
    onPriceInput(e: WechatMiniprogram.Input) {
      this.setData({ editingPrice: e.detail.value });
    },
    async savePrice() {
      if (!this.data.editingDuration || !this.data.editingPrice) return;
      await updatePricing({ duration: this.data.editingDuration as 'D30' | 'D90', price: Number(this.data.editingPrice) });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editingDuration: '', editingPrice: '' });
      this.load();
    },
    cancelEdit() {
      this.setData({ editingDuration: '', editingPrice: '' });
    },
  },
});
