import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_HASHES = {
  'api/route/route.php': 'F9A22881B6FA2E260F56657E207ECDEDAC2E07AB04BB5CB95390459273F6BEC2',
  'api/controller/Demand.php': '4A5DDB5630D71CF3CD804B993A01AA230ACE00599378B4BEE3ACD6D5F23D29BD',
};

const sourceRoot = process.argv[2] || process.env.TUTOR_SOURCE_ROOT;
if (!sourceRoot) {
  throw new Error('usage: node verify-tutor-source-contract.mjs <tutor-source-root>');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function load(relativePath) {
  const path = resolve(sourceRoot, relativePath);
  const buffer = readFileSync(path);
  const hash = createHash('sha256').update(buffer).digest('hex').toUpperCase();
  assert(
    hash === EXPECTED_HASHES[relativePath],
    `${relativePath} SHA-256 does not match the audit record`,
  );
  return buffer.toString('utf8');
}

const route = load('api/route/route.php');
const controller = load('api/controller/Demand.php');
const methodStart = controller.indexOf('public function syncTutorDemands()');
assert(methodStart >= 0, 'syncTutorDemands method is missing');
const method = controller.slice(methodStart);

assert(
  /Route::rule\(\s*'internal\/sync\/tutor-demands'\s*,\s*'Demand\/syncTutorDemands'\s*,\s*'GET'\s*\)/.test(
    route,
  ),
  'GET /internal/sync/tutor-demands route is missing',
);
assert(
  method.includes("getenv('TUTOR_SYNC_TOKEN')"),
  'TUTOR_SYNC_TOKEN environment lookup is missing',
);
assert(method.includes("header('X-Sync-Token'"), 'X-Sync-Token header lookup is missing');
assert(
  method.includes('hash_equals($expectedToken, $providedToken)'),
  'constant-time token comparison is missing',
);
assert(/'status'\s*=>\s*503/.test(method), 'missing-token 503 response is missing');
assert(/'status'\s*=>\s*403/.test(method), 'invalid-token 403 response is missing');

for (const contract of [
  "'version' => 1",
  "'mode' => 'full'",
  "'complete' => true",
  "'itemCount' => count($items)",
  "'generatedAt' => date(DATE_ATOM)",
]) {
  assert(method.includes(contract), `snapshot contract is missing: ${contract}`);
}

for (const field of [
  'a.demand_id',
  'a.province',
  'a.city',
  'a.area',
  'a.address',
  'a.gai_kuang',
  'a.price as expense',
  'a.trial_time as teach_time',
  'a.teacher_gender',
  'a.teacher_identity',
  'a.teacher_require',
  'a.teaching_way',
  'a.school',
  'a.longitude',
  'a.latitude',
  'a.status',
  '0 as is_hide',
  '0 as is_refund',
  'a.create_time',
  'b.name as subject_name',
  'c.name as grade_name',
]) {
  assert(method.includes(`'${field}'`), `snapshot field is missing: ${field}`);
}

for (const forbidden of ['parent_phone', 'mobile', 'wechat', 'openid', 'user_id']) {
  assert(!method.includes(forbidden), `private field leaked by sync method: ${forbidden}`);
}

console.log('Tutor source contract verification passed');
