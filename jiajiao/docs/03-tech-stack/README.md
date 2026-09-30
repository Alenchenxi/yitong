# 技术栈清单

| 层 | 技术 | 版本/说明 |
| --- | --- | --- |
| 后端框架 | ThinkPHP | 6.05（README 更新日志所载） |
| 后台生成器 | xhadmin | 框架级二开基座，生成器产物在 app/admin/controller/sys |
| 数据库 | MySQL | utf8mb4，表前缀 `cd_` |
| 部署 | Docker Compose | apache + php，容器名 `yantong-app`，端口 8080 |
| 前端框架 | uni-app（Vue 2） | HBuilderX 工程，无独立 CLI 脚本 |
| UI 库 | uview-ui 2.x / vk-uview-ui 1.4.x | package.json 声明，node_modules 未附带 |
| 小程序 | 微信小程序 | appid 见 manifest.json / project.config.json（卖家 appid） |
| 第三方 SDK | qqmap-wx-jssdk、PHPMailer、getid3 | extend/ 与 comm/ 内 |
