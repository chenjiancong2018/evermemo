# Evermemo · 人生数字档案馆

一个极简、温暖、安静的私人记忆产品：记录每一天，几年之后打开它，不只是看到一堆日记，而是能重新走过自己曾经的人生。

V1.0 聚焦「记录真正可用」（记录/图片/时间线/搜索）；V1.5 加入人生档案（重要时刻/人物/地点/人生故事）；V2.0 加入 AI 人生助手（整理/回顾/问答/年度总结/语义搜索/故事整理，全部草稿机制）；V3.0 加入人生数字博物馆（人生地图/人生阶段/年度纪念册/记忆胶囊/回顾报告/打印 PDF/照片打包导出）；V3.1 打磨数据可信度与交付物（归档独立页/记忆胶囊加密/原生 PDF 导出）；V3.2 收尾体验与迁移（深色模式/可安装 PWA/照片 ZIP 按拍摄月份归档/纪念册 PDF 含照片墙/Supabase 可执行 SQL 与隔离验证）；V3.3 胶囊口令保险库（密钥由登录口令派生、锁定/解锁、改密自动重包裹）；V3.4 在真实 Supabase 项目完成 20 表/RLS/存储桶部署与真实 JWT 双用户隔离验证；V3.5 胶囊恢复码（账号找回 + 重设口令，一次性、Crockford Base32、使用后自动吊销）；V2.1 真实 AI 打通（Qwen3.7 全功能实测，含语义向量检索）。

## 功能（V3.5 / V2.1 AI）

### 记录与检索

- **注册 / 登录**：scrypt 口令哈希 + 随机会话令牌（HttpOnly Cookie，30 天）
- **人生首页**：真实统计（记录数/照片/收藏/标签/连续记录天数）、往年今日、最近记忆、时间线预览、重要时刻区块
- **每日记录**：7 种类型（日记/瞬间/照片/想法/事件/旅行/自定义）、可选标题、Markdown 正文（带工具栏与预览）、发生日期（可与创建日期不同）、8 种心情、标签、图片、收藏 / 重要标记、归档、关联人物与地点
- **草稿自动保存**：编辑中每 0.8s 防抖保存到本地，误关页面不丢失
- **图片**：JPG/PNG/WEBP 批量上传（单张 ≤20MB）、自动生成缩略图、读取 EXIF 拍摄时间、私有访问（未登录无法读取图片字节）
- **时间线**：按发生日期排序（非创建日期）、日/月/年视图、类型/心情/标签/年份/月份/收藏/重要/归档筛选、无限滚动
- **画廊**：瀑布流、灯箱浏览、照片说明编辑、收藏、按说明搜索
- **搜索中心**：一次搜索同时命中记录/人物/地点/人生故事，分组展示；记录支持类型/心情/标签/收藏/重要筛选
- **收藏**：收藏的记录与收藏的照片集中浏览
- **回收站**：软删除、可恢复、可彻底删除

### 人生档案

- **重要时刻**：纪念碑卡片、按年份浏览、封面、重要程度（重要/很重要/一生铭记）、关联记录/人物/地点
- **人物档案**：姓名/昵称/关系/初见日期/简介/仅自己可见的备注、头像、关联记录与共同重要时刻
- **地点档案**：名称/国家/城市/地址/经纬度/描述/封面、关联记录
- **人生故事**：标题/时间区间/简介/Markdown 正文/封面、手动挑选与排序关联记录（上移/下移/移除）、AI 整理正文

### 人生数字博物馆

- **人生地图**：有经纬度的地点在地图上打点（Leaflet + OSM，免费无 Key），无坐标地点降级为列表；地图加载失败自动降级，可替换组件
- **人生阶段**：第一条记录/记录时长/总量统计、年度足迹条形图、人生故事时间轴区间条、重要时刻回顾
- **年度纪念册**：按年份生成（记录/照片/重要时刻/人生故事/记录全文），一键打印或下载原生 PDF（pdfkit + 微软雅黑字体嵌入；PDF 内含这一年的照片墙）
- **记忆胶囊**：写给未来某一天的自己——未到期不可打开（连自己也不行），到期自动开启、开启后不可修改；可附照片；正文 AES-256-GCM 加密存储，每胶囊独立数据密钥，**由登录口令派生的保险库密钥包裹**（scrypt KEK）：数据库直读取不到明文，服务器重启/退出登录后重新锁定，需输入登录口令解锁才能阅读；忘记登录口令则胶囊正文不可恢复（密文保留）
- **回顾报告**：今年/去年/最近 90 天/最近 30 天/自定义区间，聚合统计（活跃天数/最长连续/月度足迹/类型/心情/高频标签/高光时刻），可打印或下载原生 PDF
- **照片打包导出**：全部照片打包为 ZIP，按拍摄月份分目录（`照片/YYYY-MM/YYYYMMDD_原名.jpg`，EXIF 拍摄时间优先、缺失时用上传时间；可另附缩略图目录），同名自动去重

