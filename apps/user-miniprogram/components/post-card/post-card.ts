import { formatTime } from '../../utils/auth';

// 帖子卡片组件：展示头像/昵称/时间/内容/图片九宫格/点赞数/评论数/当前是否已赞
// 点击卡片 → 跳详情页；点赞按钮阻止冒泡 toggle 点赞；评论按钮跳详情并聚焦评论区
Component({
  properties: {
    post: {
      type: Object,
      value: null as WechatMiniprogram.IAnyObject | null,
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
    'post': function (p: {
      createdAt?: string;
      images?: string[];
      authorNickname?: string;
      authorAvatarUrl?: string | null;
    } | null) {
      if (!p) return;
      this.setData({
        timeText: p.createdAt ? formatTime(p.createdAt) : '',
        avatarChar: (p.authorNickname ?? '?').slice(0, 1),
        hasAvatar: !!p.authorAvatarUrl,
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
      const p = this.data.post as { id?: string } | null;
      if (!p?.id) return;
      wx.navigateTo({ url: `/pages/post-detail/index?id=${p.id}` });
    },
    onLike() {
      this.triggerEvent('like', { id: (this.data.post as { id: string })?.id });
    },
    onComment() {
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
