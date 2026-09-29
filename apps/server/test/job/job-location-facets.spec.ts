import { JobVisibilityScope } from '@prisma/client';
import { JobVisibilityPolicyService } from '../../src/modules/job-visibility/job-visibility.service';
import { JobService } from '../../src/modules/job/job.service';
import { LocationService } from '../../src/modules/job/location.service';
import { TutorJobPolicyService } from '../../src/modules/tutor-sync/tutor-job-policy.service';

// P2-79 去百度地图:区域筛选 facets(有岗城市聚合,归一合并存量「北京/北京市」混存)
function buildFacetsService(groupByResult: Array<{ locationCity: string | null; _count: { _all: number } }>) {
  const groupBy = jest.fn().mockResolvedValue(groupByResult);
  const prisma = { jobPost: { groupBy } };
  const service = new JobService(
    prisma as never,
    { checkText: jest.fn() } as never,
    { create: jest.fn() } as never,
    new LocationService(),
    { resolveFeedCommunityId: jest.fn().mockResolvedValue('community_a') } as never,
    new JobVisibilityPolicyService(),
    new TutorJobPolicyService(),
  );
  return { service, groupBy };
}

describe('JobService.getLocationFacets（P2-79 区域筛选 facets）', () => {
  it('同城市不同写法归并为一个 chip，count 累加、展示名取更长原始值', async () => {
    const { service } = buildFacetsService([
      { locationCity: '北京', _count: { _all: 2 } },
      { locationCity: '北京市', _count: { _all: 1 } },
      { locationCity: '杭州市', _count: { _all: 3 } },
    ]);

    const result = await service.getLocationFacets('user_1');

    // 北京(2)+北京市(1) 归并 → 北京市 3;杭州 3;同数中文序(北 < 杭)北京市在前
    expect(result.cities).toEqual([
      { city: '北京市', count: 3 },
      { city: '杭州市', count: 3 },
    ]);
    expect(result.city).toBeUndefined();
    expect(result.districts).toBeUndefined();
  });

  it('查询口径与列表一致：PUBLISHED + 未软删 + city 非空 + 圈子可见性', async () => {
    const { service, groupBy } = buildFacetsService([]);
    await service.getLocationFacets('user_1');

    const where = groupBy.mock.calls[0][0].where;
    expect(where.status).toBe('PUBLISHED');
    expect(where.deletedAt).toBe(null);
    expect(where.locationCity).toEqual({ not: null });
    // 与列表同口径的圈子可见性过滤(resolveFeedCommunityId,非透传面板 communityId)
    // buildFilters 含当前时间 expireAt.gt,两次调用毫秒可能差 1,故比对结构不比时间值
    const filters = new JobVisibilityPolicyService().buildFilters('community_a');
    expect(where.AND).toHaveLength(filters.length);
    expect(where.AND?.[0]).toEqual(filters[0]);
  });

  it('count 降序，同数按中文序', async () => {
    const { service } = buildFacetsService([
      { locationCity: '成都市', _count: { _all: 1 } },
      { locationCity: '上海市', _count: { _all: 9 } },
      { locationCity: '广州市', _count: { _all: 1 } },
    ]);

    const result = await service.getLocationFacets('user_1');

    // 同数 1 的成都/广州按拼音序 c < g,成都在前
    expect(result.cities.map((c) => c.city)).toEqual(['上海市', '成都市', '广州市']);
  });

  it('传 city 时附带本地数据包全量区县列表', async () => {
    const { service } = buildFacetsService([]);

    const result = await service.getLocationFacets('user_1', ' 北京市 ');

    expect(result.city).toBe('北京市');
    expect(result.districts).toContain('东城区');
    expect(new Set(result.districts).size).toBe(result.districts?.length);
  });

  it('city 为空白时不附带区县字段', async () => {
    const { service } = buildFacetsService([]);
    const result = await service.getLocationFacets('user_1', '   ');
    expect(result.city).toBeUndefined();
    expect(result.districts).toBeUndefined();
  });

  it('visibilityScope 全圈可见口径下 facets 过滤器含 ALL_COMMUNITIES 分支', () => {
    // 静态口径固化:facets 与列表共用 buildFilters,全圈岗位对任何圈子可见
    const filters = new JobVisibilityPolicyService().buildFilters('community_a');
    expect(filters[0]).toMatchObject({
      OR: expect.arrayContaining([{ visibilityScope: JobVisibilityScope.ALL_COMMUNITIES }]),
    });
  });
});
