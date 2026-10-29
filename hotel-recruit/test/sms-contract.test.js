const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const sms = fs.readFileSync(path.join(__dirname, '..', 'src', 'sms.js'), 'utf8');

test('报名接口在短信服务配置后强制校验验证码，且校验先于飞书写入', () => {
  const seg = app.match(/if \(smsReady\) \{[\s\S]*?\n  \}/);
  assert.ok(seg, '未找到 smsReady 验证码校验分支');
  const apply = app.match(/async function handleApply[\s\S]*/)[0];
  assert.ok(apply.includes(seg[0]), '验证码校验不在 handleApply 内');
  const writeAt = apply.indexOf('existId = await findByPhone');
  const checkAt = apply.indexOf(seg[0]);
  assert.ok(checkAt > -1 && checkAt < writeAt, '验证码校验必须发生在飞书读写之前');
});

test('验证码发送有频控且成功后才记录验证码', () => {
  const handler = app.match(/async function handleSmsSend[\s\S]*?\n\}/)[0];
  assert.match(handler, /rateLimited\(ip, 1, 60e3\)/, '缺少每 IP 每分钟 1 条频控');
  assert.match(handler, /smsCooldown\(phone\)/, '缺少同手机号 60s 冷却');
  assert.match(handler, /await sendCode\(SMS_CONF, phone, code\)/, '未接入火山短信发送');
  const setAt = handler.indexOf('smsCodes.set(phone');
  const sendAt = handler.indexOf('await sendCode(SMS_CONF, phone, code)');
  assert.ok(setAt > sendAt, '验证码必须在短信发送成功后才能入库');
});

test('火山短信模块使用 V4 签名且模板参数携带验证码', () => {
  assert.match(sms, /HMAC-SHA256 Credential=/, '缺少 V4 Authorization 头');
  assert.match(sms, /Action=SendSms&Version=2020-01-01/, '缺少 SendSms 接口参数');
  assert.match(sms, /SERVICE = 'volcSMS'/, '服务名必须是 volcSMS（volc 会报 ServiceNotFound）');
  assert.match(sms, /TemplateParam: JSON\.stringify\(\{ code \}\)/, '模板参数未携带验证码');
});
