# prod 上线前闭环修复计划

> 依据 `docs/上线前待完善清单.md`。范围：5 项🔴红线（R1-R5）+ 4 项🟡高价值小改。
> R4 用户已定「补完整下架闭环」；🟡 用户已定「带几个高价值小改」。
> 不动 `.env`（第二节凭证清单为用户部署事项）；第三节有意搁置项不碰。

---

## A. 🔴 红线修复

### R1. 表白墙帖子举报断链 — 补 reporterId
- **文件**：`apps/server/src/modules/confession/confession.service.ts:676-682`
- **改法**：`reportPost` 的 `moderationRecord.create({ data })` 补 `reporterId: uid`。
- **依据**：controller `reportPost(uid, id, reason)` 已传 uid（confession.controller.ts:177）；对比 treehole.reportGroup / job.report 均写 reporterId。
- **影响**：修复后 admin.listReports 的 `reporterId: { not: null }` 过滤可见该类举报；resolveReport 能通知举报人。

### R2. 编辑带图帖必失败 — 区分 URL 与本地路径
- **文件**：`apps/user-miniprogram/pages/post-create/index.ts`（PageData + onLoad + submit）
- **根因**：编辑模式 `this.data.images` 是 draft 回填的已上传 URL；chooseImage 又会追加新选本地路径 → 数组混存。submit 对全数组调 `uploadImages` → URL 传给 `wx.uploadFile` 必败；316 行 `[...old, ...new]` 还拼重复。
- **修法（身份判别，避免 `http://tmp/` 模拟器路径误判）**：
  1. PageData 加 `originalImages: string[]`（draft 来源 URL 集合，身份标识）。
  2. onLoad edit 回填：`initial.originalImages = draft.images ?? []`（与 images 同值）。
  3. submit：按 `originalImages` 成员身份分区 —— 命中即透传（keptUrls），未命中即本地路径（toUpload → uploadImages）。
  4. 统一 `finalImageUrls = [...keptUrls, ...uploaded]`，edit/create 两分支都用它；删除 316 行重复拼接。
- **不动 `services/upload.ts`**：身份判别比正则更稳（本地模拟器路径形如 `http://tmp/...` 会误判 `startsWith('http')`）。

### R3. 活动专题跳转断链 — 修正路径
- **文件**：`apps/user-miniprogram/pages/confession/activity/index.ts:35`
- **改法**：`/pages/confession/activity/detail?id=${id}` → `/pages/confession/activity-detail/index?id=${id}`（app.json 注册的是连字符 `activity-detail/index`，对照同目录 topic-detail）。

### R4. 岗位审核闭环缺失 — 补下架路由 + review 岗位 sub-tab
- **后端**：
  - `admin.controller.ts`：加 `@Post('job-posts/:id/takedown')`（镜像 `posts/:id/takedown`，body.reason）。
  - `admin.service.ts`：加 `takedownJobPost(id, reviewerId, reason)`，镜像 `takedownPost`：findUnique(jobPost) → update status=TAKEN_DOWN → moderationRecord.create 留痕（targetType:'job_post', status:'REJECTED', reviewerId）→ 通知商家（POST_TAKEDOWN，title '兼职 · 岗位下架'，复用 takedownReportTarget job_post 分支的通知文案）。
- **前端**：
  - `services/admin.ts`：加 `takedownJobPost(id, reason)`（POST `/admin/job-posts/:id/takedown`）。
  - `components/admin-panels/review/index.ts`：`Sub` 加 `'jobs'`、`SUBS` 加 `'jobs'`；data 加 jobs 状态；load() 加 jobs 分支（调 listJobPostsAdmin）；onPanelReachBottom jobs 分支 no-op（无分页，同 users 模式）；加 `takedownJob` 方法（showModal 输入理由 → takedownJobPost → 刷新）。
  - `review/index.wxml`：sub-tab 加「岗位」；加 jobs 列表 block（title/merchantShopName/状态/urgent·featured 角标/PUBLISHED 时显示下架按钮）。
- **不改自助发布即 PUBLISHED 流程**，仅补管理员主动下架工具。

### R5. 商家审核队列 userNickname 恒空 — join User
- **文件**：`apps/server/src/modules/admin/admin.service.ts:22-25,40`
- **改法**：`merchant.findMany` 加 `include: { user: { select: { nickname: true } } }`；映射 `userNickname: m.user.nickname`。
- VO 已声明 `userNickname: string`（services/admin.ts:11），前端 wxml 已渲染 `{{item.userNickname}}`。

---

## B. 🟡 高价值小改

### E1. 单价无输入校验 — 防 0/负数
- **后端**：`admin.service.ts updatePricing` 加 `if (dto.price <= 0) throw new BizException(60004, '单价必须大于 0')`（DTO 已有 @Min(0) 挡负数，此为业务层挡 0，defense in depth）。
- **前端**：`ops/index.ts savePrice` 加 `const price = Number(...); if (!Number.isFinite(price) || price <= 0) { toast '请输入大于 0 的单价'; return; }`。

