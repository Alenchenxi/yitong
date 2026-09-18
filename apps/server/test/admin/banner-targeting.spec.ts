import { BizException } from '../../src/common/exceptions/biz.exception';
import { AdminAccessContext, AdminAccessService } from '../../src/modules/admin/admin-access.service';
import { AdminService } from '../../src/modules/admin/admin.service';

function buildAccess(overrides: Partial<AdminAccessContext> = {}): AdminAccessContext {
  return {
    adminId: 'admin_1',
    openid: 'openid_1',
    adminTypeId: 'type_platform',
    adminTypeName: '平台管理员',
    isPlatform: true,
    allCommunities: true,
    communityIds: [],
    permissions: [],
    ...overrides,
  };
}

function buildAccessService(access: AdminAccessContext) {
  return {
    assertCommunity: jest.fn(async (_ctx: AdminAccessContext, communityId: string) => {
      if (!access.allCommunities && !access.communityIds.includes(communityId)) {
        throw new BizException(10003, '无权管理该圈子', 403);
      }
    }),
    assertPlatform: jest.fn((_ctx: AdminAccessContext) => {
      if (!access.isPlatform) {
        throw new BizException(10003, '仅平台管理员可管理平台内容', 403);
      }
    }),
    communityIdWhere: jest.fn(() => (access.allCommunities ? undefined : { in: access.communityIds })),
    audit: jest.fn(async () => undefined),
  } as unknown as AdminAccessService;
}

function buildPrisma() {
  const txBannerCommunityDeleteMany = jest.fn(async () => ({ count: 0 }));
  const txBannerUpdate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => data);
  const prisma = {
    banner: {
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      delete: jest.fn(async () => ({})),
    },
    bannerCommunity: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    community: {
      findFirst: jest.fn(async () => ({ id: 'cm_first' })),
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id })),
      ),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        bannerCommunity: { deleteMany: txBannerCommunityDeleteMany },
        banner: { update: txBannerUpdate },
      }),
    ),
  };
  return { prisma, txBannerCommunityDeleteMany, txBannerUpdate };
}

function buildService(access: AdminAccessContext) {
  const built = buildPrisma();
  const service = new AdminService(
    built.prisma as never,
    {} as never,
    {} as never,
    {} as never,
    buildAccessService(access),
  );
  return { service, prisma: built.prisma, txBannerCommunityDeleteMany: built.txBannerCommunityDeleteMany, txBannerUpdate: built.txBannerUpdate };
}

const createDto = { title: '促销广告', imageUrl: 'https://cdn/a.png' };

