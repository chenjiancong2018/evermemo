# EVERMEMO 架构分析与实施计划

> 依据《EVERMEMO — 人生数字档案馆》PRD（完整提取见 `docs/PRD_extracted.txt`）与用户补充指令编写。
> 用户四条硬性指令：(1) 先把 V1.0 做完整，不急着开发 AI；(2) 第一版必须有 JSON 导出（照片打包导出后续加）；(3) AI 只可润色/总结/整理，绝不把编造内容当作真实记忆；(4) 手机端新建记录流程尽可能简单。

## 1. 模块拆分

### V1.0 范围（本次交付）
| 模块 | 内容 |
|---|---|
| 账户系统 | 注册、登录、登出、会话（HttpOnly Cookie）、资料编辑 |
| 每日记录 | 7 种记录类型、标题/正文/发生日期/心情/标签/图片、置顶/收藏/归档/软删除、草稿自动保存 |
| 图片 | JPG/PNG/WEBP 上传（≤20MB）、EXIF 拍摄时间、缩略图、私有存储鉴权访问、批量上传、失败重试 |
| 人生时间线 | 按发生日期排序（非创建日期）、年/月/日视图、类型/标签/心情/重要筛选、分页加载、日期跳转 |
| 回忆画廊 | 瀑布流、灯箱全屏、图片详情（拍摄/上传时间区分）、说明编辑、关联记录、筛选 |
| 搜索中心 | FTS5 全文（标题+正文+标签）+ 类型/日期/心情/收藏筛选 |
| 人生首页 | 欢迎区、真实统计、今日回忆（往年今日）、最近记忆、时间线预览、快速操作 |
| 数据安全 | JSON 全量导出、回收站（恢复/彻底删除）、二次删除确认 |
| 移动端 | 底部导航（首页/时间线/＋/画廊/我的）、单手可用的快速记录页 |

### 后续版本（本次不实现，架构预留）
- V1.5：重要时刻、人物档案、地点档案、人生故事、照片打包导出
- V2.0：AI 助手（记录整理/回顾/问答/年度回顾/语义搜索）——严格「AI 草稿」机制 + 来源引用 + 不覆盖原文
- V3.0：人生地图、纪念册、记忆胶囊、PDF 导出

## 2. 技术架构与关键决策

```
浏览器（响应式：桌面/平板/手机）
   │  Next.js 15 App Router
   ├─ Server Components 页面（服务端会话校验，未登录重定向）
   ├─ Route Handlers /api/*（REST，全部校验会话 + user_id 数据隔离）
   ├─ lib/db     SQLite（better-sqlite3，WAL，迁移文件管理，字段名与 PRD §4 完全一致）
   ├─ lib/auth   scrypt 口令哈希 + 随机会话令牌（哈希存储）+ HttpOnly Cookie
   ├─ lib/storage 本地私有文件存储：data/uploads/{user}/{uuid}.ext + sharp 缩略图
   └─ lib/ai     （占位接口层，V2.0 启用；本版本无任何 AI 调用）
```

**关键决策：本地优先，而不是立刻接 Supabase。** 理由：
1. 用户要求「每个阶段都实际运行、测试」，且未提供 Supabase 项目密钥；PRD §12.6 明确「外部 API Key 缺失时不要伪造调用、优先简单稳定易维护的方案」。
2. SQLite + 本地存储零外部依赖，开箱即用、可离线、可备份（data/ 目录整体复制即可）。
3. **迁移路径保留**：所有表名/字段名严格遵循 PRD §4 设计（UUID 主键、user_id 隔离、occurred_at、软删除等），数据层集中在 `src/lib/db`，未来切换 Supabase/Postgres 只替换数据访问层 + 跑等价 SQL 迁移；`docs/SUPABASE_MIGRATION.md` 提供逐步迁移指南。
4. 数据可导出（JSON 全量导出），用户数据永远不锁定在本机。

**其他决策**：
- Tailwind CSS 钉在 v3.4（稳定、模式成熟），设计 token 严格用 PRD §7.2 的 CSS 变量值。
- 字体用系统栈 + Noto Sans SC/Inter 回退，构建时不依赖 Google Fonts 网络。
- 搜索用 SQLite FTS5 `trigram` 分词器（对中文有效，LIKE 兜底）。
- 草稿自动保存用 localStorage（页面意外关闭不丢），手动保存走服务端。
- 视频：V1.0 不实现（PRD §2.4 允许预留）。
- shadcn/ui 不引入 CLI，按 shadcn 风格手写统一组件（Button/Input/Dialog/Toast/ConfirmDialog/…），零冗余依赖。

## 3. 页面路由结构

