// 智能生成流程(2026-08-10):规则模板池 + 薪资基线常量。
// 关键约束:不引 LLM,模板随 enum 跟版本发布;后续若运营要改文案,迁 admin 后台 + 新建 JobCategoryConfig 表。
// 与 JOB_CATEGORY_VALUES(dto/job.dto.ts:5-16)语义一致:截图 13 类在 API 层做 mapping,落 10 个 enum。

export type CategoryKey =
  | 'RESTAURANT'
  | 'PHONE_SALES'
  | 'FIELD_PROMO'
  | 'RETAIL_SALES'
  | 'KITCHEN'
  | 'OFFICE_CLERK'
  | 'PHONE_CS'
  | 'FACTORY'
  | 'RIDESHARE'
  | 'SECURITY'
  | 'HOME_STREAMER'
  | 'TUTORING'
  | 'OTHERS';

// 截图 13 类 → 现有 enum(与 job.dto.ts JOB_CATEGORY_VALUES 对齐)
// mapTo 多值(如 PHONE_SALES/PHONE_CS → PROMOTION)只取第一个落 category;筛选走 where in。
// OTHERS 映射 null,前端跳「更多岗位」列表全表。
export const JOB_CATEGORY_GRID: ReadonlyArray<{
  key: CategoryKey;
  label: string;
  icon: string;
  mapTo: string | null;
}> = [
  { key: 'RESTAURANT', label: '餐厅服务员', icon: '🍽', mapTo: 'CATERING' },
  { key: 'PHONE_SALES', label: '电话销售', icon: '📞', mapTo: 'PROMOTION' },
  { key: 'FIELD_PROMO', label: '地推销售', icon: '📣', mapTo: 'PROMOTION' },
  { key: 'RETAIL_SALES', label: '导购店员', icon: '🛍', mapTo: 'RETAIL' },
  { key: 'KITCHEN', label: '厨房工作', icon: '🔪', mapTo: 'CATERING' },
  { key: 'OFFICE_CLERK', label: '文员', icon: '📋', mapTo: 'TUTORING' },
  { key: 'PHONE_CS', label: '电话客服', icon: '☎️', mapTo: 'PROMOTION' },
  { key: 'FACTORY', label: '工厂普工', icon: '🏭', mapTo: 'LONG_TERM' },
  { key: 'RIDESHARE', label: '外卖骑手', icon: '🛵', mapTo: 'LONG_TERM' },
  { key: 'SECURITY', label: '保安', icon: '🛡', mapTo: 'LONG_TERM' },
  { key: 'HOME_STREAMER', label: '居家主播', icon: '🎥', mapTo: 'ONLINE' },
  { key: 'TUTORING', label: '家教助教', icon: '📚', mapTo: 'TUTORING' },
  { key: 'OTHERS', label: '更多岗位', icon: '⋯', mapTo: null },
];

// 薪资基线(元/小时),median 样本不足时降级用。
export const SALARY_BASELINE: Record<CategoryKey, number> = {
  RESTAURANT: 150,
  PHONE_SALES: 120,
  FIELD_PROMO: 130,
  RETAIL_SALES: 110,
  KITCHEN: 160,
  OFFICE_CLERK: 100,
  PHONE_CS: 110,
  FACTORY: 150,
  RIDESHARE: 200,
  SECURITY: 130,
  HOME_STREAMER: 180,
  TUTORING: 200,
  OTHERS: 130,
};

// 标题模板:每 key 至少 4 条;占位符 {role}/{location}/{base} 由调用方替换。
export const TITLE_TEMPLATES: Record<CategoryKey, string[]> = {
  RESTAURANT: [
    '餐厅诚聘【{role}】多名·环境好+餐补',
    '【{location}】招{role}包餐+加班费',
    '急招餐厅{role}·日结+近地铁口',
    '【{location}】餐厅服务员·可兼职可长期',
  ],
  PHONE_SALES: [
    '电话销售·底薪{base}+高提成·不打卡',
    '【{location}】电销专员·月休4+五险',
    '急招电话销售·底薪120+提成上不封顶',
    '【{location}】电销·坐班+空调环境',
  ],
  FIELD_PROMO: [
    '【{location}】地推专员·日结150+提成',
    '地推销售·户外工作·时间自由',
    '急招地推·{base}元/天+邀约奖金',
    '【{location}】市场推广·底薪+提成',
  ],
  RETAIL_SALES: [
    '【{location}】招导购·{base}元/天+销售奖',
    '零售店员·环境好·月休4天',
    '【{location}】商场导购·可兼职',
    '急招零售店员·近地铁口',
  ],
  KITCHEN: [
    '【{location}】招后厨帮工·包餐+加班费',
    '厨房洗碗切配·日结·环境干净',
    '急招厨房学徒·{base}元/天+升职空间',
    '【{location}】后厨·可长期可短期',
  ],
  OFFICE_CLERK: [
    '【{location}】校园文员·坐班·双休',
    '行政助理·环境好·可实习',
    '【{location}】招办公室文员·{base}元/天',
    '急招文员·Excel熟练优先',
  ],
  PHONE_CS: [
    '【{location}】电话客服·坐班·空调环境',
    '客服专员·{base}元/天+话补',
    '急招电话客服·月休6天',
    '【{location}】售后客服·早九晚六',
  ],
  FACTORY: [
    '【{location}】工厂普工·{base}元/天+包住',
    '电子厂招工·坐班·空调车间',
    '【{location}】招流水线·可长期',
    '急招工厂普工·月结+加班费',
  ],
  RIDESHARE: [
    '【{location}】外卖骑手·多劳多得',
    '招骑手·时间自由·{base}元/天起',
    '急招外卖员·站点补贴+高温补贴',
    '【{location}】骑手·可兼职可全职',
  ],
  SECURITY: [
    '【{location}】招保安·{base}元/天+包住',
    '小区保安·坐岗·月休4',
    '急招保安员·退伍军人优先',
    '【{location}】安保·三班倒',
  ],
  HOME_STREAMER: [
    '居家主播·{base}元/小时+提成',
    '【{location}】招主播·时间自由',
    '招居家直播·设备齐全·{base}元起',
    '急招主播·多平台可选',
  ],
  TUTORING: [
    '【{location}】招家教·{base}元/小时',
    '中小学辅导老师·可周末兼职',
    '急招家教老师·大学生可',
    '【{location}】助教·时间灵活',
  ],
  OTHERS: ['【{location}】校园兼职·多岗位可选', '招校园兼职·时间灵活·日结'],
};

