import { ConfigService } from '@nestjs/config';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { LocationService } from '../../src/modules/job/location.service';

describe('LocationService location context', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it.each([
    [116.4, 39.9, '北京', '朝阳区', '东城区'],
    [121.5, 31.2, '上海', '浦东新区', '黄浦区'],
    [106.55, 29.56, '重庆', '渝中区', '城口县'],
  ])('returns all districts for the current city', async (lng, lat, city, district, expectedDistrict) => {
    process.env.NODE_ENV = 'test';
    const config = { get: () => undefined } as unknown as ConfigService;
    const service = new LocationService(config);

    const result = await service.getLocationContext(lng, lat);

    expect(result.city).toBe(city);
    expect(result.district).toBe(district);
    expect(result.districts).toContain(district);
    expect(result.districts).toContain(expectedDistrict);
    expect(new Set(result.districts).size).toBe(result.districts.length);
  });

  it('does not return a mock city when production reverse geocoding fails', async () => {
    process.env.NODE_ENV = 'production';
    const config = { get: () => 'test-ak' } as unknown as ConfigService;
    const service = new LocationService(config);
    const previousFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as typeof fetch;

    try {
      await expect(service.getLocationContext(116.4, 39.9, 'bd09')).rejects.toMatchObject({
        bizCode: 90003,
      });
    } finally {
      global.fetch = previousFetch;
    }
  });
});
