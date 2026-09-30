# 架构说明（骨架，二开中补全）

## 现状

```
uni-app 小程序（web/）
  └─ HTTP → server/public（ThinkPHP 6，Apache+PHP Docker，:8080）
              ├─ app/api     小程序接口
              ├─ app/admin   xhadmin 后台
              └─ app/cms     内容模块
       → MySQL（xxjjwz 库，cd_ 表前缀）
```

## 待补

- 关键表结构梳理（用户/教师/订单/需求）
- 登录态与支付链路
- 图片/OSS 上传链路（extend 内含 getid3、OSS 直传痕迹）
