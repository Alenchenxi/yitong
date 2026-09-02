import type { AppInstance } from '../../../app';
import {
  getAnonProfile,
  updateAnonProfile,
  getAnonTags,
  listAnonBlocks,
  unblockAnon,
  type AnonTagItem,
} from '../../../services/treehole';
import { requireAnonymousContentVisibility } from '../../../utils/anonymous-content';

interface TagItem {
  name: string;
  selected: boolean;
}

interface BlockItem {
  blockedAnonId: string;
  short: string;
}

interface PageData {
  nickname: string;
  avatars: string[];
  avatar: string;
  personalityTags: TagItem[];
  interestTags: TagItem[];
  moods: string[];
  mood: string;
  saving: boolean;
  loaded: boolean;
  blocks: BlockItem[];
}

const AVATARS = ['🌙', '🐱', '🦊', '🐧', '🦉', '🐢', '🌻', '🍄'];
const MAX_TAGS = 8;

// P1-13：标签从后端标签库加载（admin 可配置）；库为空时回退到内置预设
const FALLBACK_PERSONALITY = ['温柔', '话痨', '慢热', '理性', '感性', '幽默', '安静', '社牛', '社恐', '细心'];
const FALLBACK_INTEREST = ['音乐', '电影', '游戏', '阅读', '运动', '美食', '旅行', '摄影', '动漫', '宠物'];
const FALLBACK_MOODS = ['开心', 'emo', '吐槽', '求安慰', '学习', '恋爱', '迷茫'];

function buildTags(preset: string[], selected: string[]): TagItem[] {
  const set = new Set(selected);
  return preset.map((name) => ({ name, selected: set.has(name) }));
}

Page({
  data: {
    nickname: '',
    avatars: AVATARS,
    avatar: '',
    personalityTags: buildTags(FALLBACK_PERSONALITY, []),
    interestTags: buildTags(FALLBACK_INTEREST, []),
    moods: FALLBACK_MOODS,
    mood: '',
    saving: false,
    loaded: false,
    blocks: [] as BlockItem[],
  } as PageData,

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    await this.load();
  },

  async load() {
    // P1-13：并行拉 profile + 标签库
    let personalityPreset = FALLBACK_PERSONALITY;
    let interestPreset = FALLBACK_INTEREST;
    let moodPreset = FALLBACK_MOODS;
    try {
      const tags = await getAnonTags();
      if (tags.personality.length > 0) personalityPreset = tags.personality.map((t) => t.name);
      if (tags.interest.length > 0) interestPreset = tags.interest.map((t) => t.name);
      if (tags.mood.length > 0) moodPreset = tags.mood.map((t) => t.name);
    } catch {
      /* 标签库拉取失败用 fallback */
    }

    try {
      const p = await getAnonProfile();
      this.setData({
        nickname: p.nickname,
        avatar: p.avatar ?? '',
        personalityTags: buildTags(personalityPreset, p.personalityTags),
        interestTags: buildTags(interestPreset, p.interestTags),
        moods: moodPreset,
        mood: p.moodState ?? '',
        loaded: true,
      });
    } catch {
      this.setData({
        personalityTags: buildTags(personalityPreset, []),
        interestTags: buildTags(interestPreset, []),
        moods: moodPreset,
        loaded: true,
      });
    }
    await this.loadBlocks();
  },

  // P0-16 我的屏蔽列表
  async loadBlocks() {
    try {
      const r = await listAnonBlocks();
      this.setData({
        blocks: r.list.map((b) => ({ blockedAnonId: b.blockedAnonId, short: b.blockedAnonId.slice(0, 10) })),
      });
    } catch {
      /* toast */
    }
  },

  async unblock(e: WechatMiniprogram.TouchEvent) {
    const blockedAnonId = e.currentTarget.dataset.id as string;
    if (!blockedAnonId) return;
    try {
      await unblockAnon(blockedAnonId);
      this.setData({ blocks: this.data.blocks.filter((b) => b.blockedAnonId !== blockedAnonId) });
      wx.showToast({ title: '已取消屏蔽', icon: 'none' });
    } catch {
      /* toast */
    }
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value });
  },

  pickAvatar(e: WechatMiniprogram.TouchEvent) {
    const avatar = e.currentTarget.dataset.avatar as string;
    this.setData({ avatar: avatar === this.data.avatar ? '' : avatar });
  },

  togglePersonality(e: WechatMiniprogram.TouchEvent) {
    this.setData({ personalityTags: this.toggleTag(this.data.personalityTags, e) });
  },
  toggleInterest(e: WechatMiniprogram.TouchEvent) {
    this.setData({ interestTags: this.toggleTag(this.data.interestTags, e) });
  },
  toggleTag(tags: TagItem[], e: WechatMiniprogram.TouchEvent): TagItem[] {
    const name = e.currentTarget.dataset.name as string;
    const next = tags.map((t) => ({ ...t }));
    const target = next.find((t) => t.name === name);
    if (!target) return tags;
    if (target.selected) {
      target.selected = false;
    } else {
      if (next.filter((t) => t.selected).length >= MAX_TAGS) {
        wx.showToast({ title: `最多 ${MAX_TAGS} 个`, icon: 'none' });
        return tags;
      }
      target.selected = true;
    }
    return next;
  },

  pickMood(e: WechatMiniprogram.TouchEvent) {
    const mood = e.currentTarget.dataset.mood as string;
    this.setData({ mood: mood === this.data.mood ? '' : mood });
  },

  async save() {
    if (this.data.saving) return;
    const nickname = this.data.nickname.trim();
    if (!nickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await updateAnonProfile({
        nickname,
        avatar: this.data.avatar || undefined,
        personalityTags: this.data.personalityTags.filter((t) => t.selected).map((t) => t.name),
        interestTags: this.data.interestTags.filter((t) => t.selected).map((t) => t.name),
        moodState: this.data.mood || undefined,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch {
      /* toast */
    } finally {
      this.setData({ saving: false });
    }
  },
});
