// M5-04/M5-05 静态 FAQ 数据（按燚桐当前报名状态流和处理规则编写，不对标第三方客服样式）
// 来源：docs/商家端开发计划.md §4 静态 FAQ 初稿

export interface FaqItem {
  id: string;
  category: 'apply_rules' | 'common'; // 报名处理规则 / 常见问题
  q: string; // 问题
  a: string; // 答案
}

export const FAQ_LIST: FaqItem[] = [
  // === M5-04 报名处理规则 ===
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

  // === M5-05 常见问题 ===
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

// 帮助中心首页分类入口
export const HELP_CATEGORIES = [
  { id: 'apply_rules', title: '报名处理规则', desc: '报名状态流转与商家处理规范', path: '/pages/help/apply-rules/index' },
  { id: 'common', title: '常见问题', desc: '岗位审核 / 发布 / 支付 / 退款 / 下架', path: '/pages/help/faq/index' },
] as const;
