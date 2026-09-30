// P2-81 版本升级弹窗：校园风自定义 Modal，品牌黄体系（docs/UI设计规范.md §2 色板）
// 零接线自驱动：utils/update.ts onUpdateReady 经 subscribeUpdateModal 广播唤起，
// 页面 wxml 放一个 <update-modal /> 即可（app.json 已全局注册，无需页面 json 配置）；
// 也支持页面直接 setData show/currentVersion/latestVersion/updateLogs 复用。
import {
  applyMpUpdate,
  dismissUpdateModal,
  getUpdateModalSnapshot,
  subscribeUpdateModal,
  type UpdateModalState,
} from '../../utils/update';

// 先挂载（wx:if）再切动画类，保证 0→1 过渡在下一帧生效
const ANIMATE_IN_DELAY_MS = 30;
// 退场动画时长，结束后再卸载节点
const ANIMATE_OUT_MS = 260;

Component({
  properties: {
    // 复用入口：外部可直接控制显示；默认走 utils/update 广播自驱动
    show: { type: Boolean, value: false },
    currentVersion: { type: String, value: '' },
    latestVersion: { type: String, value: '' },
    updateLogs: { type: Array, value: [] as string[] },
  },

  data: {
    rendered: false, // wx:if 挂载态（true 时弹窗节点存在）
    visible: false, // 动画态（true 时遮罩全显 + 卡片 scale 1）
    reloading: false, // 「重新加载」防重复点击
  },

  lifetimes: {
    attached() {
      const self = this as unknown as { unsubscribeUpdateModal?: () => void };
      self.unsubscribeUpdateModal = subscribeUpdateModal((state) => {
        if (state.show) this.enter(state);
        else this.leave();
      });
      // 弹窗显示期间前进到本页（navigateTo 新页面）时补显
      const snapshot = getUpdateModalSnapshot();
      if (snapshot) this.enter(snapshot);
    },
    detached() {
      const self = this as unknown as { unsubscribeUpdateModal?: () => void };
      if (self.unsubscribeUpdateModal) self.unsubscribeUpdateModal();
    },
  },

  observers: {
    // 外部复用：show 属性 false→true 时走同一入场动画
    show(next: boolean) {
      if (next) this.enter();
      else this.leave();
    },
  },

  methods: {
    enter(payload?: UpdateModalState) {
      if (payload) {
        this.setData({
          currentVersion: payload.currentVersion,
          latestVersion: payload.latestVersion,
          updateLogs: payload.updateLogs,
        });
      }
      if (this.data.rendered && this.data.visible) return;
      this.setData({ rendered: true, visible: false, reloading: false });
      setTimeout(() => {
        this.setData({ visible: true });
      }, ANIMATE_IN_DELAY_MS);
    },

    leave() {
      if (!this.data.rendered) return;
      this.setData({ visible: false });
      setTimeout(() => {
        this.setData({ rendered: false });
      }, ANIMATE_OUT_MS);
    },

    onLater() {
      this.triggerEvent('later');
      // 广播隐藏页面栈里全部实例 + 标记本次运行不再弹（下次冷启动微信自动应用新包）
      dismissUpdateModal();
    },

    onReload() {
      if (this.data.reloading) return;
      this.triggerEvent('reload');
      this.setData({ reloading: true });
      if (!applyMpUpdate()) {
        // 无 UpdateManager（低版本基础库 / 演示直开组件）：退回关闭，避免假死
        this.setData({ reloading: false });
        dismissUpdateModal();
      }
    },

    noop() {
      // 遮罩 / 卡片 catchtap 占位：阻止冒泡；不允许点遮罩关闭（弹窗必须显式二选一）
    },
  },
});
