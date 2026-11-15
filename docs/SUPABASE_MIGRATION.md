# 从 SQLite 迁移到 Supabase（路径文档）

本文档记录 Evermemo 从「本地优先」迁移到 Supabase 的路径。V1.0 使用 SQLite 是为了在无外部密钥的情况下每阶段真实运行测试；表名与字段名严格遵循 PRD §4，因此迁移时 schema 可以基本平移。

> 状态：路径文档 + **可执行 SQL 已在真实 Supabase 项目验证**（`docs/supabase/`，2026-11-09）。代码仍未接入 supabase-js；迁移前需自行创建 Supabase 项目并获取 URL / anon key。

## 真实项目验证结果（2026-11-09）

| 项目 | 值 |
| --- | --- |
| Project ref | `lnolcreffwgxlwdompeg`（新加坡 ap-southeast-1） |
| 执行方式 | Supabase Management API `POST /v1/projects/{ref}/database/query` 依次执行 0001→0002→0003→0004 |
| 结果 | 20 张表全部创建；**全部表 relrowsecurity = true**；21 条 public 策略；`pg_trgm` 扩展 + 3 个 GIN 索引；`storage` 桶 `media` 私有 + 4 条对象策略 |

真实 REST + Auth 双用户隔离（真实 JWT，非模拟）：

| 断言 | 结果 |
| --- | --- |
| A 能写入自己的记录 | ✅ 201 |
| A 能看到自己的 1 条记录 | ✅ rows=1 |
| B 看不到 A 的记录（RLS 隔离） | ✅ rows=0 |
| B 不能以 A 的身份写入（with check） | ✅ 403 |
| B 能写入自己的记录 | ✅ 201 |
| A 仍只看到自己的记录 | ✅ `["A 的私密记录"]` |
| B 只看到自己的记录 | ✅ `["B 的记录"]` |

Storage 目录隔离：A 上传到 `<A.uid>/verify.txt` ✅ 200；A 上传到别人目录 ✅ 400 被 policy 拒绝；`media` 桶 `public=false` ✅。