```
/                      → 已登录跳 /dashboard，否则 /login
/login  /register
/dashboard             人生首页
/entries               记录列表（筛选）
/entries/new           快速新建（移动端核心入口）
/entries/[id]          详情    /entries/[id]/edit  编辑
/timeline              人生时间线
/gallery               回忆画廊
/search                搜索中心
/settings              个人设置   /settings/data  数据管理
/trash                 回收站
API（全部 /api/*，见 §4）
```

## 4. 数据库 ER（SQLite，与 PRD §4 同构）

```
users 1─┬─n sessions            (token_hash UNIQUE)
        ├─n entries             (软删除 deleted_at)
        │     ├─n media         (entry_id 可空=独立照片)
        │     ├─n entry_tags n─ tags
        │     └─ entries_fts    (FTS5 trigram: title+content，触发器同步)
        └─n media
```

**entries**: id(PK uuid) user_id title content content_format('md') entry_type('diary|moment|photo|idea|event|travel|custom') occurred_at(ISO, 按发生时间排序) created_at updated_at mood is_favorite is_important is_archived deleted_at
**media**: id user_id entry_id file_name storage_path mime_type file_size thumbnail_path media_type('image') captured_at(EXIF 优先) created_at
**tags**: id user_id name color created_at；entry_tags(entry_id,tag_id) UNIQUE 约束
**索引**: entries(user_id,occurred_at DESC)、entries(user_id,entry_type)、entries(user_id,deleted_at)、media(user_id,entry_id)、media(user_id,captured_at)、tags(user_id,name UNIQUE)
**通用**: UUID 文本主键、时间 ISO 文本、所有查询强制 user_id、事务包裹关键操作、迁移文件 `src/lib/db/migrations/NNNN_*.sql` 由启动时 runner 顺序执行。

## 5. 组件目录

```
src/components/ui/        Button Input Textarea Select Dialog DropdownMenu Spinner
                          Skeleton EmptyState Toast ConfirmDialog Badge DatePicker
src/components/layout/    AppSidebar(桌面230px) MobileNav(底部5入口) PageHeader
src/components/entries/   EntryCard EntryForm MoodPicker TypePicker TagInput
                          MarkdownLite(加粗/斜体/列表/引用+预览) DraftAutosave
src/components/timeline/  TimelineList TimelineItem TimelineFilters ViewSwitch
src/components/gallery/   GalleryGrid Lightbox MediaDetail
src/components/dashboard/ StatCard TodayMemories RecentEntries QuickActions
src/components/search/    SearchBox SearchFilters SearchResults
```

## 6. 阶段计划（每阶段：实现 → 构建 → 真机操作测试 → 修复）

| 阶段 | 内容 | 验收测试 |
|---|---|---|
| 0 | 架构文档、脚手架、设计系统、基础 UI 组件、构建通过 | `pnpm build` 零错误 |
| 1 | 迁移+认证+记录 CRUD+标签 | 注册/登录/CRUD/隔离（双用户互不可见） |
| 2 | 图片上传/缩略图/EXIF/私有访问/画廊 | 三种格式上传、灯箱、拍摄时间正确、未登录 403 |
| 3 | 时间线+搜索+人生首页 | 按发生日期排序、年月筛选、中文全文检索、往年今日 |
| 4 | JSON 导出+回收站 | 导出 JSON 结构完整、恢复/彻底删除生效 |
| 5 | 移动端适配+全流程 E2E+修复 | 390px 视口全流程：注册→快速记录→传图→时间线→画廊→搜索→导出 |
| 6 | README、Supabase 迁移指南、测试报告、阶段报告 | 文档齐全、构建+单测全绿 |

## 7. 技术风险与预案

| 风险 | 预案 |
|---|---|
| better-sqlite3 原生模块在 Windows/Node24 无预编译 | 已在 package.json `onlyBuiltDependencies` 放行构建脚本；失败则退化为 Node 24 内置 `node:sqlite` |
| sharp 原生模块失败 | 退化为不生成缩略图（原图直接展示），或换纯 JS 编码 |
| 移动端视口无法真机模拟 | 用同源 iframe(390px) 内嵌应用做截图与交互测试 |
| 中文全文检索效果 | FTS5 trigram + LIKE 兜底，双路查询 |
| Tailwind v4 变化 | 钉 v3.4 规避 |

## 8. 目录约定

```
evermemo/
├─ data/                 # 运行时数据（gitignore：evermemo.db、uploads/）
├─ docs/                 # PRD 提取、本架构文档、迁移指南、测试报告
├─ src/app/              # 路由页面 + api Route Handlers
├─ src/lib/              # db/ auth/ storage/ api/ ai/(占位) types/ utils/
├─ src/components/       # §5 组件
├─ migrations→src/lib/db/migrations
└─ README.md / .env.example / package.json / next.config.mjs
```
