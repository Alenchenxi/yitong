import type { AppInstance } from '../../app';
import { listMyAnonPosts, type AnonPostVo } from '../../services/treehole';
import { formatTime } from '../../utils/auth';
import {
  bindAnonymousContentPageGuard,
  requireAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../utils/anonymous-content';

Page({
  data: { posts: [] as Array<AnonPostVo & { timeText: string }>, loading: true },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    bindAnonymousContentPageGuard(this);
    try {
      const r = await listMyAnonPosts();
      this.setData({ posts: r.list.map((p) => ({ ...p, timeText: formatTime(p.createdAt) })) });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  previewImage(e: WechatMiniprogram.TouchEvent) {
    const { id, src } = e.currentTarget.dataset as { id: string; src: string };
    const post = this.data.posts.find((item) => item.id === id);
    if (src && post?.images.length) {
      wx.previewImage({ current: src, urls: post.images });
    }
  },
});