注意事项：
- 建项目时若取消勾选「自动暴露新表」，必须执行 0002 末尾的授权块（已内置：`authenticated` 读写、`service_role` 全权、`anon` 全禁）。
- 在 Supabase 平台上 `auth` schema 归 `supabase_auth_admin` 所有，0002 中 `auth.uid()` 桩改为「不存在才创建」，平台环境自动跳过，本地 PGlite 仍会创建。
- 大陆网络直连 `*.supabase.co` 会被 TLS 重置，验证时通过本机代理（Clash `127.0.0.1:7897`）；Node 脚本需 `--use-env-proxy` 或 `NODE_USE_ENV_PROXY=1`。
- `.env.local` 已写入 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`（本机、gitignore）。

## 0. 可执行 SQL 与隔离验证

`docs/supabase/` 下的四个文件可以直接在 Supabase SQL Editor 或本地 Postgres 中执行：

| 文件 | 内容 |
| --- | --- |
| `0001_schema.sql` | 全部 20 张业务表（均带 RLS 前提：uuid 主键、user_id 外键、索引） |
| `0002_rls.sql` | `auth.uid()` 桩函数 + 每张表的 RLS 策略（关联表用 exists 子查询双向校验） |
| `0003_search.sql` | `pg_trgm` 扩展 + title/content/tags.name 的 GIN 索引 |
| `0004_storage.sql` | 私有 `media` 桶与 `storage.objects` 的按用户目录策略 |

验证脚本 `scripts/verify-supabase.mjs` 用 `@electric-sql/pglite`（WASM 版真实 Postgres，无需 Supabase 账号）执行 0001 + 0002 并断言双用户隔离：

```bash
node scripts/verify-supabase.mjs
```

覆盖断言：20 张表存在；全部表 `relrowsecurity = true`；A 可见自己的 1 条记录/1 个标签、B 可见 0 条；B 伪造 `user_id = A` 的插入被拒；B 写入自己的记录后只见 1 条；`entry_tags` 跨用户不可见。当前结果：全部通过。


## 1. Schema 平移

`src/lib/db/migrations/0001_init.sql` 中的表可直接建到 Supabase（Postgres）。需要注意的差异：

| SQLite | Postgres / Supabase |
| --- | --- |
| `TEXT PRIMARY KEY`（UUID 字符串） | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| `INTEGER 0/1` 布尔 | `boolean` |
| `TEXT` 存 ISO 时间 | `timestamptz`（建议发生时间保留 `TEXT` 语义：用户本地时间，不换算时区） |
| FTS5 trigram 扩展 | pg_trgm + `GIN` 索引（`gin_trgm_ops`），或 Supabase `to_tsvector` |
| 同步触发器维护 FTS | Postgres 触发函数或应用层写入 |

迁移顺序建议：
1. 建表（users / sessions / entries / media / tags / entry_tags / schema_migrations）。
2. 用 Supabase `pgloader` 或自定义脚本导入 JSON 导出数据。
3. 建 RLS 策略（见下）。
4. 替换 `src/lib/db/*` 为 `supabase-js` 实现，保持函数签名不变。

## 2. 认证

V1.0 自建会话（scrypt + 随机 token）是为了零依赖可运行。迁移时两种选择：

- **A（推荐）**：换 Supabase Auth（邮箱+密码），客户端 `createClient` + `getUser()`；`src/lib/auth/session.ts` 的 `getSessionUser()` 改为读 Supabase session。
- **B（保持自建）**：继续用 scrypt + sessions 表，仅把库换成 Postgres。sessions 表已含 `token_hash`、`expires_at`，结构兼容。

## 3. RLS（数据权限隔离）

所有业务表都按 `user_id = auth.uid()` 隔离，与 V1.0 的 `WHERE user_id = ?` 一一对应：

```sql
alter table entries enable row level security;
create policy "own entries" on entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- media / tags / entry_tags / sessions 同理
```

`entry_tags` 的 RLS 需要 join 校验：`exists (select 1 from tags t where t.id = entry_tags.tag_id and t.user_id = auth.uid())`。

## 4. 存储

`data/uploads/<userId>/...` → Supabase Storage。规则：

- 桶 `media` 设私有（private），读取走 Supabase 的签名 URL 或自定义代理路由。
- 路径保持 `userId/uuid.ext` 与 `userId/thumbs/uuid.webp`，便于直接从 JSON 导出重建。
- 上传仍建议服务端先过 sharp 校验/缩略图（当前 `/api/media/upload` 逻辑可复用），再 `storage.from('media').upload(...)`。
- EXIF 解析逻辑（`src/lib/image/exif.ts`）不变。

## 5. 全文搜索

SQLite FTS5 trigram → Postgres：

- 中文场景推荐 `pg_trgm`：`CREATE INDEX ON entries USING gin (title gin_trgm_ops);`，搜索 `title ILIKE '%词%'` 即可走索引。
- 更精细可用 `zhparser`（分词），但维护成本高；V1 的 trigram + LIKE 兜底策略在 Postgres 上等价于 pg_trgm。
- `src/lib/db/entries.ts` 的 `listEntries` 中 FTS 探测与 LIKE 兜底分支替换为 pg_trgm 查询。

## 6. 数据库访问层替换

目标：`src/lib/db/*` 的函数签名保持不变（页面与 API 不用改），内部实现从 better-sqlite3 换为 supabase-js：

```ts
// 例如 listEntries(userId, query) 保持返回 { items, total, page, page_size, has_more }
```

`getDb()` 单例、`runMigrations()` 在 Supabase 模式下变为 no-op（迁移在 Supabase 控制台或 CLI 执行）。

## 7. 检查清单

- [ ] Supabase 项目建表 + RLS 全开
- [ ] 导入 JSON 导出验证数据完整
- [ ] 注册/登录切换 Supabase Auth（或保留自建）
- [ ] 图片上传/读取切换 Storage 私有桶
- [ ] 搜索切换 pg_trgm
- [ ] 双用户隔离测试（A 用户无法读到 B 用户任何数据）
- [ ] 导出功能在 Supabase 模式仍可用
