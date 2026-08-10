import { formatTime } from '../../utils/auth';

// 帖子卡片组件：展示头像/昵称/时间/内容/图片九宫格/点赞数/评论数/当前是否已赞
// 点击卡片 → 跳详情页；点赞按钮阻止冒泡 toggle 点赞；评论按钮跳详情并聚焦评论区
// CR-001: 扩展 anonymous / disabled / disabledReason props 支持广场匿名卡降级渲染
Component({
  properties: {
    post: {
      type: Object,
      value: null as WechatMiniprogram.IAnyObject | null,
    },
    // CR-001 匿名模式：去头像/昵称，显示「匿名」标识 + mood
    anonymous: {
      type: Boolean,
      value: false,
    },
    // CR-001 点赞/评论 disabled（anonToken 缺失时）
    disabled: {
      type: Boolean,
      value: false,
    },
    // CR-001 disabled 时点击 toast 文案
    disabledReason: {
      type: String,
      value: '请前往树洞签发匿名身份后互动',
    },
  },
  data: {
    timeText: '',
    avatarChar: '',
    hasAvatar: false,
    // 图片九宫格布局：1 张大图 / 2-4 张 2 列 / 5-9 张 3 列
    imgLayout: '' as '' | 'one' | 'two' | 'three',
  },
  observers: {
    'post, anonymous': function (p: {
      createdAt?: string;
      images?: string[];
      authorNickname?: string;
      authorAvatarUrl?: string | null;
      mood?: string | null; // CR-001 树洞 mood
    } | null) {
      if (!p) return;
      const isAnon = this.data.anonymous;
      this.setData({
        timeText: p.createdAt ? formatTime(p.createdAt) : '',
        avatarChar: isAnon ? '?' : ((p.authorNickname ?? '?').slice(0, 1)),
        hasAvatar: !isAnon && !!p.authorAvatarUrl,
        imgLayout: this.calcLayout(p.images?.length ?? 0),
      });
    },
  },
  methods: {
    calcLayout(n: number): '' | 'one' | 'two' | 'three' {
      if (n <= 0) return '';
      if (n === 1) return 'one';
      if (n <= 4) return 'two';
      return 'three';
    },
    onTap() {
      // CR-001: 匿名卡点击由父页面处理跃（父层 bindtap 决定跳表白墙/树洞详情）
      if (this.data.anonymous) return; // 父层处理
      const p = this.data.post as { id?: string } | null;
      if (!p?.id) return;
      wx.navigateTo({ url: `/pages/post-detail/index?id=${p.id}` });
    },
    onLike() {
      // CR-001: disabled 时弹出提示，不触发点赞
      if (this.data.disabled) {
        wx.showToast({ title: this.data.disabledReason, icon: 'none' });
        return;
      }
      this.triggerEvent('like', { id: (this.data.post as { id: string })?.id });
    },
    onComment() {
      // CR-001: disabled 时弹出提示，不触发跳转
      if (this.data.disabled) {
        wx.showToast({ title: this.data.disabledReason, icon: 'none' });
        return;
      }
      const p = this.data.post as { id?: string } | null;
      if (!p?.id) return;
      wx.navigateTo({ url: `/pages/post-detail/index?id=${p.id}&focus=1` });
    },
    previewImage(e: WechatMiniprogram.TouchEvent) {
      const { src } = e.currentTarget.dataset as { src: string };
      const imgs = ((this.data.post as { images: string[] })?.images ?? []);
      wx.previewImage({ current: src, urls: imgs });
    },
  },
});
