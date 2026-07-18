import type { AppInstance } from '../../../app';
import { getMerchantReviews, type MerchantReviewVo } from '../../../services/merchant';

Page({
  data: { reviews: [] as Array<MerchantReviewVo & { stars: string }>, loading: false },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const reviews = await getMerchantReviews();
      this.setData({ reviews: reviews.map((r) => ({ ...r, stars: '★'.repeat(r.rating) })) });
    } catch {} finally { this.setData({ loading: false }); }
  },
});