### E2. 看板待办跳转不深链 — 传 sub params
- **文件**：`dashboard/index.ts` + `dashboard/index.wxml` + `users/index.ts`
- **改法**：
  - dashboard：拆分待办跳转 ——「待审核商家」goReview（无 params，落 merchant 默认 tab ✓）；「待处理举报」新 goReports → `switchtab({tab:'review', params:{sub:'reports'}})`；「待处理工单」新 goTickets → `switchtab({tab:'users', params:{sub:'tickets'}})`；wxml 改 bindtap。
  - users/index.ts：`onParams` 由 no-op 改为消费 `sub`（镜像 review 的 onParams：合法 sub 则 setData）。
  - admin shell `activateTab` 已支持 params 转发（pages/admin/index.ts:91-105），无需改。

### E3. treehole 首页 mood chips 硬编码 — 从标签库拉
- **文件**：`pages/treehole/index.ts:13`
- **改法**：删硬编码 `MOODS`；onShow 调 `getAnonTags()`（services/treehole.ts 已有，返回 `{mood: AnonTagItem[]}`），`this.setData({ moods: tags.mood.map(t => t.name) })`。后端已支持 mood 过滤、profile/post 已从库拉，首页对齐。

### E4. 支付成功无主动通知 — 通知商家
- **后端**：
  - `notification.service.ts`：NotificationType 加 `PAYMENT_PAID: 'payment_paid'`；`CATEGORY_TYPE_MAP.order` 由 `[]` 改为 `['payment_paid']`。
  - `payment.service.ts`：注入 NotificationService（NotificationModule 是 @Global，无需改模块）；`fulfillOrder` 事务后查 `jobPost.findUnique({ where:{id:order.jobPostId}, include:{ merchant:{select:{userId:true,shopName:true}} } })`，通知商家 `PAYMENT_PAID`（title '兼职 · 岗位已发布'，content 带岗位标题）。
- **注意**：PaymentOrder 无 relation 字段（仅 FK 列），不能 `include`，须经 jobPost 取 merchant。

---

## C. 文档与测试（AGENTS §3/§4）

1. **改动记录**：`docs/开发记录/改动记录.md` 顶部新增一条（状态「待检查」，格式与现有条目一致），覆盖 R1-R5 + E1-E4。
2. **typecheck**：server `pnpm -C apps/server run typecheck`；miniprogram `tsc --noEmit`（miniprogram tsconfig）。
3. **空上下文子代理测试**（不得自证）：开后端子代理跑 typecheck + smoke（confession 举报 / admin 下架 / payment fulfill 通知 关键路径）+ 关键单测；前端子代理跑 tsc + 静态校验 navigateTo 路径 / review sub-tab 结构。测试数据子代理须清理（AGENTS §10.6）。
4. **任务规划同步**：本批属 P3 质量收尾，无新任务 ID；改动记录写明对应清单条目 R1-R5/E1-E4。清单每项修复后标 ✅ + commit。

---

## D. 提交（AGENTS §5，trunk-based）

- 分支：`feat/prod-闭环修复`（从 main）。
- commit：`fix(prod): 上线前红线缺陷与体验缺口修复`（中文为主），结尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 测试通过后改动记录改「已审查」+ 回填 commit；`merge --squash` 到 main；push（超时重试 3-5 次，失败告知用户手动 `! git push origin main`）。

---

## 改动文件清单

**后端**（apps/server/src/modules）：
- `confession/confession.service.ts` — R1
- `admin/admin.service.ts` — R4(takedownJobPost) + R5(getQueue join) + E1(updatePricing 校验)
- `admin/admin.controller.ts` — R4(takedown 路由)
- `notification/notification.service.ts` — E4(PAYMENT_PAID 类型 + order 分类)
- `payment/payment.service.ts` — E4(注入 NotificationService + fulfillOrder 通知)

**前端**（apps/user-miniprogram）：
- `pages/post-create/index.ts` — R2
- `pages/confession/activity/index.ts` — R3
- `pages/treehole/index.ts` — E3
- `services/admin.ts` — R4(takedownJobPost)
- `components/admin-panels/review/index.ts` + `index.wxml` — R4(岗位 sub-tab)
- `components/admin-panels/dashboard/index.ts` + `index.wxml` — E2
- `components/admin-panels/users/index.ts` — E2(onParams 消费 sub)
- `components/admin-panels/ops/index.ts` — E1(单价前端校验)

**文档**：
- `docs/开发记录/改动记录.md` — 新增条目
- `docs/上线前待完善清单.md` — 各条目标 ✅ + commit（测试通过后）
