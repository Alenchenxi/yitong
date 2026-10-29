// 火山引擎短信发送（零依赖）：V4 签名流程参考官方「API 签名调用指南-签名过程Demo」
const crypto = require('crypto');
const HOST = 'sms.volcengineapi.com';
const REGION = 'cn-north-1';
const SERVICE = 'volcSMS'; // 网关按 Credential scope 里的服务名路由，SMS 是 volcSMS 不是 volc

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256hex = data => crypto.createHash('sha256').update(data).digest('hex');

// conf: { accessKeyId, secretKey, account, sign, templateId }
async function sendCode(conf, phone, code) {
  const body = JSON.stringify({
    SmsAccount: conf.account,
    Sign: conf.sign,
    TemplateID: conf.templateId,
    TemplateParam: JSON.stringify({ code }),
    PhoneNumbers: phone,
  });
  const xDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // YYYYMMDDTHHMMSSZ
  const date = xDate.slice(0, 8);
  const query = 'Action=SendSms&Version=2020-01-01';
  const signedHeaders = 'content-type;host;x-content-sha256;x-date';
  const bodyHash = sha256hex(body);
  const canonical = [
    'POST', '/', query,
    `content-type:application/json\nhost:${HOST}\nx-content-sha256:${bodyHash}\nx-date:${xDate}\n`,
    signedHeaders, bodyHash,
  ].join('\n');
  const scope = `${date}/${REGION}/${SERVICE}/request`;
  const stringToSign = ['HMAC-SHA256', xDate, scope, sha256hex(canonical)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(conf.secretKey, date), REGION), SERVICE), 'request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const r = await fetch(`https://${HOST}/?${query}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Date': xDate,
      'X-Content-Sha256': bodyHash,
      Authorization: `HMAC-SHA256 Credential=${conf.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  }).then(x => x.json());
  const err = r && r.ResponseMetadata && r.ResponseMetadata.Error;
  if (err) throw new Error(`火山短信 ${err.Code}: ${err.Message}`);
  return r;
}

module.exports = { sendCode };
