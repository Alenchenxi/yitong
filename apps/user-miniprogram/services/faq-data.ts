// M5-04/M5-05 静态 FAQ 数据，按角色区分：
// - 商家端：报名处理规则 + 岗位审核/发布/支付/退款（来源 docs/商家端开发计划.md §4）
// - 用户端：兼职报名指南 + 找兼职/投诉/薪资保障/账号（用户视角）

export interface FaqItem {
  id: string;
  category: 'apply_rules' | 'common'; // 报名相关 / 常见问题
  q: string;
  a: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  desc: string;
  path: string;
}

// ===== 商家端 =====
export const MERCHANT_FAQ_LIST: FaqItem[] = [
  // === 报名处理规则 ===
  {
    id: 'ar-1',
    category: 'apply_rules',
    q: '用户报名后，商家应该怎么处理？',
    a: '用户报名后，报名状态为"待处理"，商家应先查看简历和报名问题回答，再决定是否录用。',
  },
  {
    id: 'ar-2',
    category: 'apply_rules',
    q: '候选人信息不足时怎么办？',
    a: '商家可以先通过站内消息或用户授权的联系方式联系候选人，进一步了解情况后再决定。',
  },
  {
    id: 'ar-3',
    category: 'apply_rules',
    q: '候选人合适/不合适怎么标记？',
    a: '候选人合适时，商家可录用；不合适时，商家应标记为未录用。已沟通但暂不决定时，可先标记"已联系"或"合适/不合适"。',
  },
  {
    id: 'ar-4',
    category: 'apply_rules',
    q: '兼职完成后怎么结束？',
    a: '商家录用后，完成兼职时标记"已完成"，之后用户和商家可互相评价。',
  },
  {
    id: 'ar-5',
    category: 'apply_rules',
    q: '用户取消报名后商家还能录用吗？',
    a: '不能。用户取消报名后，商家不可再录用该报名记录。',
  },

  // === 常见问题 ===
  {
    id: 'cm-1',
    category: 'common',
    q: '岗位审核多久完成？',
    a: '平台审核通过后岗位才能公开展示。开发环境可自动通过，生产环境以后台审核结果为准。',
  },
  {
    id: 'cm-2',
    category: 'common',
    q: '为什么无法发布岗位？',
    a: '需要先完成商家入驻并通过平台资质审核，审核通过后才能发布岗位。',
  },
  {
    id: 'cm-3',
    category: 'common',
    q: '为什么创建岗位后还是"待发布"？',
    a: '岗位创建后需要完成付费发布，支付成功后才会公开展示。',
  },
  {
    id: 'cm-4',
    category: 'common',
    q: '如何修改岗位内容？',
    a: '在职位管理中点击"编辑"即可修改岗位内容。已发布岗位编辑后会回退为待发布，需重新付费发布。',
  },
  {
    id: 'cm-5',
    category: 'common',
    q: '如何下架岗位？',
    a: '在职位管理中点击"下架"即可主动下架已发布岗位；平台也可因违规下架岗位。',
  },
  {
    id: 'cm-6',
    category: 'common',
    q: '如何处理退款？',
    a: '在订单记录页可申请退款，生产环境走微信退款接口，退款后岗位状态将同步处理。',
  },
  {
    id: 'cm-7',
    category: 'common',
    q: '如何开启报名提醒？',
    a: '在消息中心可授权微信订阅消息。未授权时仍可收到站内消息提醒。',
  },
  {
    id: 'cm-8',
    category: 'common',
    q: '如何投诉用户？',
    a: '在候选人详情中可发起投诉，由平台后台处理。',
  },
];

export const MERCHANT_CATEGORIES: HelpCategory[] = [
  { id: 'apply_rules', title: '报名处理规则', desc: '报名状态流转与商家处理规范', path: '/pages/help/apply-rules/index' },
  { id: 'common', title: '常见问题', desc: '岗位审核 / 发布 / 支付 / 退款 / 下架', path: '/pages/help/faq/index' },
];

