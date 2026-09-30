import {
  disableNearbyPresence,
  enableNearbyPresence,
  getNearbyPresence,
  listNearbyPeople,
  type NearbyChannel,
  type NearbyPersonVo,
} from '../../services/nearby';
import { toggleFollow } from '../../services/follow';
import { getAnonymousToken, hasAnonToken, toggleAnonAuthorFollow } from '../../services/treehole';

type LocationAction = '' | 'miniProgramSettings' | 'appSettings' | 'privacy' | 'retry';

Component({
  properties: {
    channel: {
      type: String,
      value: 'confession',
    },
  },

  data: {
    initialized: false,
    statusLoading: false,
    locating: false,
    loading: false,
    enabled: false,
    people: [] as NearbyPersonVo[],
    nextCursor: null as string | null,
    hasMore: false,
    locationError: '',
    locationAction: '' as LocationAction,
    locationActionLabel: '',
    pendingEnable: false,
    waitingForAppSettings: false,
    waitingForPrivacy: false,
    fuzzyLocationScopeAuthorized: false,
    followLoadingId: '',
  },

  lifetimes: {
    attached() {
      void (this as any).activate();
    },
  },

  pageLifetimes: {
    show() {
      if (this.data.waitingForAppSettings || this.data.waitingForPrivacy) {
        const pendingEnable = this.data.pendingEnable;
        this.setData({ waitingForAppSettings: false, waitingForPrivacy: false });
        void (this as any).requestLocation(pendingEnable, false);
      }
    },
  },

  methods: {
    getChannel(): NearbyChannel {
      return this.properties.channel === 'treehole' ? 'treehole' : 'confession';
    },

    async ensureAnonymousIdentity() {
      if (this.getChannel() === 'treehole' && !hasAnonToken()) {
        await getAnonymousToken();
      }
    },

    async activate() {
      if (this.data.statusLoading || this.data.locating) return;
      this.setData({ initialized: true, statusLoading: true, locationError: '' });
      try {
        await this.ensureAnonymousIdentity();
        const presence = await getNearbyPresence(this.getChannel());
        this.setData({ enabled: presence.enabled });
        if (presence.enabled) await this.requestLocation(false, false);
      } catch {
        this.setData({ locationError: '附近状态加载失败，请重试' });
      } finally {
        this.setData({ statusLoading: false });
      }
    },

    onVisibilityChange(event: WechatMiniprogram.SwitchChange) {
      if (event.detail.value) {
        this.confirmEnable();
        return;
      }

      this.setData({ enabled: true });
      wx.showModal({
        title: '关闭附近可见',
        content: '关闭后，其他人将无法在该频道的附近列表中看到你。',
        confirmText: '确认关闭',
        success: ({ confirm }) => {
          if (confirm) void this.disablePresence();
        },
      });
    },

    enableFromButton() {
      this.confirmEnable();
    },

    confirmEnable() {
      this.setData({ enabled: false });
      wx.showModal({
        title: '开启附近的人',
        content:
          this.getChannel() === 'treehole'
            ? '将使用模糊位置展示你的匿名身份，不会公开真实资料和具体位置。'
            : '将使用模糊位置展示你的头像和昵称，不会公开具体位置。',
        confirmText: '同意开启',
        success: ({ confirm }) => {
          if (confirm) void this.requestLocation(true, true);
        },
      });
    },

    async disablePresence() {
      try {
        await disableNearbyPresence(this.getChannel());
        this.setData({
          enabled: false,
          people: [],
          nextCursor: null,
          hasMore: false,
        });
        wx.showToast({ title: '已关闭附近可见', icon: 'none' });
      } catch {
        this.setData({ enabled: true });
      }
    },

    requestLocation(pendingEnable = false, showGuide = true) {
      if (this.data.locating) return;
      this.setData({
        locating: true,
        fuzzyLocationScopeAuthorized: false,
        pendingEnable,
        locationError: '',
        locationAction: '',
        locationActionLabel: '',
      });
      wx.getSetting({
        success: ({ authSetting }) => {
          this.setData({
            fuzzyLocationScopeAuthorized: authSetting['scope.userFuzzyLocation'] === true,
          });
          if (authSetting['scope.userFuzzyLocation'] === false) {
            this.setData({ locating: false });
            this.handleMiniProgramLocationDenied(showGuide);
            return;
          }
          this.ensurePrivacyAuthorization(() => this.startFuzzyLocation(pendingEnable, showGuide));
        },
        fail: () =>
          this.ensurePrivacyAuthorization(() => this.startFuzzyLocation(pendingEnable, showGuide)),
      });
    },

    ensurePrivacyAuthorization(onAuthorized: () => void) {
      const privacyApi = wx as typeof wx & {
        getPrivacySetting?: (options: {
          success: (result: { needAuthorization: boolean }) => void;
          fail: () => void;
        }) => void;
        requirePrivacyAuthorize?: (options: { success: () => void; fail: () => void }) => void;
      };
      const supported =
        wx.canIUse('getPrivacySetting') &&
        wx.canIUse('requirePrivacyAuthorize') &&
        typeof privacyApi.getPrivacySetting === 'function' &&
        typeof privacyApi.requirePrivacyAuthorize === 'function';
      if (!supported) {
        onAuthorized();
        return;
      }
      privacyApi.getPrivacySetting!({
        success: ({ needAuthorization }) => {
          if (!needAuthorization) {
            onAuthorized();
            return;
          }
          privacyApi.requirePrivacyAuthorize!({
            success: onAuthorized,
            fail: () => {
              this.setData({ locating: false });
              this.setLocationError(
                '请先同意隐私保护指引，再使用附近的人',
                'privacy',
                '查看隐私说明',
              );
            },
          });
        },
        fail: () => {
          this.setData({ locating: false });
          this.setLocationError('暂时无法确认隐私授权状态', 'retry', '重新定位');
        },
      });
    },

    startFuzzyLocation(pendingEnable: boolean, showGuide: boolean) {
      wx.getFuzzyLocation({
        type: 'gcj02',
        success: ({ longitude, latitude }) => {
          void this.persistAndLoad(longitude, latitude, pendingEnable);
        },
        fail: (error) => {
          this.setData({ locating: false });
          this.handleLocationFailure(error, showGuide);
        },
      });
    },

    async persistAndLoad(longitude: number, latitude: number, pendingEnable: boolean) {
      try {
        await enableNearbyPresence(this.getChannel(), { lng: longitude, lat: latitude });
        this.setData({
          enabled: true,
          pendingEnable: false,
          people: [],
          nextCursor: null,
          hasMore: true,
        });
        await this.loadMore();
        if (pendingEnable) wx.showToast({ title: '已开启附近可见', icon: 'none' });
      } catch {
        this.setData({ locationError: '附近列表加载失败，请重试' });
      } finally {
        this.setData({ locating: false });
        wx.stopPullDownRefresh();
      }
    },

    handleLocationFailure(error: { errMsg?: string }, showGuide: boolean) {
      const message = (error.errMsg || '').toLowerCase();
      if (/system permission|location service|app permission|gps/.test(message)) {
        this.handleSystemLocationDenied(showGuide);
        return;
      }
      if (/auth deny|auth denied|authorize.*deny|permission denied/.test(message)) {
        if (this.data.fuzzyLocationScopeAuthorized) {
          this.handleSystemLocationDenied(showGuide);
        } else {
          this.handleMiniProgramLocationDenied(showGuide);
        }
        return;
      }
      this.setLocationError('定位失败，请重新定位', 'retry', '重新定位');
    },

    handleMiniProgramLocationDenied(showGuide: boolean) {
      this.setLocationError('小程序定位权限未开启', 'miniProgramSettings', '去开启');
      if (!showGuide) return;
      wx.showModal({
        title: '定位权限未开启',
        content: '开启小程序模糊定位权限后，才能查找附近的人。',
        confirmText: '去开启',
        success: ({ confirm }) => {
          if (confirm) this.openMiniProgramSettings();
        },
      });
    },

    openMiniProgramSettings() {
      wx.openSetting({
        success: ({ authSetting }) => {
          if (authSetting['scope.userFuzzyLocation']) {
            this.setData({ fuzzyLocationScopeAuthorized: true });
            void this.requestLocation(this.data.pendingEnable, false);
            return;
          }
          this.handleMiniProgramLocationDenied(false);
        },
        fail: () => this.handleMiniProgramLocationDenied(false),
      });
    },

    handleSystemLocationDenied(showGuide: boolean) {
      this.setLocationError('微信系统定位权限未开启', 'appSettings', '去设置');
      if (!showGuide) return;
      wx.showModal({
        title: '系统定位权限未开启',
        content: '请允许微信使用定位信息，返回小程序后会自动重试。',
        confirmText: '去设置',
        success: ({ confirm }) => {
          if (confirm) this.openAppSettings();
        },
      });
    },

    openAppSettings() {
      const appAuthorizeApi = wx as typeof wx & {
        openAppAuthorizeSetting?: (options?: { fail?: () => void }) => void;
      };
      const supported =
        wx.canIUse('openAppAuthorizeSetting') &&
        typeof appAuthorizeApi.openAppAuthorizeSetting === 'function';
      if (!supported) {
        wx.showModal({
          title: '请手动开启定位',
          content: '请前往手机系统设置，允许微信使用定位信息。',
          showCancel: false,
        });
        return;
      }
      this.setData({ waitingForAppSettings: true });
      appAuthorizeApi.openAppAuthorizeSetting!({
        fail: () => {
          this.setData({ waitingForAppSettings: false });
          wx.showToast({ title: '系统设置打开失败', icon: 'none' });
        },
      });
    },

    setLocationError(message: string, action: LocationAction, actionLabel: string) {
      this.setData({
        locationError: message,
        locationAction: action,
        locationActionLabel: actionLabel,
      });
    },

    onLocationAction() {
      switch (this.data.locationAction) {
        case 'miniProgramSettings':
          this.openMiniProgramSettings();
          return;
        case 'appSettings':
          this.openAppSettings();
          return;
        case 'privacy': {
          const privacyApi = wx as typeof wx & {
            openPrivacyContract?: (options?: { fail?: () => void }) => void;
          };
          if (typeof privacyApi.openPrivacyContract !== 'function') {
            wx.showToast({ title: '请先同意隐私保护指引', icon: 'none' });
            return;
          }
          this.setData({ waitingForPrivacy: true });
          privacyApi.openPrivacyContract({
            fail: () => {
              this.setData({ waitingForPrivacy: false });
              wx.showToast({ title: '隐私保护指引打开失败', icon: 'none' });
            },
          });
          return;
        }
        default:
          void this.requestLocation(this.data.pendingEnable, true);
      }
    },

    refresh() {
      if (!this.data.enabled) {
        void this.activate().finally(() => wx.stopPullDownRefresh());
        return;
      }
      this.requestLocation(false, false);
    },

    async loadMore() {
      if (this.data.loading || !this.data.enabled || !this.data.hasMore) return;
      this.setData({ loading: true });
      try {
        const response = await listNearbyPeople(
          this.getChannel(),
          this.data.nextCursor || undefined,
        );
        this.setData({
          people: [...this.data.people, ...response.list],
          nextCursor: response.nextCursor,
          hasMore: response.hasMore,
        });
      } catch {
        this.setData({ locationError: '附近列表加载失败，请重试' });
      } finally {
        this.setData({ loading: false });
      }
    },

    async toggleFollow(event: WechatMiniprogram.TouchEvent) {
      const id = event.currentTarget.dataset.id as string;
      if (!id || this.data.followLoadingId) return;
      const index = this.data.people.findIndex((item) => item.id === id);
      if (index < 0) return;
      const previous = this.data.people[index].following;
      this.setData({
        followLoadingId: id,
        ['people[' + index + '].following']: !previous,
      });
      try {
        const result =
          this.getChannel() === 'treehole'
            ? await toggleAnonAuthorFollow(id)
            : await toggleFollow(id);
        this.setData({ ['people[' + index + '].following']: result.following });
      } catch {
        this.setData({ ['people[' + index + '].following']: previous });
      } finally {
        this.setData({ followLoadingId: '' });
      }
    },

    openProfile(event: WechatMiniprogram.TouchEvent) {
      const id = event.currentTarget.dataset.id as string;
      if (!id) return;
      const url =
        this.getChannel() === 'treehole'
          ? '/pages/treehole/author/index?anonId=' + encodeURIComponent(id)
          : '/pages/user-profile/index?id=' + encodeURIComponent(id);
      wx.navigateTo({ url });
    },
  },
});
