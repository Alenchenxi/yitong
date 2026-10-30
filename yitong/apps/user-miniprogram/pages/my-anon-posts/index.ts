import type { AppInstance } from '../../app';
import { listMyAnonPosts, deleteAnonPost, type AnonPostVo } from '../../services/treehole';
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

  // CR-007 编辑：storage 中转草稿 → 发布页 editId 回填
  onEditItem(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const post = this.data.posts.find((item) => item.id === id);
    if (!post) return;
    wx.setStorageSync('yitong_edit_anon_post_draft', post);
    wx.navigateTo({ url: `/pages/treehole/post/index?editId=${id}` });
  },

  // CR-007 删除（软删，全圈子不可见）；成功后本地移除
  onDeleteItem(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const post = this.data.posts.find((item) => item.id === id);
    if (!post) return;
    wx.showModal({
      title: '删除帖子',
      content: '删除后所有圈子都不再可见，确定删除吗？',
      confirmText: '删除',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await deleteAnonPost(id);
          this.setData({ posts: this.data.posts.filter((item) => item.id !== id) });
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch {
          /* toast */
        }
      },
    });
  },
});
