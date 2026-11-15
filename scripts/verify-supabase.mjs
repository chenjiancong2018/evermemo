/**
 * Supabase 迁移实测脚本（无需 Supabase 账号）
 *
 * 用 PGlite（WASM 编译的真实 PostgreSQL）执行 docs/supabase/*.sql，
 * 然后以普通角色 + 伪造 JWT claims 的方式验证 RLS 是否真正隔离两个用户。
 *
 * 运行：node scripts/verify-supabase.mjs
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const schemaSql = readFileSync(new URL('../docs/supabase/0001_schema.sql', import.meta.url), 'utf8');
const rlsSql = readFileSync(new URL('../docs/supabase/0002_rls.sql', import.meta.url), 'utf8');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function scalar(db, sql, params) {
  const res = await db.query(sql, params);
  const row = res.rows[0];
  return row ? Object.values(row)[0] : undefined;
}

const db = new PGlite();
console.log('• 执行 docs/supabase/0001_schema.sql');
await db.exec(schemaSql);
console.log('• 执行 docs/supabase/0002_rls.sql');
await db.exec(rlsSql);

// 建两个用户（以库所有者身份，模拟服务端注册）
await db.query(
  `insert into users (id, email, password_hash, display_name) values
     ($1, 'a@evermemo.local', 'x', 'A'),
     ($2, 'b@evermemo.local', 'x', 'B')`,
  [USER_A, USER_B]
);

// 创建一个非超级用户角色来验证 RLS
await db.exec(`
  create role app_user nologin;
  grant usage on schema public, auth to app_user;
  grant select, insert, update, delete on all tables in schema public to app_user;
`);

await db.exec('set role app_user');

// ── 用户 A 写入一条记录与一个标签 ────────────────────────────
await db.exec(`set request.jwt.claims = '{"sub":"${USER_A}"}'`);
await db.query(
  `insert into entries (id, user_id, title, content, entry_type, occurred_at)
   values (gen_random_uuid(), $1, 'A 的记录', '只有 A 能看到', 'diary', '2026-11-08')`,
  [USER_A]
);
await db.query(`insert into tags (user_id, name) values ($1, '海边')`, [USER_A]);

console.log('• 验证 RLS 隔离');
assert((await scalar(db, 'select count(*)::int from entries')) === 1, 'A 能看到自己 1 条记录');
assert((await scalar(db, 'select count(*)::int from tags')) === 1, 'A 能看到自己 1 个标签');

// ── 用户 B 视角 ───────────────────────────────────────────────
await db.exec(`set request.jwt.claims = '{"sub":"${USER_B}"}'`);
assert((await scalar(db, 'select count(*)::int from entries')) === 0, 'B 看不到 A 的记录（RLS 隔离）');
assert((await scalar(db, 'select count(*)::int from tags')) === 0, 'B 看不到 A 的标签（RLS 隔离）');

let denied = false;
try {
  await db.query(
    `insert into entries (user_id, title, content, entry_type, occurred_at)
     values ($1, 'B 替 A 写入', 'x', 'diary', '2026-11-08')`,
    [USER_A]
  );
} catch {
  denied = true;
}
assert(denied, 'B 不能以 A 的身份写入（with check 生效）');

// B 写自己的记录后只看到自己的
await db.query(
  `insert into entries (user_id, title, content, entry_type, occurred_at)
   values ($1, 'B 的记录', '只有 B 能看到', 'diary', '2026-11-07')`,
  [USER_B]
);
assert((await scalar(db, 'select count(*)::int from entries')) === 1, 'B 写入后只看到自己的 1 条');

// ── 关联表策略（entry_tags）──────────────────────────────────
await db.exec(`set request.jwt.claims = '{"sub":"${USER_A}"}'`);
const aEntry = await scalar(db, 'select id from entries limit 1');
const aTag = await scalar(db, 'select id from tags limit 1');
await db.query('insert into entry_tags (entry_id, tag_id) values ($1, $2)', [aEntry, aTag]);
assert((await scalar(db, 'select count(*)::int from entry_tags')) === 1, 'A 能关联自己的记录与标签');

await db.exec(`set request.jwt.claims = '{"sub":"${USER_B}"}'`);
assert((await scalar(db, 'select count(*)::int from entry_tags')) === 0, 'B 看不到 A 的关联');

await db.exec('reset role');

// ── 结构完整性 ───────────────────────────────────────────────
const expectedTables = [
  'users', 'sessions', 'entries', 'media', 'tags', 'entry_tags',
  'people', 'entry_people', 'places', 'entry_places',
  'milestones', 'milestone_entries', 'milestone_people', 'milestone_places',
  'chapters', 'chapter_entries', 'memory_capsules', 'capsule_media',
  'ai_drafts', 'ai_messages',
];
const actualTables = (
  await db.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`
  )
).rows.map((r) => r.table_name);
for (const t of expectedTables) {
  assert(actualTables.includes(t), `表 ${t} 存在`);
}

const rlsEnabled = (
  await db.query(
    `select relname from pg_class
     where relnamespace = 'public'::regnamespace and relrowsecurity = true and relkind = 'r'`
  )
).rows.map((r) => r.relname);
for (const t of expectedTables) {
  assert(rlsEnabled.includes(t), `表 ${t} 已开启 RLS`);
}

await db.close();
console.log('\n全部通过：Postgres schema 可执行，RLS 双用户隔离正确。');