### 外观与安装

- **深色模式**：浅色 / 深色 / 跟随系统三态切换（设置页「外观」或侧栏底部按钮），首屏内联脚本避免闪白，偏好保存在本地
- **PWA**：`manifest.webmanifest` + Service Worker——可「添加到主屏幕」，静态资源缓存优先、页面离线回退到 `/offline`；生成 192/512/maskable 与 Apple 图标

### AI 人生助手

- **记录整理**：编辑页「AI 整理」按钮——建议标题/类型/标签/润色正文；应用后原文可一键恢复，未保存前不写入数据库
- **区间回顾**：今天/最近一周/本月/自定义，基于该时间段真实记录生成回顾
- **人生问答**：向记忆提问，回答附引用记录，点击直达原文
- **年度回顾**：年度关键词、重要事件、旅行回忆、你写过的文字、年度故事
- **语义搜索**：按意思相似度查找；未配置 AI 时自动退回关键词搜索并如实说明
- **故事整理**：基于故事内关联记录整理正文
- **AI 尊重原始记忆**：一切 AI 产出均为草稿（草稿箱统一管理），须你确认后才应用；绝不静默改写原文、绝不编造记忆（无记录时如实说明）
- **配置**：服务端环境变量（OpenAI 兼容接口），Key 绝不下发客户端；未配置时页面明确提示；开发环境 `AI_MOCK=1` 可体验全流程（响应带 [MOCK] 标记）
  - `AI_API_BASE`：如 `https://maas.qianwenaiapi.com/compatible-mode/v1`（千问AI平台）、`https://dashscope.aliyuncs.com/compatible-mode/v1`（百炼）、`https://api.openai.com/v1`
  - `AI_API_KEY` / `AI_MODEL`：如 `qwen3.7-plus`、`glm-4-flash`、`deepseek-chat`
  - `AI_EMBEDDING_MODEL`：语义搜索用的 embedding 模型（如 `text-embedding-v3`），未设置时回退 `AI_MODEL`
  - `AI_THINKING=off`：关闭 Qwen 系深度思考（整理/回顾类任务更快更省），默认由模型决定

### 数据与安全

- **恢复码（账号找回）**：设置页「恢复码」可生成一次性备份钥匙——忘记登录口令时，在 `/recover` 用「邮箱 + 恢复码 + 新口令」重设口令并取回同一数据密钥，已加密封存的胶囊继续可读。恢复码为 160 bit 随机数的 Crockford Base32（8 组 × 4 字符），只显示一次、服务端只保存用恢复码包裹的数据密钥；**使用一次后自动吊销**（可随时重新生成或撤销）；找回接口按邮箱限流（15 分钟 5 次）
- **归档**：独立归档页——从时间线安静退场的记录集中管理，可一键取消归档或移入回收站
- **数据导出**：一键导出全部数据为 JSON（记录/标签/照片/人物/地点/重要时刻/人生故事/记忆胶囊（明文；保险库锁定时保留密文并标记 `locked`）/AI 草稿及全部关联，schema_version=2）+ 照片 ZIP 打包（按拍摄月份分目录）
- **权限隔离**：所有数据按用户隔离，跨用户访问一律 404
- **移动端**：底部导航 + 中央「+」快速记录 +「我的」页，390px 宽度下完整可用

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript（strict）
- Tailwind CSS 3.4（设计 token 全部走 CSS 变量，PRD 色板）
- SQLite（better-sqlite3，WAL 模式）+ FTS5 全文检索
- sharp（图片校验与缩略图）、react-markdown + remark-gfm
- Leaflet + OSM（人生地图）、yazl（照片 ZIP 打包）、pdfkit（原生 PDF，嵌入系统微软雅黑/黑体）
- Zod 参数校验、Vitest 单元测试
- 无外部服务依赖：数据库、文件、会话全部在本机

## 快速开始

