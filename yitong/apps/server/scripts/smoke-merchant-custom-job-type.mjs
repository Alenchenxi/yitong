/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${message}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${message}`);
}

const categoryData = read('apps/server/src/modules/job/job.template.data.ts');
const schema = read('apps/server/prisma/schema.prisma');
const dto = read('apps/server/src/modules/job/dto/job.dto.ts');
const service = read('apps/server/src/modules/job/job.service.ts');
const jobTypes = read('apps/server/src/modules/job/types.ts');
const jobClient = read('apps/user-miniprogram/services/job.ts');
const publishTs = read('apps/user-miniprogram/pages/job/publish/index.ts');
const publishWxml = read('apps/user-miniprogram/pages/job/publish/index.wxml');
const postCreateTs = read('apps/user-miniprogram/pages/job/post-create/index.ts');
const detailTs = read('apps/user-miniprogram/pages/job/detail/index.ts');
const merchantPostTs = read('apps/user-miniprogram/components/merchant-panels/post/index.ts');
const merchantPostWxml = read('apps/user-miniprogram/components/merchant-panels/post/index.wxml');
const templateDto = read('apps/server/src/modules/job/dto/job-template.dto.ts');
const templateService = read('apps/server/src/modules/job/job-template.service.ts');
const templateEngine = read('apps/server/src/modules/job/job.template.ts');

assert(
  categoryData.includes("'CUSTOM'") &&
    categoryData.includes("label: '自定义'") &&
    categoryData.includes("icon: '💼'"),
  '岗位名称网格包含“自定义”入口及系统默认岗位图标',
);
assert(
  publishWxml.includes('wx:if="{{selectedKey === \'CUSTOM\'}}"') &&
    publishWxml.includes('placeholder="输入岗位类型"') &&
    publishWxml.includes('bindinput="onCustomCategoryInput"'),
  '选择自定义后展示“输入岗位类型”输入框',
);
assert(
  publishTs.includes('customCategory:') &&
    publishTs.includes('onCustomCategoryInput') &&
    publishTs.includes("selectedKey === 'CUSTOM' ? customCategory.trim() : ''"),
  '发布入口维护自定义岗位类型并传给创建页',
);
assert(
  schema.includes('customCategory String?') &&
    schema.includes('@map("custom_category")'),
  'JobPost 持久化自定义岗位类型',
);
assert(
  dto.match(/customCategory\??:\s*string/g)?.length >= 2 &&
    dto.match(/isCustomCategory\??:\s*boolean/g)?.length >= 2 &&
    dto.includes('@MaxLength(20)'),
  '创建和更新 DTO 校验自定义岗位类型',
);
assert(
  service.includes('customCategory,') &&
    service.includes('customCategory: p.customCategory'),
  '岗位服务写入并返回自定义岗位类型',
);
assert(
  jobTypes.includes('customCategory: string | null') &&
    jobClient.includes('customCategory: string | null'),
  '前后端岗位 VO 暴露自定义岗位类型',
);
assert(
  postCreateTs.includes('customCategory: decodeURIComponent(opts.customCategory ?? \'\')') &&
    postCreateTs.includes("this.data.selectedKey === 'CUSTOM' ? this.data.customCategory.trim() : undefined") &&
    postCreateTs.includes("isCustomCategory: this.data.selectedKey === 'CUSTOM'"),
  '创建确认页把自定义岗位类型写入发布请求',
);
assert(
  detailTs.includes("categoryLabel: post.customCategory ||"),
  '岗位详情优先展示自定义岗位类型',
);
assert(
  publishTs.includes("customCategory: isCustom ? this.data.customCategory : ''") &&
    publishTs.includes("selectedKey === 'CUSTOM' ? customCategory.trim() : ''") &&
    postCreateTs.includes("this.data.selectedKey === 'CUSTOM' ? this.data.customCategory.trim() : undefined"),
  '发布向导切换回预设岗位时不会携带旧自定义类型',
);
assert(
  merchantPostTs.includes("{ value: 'CUSTOM', label: '自定义', icon: '💼'") &&
    merchantPostWxml.includes('placeholder="输入岗位类型"') &&
    merchantPostWxml.includes('wx:if="{{customSelected}}"'),
  '商家发布和编辑表单提供带默认图标的自定义入口与输入框',
);
assert(
  merchantPostTs.includes('customCategory: post.customCategory ??') &&
    merchantPostTs.includes("selected: customSelected ? o.value === 'CUSTOM'") &&
    merchantPostTs.includes('customCategory: persistedCustomCategory'),
  '商家编辑表单回显并提交自定义岗位类型',
);
assert(
  merchantPostTs.includes("if (category === 'CUSTOM' && !customCategory.trim())") &&
    merchantPostTs.includes("customCategory: customSelected ? this.data.customCategory : ''"),
  '商家表单校验自定义必填并在切换预设时清空',
);
assert(
  service.includes('if (dto.isCustomCategory)') &&
    service.includes("throw new BizException(40003, '请输入岗位类型'") &&
    service.includes("throw new BizException(40003, '预设岗位类型不可提交自定义岗位类型'") &&
    service.includes('if (dto.isCustomCategory === false)') &&
    service.includes('data.customCategory = null'),
  '服务端拒绝不一致分类组合并清除预设分类的旧自定义值',
);
assert(
  templateDto.includes('customCategory?: string') &&
    templateService.includes("q.key === 'CUSTOM' && !customCategory") &&
    templateEngine.includes('roleForKey(input.key, input.customCategory)') &&
    postCreateTs.includes("customCategory: selectedKey === 'CUSTOM' ? customCategory.trim() : undefined"),
  '智能模板使用实际自定义岗位名称并校验必填',
);

console.log(`\n通过: ${passed}`);
console.log(`失败: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