// ===== 用户端 =====
export const USER_FAQ_LIST: FaqItem[] = [
  // === 兼职报名指南 ===
  {
    id: 'u-ar-1',
    category: 'apply_rules',
    q: '怎么找兼职？',
    a: '打开「兼职」tab 浏览在招岗位，可按分类、薪资、地点筛选；点岗位卡片进入详情查看工作内容、时间与薪资。',
  },
  {
    id: 'u-ar-2',
    category: 'apply_rules',
    q: '怎么报名兼职？',
    a: '在岗位详情页点「报名」，按需回答商家设置的报名问题、确认简历后提交，即完成报名。',
  },
  {
    id: 'u-ar-3',
    category: 'apply_rules',
    q: '报名状态分别是什么意思？',
    a: '待处理：商家尚未处理；已录用：商家已选中你；未录用：商家未选中；已取消：你或商家取消；已完成：兼职已结束。',
  },
  {
    id: 'u-ar-4',
    category: 'apply_rules',
    q: '报名后怎么知道结果？',
    a: '在「我的-我的兼职」查看报名状态；状态变化会通过消息中心提醒，建议开启订阅消息。',
  },
  {
    id: 'u-ar-5',
    category: 'apply_rules',
    q: '可以取消报名吗？',
    a: '待处理/已录用阶段可在「我的兼职」取消；已录用后取消建议先与商家沟通，避免影响信用。',
  },
  {
    id: 'u-ar-6',
    category: 'apply_rules',
    q: '怎么完善简历？',
    a: '在「我的-我的简历」填写姓名、技能、空闲时间、经验等；简历越完整，被录用概率越高。',
  },
  {
    id: 'u-ar-7',
    category: 'apply_rules',
    q: '被录用了怎么联系商家？',
    a: '通过站内消息联系商家，或使用商家授权公开的联系方式。',
  },
  {
    id: 'u-ar-8',
    category: 'apply_rules',
    q: '兼职完成后做什么？',
    a: '商家标记「已完成」后，可对本次兼职评价商家；真实评价能帮助其他同学。',
  },

  // === 常见问题 ===
  {
    id: 'u-cm-1',
    category: 'common',
    q: '遇到拖欠薪资或纠纷怎么办？',
    a: '在岗位详情点「投诉商家」，平台 24 小时内介入。建议保留聊天记录、打卡/工作量截图作为证据。',
  },
  {
    id: 'u-cm-2',
    category: 'common',
    q: '怎么收到消息提醒？',
    a: '在「消息中心」可授权微信订阅消息；未授权也能收到站内消息，仅在微信内提醒。',
  },
  {
    id: 'u-cm-4',
    category: 'common',
    q: '表白墙怎么发帖？',
    a: '「表白墙」tab 点发布，可带图片/话题；内容经平台安全审核后展示。',
  },
  {
    id: 'u-cm-5',
    category: 'common',
    q: '怎么修改昵称/头像？',
    a: '在「我的-账号与安全」修改账号资料。',
  },
  {
    id: 'u-cm-6',
    category: 'common',
    q: '邀请好友有奖励吗？',
    a: '在「我的-邀请好友」分享邀请码，好友首次注册会建立邀请关联，奖励以平台活动为准。',
  },
  {
    id: 'u-cm-7',
    category: 'common',
    q: '换手机/重装微信怎么办？',
    a: '登录同一微信号即可自动识别账号，数据跟随微信。',
  },
  {
    id: 'u-cm-8',
    category: 'common',
    q: '怎么反馈问题或建议？',
    a: '在「我的-意见反馈」提交工单，客服会处理并回复。',
  },
];

export const USER_CATEGORIES: HelpCategory[] = [
  { id: 'apply_rules', title: '兼职报名指南', desc: '报名流程 / 报名状态 / 简历', path: '/pages/help/apply-rules/index' },
  { id: 'common', title: '常见问题', desc: '找兼职 / 投诉商家 / 薪资保障 / 账号', path: '/pages/help/faq/index' },
];

// 按角色取 FAQ 数据（非商家均落用户端内容）
export function getFaqData(role: string): { list: FaqItem[]; categories: HelpCategory[] } {
  return role === 'MERCHANT'
    ? { list: MERCHANT_FAQ_LIST, categories: MERCHANT_CATEGORIES }
    : { list: USER_FAQ_LIST, categories: USER_CATEGORIES };
}
