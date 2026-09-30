// P1-07 搜索历史：小程序本地 storage 存最近 10 条

const KEY = 'yitong_search_history_v1';
const MAX = 10;

export function getHistory(): string[] {
  try {
    const raw = wx.getStorageSync(KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string').slice(0, MAX);
  } catch {
    return [];
  }
}

export function addHistory(keyword: string) {
  const kw = keyword.trim();
  if (!kw) return;
  const list = getHistory().filter((x) => x !== kw);
  list.unshift(kw);
  try {
    wx.setStorageSync(KEY, list.slice(0, MAX));
  } catch {
    /* ignore */
  }
}

export function clearHistory() {
  try {
    wx.removeStorageSync(KEY);
  } catch {
    /* ignore */
  }
}
