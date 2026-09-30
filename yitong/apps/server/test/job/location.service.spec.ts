import { LocationService } from '../../src/modules/job/location.service';

// P2-79 去百度地图:LocationService 全本地实现(坐标公式 + 地址城市解析 + 区县列表)
// 替代旧 location-context.spec.ts(围绕已删除的百度 getLocationContext)
describe('LocationService 本地地理能力（P2-79）', () => {
  const service = new LocationService();

  describe('gcj02ToBd09', () => {
    // 已知锚值(百度 geoconv from=3 to=5 定义本身),容差 1e-6 对齐 round6/Decimal(10,6)
    it.each([
      [116.397428, 39.90923, 116.403801, 39.915573],
      [121.473701, 31.230416, 121.480238, 31.236351],
      [113.264385, 23.129112, 113.270818, 23.13534],
      [106.551556, 29.563009, 106.557991, 29.569302],
    ])('(%s, %s) → (%s, %s)', (lng, lat, expectedLng, expectedLat) => {
      const result = service.gcj02ToBd09(lng, lat);
      expect(Math.abs(result.lng - expectedLng)).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(result.lat - expectedLat)).toBeLessThanOrEqual(1e-6);
    });

    it('同输入幂等（round6 对齐 Decimal(10,6)，幂等重放一致）', () => {
      expect(service.gcj02ToBd09(116.4, 39.9)).toEqual(service.gcj02ToBd09(116.4, 39.9));
    });

    it('(0, 0) 合法（缺省坐标可转换，不抛错）', () => {
      expect(service.gcj02ToBd09(0, 0)).toEqual({ lng: 0.0065, lat: 0.006 });
    });
  });

  describe('normalizeAdministrativeName', () => {
    it('剥行政后缀（市/自治州等）', () => {
      expect(service.normalizeAdministrativeName('杭州市')).toBe('杭州');
      expect(service.normalizeAdministrativeName('大理白族自治州')).toBe('大理白族');
      expect(service.normalizeAdministrativeName('  北京市 ')).toBe('北京');
    });
  });

  describe('parseCityFromAddress', () => {
    it.each([
      ['北京市朝阳区望京街道', '北京市'], // 直辖市(从 provinces 补)
      ['上海市杨浦区五角场', '上海市'],
      ['浙江省杭州市西湖区文一路', '杭州市'], // 全前缀
      ['杭州西湖区文一路', '杭州市'], // 无省名简称
      ['吉林省吉林市船营区', '吉林市'], // 省名与市名同字,省名预匹配消歧
      ['重庆市渝中区', '重庆市'],
      ['云南省大理白族自治州大理市', '大理白族自治州'], // 自治州
    ])('%s → %s', (address, expected) => {
      expect(service.parseCityFromAddress(address)).toBe(expected);
    });

    it('无命中 → null（null / undefined / 空白 / 无城市名文本）', () => {
      expect(service.parseCityFromAddress(null)).toBeNull();
      expect(service.parseCityFromAddress(undefined)).toBeNull();
      expect(service.parseCityFromAddress('   ')).toBeNull();
      expect(service.parseCityFromAddress('大学生活动中心')).toBeNull();
    });

    it('圈子 region 回落文本同样可解析（createPost 地址解析失败后的第二跳）', () => {
      expect(service.parseCityFromAddress('北京市朝阳区')).toBe('北京市');
    });

    // 已知限制(方案文档化接受):跨市同名街区可能误判,只影响 city 归类不影响坐标。
    // 固化该行为,避免后续无意识变更。
    it('已知限制:跨市同名街区会误判(南京北京东路 → 北京市)', () => {
      expect(service.parseCityFromAddress('南京北京东路大学科技园')).toBe('北京市');
    });
  });

  describe('listDistricts', () => {
    it('直辖市:北京 16 区,去重', () => {
      const districts = service.listDistricts('北京市');
      expect(districts).toHaveLength(16);
      expect(districts).toContain('东城区');
      expect(districts).toContain('密云区');
      expect(new Set(districts).size).toBe(districts.length);
    });

    it('简称与全名等价(北京 === 北京市)', () => {
      expect(service.listDistricts('北京')).toEqual(service.listDistricts('北京市'));
    });

    it('地级市:杭州含西湖区', () => {
      expect(service.listDistricts('杭州市')).toContain('西湖区');
    });

    it('未知城市 → 空数组', () => {
      expect(service.listDistricts('不存在市')).toEqual([]);
    });
  });
});