describe('广告位多圈投放（P2-63）', () => {
  it('平台管理员可创建全部圈子投放广告，写入 allCommunities 且不建定向行', async () => {
    const { service, prisma } = buildService(buildAccess());
    const created = await service.createBanner({ ...createDto, allCommunities: true }, buildAccess());
    expect(created).toMatchObject({ allCommunities: true, communityId: 'cm_first' });
    expect(prisma.community.findFirst).toHaveBeenCalled();
    expect(prisma.banner.create).toHaveBeenCalledTimes(1);
    const data = (prisma.banner.create as jest.Mock).mock.calls[0][0].data;
    expect(data.targets).toBeUndefined();
  });

  it('非平台管理员创建全圈投放应拒绝 10003', async () => {
    const { service } = buildService(buildAccess({ isPlatform: false, allCommunities: false, communityIds: ['cm_a'] }));
    await expect(
      service.createBanner({ ...createDto, allCommunities: true }, buildAccess({ isPlatform: false, allCommunities: false, communityIds: ['cm_a'] })),
    ).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('指定多圈投放去重写入定向行，兜底圈取第一个目标圈', async () => {
    const { service, prisma } = buildService(buildAccess());
    await service.createBanner({ ...createDto, communityIds: ['cm_b', 'cm_a', 'cm_b'] }, buildAccess());
    const { data, include } = (prisma.banner.create as jest.Mock).mock.calls[0][0];
    expect(data.allCommunities).toBe(false);
    expect(data.communityId).toBe('cm_b');
    expect(data.targets.create).toEqual([{ communityId: 'cm_b' }, { communityId: 'cm_a' }]);
    expect(include).toMatchObject({ targets: true });
  });

  it('兼容旧 communityId 单圈字段：归一为单元素定向', async () => {
    const { service, prisma } = buildService(buildAccess());
    await service.createBanner({ ...createDto, communityId: 'cm_legacy' }, buildAccess());
    const { data } = (prisma.banner.create as jest.Mock).mock.calls[0][0];
    expect(data.targets.create).toEqual([{ communityId: 'cm_legacy' }]);
  });

  it('未选择任何圈子应拒绝 40013', async () => {
    const { service } = buildService(buildAccess());
    await expect(service.createBanner({ ...createDto }, buildAccess())).rejects.toMatchObject({ bizCode: 40013 });
  });

  it('指定不存在的圈子应拒绝 80010', async () => {
    const { service, prisma } = buildService(buildAccess());
    (prisma.community.findMany as jest.Mock).mockResolvedValueOnce([{ id: 'cm_a' }]);
    await expect(
      service.createBanner({ ...createDto, communityIds: ['cm_a', 'cm_missing'] }, buildAccess()),
    ).rejects.toMatchObject({ bizCode: 80010 });
  });

  it('非平台管理员修改投放范围应拒绝 10003', async () => {
    const access = buildAccess({ isPlatform: false, allCommunities: false, communityIds: ['cm_a'] });
    const { service, prisma } = buildService(access);
    (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'bn_1', allCommunities: false, communityId: 'cm_a' });
    await expect(
      service.updateBanner('bn_1', { allCommunities: true }, access),
    ).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('平台管理员改投指定圈子应在事务内重建定向行', async () => {
    const { service, prisma, txBannerCommunityDeleteMany, txBannerUpdate } = buildService(buildAccess());
    (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'bn_1', allCommunities: true, communityId: 'cm_first' });
    await service.updateBanner('bn_1', { communityIds: ['cm_a', 'cm_c'] }, buildAccess());
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txBannerCommunityDeleteMany).toHaveBeenCalledWith({ where: { bannerId: 'bn_1' } });
    const updateArg = (txBannerUpdate as jest.Mock).mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'bn_1' });
    expect(updateArg.data).toMatchObject({ allCommunities: false });
    expect(updateArg.data.targets.create).toEqual([{ communityId: 'cm_a' }, { communityId: 'cm_c' }]);
  });

  it('平台管理员把指定圈广告改为全圈后不再保留定向行', async () => {
    const { service, prisma } = buildService(buildAccess());
    (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'bn_2', allCommunities: false, communityId: 'cm_a' });
    const updated = await service.updateBanner('bn_2', { allCommunities: true }, buildAccess());
    expect(updated).toMatchObject({ allCommunities: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('圈子管理员仍可编辑本圈单圈广告的标题等非投放字段', async () => {
    const access = buildAccess({ isPlatform: false, allCommunities: false, communityIds: ['cm_a'] });
    const { service, prisma } = buildService(access);
    (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'bn_3', allCommunities: false, communityId: 'cm_a' });
    const updated = await service.updateBanner('bn_3', { title: '新标题' }, access);
    expect(updated).toMatchObject({ title: '新标题' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('圈子管理员不可管理全圈广告（编辑同样拒绝）', async () => {
    const access = buildAccess({ isPlatform: false, allCommunities: false, communityIds: ['cm_a'] });
    const { service, prisma } = buildService(access);
    (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'bn_4', allCommunities: true, communityId: 'cm_first' });
    await expect(service.updateBanner('bn_4', { title: 'x' }, access)).rejects.toMatchObject({ bizCode: 10003 });
    await expect(service.deleteBanner('bn_4', access)).rejects.toMatchObject({ bizCode: 10003 });
    await expect(service.toggleBanner('bn_4', false, access)).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('管理端列表返回定向圈子并放行全圈广告', async () => {
    const { service, prisma } = buildService(buildAccess());
    await service.listBanners(undefined, undefined, buildAccess());
    const args = (prisma.banner.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where).toMatchObject({ OR: [{ allCommunities: true }, { community: { deletedAt: null } }] });
    expect(args.include).toHaveProperty('targets');
  });

  it('删除/启停指定圈广告沿用圈子范围校验', async () => {
    const access = buildAccess({ isPlatform: false, allCommunities: false, communityIds: ['cm_a'] });
    const { service, prisma } = buildService(access);
    (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'bn_5', allCommunities: false, communityId: 'cm_out' });
    await expect(service.deleteBanner('bn_5', access)).rejects.toMatchObject({ bizCode: 10003 });
    (prisma.banner.findUnique as jest.Mock).mockResolvedValue({ id: 'bn_6', allCommunities: false, communityId: 'cm_a' });
    await expect(service.toggleBanner('bn_6', false, access)).resolves.toBeTruthy();
  });
});
