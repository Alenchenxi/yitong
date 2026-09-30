# jiajiao 业务上下文

## 产品与受众

- **产品**：家教服务小程序（源码购入，原卖家站点 www.xxjjwz.com，源码年代约 2020-2021）
- **受众**：找家教的学生/家长、接单的教师、平台运营方
- **场景**：家长发布辅导需求 / 浏览教师库 → 教师入驻与接单 → 平台抽成管理订单

## 角色与板块

| 角色 | 入口 | 主要板块 |
| --- | --- | --- |
| 家长/学生 | `web/pages/` | 找老师、发布需求、下单 |
| 教师 | `web/pages_teacher/` + `web/receiving/` | 入驻、接单、授课管理 |
| 通用 | `web/my/` | 订单/收藏/优惠券/发布管理/联系/意见反馈 |
| 运营 | `server/app/admin/` | 权限、内容、数据管理（xhadmin 后台） |
| 其他 | `web/division/` | 分校、评分页、直播（zhibo） |
| 社区 | `web/components/jiazhangquan/` | 家长圈 |

## CTA / 命名与 Avoid 词

暂无自有品牌命名（待二开时确定）；当前代码内全部为卖家品牌「xxjjwz」。

## 技术栈摘要

- 后端：ThinkPHP 6.05 + xhadmin 后台生成器，MySQL（库名 `xxjjwz`，表前缀 `cd_`），Docker（apache+php）
- 前端：uni-app（Vue 2）+ uview-ui / vk-uview-ui + miniprogram-recycle-view
- 第三方：腾讯地图 SDK（qqmap-wx-jssdk）、微信登录/支付（appid 见 manifest.json / project.config.json）
- 接口地址：`web/comm/api.js`（dev=`http://localhost:8080/api`，prod=`https://www.xxjjwz.com`，二开必改）

## 遗留凭据说明（重要）

- `server/config/database*.php` 的 Env 回退值**硬编码了卖家数据库凭据**（dev: 122.51.9.225 root；prod: xxjjwz 库）。2026-09-30 经用户决定**原样入库**（私仓）。部署自有环境前必须替换，且替换时不得把新密码再硬编码进 git。
- `server/config/my.php` 中的**卖家云密钥已脱敏**（阿里云短信/OSS、七牛云、极速短信共 7 处置空，因 GitHub Push Protection 拦截 + 用户确认；原值存本地 gitignore 文件 `server/config/secrets.local.md`）。部署时填**自己的**密钥。

## ADR 索引

- [ADR-0001] 目录整合与首次入库（2026-09-30）：两目录整合为 `jiajiao/server` + `jiajiao/web`；凭据原样入库；untime 残留目录 gitignore 不删
