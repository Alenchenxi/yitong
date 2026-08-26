/* eslint-disable no-console */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { CommunityController } from '../../src/modules/community/community.controller';
import type { CommunityService } from '../../src/modules/community/community.service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

type InviteResult = { id: string; joined: boolean };

function buildController(behavior: 'resolve' | 'reject') {
  const calls: Array<{ uid: string; communityId: string }> = [];
  const expectedError = new BizException(80011, '圈子不存在或不可用');
  const service = {
    acceptInvite: async (uid: string, communityId: string): Promise<InviteResult> => {
      calls.push({ uid, communityId });
      if (behavior === 'reject') throw expectedError;
      return { id: communityId, joined: true };
    },
  } as unknown as CommunityService;

  return {
    controller: new CommunityController(service),
    calls,
    expectedError,
  };
}

async function main(): Promise<void> {
  console.log('[1] 路由元数据');
  const controllerPath = Reflect.getMetadata('path', CommunityController) as string | undefined;
  const method = CommunityController.prototype.acceptInvite;
  const routePath = Reflect.getMetadata('path', method) as string | undefined;
  const requestMethod = Reflect.getMetadata('method', method) as RequestMethod | undefined;

  assert(controllerPath === 'community', 'Controller 类路径为 community');
  assert(routePath === ':id/invite-join', 'acceptInvite 路径为 :id/invite-join');
  assert(requestMethod === RequestMethod.POST, 'acceptInvite 使用 POST');

  console.log('[2] 参数传递与真实 ok(data) 包络');
  {
    const { controller, calls } = buildController('resolve');
    const req = { user: { uid: 'user_a', openid: 'openid_a', role: 'USER' } };
    const responsePromise = controller.acceptInvite(req as never, 'community_a');

    assert(responsePromise instanceof Promise, 'acceptInvite 返回 Promise');
    const response = await responsePromise;
    assert(calls.length === 1, 'CommunityService.acceptInvite 仅调用一次');
    assert(
      calls[0]?.uid === 'user_a' && calls[0]?.communityId === 'community_a',
      '正确传递 req.user.uid 和圈子 id',
    );
    assert(response.code === 0, '响应包络 code 为 0');
    assert(response.message === 'ok', '响应包络 message 为 ok');
    assert(
      response.data.id === 'community_a' && response.data.joined === true,
      '响应 data 是 service 返回的真实邀请结果',
    );
    assert(!(response.data instanceof Promise), '响应 data 不是 Promise');
  }

  console.log('[3] Service 异常通过 Promise 原样传播');
  {
    const { controller, expectedError } = buildController('reject');
    const req = { user: { uid: 'user_a', openid: 'openid_a', role: 'USER' } };
    let caught: unknown;
    try {
      await controller.acceptInvite(req as never, 'community_disabled');
    } catch (error) {
      caught = error;
    }
    assert(caught === expectedError, 'BizException 经 controller Promise 原样 reject');
  }

  console.log(`\n==== community invite smoke：${passed} 通过 / ${failed} 失败 ====`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('community invite smoke 异常:', error);
  process.exit(1);
});
