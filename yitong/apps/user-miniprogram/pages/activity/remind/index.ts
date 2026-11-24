import { activityDetail, listReminders, remindActivity, type ActivityDetailVo } from '../../../services/activity';

const KIND_TEXT: Record<string, string> = {
  AUTO_3D: '自动·前三天',
  AUTO_1D: '自动·前一天',
  MANUAL: '手动',
};

const RESULT_TEXT: Record<string, string> = {
  sent: '已发送',
  skipped_no_template: '未配置模板',
  skipped_rate_limited: '24h 限频跳过',
  skipped_already_sent: '已发过',
  failed: '失败',
};

interface ReminderRecord {
  id: string;
  kind: string;
  userId: string;
  kindText: string;
  userNickname: string;
  sentByNickname: string | null;
  resultText: string;
  createdAt: string;
}

// 发送记录按用户分组：一个用户一项（用户名+次数），点击弹窗展开明细（2026-11-24 用户口径）
interface ReminderGroup {
  userId: string;
  userNickname: string;
  count: number;
  records: ReminderRecord[];
}

const PAGE_SIZE = 500; // 服务端上限；超过则翻页拉全量（分组计数必须完整）

Page({
  data: {
    id: '',
    detail: null as ActivityDetailVo | null,
    groups: [] as ReminderGroup[],
    total: 0,
    sending: false,
    activeGroup: null as ReminderGroup | null,
  },

  onLoad(query: Record<string, string>) {
    this.setData({ id: query.id ?? '' });
  },

  onShow() {
    void this.reload();
  },

  async reload() {
    try {
      const [detail, all] = await Promise.all([
        this.data.detail ? Promise.resolve(this.data.detail) : activityDetail(this.data.id),
        this.fetchAllRecords(),
      ]);
      this.setData({
        detail,
        groups: buildGroups(all),
        total: all.length,
      });
    } catch {
      /* toast 已在 request 内 */
    }
  },

  // 拉全量记录（pageSize=500 翻页，封顶 5 页）：分组计数需要完整数据
  async fetchAllRecords(): Promise<ReminderRecord[]> {
    const all: ReminderRecord[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const res = await listReminders(this.data.id, page, PAGE_SIZE);
      all.push(...res.list.map((r) => ({ ...r, kindText: KIND_TEXT[r.kind] ?? r.kind, resultText: RESULT_TEXT[r.result] ?? r.result })));
      if (res.list.length < PAGE_SIZE) break;
    }
    return all;
  },

  // 固定手动提醒：全部正式参与人（每人 24h 内最多 3 次，2026-11-24 口径）
  async onRemindAll() {
    if (this.data.sending) return;
    const { confirm } = await wx.showModal({
      title: '发送提醒',
      content: '将向全部正式参与人发送活动提醒（每人 24 小时内最多 3 次），确定发送吗？',
    });
    if (!confirm) return;
    this.setData({ sending: true });
    try {
      const res = await remindActivity(this.data.id);
      wx.showToast({ title: `已发送（跳过 ${res.skipped} 人）`, icon: 'none' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ sending: false });
    }
  },

  onOpenGroup(e: WechatMiniprogram.TouchEvent) {
    const userId = e.currentTarget.dataset.id as string;
    const group = this.data.groups.find((g) => g.userId === userId);
    if (!group) return;
    this.setData({ activeGroup: group });
  },

  onCloseGroup() {
    this.setData({ activeGroup: null });
  },

  // 弹窗内容区 catchtap 占位：阻止冒泡到遮罩关闭
  noop() {},
});

// 按用户分组，保持记录倒序（最近提醒过的用户在前）
function buildGroups(records: ReminderRecord[]): ReminderGroup[] {
  const map = new Map<string, ReminderGroup>();
  for (const r of records) {
    const g = map.get(r.userId);
    if (g) {
      g.count += 1;
      g.records.push(r);
    } else {
      map.set(r.userId, { userId: r.userId, userNickname: r.userNickname, count: 1, records: [r] });
    }
  }
  return [...map.values()];
}
