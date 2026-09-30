// 微信虚拟支付 wx.requestVirtualPayment（基础库 2.19.2+，仅真机可拉起，开发者工具不支持）：
// miniprogram-api-typings@5.2.1 尚未收录该 API，此处按官方文档补充声明（全局命名空间合并）。
// signData 必须原样透传服务端返回的 JSON 字符串，禁止重新序列化（微信对 key 顺序敏感）。
declare namespace WechatMiniprogram {
  interface Wx {
    requestVirtualPayment(option: {
      signData: string;
      paySig: string;
      signature: string;
      mode: string;
      success?: (result: { errMsg: string }) => void;
      fail?: (result: { errMsg: string }) => void;
    }): void;
  }
}
