// 管理 shell「用户」panel（迁移自 pages/admin/users/index，Page -> Component）
// 3 个 sub-tab：用户 / 工单 / 管理员。sub-tab 切换 + 用户封禁/禁言 + 工单回复/重开 + 管理员 CRUD 逻辑全保留。
// onPanelShow requireAuth 后按当前 sub 加载；本 panel 无同端 tab 跳转，不发 switchtab 事件。
import type { AppInstance } from '../../../app';
import {
  listUsers,
  banUser,
  unbanUser,
  muteUser,
  getModerationContexts,
  listTickets,
  replyTicket,
  reopenTicket,
  listAdmins,
  searchCandidateUsers,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  listAdminTypes,
  listAdminPermissions,
  createAdminType,
  updateAdminType,
  deleteAdminType,
  listCommunitiesAdmin,
  type AdminUserVo,
  type AdminTicketVo,
  type ManagerVo,
  type CandidateUserVo,
  type AdminTypeVo,
  type AdminPermissionVo,
  type AdminCommunityVo,
  type AdminModerationScope,
  type ModerationContextsVo,
} from '../../../services/admin';

type Sub = 'users' | 'tickets' | 'admins' | 'adminTypes';
const SUBS: Sub[] = ['users', 'tickets', 'admins', 'adminTypes'];
const SUB_LABELS: Record<Sub, string> = {
  users: '用户封禁',
  tickets: '工单处理',
  admins: '管理员',
  adminTypes: '管理员类型',
};
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
    subs: [] as Sub[],
    users: [] as AdminUserVo[],
    userKeyword: '',
    userScopes: [] as ModerationContextsVo['scopes'],
    userCommunities: [] as ModerationContextsVo['communities'],
    userScope: 'COMMUNITY' as AdminModerationScope,
    userCommunityId: '',
    userCommunityIndex: 0,
    isPlatformAdmin: false,
    tickets: [] as AdminTicketVo[],
    ticketStatus: 'OPEN',
    admins: [] as ManagerVo[],
    adminKeyword: '',
    candidateKeyword: '',
    candidates: [] as CandidateUserVo[],
    showAddDialog: false,
    addingUserId: '',
    addingFlowToken: 0,
    adminTypes: [] as AdminTypeVo[],
    permissions: [] as AdminPermissionVo[],
    permissionOptions: [] as Array<AdminPermissionVo & { checked: boolean }>,
    scopeCommunities: [] as AdminCommunityVo[],
    scopeCommunityOptions: [] as Array<AdminCommunityVo & { selected: boolean }>,
    selectedAdminTypeId: '',
    selectedAdminTypeIndex: 0,
    allCommunities: false,
    selectedCommunityIds: [] as string[],
    editingManagerId: '',
    typeFormId: '',
    typeName: '',
    typeCode: '',
    typeDescription: '',
    typePermissionCodes: [] as string[],
    loading: false,
    requestVersion: 0,
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
      const access = app.globalData.adminAccess;
      if (!access) return;
      const can = (permission: string) =>
        access.isPlatform || access.permissions.includes(permission);
      const subs = SUBS.filter((sub) => (
        (sub === 'users' && can('user.manage'))
        || (sub === 'tickets' && can('ticket.manage'))
        || (sub === 'admins' && access.isPlatform && can('admin.manage'))
        || (sub === 'adminTypes' && access.isPlatform && can('admin_type.manage'))
      ));
      const sub = subs.includes(this.data.sub) ? this.data.sub : subs[0];
      if (!sub) return;
      this.setData({ subs, sub, isPlatformAdmin: access.isPlatform });
      if (sub === 'users') {
        void this.ensureUserContexts().then(() => this.load());
      } else {
        void this.load();
      }
    },

    async ensureUserContexts() {
      if (this.data.userScopes.length > 0) return;
      const contexts = await getModerationContexts();
      const scope = contexts.scopes.some((item) => item.scope === 'PLATFORM') ? 'PLATFORM' : 'COMMUNITY';
      const firstCommunityId = scope === 'COMMUNITY' ? (contexts.communities[0]?.id ?? '') : '';
      this.setData({
        userScopes: contexts.scopes,
        userCommunities: contexts.communities,
        userScope: scope,
        userCommunityId: firstCommunityId,
        userCommunityIndex: 0,
      });
    },

    userQuery() {
      return {
        scope: this.data.userScope,
        communityId: this.data.userScope === 'COMMUNITY' ? this.data.userCommunityId : undefined,
      };
    },

    switchUserScope(e: WechatMiniprogram.TouchEvent) {
      const scope = e.currentTarget.dataset.scope as AdminModerationScope;
      if (!this.data.userScopes.some((item) => item.scope === scope)) return;
      this.setData({
        userScope: scope,
        userCommunityIndex: 0,
        userCommunityId: scope === 'COMMUNITY' ? (this.data.userCommunities[0]?.id ?? '') : '',
      });
      void this.load();
    },

    onUserCommunityChange(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value) || 0;
      this.setData({
        userCommunityIndex: index,
        userCommunityId: this.data.userCommunities[index]?.id ?? '',
      });
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
      const requestVersion = this.data.requestVersion + 1;
      const sub = this.data.sub;
      const userKeyword = this.data.userKeyword || undefined;
      const userQuery = this.userQuery();
      const ticketStatus = this.data.ticketStatus;
      const adminKeyword = this.data.adminKeyword || undefined;
      this.setData({ loading: true, requestVersion });
      try {
        if (sub === 'users') {
          const users = await listUsers(userKeyword, userQuery);
          if (this.data.requestVersion !== requestVersion) return;
          this.setData({ users });
        } else if (sub === 'tickets') {
          const tickets = await listTickets(ticketStatus);
          if (this.data.requestVersion !== requestVersion) return;
          this.setData({ tickets });
        } else if (sub === 'admins') {
          const admins = await listAdmins(adminKeyword);
          if (this.data.requestVersion !== requestVersion) return;
          this.setData({ admins });
        } else {
          const [adminTypes, permissions] = await Promise.all([
            listAdminTypes(),
            listAdminPermissions(),
          ]);
          if (this.data.requestVersion !== requestVersion) return;
          this.setData({
            adminTypes,
            permissions,
            permissionOptions: permissions.map((item) => ({
              ...item,
              checked: this.data.typePermissionCodes.includes(item.code),
            })),
          });
        }
      } catch {
        /* toast */
      } finally {
        if (this.data.requestVersion === requestVersion) {
          this.setData({ loading: false });
        }
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
      if (this.data.userScope === 'COMMUNITY' && !this.data.userCommunityId) {
        wx.showToast({ title: '请先选择圈子', icon: 'none' });
        return;
      }
      const scopeLabel = this.data.userScope === 'PLATFORM' ? '全平台' : '当前圈子';
      wx.showModal({
        title: `封禁用户（${scopeLabel}）`,
        editable: true,
        placeholderText: '封禁原因（可选）',
        confirmColor: '#F53F3F',
        success: async (r) => {
          if (!r.confirm) return;
          await banUser(id, {
            ...this.userQuery(),
            scope: this.data.userScope,
            reason: r.content?.trim() || undefined,
          });
          wx.showToast({ title: '已封禁', icon: 'success' });
          void this.load();
        },
      });
    },
    unbanUserTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      const scopeLabel = this.data.userScope === 'PLATFORM' ? '全平台' : '当前圈子';
      wx.showModal({
        title: `解除封禁（${scopeLabel}）`,
        content: '仅解除当前所选治理层级的封禁，确定继续？',
        success: async (r) => {
          if (!r.confirm) return;
          await unbanUser(id, { ...this.userQuery(), scope: this.data.userScope });
          wx.showToast({ title: '已解除', icon: 'success' });
          void this.load();
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
    async openAddDialog() {
      if (this.data.addingUserId) return;
      try {
        const [adminTypes, scopeCommunities] = await Promise.all([
          listAdminTypes(),
          listCommunitiesAdmin(),
        ]);
        const availableTypes = adminTypes.filter((item) => item.active);
        this.setData({
          showAddDialog: true,
          candidateKeyword: '',
          candidates: [],
          adminTypes: availableTypes,
          scopeCommunities,
          scopeCommunityOptions: scopeCommunities.map((item) => ({ ...item, selected: false })),
          selectedAdminTypeId: availableTypes[0]?.id ?? '',
          selectedAdminTypeIndex: 0,
          allCommunities: availableTypes[0]?.isPlatform === true,
          selectedCommunityIds: [],
          editingManagerId: '',
        });
      } catch {
        /* toast */
      }
    },
    closeAddDialog() {
      if (this.data.addingUserId) return;
      this.setData({ showAddDialog: false });
    },
    onCandidateKeywordInput(e: WechatMiniprogram.Input) {
      this.setData({ candidateKeyword: e.detail.value });
    },
    onAdminTypeChange(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value) || 0;
      const selected = this.data.adminTypes[index];
      this.setData({
        selectedAdminTypeIndex: index,
        selectedAdminTypeId: selected?.id ?? '',
        allCommunities: selected?.isPlatform === true ? true : this.data.allCommunities,
      });
    },
    onAllCommunitiesChange(e: WechatMiniprogram.SwitchChange) {
      const selected = this.data.adminTypes[this.data.selectedAdminTypeIndex];
      this.setData({ allCommunities: selected?.isPlatform === true || e.detail.value });
    },
    onCommunityScopeChange(e: WechatMiniprogram.CheckboxGroupChange) {
      const selectedCommunityIds = e.detail.value;
      this.setData({
        selectedCommunityIds,
        scopeCommunityOptions: this.data.scopeCommunities.map((item) => ({
          ...item,
          selected: selectedCommunityIds.includes(item.id),
        })),
      });
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
          if (!this.data.selectedAdminTypeId) {
            wx.showToast({ title: '请选择管理员类型', icon: 'none' });
            return;
          }
          if (!this.data.allCommunities && !this.data.selectedCommunityIds.length) {
            wx.showToast({ title: '请至少选择一个圈子', icon: 'none' });
            return;
          }
          await createAdmin(
            userId,
            this.data.selectedAdminTypeId,
            this.data.allCommunities,
            this.data.selectedCommunityIds,
          );
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
    async editAdminTap(e: WechatMiniprogram.TouchEvent) {
      const manager = e.currentTarget.dataset.admin as ManagerVo;
      const [adminTypes, scopeCommunities] = await Promise.all([
        listAdminTypes(),
        listCommunitiesAdmin(),
      ]);
      const availableTypes = adminTypes.filter((item) => item.active);
      const index = Math.max(0, availableTypes.findIndex((item) => item.id === manager.adminType.id));
      this.setData({
        showAddDialog: true,
        editingManagerId: manager.id,
        adminTypes: availableTypes,
        scopeCommunities,
        scopeCommunityOptions: scopeCommunities.map((item) => ({
          ...item,
          selected: manager.communities.some((community) => community.id === item.id),
        })),
        selectedAdminTypeIndex: index,
        selectedAdminTypeId: availableTypes[index]?.id ?? '',
        allCommunities: manager.allCommunities,
        selectedCommunityIds: manager.communities.map((item) => item.id),
        candidates: [],
        candidateKeyword: '',
      });
    },
    async saveAdminAssignment() {
      if (!this.data.editingManagerId || !this.data.selectedAdminTypeId) return;
      if (!this.data.allCommunities && !this.data.selectedCommunityIds.length) {
        wx.showToast({ title: '请至少选择一个圈子', icon: 'none' });
        return;
      }
      await updateAdmin(
        this.data.editingManagerId,
        this.data.selectedAdminTypeId,
        this.data.allCommunities,
        this.data.selectedCommunityIds,
      );
      wx.showToast({ title: '权限已更新', icon: 'success' });
      this.setData({ showAddDialog: false, editingManagerId: '' });
      void this.load();
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
    startCreateType() {
      this.setData({
        typeFormId: '',
        typeName: '',
        typeCode: '',
        typeDescription: '',
        typePermissionCodes: [],
        permissionOptions: this.data.permissions.map((item) => ({ ...item, checked: false })),
      });
    },
    startEditType(e: WechatMiniprogram.TouchEvent) {
      const item = e.currentTarget.dataset.type as AdminTypeVo;
      if (item.isPlatform) return;
      this.setData({
        typeFormId: item.id,
        typeName: item.name,
        typeCode: item.code,
        typeDescription: item.description ?? '',
        typePermissionCodes: item.permissionCodes,
        permissionOptions: this.data.permissions.map((permission) => ({
          ...permission,
          checked: item.permissionCodes.includes(permission.code),
        })),
      });
    },
    onTypeInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'typeName' | 'typeCode' | 'typeDescription';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },
    onTypePermissionsChange(e: WechatMiniprogram.CheckboxGroupChange) {
      const selected = new Set(e.detail.value);
      if (
        selected.has('community.banner.manage')
        || selected.has('community.edit')
        || selected.has('community.review')
      ) {
        selected.add('community.view');
      }
      const typePermissionCodes = [...selected];
      this.setData({
        typePermissionCodes,
        permissionOptions: this.data.permissions.map((item) => ({
          ...item,
          checked: typePermissionCodes.includes(item.code),
        })),
      });
    },
    async saveAdminType() {
      const name = this.data.typeName.trim();
      const code = this.data.typeCode.trim().toUpperCase();
      if (!name || (!this.data.typeFormId && !code)) {
        wx.showToast({ title: '请填写类型名称和编码', icon: 'none' });
        return;
      }
      if (this.data.typeFormId) {
        await updateAdminType(this.data.typeFormId, {
          name,
          description: this.data.typeDescription.trim(),
          permissionCodes: this.data.typePermissionCodes,
        });
      } else {
        await createAdminType({
          name,
          code,
          description: this.data.typeDescription.trim(),
          permissionCodes: this.data.typePermissionCodes,
        });
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      this.startCreateType();
      void this.load();
    },
    async toggleAdminType(e: WechatMiniprogram.SwitchChange) {
      const id = e.currentTarget.dataset.id as string;
      await updateAdminType(id, { active: e.detail.value });
      void this.load();
    },
    deleteAdminTypeTap(e: WechatMiniprogram.TouchEvent) {
      const item = e.currentTarget.dataset.type as AdminTypeVo;
      wx.showModal({
        title: '删除管理员类型',
        content: `确定删除「${item.name}」？`,
        confirmColor: '#F53F3F',
        success: async (result) => {
          if (!result.confirm) return;
          await deleteAdminType(item.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          void this.load();
        },
      });
    },
  },
});
