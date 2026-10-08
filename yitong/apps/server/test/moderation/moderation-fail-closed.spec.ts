import { BizException } from '../../src/common/exceptions/biz.exception';
import { ModerationService } from '../../src/modules/moderation/moderation.service';

// 内容安全 fail-closed 加固单测：
// 核心口径——未从微信拿到明确审核结论（errcode 业务错误 / 缺 suggest / 响应非 JSON / 请求失败）时，
// 生产环境必须抛 90003 拒绝发布（fail-closed），不得像旧实现那样 `?? 'pass'` 默认放行。

type SecCheckJson = Record<string, unknown>;

function buildService(): ModerationService {
  const wxToken = {
    isMock: () => false,
    getAccessToken: async () => 'test-access-token',
  };
  return new ModerationService(wxToken as never);
}

function mockFetchJson(payload: SecCheckJson): void {
  const fetchMock = jest.fn();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  (globalThis as { fetch: unknown }).fetch = fetchMock;
}

function mockFetchHttpError(status: number): void {
  (globalThis as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({}),
  });
}

// HTTP 200 但响应体不是合法 JSON（res.json() reject）——与「请求失败」分支区分覆盖
function mockFetchInvalidJsonBody(): void {
  (globalThis as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error('Unexpected token < in JSON');
    },
  });
}

async function expectBizCode(promise: Promise<void>, code: number): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(BizException);
  expect((caught as BizException).bizCode).toBe(code);
}

describe('ModerationService fail-closed 加固', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  describe('checkText（文本）', () => {
    it('明确 suggest=pass 时放行', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 0, result: { suggest: 'pass', label: 100 } });
      await expect(buildService().checkText('正常内容', 'openid_1')).resolves.toBeUndefined();
    });

    it('明确 suggest=risky 时抛 90002', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 0, result: { suggest: 'risky', label: 20001 } });
      await expectBizCode(buildService().checkText('违规内容', 'openid_1'), 90002);
    });

    it('suggest=review 时不拦截（留给人工复审）', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 0, result: { suggest: 'review', label: 20002 } });
      await expect(buildService().checkText('疑似内容', 'openid_1')).resolves.toBeUndefined();
    });

    it('result 缺失时回退 detail[0].suggest=risky 仍拦截', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 0, detail: [{ strategy: 'content_model', suggest: 'risky' }] });
      await expectBizCode(buildService().checkText('违规内容', 'openid_1'), 90002);
    });

    it('HTTP 200 + errcode=40001（token 失效）生产环境抛 90003，不得默认放行', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 40001, errmsg: 'invalid credential' });
      await expectBizCode(buildService().checkText('任意内容', 'openid_1'), 90003);
    });

    it('HTTP 200 + errcode=40001 非生产环境 fail-open 放行', async () => {
      process.env.NODE_ENV = 'test';
      mockFetchJson({ errcode: 40001, errmsg: 'invalid credential' });
      await expect(buildService().checkText('任意内容', 'openid_1')).resolves.toBeUndefined();
    });

    it('errcode=0 但缺 suggest 生产环境抛 90003', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 0, errmsg: 'ok' });
      await expectBizCode(buildService().checkText('任意内容', 'openid_1'), 90003);
    });

    it('响应体非 JSON 生产环境抛 90003', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchInvalidJsonBody();
      await expectBizCode(buildService().checkText('任意内容', 'openid_1'), 90003);
    });

    it('请求网络失败生产环境抛 90003', async () => {
      process.env.NODE_ENV = 'production';
      (globalThis as { fetch: unknown }).fetch = jest.fn().mockRejectedValueOnce(new Error('network down'));
      await expectBizCode(buildService().checkText('任意内容', 'openid_1'), 90003);
    });

    it('HTTP 非 200 生产环境抛 90003', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchHttpError(500);
      await expectBizCode(buildService().checkText('任意内容', 'openid_1'), 90003);
    });
  });

  describe('checkImage（图片）', () => {
    it('明确 suggest=risky 时抛 90002', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 0, result: { suggest: 'risky', label: 20001 } });
      await expectBizCode(buildService().checkImage('https://cos.example/x.jpg'), 90002);
    });

    it('明确 suggest=pass 时放行', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 0, result: { suggest: 'pass', label: 100 } });
      await expect(buildService().checkImage('https://cos.example/x.jpg')).resolves.toBeUndefined();
    });

    it('HTTP 200 + errcode=40001 生产环境抛 90003', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 40001, errmsg: 'invalid credential' });
      await expectBizCode(buildService().checkImage('https://cos.example/x.jpg'), 90003);
    });

    it('errcode=0 但缺 suggest 生产环境抛 90003', async () => {
      process.env.NODE_ENV = 'production';
      mockFetchJson({ errcode: 0, errmsg: 'ok' });
      await expectBizCode(buildService().checkImage('https://cos.example/x.jpg'), 90003);
    });
  });
});
