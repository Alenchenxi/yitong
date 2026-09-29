import { AppConfigController } from '../../src/modules/app-config/app-config.controller';
import {
  MP_RELEASE_NOTES_KEY,
  MP_RELEASE_NOTES_MAX_LENGTH,
  AppConfigService,
} from '../../src/modules/app-config/app-config.service';
import { AdminService } from '../../src/modules/admin/admin.service';
import { PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../../src/modules/auth/public.decorator';

describe('小程序版本更新说明配置', () => {
  function buildAppConfig(value?: unknown) {
    const prisma = {
      appConfig: {
        findUnique: jest.fn().mockResolvedValue(
          value === undefined ? null : { key: MP_RELEASE_NOTES_KEY, value },
        ),
      },
    };
    const service = new AppConfigService(prisma as never);
    return { controller: new AppConfigController(service), prisma };
  }

  function buildAdmin(prisma: Record<string, unknown>) {
    return new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never);
  }

  it('未配置时公开接口默认返回空说明', async () => {
    const { controller } = buildAppConfig();

    await expect(controller.getMpReleaseNotes()).resolves.toEqual({
      code: 0,
      data: { notes: '' },
      message: 'ok',
    });
  });

  it('公开接口固定注册为 /app-config/mp-release-notes 且无需登录', () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, AppConfigController);
    const method = AppConfigController.prototype.getMpReleaseNotes;
    const methodPath = Reflect.getMetadata(PATH_METADATA, method);
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, method);

    expect(controllerPath).toBe('app-config');
    expect(methodPath).toBe('mp-release-notes');
    expect(isPublic).toBe(true);
  });

  it('公开接口返回管理员保存的字符串说明', async () => {
    const { controller } = buildAppConfig('优化了广场体验，修复若干问题');

    await expect(controller.getMpReleaseNotes()).resolves.toEqual({
      code: 0,
      data: { notes: '优化了广场体验，修复若干问题' },
      message: 'ok',
    });
  });

  it.each([true, 1, null])('数据库中的非字符串旧值按空说明处理 %p', async (value) => {
    const { controller } = buildAppConfig(value);

    await expect(controller.getMpReleaseNotes()).resolves.toEqual({
      code: 0,
      data: { notes: '' },
      message: 'ok',
    });
  });

  it('管理端允许写入说明并自动去除首尾空白', async () => {
    const prisma = {
      appConfig: {
        upsert: jest.fn().mockImplementation(async (args) => args.create),
      },
    };
    const admin = buildAdmin(prisma);

    await admin.updateSetting(MP_RELEASE_NOTES_KEY, '  修复登录闪退  ', 'admin-openid');

    expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: MP_RELEASE_NOTES_KEY },
        create: expect.objectContaining({
          key: MP_RELEASE_NOTES_KEY,
          value: '修复登录闪退',
          updatedBy: 'admin-openid',
        }),
      }),
    );
  });

  it('管理端允许写入空串（清空说明，用户端弹窗回退通用文案）', async () => {
    const prisma = {
      appConfig: {
        upsert: jest.fn().mockImplementation(async (args) => args.create),
      },
    };
    const admin = buildAdmin(prisma);

    await admin.updateSetting(MP_RELEASE_NOTES_KEY, '   ', 'admin-openid');

    expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: MP_RELEASE_NOTES_KEY },
        create: expect.objectContaining({ key: MP_RELEASE_NOTES_KEY, value: '' }),
      }),
    );
  });

  it('管理端设置列表包含默认为空串的版本更新说明', async () => {
    const prisma = {
      appConfig: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const admin = buildAdmin(prisma);

    await expect(admin.getSettings()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: MP_RELEASE_NOTES_KEY,
          value: '',
        }),
      ]),
    );
  });

  it.each([true, 1, null])('管理端拒绝非法说明值 %p', async (value) => {
    const prisma = {
      appConfig: {
        upsert: jest.fn(),
      },
    };
    const admin = buildAdmin(prisma);

    await expect(
      admin.updateSetting(MP_RELEASE_NOTES_KEY, value, 'admin-openid'),
    ).rejects.toMatchObject({ bizCode: 40003, status: 400 });
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled();
  });

  it(`管理端拒绝超过 ${MP_RELEASE_NOTES_MAX_LENGTH} 字的说明`, async () => {
    const prisma = {
      appConfig: {
        upsert: jest.fn(),
      },
    };
    const admin = buildAdmin(prisma);

    await expect(
      admin.updateSetting(MP_RELEASE_NOTES_KEY, '长'.repeat(MP_RELEASE_NOTES_MAX_LENGTH + 1), 'admin-openid'),
    ).rejects.toMatchObject({ bizCode: 40003, status: 400 });
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled();
  });
});
