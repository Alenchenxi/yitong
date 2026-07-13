import type { AppInstance } from '../../../app';
import { getMerchantReviews, type MerchantReviewVo } from '../../../services/merchant';

Page({
  data: { reviews: [] as MerchantReviewVo[], loading: false },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const reviews = await getMerchantReviews();
      this.setData({ reviews });
    } catch {} finally { this.setData({ loading: false }); }
  },
});
