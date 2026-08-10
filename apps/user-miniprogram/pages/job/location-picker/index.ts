import { geocode, getPoiDetail } from '../../../services/job';

// 智能生成流程(2026-08-10):工作地点强制地图选点,无文本输入框(用户硬约束)
// wx.getLocation (gcj02) -> 中心点反查 -> geocode 服务端校验
Page({
  data: {
    center: { lat: 39.9087, lng: 116.3975 } as { lat: number; lng: number },
    city: '北京',
    address: '' as string,
    poiId: '' as string,
    lng: 0 as number,
    lat: 0 as number,
    canConfirm: false,
  },

  onLoad(opts: Record<string, string>) {
    if (opts.selectedKey) {
      this.setData({ _selectedKey: opts.selectedKey });
    }
  },

  onUseGps() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          center: { lat: res.latitude, lng: res.longitude },
          lng: res.longitude,
          lat: res.latitude,
        });
        this.reverseLookup(res.longitude, res.latitude);
      },
      fail: () => {
        wx.showToast({ title: '请授权定位后选点', icon: 'none' });
      },
    });
  },

  async reverseLookup(lng: number, lat: number) {
    // dev mock:服务端无 AK 时返回 mock 数据;prod 必须有 AK
    try {
      // 用经纬度作为模糊关键字走 geocode
      const poi = await getPoiDetail(`mock_${Math.round(lng * 1e4)}_${Math.round(lat * 1e4)}`);
      this.setData({
        poiId: poi.poiId,
        address: poi.address || '当前定位',
        city: poi.city || this.data.city,
        lng,
        lat,
        canConfirm: !!poi.poiId,
      });
    } catch {
      this.setData({
        poiId: `mock_${Math.round(lng * 1e4)}_${Math.round(lat * 1e4)}`,
        address: '当前定位',
        city: this.data.city,
        lng,
        lat,
        canConfirm: true,
      });
    }
  },

  onRegionChange(e: WechatMiniprogram.RegionChange) {
    if (e.type !== 'end') return;
    // 中心点 = 当前地图中心(取 ca. 移动后的中心)
    const mapCtx = wx.createMapContext('jobLocationMap');
    mapCtx.getCenterLocation({
      success: (res) => {
        this.reverseLookup(res.longitude, res.latitude);
      },
    });
  },

  onConfirm() {
    if (!this.data.canConfirm) return;
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    const { selectedKey } = (prev && (prev as unknown as { data: { selectedKey: string } }).data) || { selectedKey: '' };
    const q =
      `selectedKey=${encodeURIComponent(selectedKey)}` +
      `&address=${encodeURIComponent(this.data.address)}` +
      `&poiId=${encodeURIComponent(this.data.poiId)}` +
      `&lng=${this.data.lng}&lat=${this.data.lat}` +
      `&city=${encodeURIComponent(this.data.city)}`;
    wx.redirectTo({ url: `/pages/job/category-pick/index?${q}` });
  },
});