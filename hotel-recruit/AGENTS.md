# hotel-recruit — 酒店招聘报名（H5 + 飞书多维表格）

推广员专属链接收集酒店招聘报名，数据落飞书 Base，按推广员统计转化。

## 结构
- `public/index.html` H5 单页：酒店列表 + 报名表单，零构建零依赖
- `src/app.js` Node 20 服务（无 npm 依赖）：`/api/config` `/api/apply` `/api/visit` `/api/stats`
- `config/hotels.json` 招聘配置与 20 家酒店数据。酒店展示字段：region/name/hours/pay/newYearPay/rest/accommodation/overtime/transport/bonus/highlight/address；顶层同时配置上岗日期、最低年龄和公开联系电话（改完 `docker compose restart` 生效）
- `public/img/` 酒店照片目录：文件名 = 酒店名.jpg（与 name 完全一致），缺图自动显示区域色占位块
- `config/inviters.json` 推广员字典 `{编码: 姓名}`，推广员链接 = `https://<域名>/zhaopin/?inviter=<编码>`
- `data/` 访问日志 jsonl（按月分文件），已 gitignore

## 部署
服务器（121.40.26.41）上：`cp .env.example .env` 填好 → `bash deploy.sh`。域名 `yitongjiajiao.cn`（已备案 https），nginx 复用现有 server 块加子路径反代（注意 proxy_pass 结尾的 `/`，它会剥掉前缀）：

```nginx
location /zhaopin/ {
    proxy_pass http://127.0.0.1:8090/;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

推广员链接格式：`https://yitongjiajiao.cn/zhaopin/?inviter=p001`。微信内打开必须 https + 备案域名，裸 IP 打不开。

## 统计
`https://<域名>/api/stats?token=<ADMIN_TOKEN>`：各推广员访问数/报名数/转化率；报名明细直接看飞书 Base（提交时间列为自动创建时间）。

## 红线
- `.env` 不进 git、不进镜像（.dockerignore 已排除）
- 手机号在飞书查重：已报名则更新填写内容（酒店可换），推广员归属保持首次提交不改
- 「报名类型」单选字段只在首次创建时写「新报名」（更新重复提交不改）；「是否有酒店工作经验」随每次提交更新（未勾选=无经验）；历史记录已回填「旧报名」。行填色规则（新报名蓝/旧报名米色）在飞书表格视图的「条件染色」里手动配置，API 不支持
- 报名酒店下拉选项由提交自动创建，无需在飞书手动维护
- 短信验证码（火山引擎 SMS，`src/sms.js` V4 签名零依赖）：6 位 / 5 分钟有效 / 同号 60s 重发 / 每 IP 每分钟 1 条；5 个 `SMS_*` 环境变量全配置才启用校验，未配置时报名不受影响（发送接口返回「短信服务未配置」）；网关服务名是 `volcSMS` 不是 `volc`
- 公开联系电话未确认前保持 `contact.phone` 为空，前端只显示“报名后专员回电”，禁止填入占位号码