// 描述模板:每 key 至少 2 段(每段数组按行拼接)。
export const DESCRIPTION_TEMPLATES: Record<CategoryKey, string[][]> = {
  RESTAURANT: [
    [
      '1. 负责餐厅前厅或后厨的点餐、出餐、清洁工作。',
      '2. 保持服务态度热情,有团队协作意识。',
      '3. 服从排班,早晚班可轮换。',
    ],
    [
      '1. 前厅:迎宾、点餐、传菜、收桌。',
      '2. 后厨:切配、清洗、出餐打包。',
      '3. 每周排班,提供工作餐。',
    ],
  ],
  PHONE_SALES: [
    ['1. 通过电话联系意向客户,介绍产品促成成交。', '2. 维护客户资料,跟进成单。', '3. 完成月度销售指标。'],
    ['1. 坐班电销,公司提供客户资源。', '2. 底薪+提成,月休4天。'],
  ],
  FIELD_PROMO: [
    ['1. 户外推广,引导用户扫码或下载。', '2. 按有效邀约结算。', '3. 时间灵活,适合学生。'],
    ['1. 在指定商圈地推。', '2. 日结+邀约奖金。'],
  ],
  RETAIL_SALES: [
    ['1. 门店导购,介绍商品促成成交。', '2. 整理货架,保持店面整洁。', '3. 月休4天。'],
    ['1. 商场专柜导购。', '2. 底薪+销售提成。'],
  ],
  KITCHEN: [
    ['1. 后厨切配、洗碗、出餐打包。', '2. 保持后厨卫生。', '3. 服从厨师长安排。'],
    ['1. 厨房学徒,提供升职空间。', '2. 包工作餐。'],
  ],
  OFFICE_CLERK: [
    ['1. 文档整理、Excel 数据录入。', '2. 接听电话、接待来访。', '3. 完成上级交办事务。'],
    ['1. 校园行政助理。', '2. 双休,法定节假日休。'],
  ],
  PHONE_CS: [
    ['1. 接听客户来电,解答咨询。', '2. 记录客户问题并跟进。', '3. 坐班,空调环境。'],
    ['1. 售后客服,处理订单问题。', '2. 早九晚六。'],
  ],
  FACTORY: [
    ['1. 流水线作业,产品组装/包装。', '2. 坐班,空调车间。', '3. 月结+加班费。'],
    ['1. 电子厂普工。', '2. 包住,可长期。'],
  ],
  RIDESHARE: [
    ['1. 外卖配送,按时送达。', '2. 多劳多得,时间自由。', '3. 提供站点补贴。'],
    ['1. 骑手招募。', '2. 高温补贴+恶劣天气补贴。'],
  ],
  SECURITY: [
    ['1. 门岗/巡逻岗,负责出入登记。', '2. 三班倒,月休4天。', '3. 包住。'],
    ['1. 小区/商场安保。', '2. 退伍军人优先。'],
  ],
  HOME_STREAMER: [
    ['1. 在家直播带货或娱乐直播。', '2. 设备齐全,公司提供。', '3. 提成上不封顶。'],
    ['1. 多平台可选,时间自由。', '2. 按时薪+提成结算。'],
  ],
  TUTORING: [
    ['1. 中小学作业辅导或学科辅导。', '2. 上门或线上,时间灵活。', '3. 大学生可。'],
    ['1. 助教,协助主讲老师备课/答疑。', '2. 周末班。'],
  ],
  OTHERS: [['1. 校园周边各类兼职岗位。', '2. 时间灵活,日结/周结。']],
};

// 取 key 对应的一个 mapTo enum(用于 category 字段落库;null 表示「更多岗位」不直接落)。
export function mapKeyToCategory(key: CategoryKey): string | null {
  const entry = JOB_CATEGORY_GRID.find((c) => c.key === key);
  return entry ? entry.mapTo : null;
}

// 取 key 对应的所有 mapTo enum(用于 where in 筛选;null 走全表)。
export function mapKeyToCategories(key: CategoryKey): string[] {
  const entry = JOB_CATEGORY_GRID.find((c) => c.key === key);
  if (!entry) return [];
  return entry.mapTo ? [entry.mapTo] : [];
}

// 类别 meta 是否合法白名单
export function isValidCategoryKey(key: string): key is CategoryKey {
  return JOB_CATEGORY_GRID.some((c) => c.key === key);
}