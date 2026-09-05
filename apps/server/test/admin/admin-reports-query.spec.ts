import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminController } from '../../src/modules/admin/admin.controller';
import { AdminService } from '../../src/modules/admin/admin.service';
import { DashboardService } from '../../src/modules/admin/dashboard.service';
import { AdminGuard } from '../../src/modules/auth/admin.guard';

describe('GET /admin/reports query validation', () => {
  let app: INestApplication;
  const listReports = jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 1 });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: { listReports } },
        { provide: DashboardService, useValue: {} },
      ],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((req: { adminAccess?: unknown }, _res: unknown, next: () => void) => {
      req.adminAccess = {
        adminId: 'admin_platform',
        isPlatform: true,
        allCommunities: true,
        communityIds: [],
        permissions: ['report.manage'],
      };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts pagination and status alongside moderation context', async () => {
    const address = app.getHttpServer().address() as { port: number };
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/admin/reports?page=1&pageSize=1&status=PENDING`,
    );

    expect(response.status).toBe(200);
    expect(listReports).toHaveBeenCalledWith(
      'PENDING',
      1,
      1,
      expect.objectContaining({ adminId: 'admin_platform' }),
      undefined,
      undefined,
    );
  });

  it('keeps rejecting query fields outside the reports whitelist', async () => {
    const address = app.getHttpServer().address() as { port: number };
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/admin/reports?unexpected=1`,
    );

    expect(response.status).toBe(400);
  });
});
