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
  getBoostPlans,
  updateBoostPlanPrice,
  listBannersAdmin,
  createBannerAdmin,
  updateBannerAdmin,
  deleteBannerAdmin,
  toggleBannerAdmin,
  listCommunitiesAdmin,
  disableCommunityAdmin,
  enableCommunityAdmin,
  approveCommunityAdmin,
  rejectCommunityAdmin,
  getAppSettings,
  updateAppSetting,
  type ActivityTopicVo,
  type TopicVo,
  type AnonTagVo,
  type AdminJobPostVo,
  type PricingVo,
  type BoostPlanVo,
  type AdminBannerVo,
  type AdminCommunityVo,
} from '../../../services/admin';
import { uploadImage } from '../../../services/upload';
import {
  listAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AdminAnnouncementVo,
} from '../../../services/announcement';

type Sub = 'announce' | 'activity' | 'topic' | 'tags' | 'jobs' | 'pricing' | 'boost' | 'banner' | 'community' | 'settings';
const SUBS: Sub[] = ['announce', 'activity', 'topic', 'tags', 'jobs', 'pricing', 'boost', 'banner', 'community', 'settings'];

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
    // 推广价
    boostPlans: [] as BoostPlanVo[],
    editingBoostCode: '',
    editingBoostPrice: '',
    // 广告位 Banner
    banners: [] as AdminBannerVo[],
    bnTitle: '',
    bnImageUrl: '',
    bnLinkUrl: '',
    bnSortOrder: '',
    bnUploading: false,
    editingBannerId: '',
    editingBannerSort: '',
    editingBannerLink: '',
    // 圈子
    communities: [] as AdminCommunityVo[],
    cmKeyword: '',
    cmStatus: '' as '' | 'PENDING' | 'ACTIVE' | 'DISABLED', // P2-26 圈子状态筛选
    cmPendingCount: 0,
    // 全局设置
    needReviewEnabled: false,
    togglingNeedReview: false,
    tutorSyncMaxDemands: '100',
    savingTutorSync: false,
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
        } else if (sub === 'boost') {
          this.setData({ boostPlans: await getBoostPlans() });
        } else if (sub === 'banner') {
          this.setData({ banners: await listBannersAdmin() });
        } else if (sub === 'community') {
          const list = await listCommunitiesAdmin(this.data.cmStatus || undefined, this.data.cmKeyword || undefined);
          const pendingCount = (await listCommunitiesAdmin('PENDING')).length;
          this.setData({ communities: list, cmPendingCount: pendingCount });
        } else if (sub === 'settings') {
          const cfgList = await getAppSettings();
          const needReview = cfgList.find((item) => item.key === 'community.need_review');
          const maxDemands = cfgList.find((item) => item.key === 'tutor_sync.max_demands');
          this.setData({
            needReviewEnabled: needReview?.value === true,
            tutorSyncMaxDemands: typeof maxDemands?.value === 'number'
              ? String(maxDemands.value)
              : '100',
          });
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
      const price = Number(this.data.editingPrice);
      // E1 单价校验：防非数字 / 0 / 负数（后端 updatePricing 另有 60004 兜底）
      if (!Number.isFinite(price) || price <= 0) {
        wx.showToast({ title: '请输入大于 0 的单价', icon: 'none' });
        return;
      }
      await updatePricing({ duration: this.data.editingDuration as 'D30' | 'D90', price });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editingDuration: '', editingPrice: '' });
      this.load();
    },
    cancelEdit() {
      this.setData({ editingDuration: '', editingPrice: '' });
    },

    // ===== 推广价 =====
    startEditBoost(e: WechatMiniprogram.TouchEvent) {
      const { code, price } = e.currentTarget.dataset as { code: string; price: string };
      this.setData({ editingBoostCode: code, editingBoostPrice: price });
    },
    onBoostPriceInput(e: WechatMiniprogram.Input) {
      this.setData({ editingBoostPrice: e.detail.value });
    },
    async saveBoostPrice() {
      if (!this.data.editingBoostCode || !this.data.editingBoostPrice) return;
      const price = Number(this.data.editingBoostPrice);
      // 校验：防非数字 / 负数（后端 60004 兜底）
      if (!Number.isFinite(price) || price < 0) {
        wx.showToast({ title: '请输入有效的推广价', icon: 'none' });
        return;
      }
      await updateBoostPlanPrice(this.data.editingBoostCode, price);
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editingBoostCode: '', editingBoostPrice: '' });
      this.load();
    },
    cancelEditBoost() {
      this.setData({ editingBoostCode: '', editingBoostPrice: '' });
    },

    // ===== 广告位 Banner =====
    onBannerInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'bnTitle' | 'bnLinkUrl' | 'bnSortOrder';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },
    async chooseBannerImage() {
      if (this.data.bnUploading) return;
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        success: (res) => {
          const file = res.tempFiles[0];
          if (!file) return;
          this.setData({ bnUploading: true });
          uploadImage(file.tempFilePath, 'banner')
            .then((url) => this.setData({ bnImageUrl: url }))
            .catch(() => {})
            .finally(() => this.setData({ bnUploading: false }));
        },
      });
    },
    async createBanner() {
      if (!this.data.bnTitle.trim() || !this.data.bnImageUrl) {
        wx.showToast({ title: '请填标题并上传图片', icon: 'none' });
        return;
      }
      await createBannerAdmin({
        title: this.data.bnTitle.trim(),
        imageUrl: this.data.bnImageUrl,
        linkUrl: this.data.bnLinkUrl.trim() || null,
        sortOrder: Number(this.data.bnSortOrder) || 0,
        communityId: null, // 全局轮播（圈子维度广告后续按圈配置）
      });
      wx.showToast({ title: '已创建', icon: 'success' });
      this.setData({ bnTitle: '', bnImageUrl: '', bnLinkUrl: '', bnSortOrder: '' });
      this.load();
    },
    async toggleBanner(e: WechatMiniprogram.TouchEvent) {
      const { id, enabled } = e.currentTarget.dataset as { id: string; enabled: boolean };
      await toggleBannerAdmin(id, !enabled);
      this.load();
    },
    startEditBanner(e: WechatMiniprogram.TouchEvent) {
      const { id, sort, link } = e.currentTarget.dataset as { id: string; sort: number; link?: string | null };
      this.setData({ editingBannerId: id, editingBannerSort: String(sort), editingBannerLink: link ?? '' });
    },
    onEditBannerInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'editingBannerSort' | 'editingBannerLink';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },
    async saveBanner() {
      if (!this.data.editingBannerId) return;
      await updateBannerAdmin(this.data.editingBannerId, {
        sortOrder: Number(this.data.editingBannerSort) || 0,
        linkUrl: this.data.editingBannerLink || null,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editingBannerId: '', editingBannerSort: '', editingBannerLink: '' });
      this.load();
    },
    cancelEditBanner() {
      this.setData({ editingBannerId: '', editingBannerSort: '', editingBannerLink: '' });
    },
    async deleteBanner(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      await deleteBannerAdmin(id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.load();
    },

    // ===== 圈子（Community）管理 =====
    onCommunitySearch(e: WechatMiniprogram.Input) {
      this.setData({ cmKeyword: e.detail.value });
    },
    async searchCommunities() {
      this.load();
    },
    switchCmStatus(e: WechatMiniprogram.TouchEvent) {
      const s = e.currentTarget.dataset.s as '' | 'PENDING' | 'ACTIVE' | 'DISABLED';
      this.setData({ cmStatus: s });
      this.load();
    },
    async toggleCommunity(e: WechatMiniprogram.TouchEvent) {
      const { id, disabled } = e.currentTarget.dataset as { id: string; disabled: boolean };
      if (disabled) await enableCommunityAdmin(id);
      else await disableCommunityAdmin(id);
      wx.showToast({ title: disabled ? '已启用' : '已禁用', icon: 'success' });
      this.load();
    },
    // P2-26 待审圈子：通过
    async approveCommunity(e: WechatMiniprogram.TouchEvent) {
      const { id, name } = e.currentTarget.dataset as { id: string; name: string };
      wx.showModal({
        title: '通过审核',
        content: `确定通过「${name}」的审核？`,
        success: async (r) => {
          if (!r.confirm) return;
          await approveCommunityAdmin(id);
          wx.showToast({ title: '已通过', icon: 'success' });
          this.load();
        },
      });
    },
    // P2-26 待审圈子：拒绝（弹原因输入框）
    rejectCommunity(e: WechatMiniprogram.TouchEvent) {
      const { id, name } = e.currentTarget.dataset as { id: string; name: string };
      // 小程序 showModal 不支持 textarea，改用多行 confirm + 提示用户跳转
      wx.showModal({
        title: `拒绝「${name}」`,
        content: '确定拒绝此圈子的审核？',
        editable: true,
        placeholderText: '拒绝理由（1-200 字，必填）',
        success: async (r) => {
          if (!r.confirm) return;
          const reason = (r.content || '').trim();
          if (reason.length < 1 || reason.length > 200) {
            wx.showToast({ title: '拒绝理由 1-200 字', icon: 'none' });
            return;
          }
          await rejectCommunityAdmin(id, reason);
          wx.showToast({ title: '已拒绝', icon: 'success' });
          this.load();
        },
      });
    },
    // P2-26 全局设置 - 建圈审核开关
    async toggleNeedReview(e: WechatMiniprogram.SwitchChange) {
      const next = e.detail.value;
      if (this.data.togglingNeedReview) return;
      this.setData({ togglingNeedReview: true });
      try {
        await updateAppSetting('community.need_review', next);
        wx.showToast({ title: next ? '已开启审核' : '已关闭审核', icon: 'success' });
        this.load();
      } catch {
        /* toast */
      } finally {
        this.setData({ togglingNeedReview: false });
      }
    },
    onTutorSyncMaxInput(e: WechatMiniprogram.Input) {
      this.setData({ tutorSyncMaxDemands: e.detail.value });
    },
    async saveTutorSyncSettings() {
      if (this.data.savingTutorSync) return;
      const maxDemands = Number(this.data.tutorSyncMaxDemands);
      if (!Number.isInteger(maxDemands) || maxDemands < 1 || maxDemands > 200) {
        wx.showToast({ title: '请输入 1-200 的整数', icon: 'none' });
        return;
      }
      this.setData({ savingTutorSync: true });
      try {
        await updateAppSetting('tutor_sync.max_demands', maxDemands);
        wx.showToast({ title: '同步配置已保存', icon: 'success' });
        this.setData({ tutorSyncMaxDemands: String(maxDemands) });
      } catch {
        /* toast */
      } finally {
        this.setData({ savingTutorSync: false });
      }
    },
  },
});
