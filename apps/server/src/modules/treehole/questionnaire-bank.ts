// P1-14 树洞问卷题库（内置；标签来自 P1-13 seed 标签库，保证写回 profile 不被 30003 拦截）
// 4 类：personality（性格）/ interest（兴趣）/ values（三观）/ mood（心情）

export type QuestionnaireType = 'personality' | 'interest' | 'values' | 'mood';

export interface QuizOption {
  id: string;
  text: string;
  tags: string[]; // 选此选项累计的标签（1-2 个）
}
export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}
export interface QuizBank {
  type: QuestionnaireType;
  title: string;
  desc: string;
  questions: QuizQuestion[];
}

export const QUESTIONNAIRE_BANK: Record<QuestionnaireType, QuizBank> = {
  personality: {
    type: 'personality',
    title: '性格测试',
    desc: '测测你的匿名性格画像',
    questions: [
      {
        id: 'p1',
        text: '聚会中你通常是？',
        options: [
          { id: 'a', text: '角落安静观察', tags: ['社恐', '慢热'] },
          { id: 'b', text: '活跃气氛中心', tags: ['话痨', '乐观'] },
        ],
      },
      {
        id: 'p2',
        text: '做决定时你更倾向？',
        options: [
          { id: 'a', text: '分析利弊再定', tags: ['理性'] },
          { id: 'b', text: '跟着直觉走', tags: ['感性'] },
        ],
      },
      {
        id: 'p3',
        text: '面对新环境你？',
        options: [
          { id: 'a', text: '需要时间适应', tags: ['慢热', '社恐'] },
          { id: 'b', text: '很快融入', tags: ['乐观', '话痨'] },
        ],
      },
      {
        id: 'p4',
        text: '朋友眼中你是？',
        options: [
          { id: 'a', text: '倾听者', tags: ['慢热', '理性'] },
          { id: 'b', text: '开心果', tags: ['乐观', '话痨'] },
        ],
      },
      {
        id: 'p5',
        text: '遇到烦心事你？',
        options: [
          { id: 'a', text: '默默消化', tags: ['社恐', '感性'] },
          { id: 'b', text: '找朋友倾诉', tags: ['话痨'] },
        ],
      },
    ],
  },
  interest: {
    type: 'interest',
    title: '兴趣测试',
    desc: '发现你的兴趣标签',
    questions: [
      {
        id: 'i1',
        text: '周末宅家你选？',
        options: [
          { id: 'a', text: '听歌看电影', tags: ['音乐', '电影'] },
          { id: 'b', text: '打游戏', tags: ['游戏'] },
          { id: 'c', text: '看书', tags: ['阅读'] },
        ],
      },
      {
        id: 'i2',
        text: '出门你最想？',
        options: [
          { id: 'a', text: '运动流汗', tags: ['运动'] },
          { id: 'b', text: '寻觅美食', tags: ['美食'] },
          { id: 'c', text: '拍照打卡', tags: ['摄影', '旅行'] },
        ],
      },
      {
        id: 'i3',
        text: '旅行中你最喜欢？',
        options: [
          { id: 'a', text: '风景大片', tags: ['摄影', '旅行'] },
          { id: 'b', text: '当地小吃', tags: ['美食'] },
          { id: 'c', text: '文艺场馆', tags: ['阅读', '电影'] },
        ],
      },
      {
        id: 'i4',
        text: '你的播放列表多是？',
        options: [
          { id: 'a', text: '各种音乐', tags: ['音乐'] },
          { id: 'b', text: '播客有声书', tags: ['阅读'] },
        ],
      },
      {
        id: 'i5',
        text: '和朋友约你最常？',
        options: [
          { id: 'a', text: '约球运动', tags: ['运动'] },
          { id: 'b', text: '逛街探店', tags: ['美食', '摄影'] },
          { id: 'c', text: '开黑', tags: ['游戏'] },
        ],
      },
    ],
  },
  values: {
    type: 'values',
    title: '三观问卷',
    desc: '了解你的价值取向',
    questions: [
      {
        id: 'v1',
        text: '你更看重？',
        options: [
          { id: 'a', text: '逻辑与事实', tags: ['理性'] },
          { id: 'b', text: '感受与共情', tags: ['感性'] },
        ],
      },
      {
        id: 'v2',
        text: '面对挫折你？',
        options: [
          { id: 'a', text: '积极寻找出路', tags: ['乐观'] },
          { id: 'b', text: '先处理情绪', tags: ['感性'] },
        ],
      },
      {
        id: 'v3',
        text: '人际关系中你？',
        options: [
          { id: 'a', text: '重质量少而精', tags: ['慢热'] },
          { id: 'b', text: '广泛交友', tags: ['话痨'] },
        ],
      },
      {
        id: 'v4',
        text: '做计划你更？',
        options: [
          { id: 'a', text: '条理清晰', tags: ['理性'] },
          { id: 'b', text: '随性而为', tags: ['乐观'] },
        ],
      },
      {
        id: 'v5',
        text: '你理想的生活？',
        options: [
          { id: 'a', text: '安稳有序', tags: ['理性', '慢热'] },
          { id: 'b', text: '丰富多彩', tags: ['乐观', '话痨'] },
        ],
      },
    ],
  },
  mood: {
    type: 'mood',
    title: '心情问卷',
    desc: '记录此刻的心情状态',
    questions: [
      {
        id: 'm1',
        text: '此刻你的状态？',
        options: [
          { id: 'a', text: '心情不错', tags: ['开心'] },
          { id: 'b', text: '有点低落', tags: ['emo'] },
          { id: 'c', text: '想吐槽', tags: ['吐槽'] },
        ],
      },
      {
        id: 'm2',
        text: '今天最想？',
        options: [
          { id: 'a', text: '找人倾诉求安慰', tags: ['求安慰'] },
          { id: 'b', text: '专注学习', tags: ['学习'] },
          { id: 'c', text: '想谈恋爱', tags: ['恋爱'] },
        ],
      },
      {
        id: 'm3',
        text: '最近常感到？',
        options: [
          { id: 'a', text: '对未来迷茫', tags: ['迷茫'] },
          { id: 'b', text: '充实快乐', tags: ['开心'] },
          { id: 'c', text: '压力想吐槽', tags: ['吐槽'] },
        ],
      },
      {
        id: 'm4',
        text: '夜晚的你？',
        options: [
          { id: 'a', text: 'emo 时间', tags: ['emo'] },
          { id: 'b', text: '学习充电', tags: ['学习'] },
          { id: 'c', text: '幻想恋爱', tags: ['恋爱'] },
        ],
      },
      {
        id: 'm5',
        text: '最想对树洞说？',
        options: [
          { id: 'a', text: '求抱抱', tags: ['求安慰'] },
          { id: 'b', text: '好迷茫', tags: ['迷茫'] },
          { id: 'c', text: '今天真开心', tags: ['开心'] },
        ],
      },
    ],
  },
};

// 各类问卷结果写入 profile 的字段 + top N
export const QUIZ_RESULT_CONFIG: Record<
  QuestionnaireType,
  { field: 'personalityTags' | 'interestTags' | 'moodState'; topN: number }
> = {
  personality: { field: 'personalityTags', topN: 3 },
  interest: { field: 'interestTags', topN: 3 },
  values: { field: 'personalityTags', topN: 2 }, // 三观映射性格
  mood: { field: 'moodState', topN: 1 }, // 心情取 top1
};
