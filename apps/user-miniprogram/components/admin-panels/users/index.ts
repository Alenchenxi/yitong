// 管理 shell「用户」panel（迁移自 pages/admin/users/index，Page -> Component）
// 3 个 sub-tab：用户 / 工单 / 管理员。sub-tab 切换 + 用户封禁/禁言 + 工单回复/重开 + 管理员 CRUD 逻辑全保留。
// onPanelShow requireAuth 后按当前 sub 加载；本 panel 无同端 tab 跳转，不发 switchtab 事件。
import type { AppInstance } from '../../../app';
import {
  listUsers,
  banUser,
  muteUser,
  listTickets,
  replyTicket,
  reopenTicket,
  listAdmins,
  searchCandidateUsers,
  createAdmin,
  deleteAdmin,
  type AdminUserVo,
  type AdminTicketVo,
  type ManagerVo,
  type CandidateUserVo,
} from '../../../services/admin';

type Sub = 'users' | 'tickets' | 'admins';
const SUBS: Sub[] = ['users', 'tickets', 'admins'];
const SUB_LABELS: Record<Sub, string> = { users: '用户封禁', tickets: '工单处理', admins: '管理员' };
let nextAddingFlowToken = 0;

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
    sub: 'users' as Sub,
    subLabels: SUB_LABELS,
    subs: SUBS,
    users: [] as AdminUserVo[],
    userKeyword: '',
    tickets: [] as AdminTicketVo[],
    ticketStatus: 'OPEN',
    admins: [] as ManagerVo[],
    adminKeyword: '',
    candidateKeyword: '',
    candidates: [] as CandidateUserVo[],
    showAddDialog: false,
    addingUserId: '',
    addingFlowToken: 0,
    loading: false,
  },

  methods: {
    /** shell 注入参数（带 _ts nonce）；E2 支持 dashboard「待处理工单」深链预选 tickets sub-tab */
    onParams(params: Record<string, unknown>) {
      const sub = params.sub as Sub | undefined;
      if (sub && SUBS.includes(sub)) {
        this.setData({ sub });
      }
    },

    /** 等价原 onShow：requireAuth + 加载当前 sub-tab */
    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      void this.load();
    },

    /** 用户/工单列表一次性返回，无分页加载更多 */
    onPanelReachBottom() {
      // no-op
    },

    /** 下拉刷新：重载当前 sub-tab（shell onPullDownRefresh 兜底 stopPullDownRefresh） */
    async onPanelPullDown() {
      await this.load();
      wx.stopPullDownRefresh();
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
        if (this.data.sub === 'users') {
          this.setData({ users: await listUsers(this.data.userKeyword || undefined) });
        } else if (this.data.sub === 'tickets') {
          this.setData({ tickets: await listTickets(this.data.ticketStatus) });
        } else {
          this.setData({ admins: await listAdmins(this.data.adminKeyword || undefined) });
        }
      } catch {
        /* toast */
      } finally {
        this.setData({ loading: false });
      }
    },

    // ===== 用户 =====
    onUserKeywordInput(e: WechatMiniprogram.Input) {
      this.setData({ userKeyword: e.detail.value });
    },
    searchUsers() {
      this.load();
    },
    banUserTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.showModal({
        title: '封禁用户',
        content: '封禁后用户无法登录，确定？',
        confirmColor: '#F53F3F',
        success: async (r) => {
          if (r.confirm) {
            await banUser(id);
            wx.showToast({ title: '已封禁', icon: 'success' });
            this.load();
          }
        },
      });
    },
    muteUserTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      const isMuted = !!(e.currentTarget.dataset.muted as string);
      if (isMuted) {
        void muteUser(id, 0).then(() => {
          wx.showToast({ title: '已解除禁言', icon: 'success' });
          this.load();
        });
        return;
      }
      wx.showModal({
        title: '禁言',
        editable: true,
        placeholderText: '禁言天数（1-365）',
        success: async (r) => {
          if (r.confirm) {
            const days = Number(r.content) || 1;
            await muteUser(id, days);
            wx.showToast({ title: `已禁言 ${days} 天`, icon: 'success' });
            this.load();
          }
        },
      });
    },

    // ===== 工单 =====
    switchTicketStatus(e: WechatMiniprogram.TouchEvent) {
      this.setData({ ticketStatus: e.currentTarget.dataset.s as string });
      this.load();
    },
    replyTicketTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.showModal({
        title: '回复工单',
        editable: true,
        placeholderText: '回复内容',
        confirmText: '回复并关闭',
        success: async (r) => {
          if (r.confirm && r.content?.trim()) {
            await replyTicket(id, r.content.trim(), true);
            wx.showToast({ title: '已回复并关闭', icon: 'success' });
            this.load();
          }
        },
      });
    },
    replyTicketKeepTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.showModal({
        title: '回复并保留处理中',
        editable: true,
        placeholderText: '回复内容（工单保持处理中）',
        confirmText: '回复',
        success: async (r) => {
          if (r.confirm && r.content?.trim()) {
            await replyTicket(id, r.content.trim(), false);
            wx.showToast({ title: '已回复（处理中）', icon: 'success' });
            this.load();
          }
        },
      });
    },
    reopenTicketTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      if (!id) return;
      wx.showModal({
        title: '重开工单',
        content: '重开后回复内容将被清空，需重新回复。确定？',
        confirmColor: '#F9C801',
        success: async (r) => {
          if (r.confirm) {
            await reopenTicket(id);
            wx.showToast({ title: '已重开', icon: 'success' });
            this.load();
          }
        },
      });
    },

    // ===== 管理员（P2-30）=====
    onAdminKeywordInput(e: WechatMiniprogram.Input) {
      this.setData({ adminKeyword: e.detail.value });
    },
    searchAdmins() {
      this.load();
    },
    openAddDialog() {
      if (this.data.addingUserId) return;
      this.setData({ showAddDialog: true, candidateKeyword: '', candidates: [] });
    },
    closeAddDialog() {
      if (this.data.addingUserId) return;
      this.setData({ showAddDialog: false });
    },
    onCandidateKeywordInput(e: WechatMiniprogram.Input) {
      this.setData({ candidateKeyword: e.detail.value });
    },
    async searchCandidates(silent = false) {
      const kw = this.data.candidateKeyword.trim();
      if (!kw) {
        if (silent !== true) wx.showToast({ title: '请输入昵称', icon: 'none' });
        return;
      }
      try {
        const list = await searchCandidateUsers(kw);
        this.setData({ candidates: list });
        if (!list.length && silent !== true) wx.showToast({ title: '无匹配用户', icon: 'none' });
      } catch {
        /* toast */
      }
    },
    addCandidateTap(e: WechatMiniprogram.TouchEvent) {
      if (this.data.addingUserId) return;
      const userId = e.currentTarget.dataset.userId as string;
      const nickname = e.currentTarget.dataset.userNickname as string;
      if (!userId) {
        wx.showToast({ title: '用户信息无效，请重试', icon: 'none' });
        return;
      }
      const flowToken = ++nextAddingFlowToken;
      this.setData({ addingUserId: userId, addingFlowToken: flowToken });
      const isCurrentAddingFlow = () =>
        this.data.addingUserId === userId && this.data.addingFlowToken === flowToken;
      const releaseAddingLock = () => {
        if (isCurrentAddingFlow()) {
          this.setData({ addingUserId: '', addingFlowToken: 0 });
        }
      };
      // 直接添加：跳过原生 wx.showModal 确认弹窗，避免与 .adm-dialog 自定义弹窗
      // 叠加在部分基础库下进入 fail 回调；addingFlowToken 锁保证幂等与异步竞态保护。
      void (async () => {
        try {
          await createAdmin(userId);
          if (!isCurrentAddingFlow()) return;
          // 刷新候选列表（该用户已被设为 admin，应排除）+ 刷新管理员列表
          await this.searchCandidates(true);
          await this.load();
          wx.showToast({ title: `已添加「${nickname || userId}」为管理员`, icon: 'success' });
        } catch {
          if (!isCurrentAddingFlow()) return;
          wx.showToast({ title: '添加失败，请重试', icon: 'none' });
        } finally {
          releaseAddingLock();
        }
      })();
    },
    deleteAdminTap(e: WechatMiniprogram.TouchEvent) {
      const a = e.currentTarget.dataset.admin as ManagerVo;
      if (a.isSelf) return; // 后端会拒，前端 disabled 兜底
      wx.showModal({
        title: '删除管理员',
        content: `删除「${a.linkedUser?.nickname || a.username}」的管理员权限？`,
        confirmColor: '#F53F3F',
        success: async (r) => {
          if (r.confirm) {
            try {
              await deleteAdmin(a.id);
              wx.showToast({ title: '已删除', icon: 'success' });
              this.load();
            } catch {
              /* toast */
            }
          }
        },
      });
    },
  },
});
