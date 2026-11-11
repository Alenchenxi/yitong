import {
  activityDetail,
  cancelActivity,
  cancelMyEnrollment,
  delistActivity,
  finishActivity,
  setInterest,
  type ActivityDetailVo,
} from '../../../services/activity';

const STATUS_TEXT: Record<string, string> = {
  PUBLISHED: '报名中',
  UPCOMING: '待开始',
  ONGOING: '进行中',
  ENDED: '已结束',
  CANCELLED: '已取消',
  DELISTED: '已下架',
  DRAFT: '草稿',
};

const ENROLL_STATUS_TEXT: Record<string, string> = {
  PENDING_REVIEW: '待审核',
  APPROVED: '报名成功',
  WAITLIST: '候补中',
  CANCELLED: '已取消',
  REJECTED: '未通过',
  REVOKED: '资格已取消',
};

interface LinkSegment {
  text: string;
  isLink: boolean;
}

Page({
  data: {
    id: '',
    loading: true,
    detail: null as ActivityDetailVo | null,
    statusText: '',
    enrollStatusText: '',
    timeText: '',
    segments: [] as LinkSegment[],
    canEnroll: false,
    chatReadonly: false,
    managing: false,
  },

  onLoad(query: Record<string, string>) {
    this.setData({ id: query.id ?? '' });
  },

  onShow() {
    void this.reload();
  },

  async reload() {
    if (!this.data.id) return;
    try {
      const d = await activityDetail(this.data.id);
      const myStatus = d.myEnrollment?.status ?? '';
      const enrollClosed = ['CANCELLED', 'ENDED', 'DELISTED', 'DRAFT'].includes(d.status)
        || (d.enrollEndAt !== null && Date.now() >= new Date(d.enrollEndAt).getTime());
      this.setData({
        loading: false,
        detail: d,
        statusText: STATUS_TEXT[d.status] ?? d.status,
        enrollStatusText: myStatus ? ENROLL_STATUS_TEXT[myStatus] ?? myStatus : '',
        timeText: this.formatRange(d.startTime, d.endTime),
        segments: parseLinks(d.description),
        canEnroll: !myStatus && d.status === 'PUBLISHED',
        chatReadonly: d.chat.readonly,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  formatRange(start: string | null, end: string | null): string {
    if (!start) return '长期活动';
    const fmt = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => `${n}`.padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    return end ? `${fmt(start)} ~ ${fmt(end)}` : fmt(start);
  },

  onSegmentTap(e: WechatMiniprogram.TouchEvent) {
    const { text, link } = e.currentTarget.dataset as { text: string; link: boolean };
    if (!link) return;
    // 统一行为：外链一律提示并支持复制（web-view 业务域名未配置，spec §7 允许统一为提示+复制）
    wx.showModal({
      title: '打开链接',
      content: text,
      confirmText: '复制链接',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({ data: text });
        }
      },
    });
  },

  // 参与方式一键复制（链接/会议号等，统一 spec §7 复制提示口径）
  onCopyJoinLink() {
    const link = this.data.detail?.joinLink;
    if (!link) return;
    wx.setClipboardData({ data: link });
  },

  goEnroll() {
    const d = this.data.detail;
    if (!d) return;
    if (d.myEnrollment) {
      wx.navigateTo({ url: `/pages/activity/enroll/index?id=${d.id}` });
      return;
    }
    if (!this.data.canEnroll) {
      wx.showToast({ title: '当前不可报名', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/activity/enroll/index?id=${d.id}` });
  },

  async onCancelEnroll() {
    const d = this.data.detail;
    if (!d) return;
    // 二次确认（AC §4.9）
    const { confirm } = await wx.showModal({ title: '退出报名', content: '确定退出该活动报名吗？退出后可在截止前重新报名。' });
    if (!confirm) return;
    try {
      await cancelMyEnrollment(d.id);
      wx.showToast({ title: '已退出报名', icon: 'success' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    }
  },

  async onInterest(e: WechatMiniprogram.TouchEvent) {
    const d = this.data.detail;
    if (!d) return;
    const state = e.currentTarget.dataset.state as 'INTERESTED' | 'NOT_INTERESTED';
    try {
      await setInterest(d.id, d.myInterest === state ? '' : state);
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    }
  },

  goChat() {
    wx.navigateTo({ url: `/pages/activity/chat/index?id=${this.data.id}` });
  },

  goManage() {
    wx.navigateTo({ url: `/pages/activity/manage/index?id=${this.data.id}` });
  },

  goRemind() {
    wx.navigateTo({ url: `/pages/activity/remind/index?id=${this.data.id}` });
  },

  goEdit() {
    wx.navigateTo({ url: `/pages/activity/publish/index?id=${this.data.id}` });
  },

  goSync() {
    wx.navigateTo({ url: `/pages/activity/connections/index?activityId=${this.data.id}` });
  },

  async onLifecycle(e: WechatMiniprogram.TouchEvent) {
    const d = this.data.detail;
    if (!d) return;
    const action = e.currentTarget.dataset.action as 'cancel' | 'delist' | 'finish';
    const confirms: Record<string, { title: string; content: string }> = {
      cancel: { title: '取消活动', content: '取消后将通知全部参与人、群聊立即只读且不可恢复，确定取消吗？' },
      delist: { title: '下架活动', content: '下架后活动停止展示和报名，已报名用户仍可查看。确定下架吗？' },
      finish: { title: '结束活动', content: '结束后群聊保留 7 天再转只读。确定结束吗？' },
    };
    const cfg = confirms[action];
    const { confirm } = await wx.showModal(cfg);
    if (!confirm) return;
    try {
      if (action === 'cancel') await cancelActivity(d.id);
      if (action === 'delist') await delistActivity(d.id);
      if (action === 'finish') await finishActivity(d.id);
      wx.showToast({ title: '操作成功', icon: 'success' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    }
  },

  toggleManage() {
    this.setData({ managing: !this.data.managing });
  },
});

// 活动介绍链接识别：URL 高亮可点（其余纯文本）
function parseLinks(text: string): LinkSegment[] {
  const regex = /(https?:\/\/[^\s，。！？、）)】]+)/g;
  const segments: LinkSegment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), isLink: false });
    segments.push({ text: match[0], isLink: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), isLink: false });
  return segments.length ? segments : [{ text, isLink: false }];
}
