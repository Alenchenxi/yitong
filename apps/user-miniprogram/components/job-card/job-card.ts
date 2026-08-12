// 兼职岗位卡片组件：标题/薪资/店铺/地点/急招·可线上 徽标
// 点击卡片 → 跳岗位详情页
Component({
  properties: {
    job: {
      type: Object,
      value: null as WechatMiniprogram.IAnyObject | null,
    },
  },

  methods: {
    onTap() {
      const job = this.data.job as { id?: string } | null;
      if (job?.id) {
        wx.navigateTo({ url: `/pages/job/detail/index?id=${job.id}` });
      }
    },
  },
});
