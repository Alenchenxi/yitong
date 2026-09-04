import type { ExecutionContext } from '@nestjs/common';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { JwtAuthGuard } from '../../src/modules/auth/jwt-auth.guard';
import { AnonGuard } from '../../src/modules/treehole/anon.guard';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('平台账号封禁守卫', () => {
  it('应拒绝已封禁用户持有的旧 access token', async () => {
    const request = { headers: { authorization: 'Bearer access-token' } };
    const guard = new JwtAuthGuard(
      { verifyAsync: jest.fn().mockResolvedValue({ uid: 'user_1', role: 'USER', openid: 'openid_1', type: 'access' }) } as never,
      { getAllAndOverride: jest.fn().mockReturnValue(false) } as never,
      { user: { findUnique: jest.fn().mockResolvedValue({ deletedAt: new Date('2026-09-04T00:00:00.000Z') }) } } as never,
    );

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject<Partial<BizException>>({
      bizCode: 10005,
    });
    expect(request).not.toHaveProperty('user');
  });

  it('未封禁用户的 access token 应正常挂载身份', async () => {
    const request: { headers: { authorization: string }; user?: { uid: string } } = {
      headers: { authorization: 'Bearer access-token' },
    };
    const guard = new JwtAuthGuard(
      { verifyAsync: jest.fn().mockResolvedValue({ uid: 'user_1', role: 'USER', openid: 'openid_1', type: 'access' }) } as never,
      { getAllAndOverride: jest.fn().mockReturnValue(false) } as never,
      { user: { findUnique: jest.fn().mockResolvedValue({ deletedAt: null }) } } as never,
    );

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user?.uid).toBe('user_1');
  });

  it('应拒绝已封禁用户持有的旧 anon token', async () => {
    const request = { headers: { authorization: 'Bearer anon-token' } };
    const guard = new AnonGuard(
      { verifyAsync: jest.fn().mockResolvedValue({ anonId: 'anonymous_public_safe_1', type: 'anon' }) } as never,
      {
        anonymousProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'profile_1', userId: 'user_1' }) },
        user: { findUnique: jest.fn().mockResolvedValue({ deletedAt: new Date('2026-09-04T00:00:00.000Z') }) },
      } as never,
    );

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject<Partial<BizException>>({
      bizCode: 10005,
    });
    expect(request).not.toHaveProperty('user');
  });

  it('未封禁用户的 anon token 只挂载 anonId', async () => {
    const request: { headers: { authorization: string }; user?: { uid: string } } = {
      headers: { authorization: 'Bearer anon-token' },
    };
    const guard = new AnonGuard(
      { verifyAsync: jest.fn().mockResolvedValue({ anonId: 'anonymous_public_safe_1', type: 'anon' }) } as never,
      {
        anonymousProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'profile_1', userId: 'user_1' }) },
        user: { findUnique: jest.fn().mockResolvedValue({ deletedAt: null }) },
      } as never,
    );

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user?.uid).toBe('anonymous_public_safe_1');
    expect(JSON.stringify(request.user)).not.toContain('user_1');
  });
});