要求：Node.js ≥ 20（开发时使用 Node 24）。

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # 生产构建
pnpm start      # 生产运行（默认 3000 端口）
pnpm test       # 单元测试（vitest run）
```

首次启动会自动创建 `data/`（SQLite 数据库、上传的图片、会话密钥）。数据完全本地私有，不会上传到任何服务器。

配置 AI（可选，不配置也能用，界面会明确提示未配置）：

```bash
# 放在项目根目录的 .env.local（已被 .gitignore 忽略）
AI_API_BASE=https://maas.qianwenaiapi.com/compatible-mode/v1   # 千问AI平台（OpenAI 兼容）
AI_API_KEY=sk-ws-...
AI_MODEL=qwen3.7-plus
AI_EMBEDDING_MODEL=text-embedding-v3     # 语义搜索；不设则回退 AI_MODEL
AI_THINKING=off                          # 可选：关闭 Qwen 深度思考
```

改完环境变量需重启服务（`next start` 只在启动时读取 `.env.local`）。

> 注意：若使用 pnpm 11，构建脚本需要批准：`pnpm approve-builds` 勾选 better-sqlite3 与 sharp（esbuild 可选）。Node 24 + pnpm 11 下 better-sqlite3 若无预编译二进制，见 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

## 目录结构

```
src/
  app/
    (auth)/            登录、注册
    (app)/             登录后的页面：home / timeline / gallery / search / favorites / trash / archives /
                        settings / me / entries / milestones / people / places / chapters /
                        stages / map / memories / capsules / report / ai
    api/               Route Handlers（auth、entries、tags、media、dashboard、export（JSON+photos ZIP+PDF）、
                        milestones、people、places、chapters、search、ai、capsules）
  components/
    entry/             记录表单、卡片、Markdown 渲染、图片上传、标签输入
    gallery/           画廊视图、灯箱
    layout/            侧边导航（含外观切换）、移动端底部导航
    archive/           人物/地点/记录多选器、封面选择
    theme/             深色模式切换
    pwa/               Service Worker 注册
    milestones/ people/ places/ chapters/ favorites/ archives/
    ai/                AI 助手页（回顾/问答/年度回顾/草稿箱）
    map/ stages/ memories/ capsules/ report/
    timeline/ search/ trash/ settings/ ui/
  lib/
    db/                SQLite 数据层（entries/tags/media/dashboard/people/places/milestones/chapters/ai/capsules）
                       + 迁移
    auth/              口令哈希、会话
    api/               HTTP 信封、Zod schema、客户端 fetch 封装
    image/             EXIF 解析
    ai/                AI 服务层（OpenAI 兼容调用/配置）、能力层（整理/回顾/问答/年度/故事/语义搜索）
    crypto/            胶囊加密（AES-256-GCM）+ 口令保险库（scrypt KEK）
    pdf/               原生 PDF（报告/纪念册，pdfkit + 中文字体嵌入）
```

## 数据与备份

- 数据库：`data/evermemo.db`（WAL）；图片：`data/uploads/<userId>/`
- **JSON 导出**：登录后「设置 → 数据与备份 → 导出全部数据」，或直接 GET `/api/export`
- **照片打包导出**：「设置 → 数据与备份 → 打包照片（ZIP）」，或直接 GET `/api/export/photos`；解压后按 `照片/YYYY-MM/YYYYMMDD_原名` 组织，EXIF 拍摄时间优先
- 迁移文件：`src/lib/db/migrations/`，按文件名顺序应用，已应用记录在 `schema_migrations`
- 迁移到 Supabase 的路径见 [docs/SUPABASE_MIGRATION.md](docs/SUPABASE_MIGRATION.md)；`docs/supabase/` 内是可直接执行的建表/RLS/搜索/存储 SQL，`node scripts/verify-supabase.mjs` 会用真实 Postgres（PGlite）验证双用户隔离。**已在真实 Supabase 项目（新加坡）完成部署与验证**：20 张表 + 全部 RLS + pg_trgm 索引 + 私有 media 桶；真实 JWT 双用户隔离 7 项断言全过（详见迁移文档与 TEST_REPORT §40）

## 产品原则

1. **记录优先**：V1.0 把记录、图片、时间线、搜索做扎实，V1.5 才加入档案，AI 不抢跑。
2. **备份优先**：第一版就有 JSON 全量导出（含全部档案与关联），V3.0 补齐照片 ZIP 打包。
3. **AI 尊重原始记忆**：AI 只润色、总结、整理；任何 AI 产出必须是「草稿 + 来源引用」，应用需用户确认，绝不把编造内容当作真实发生的事，绝不静默改写原文。

## 文档

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架构决策与阶段计划
- [docs/SUPABASE_MIGRATION.md](docs/SUPABASE_MIGRATION.md) — 从 SQLite 迁移到 Supabase 的路径
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — 已知问题与解决
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md) — 测试报告（V1.0/V1.5/V2.0/V3.0/V3.1/V3.2 单测与 E2E）
- [docs/PHASES.md](docs/PHASES.md) — 阶段执行报告与缺陷记录
- [docs/supabase/](docs/supabase/) — Supabase 可执行 SQL（建表/RLS/搜索/存储）
- [docs/PRD_extracted.txt](docs/PRD_extracted.txt) — 原始 PRD 全文提取
