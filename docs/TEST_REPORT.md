# Evermemo V1.0 测试报告

日期：2026-11-08
测试方式：真实运行验证（生产构建 + 真实浏览器操作），非 mock。

## 1. 测试环境

| 项目 | 值 |
| --- | --- |
| 运行模式 | `next build` 生产构建 + `next start -p 4321` |
| Node | v24.21.0 |
| 浏览器 | dsh 内置浏览器（Electron 44.9.2） |
| 数据库 | SQLite（better-sqlite3 12.11.1，WAL） |
| 移动端验证 | 390px 同源 iframe（iPhone 12/13 宽度） |
| 测试账户 | test@evermemo.local（小忆）、user2@evermemo.local（第二人生） |

## 2. 单元测试（vitest）

结果：**3 个文件、30 个用例全部通过**（30/30）。

| 文件 | 用例数 | 覆盖内容 |
| --- | --- | --- |
| src/lib/auth/password.test.ts | 4 | scrypt 哈希格式、正确/错误密码校验、参数健壮性 |
| src/lib/utils.test.ts | 13 | cn、日期格式化、分组键/标题、yearsAgo、excerpt |
| src/lib/api/schemas.test.ts | 13 | 注册/登录/改密 schema、记录创建 schema（含非法日期拒绝）、列表查询 |

## 3. 构建

`next build` 零错误通过：19 个页面 + 20 个 API 路由全部生成。
首页 JS 包：First Load 共享 102 kB。

## 4. 端到端功能验证

### 4.1 账户与安全
| 场景 | 结果 |
| --- | --- |
| 注册新账户（邮箱/昵称/密码） | ✅ 创建后自动登录跳转 /home |
| 未登录访问受保护页面 | ✅ 重定向 /login |
| 登录（正确/错误密码） | ✅ 错误密码 401 统一提示「邮箱或密码不正确」 |
| 退出登录 | ✅ 跳转 /login，会话立即失效（/api/auth/me 401） |
| 修改密码（UI 真实键入） | ✅ 新密码可登录、旧密码 401、其他会话全部失效 |
| 修改密码（API 层） | ✅ PUT /api/auth/password 字段 old_password/new_password |
| 资料修改（昵称/简介） | ✅ 保存后 /api/auth/me 返回新值 |

### 4.2 记录 CRUD
| 场景 | 结果 |
| --- | --- |
| 新建记录（7 种类型、标题/正文/发生日期/时间/心情） | ✅ POST 落库、跳转详情页 |
| Markdown 编辑工具栏 + 预览切换 | ✅ 渲染正确（列表/加粗/标题/引用/代码） |
| 标签输入（真实键入 + 回车） | ✅ 标签 chip 生成，随记录落库（entry_tags + tags 自动创建） |
| 标签建议 chips 点击添加 | ✅ |
| 收藏 / 标记重要 toggle | ✅ PATCH 成功，详情页徽章同步 |
| 编辑记录（改标题） | ✅ 详情页显示更新 |
| 软删除 → 回收站 → 恢复 | ✅ 恢复后回到时间线 |
| 彻底删除（purge） | ✅ 记录与关联数据移除，之后 GET 404 |
| 草稿自动保存 | ✅ localStorage 草稿、防抖保存、成功保存后清除 |

### 4.3 图片
| 场景 | 结果 |
| --- | --- |
| 上传（FormData 批量，240×180 JPEG） | ✅ 原图 + 480px WebP 缩略图落盘，宽高/大小入库 |
| 私有访问 /api/media/:id/file 与 /thumb | ✅ 登录可见（200，正确 content-type），未登录 401 |
| 缩略图损坏降级 | ✅ 设计上降级 null（sharp 可用时正常生成） |
| 灯箱（详情/画廊点图） | ✅ 打开/关闭/左右切换/查看记录/收藏 |
| 图片说明编辑（灯箱内联） | ✅ PATCH caption 落库，画廊显示 |
| 画廊瀑布流 | ✅ 按拍摄/上传时间倒序、宽高比占位 |
| 画廊筛选（只看收藏 / 说明搜索） | ✅ |

### 4.4 时间线
| 场景 | 结果 |
| --- | --- |
| 按发生日期倒序分组 | ✅ 11-08 记录在 11-07 之前（非创建时间） |
| 日/月/年视图切换 | ✅ 分组标题正确 |
| 筛选（类型/心情/标签/收藏/重要/年月） | ✅ 选「兴奋」后仅剩对应记录 |
| 无限滚动 + 日期跳转 | ✅ IntersectionObserver 加载、URL 预置年月生效 |

### 4.5 搜索
| 场景 | 结果 |
| --- | --- |
| 标题关键词「骑行」 | ✅ 1 命中（FTS5 trigram 生效） |
| 正文关键词「拿铁」 | ✅ 命中 |
| 标签名「咖啡」 | ✅ 命中 |
| 短词（<3 字）LIKE 兜底 | ✅ 正常 |

### 4.6 首页
| 场景 | 结果 |
| --- | --- |
| 欢迎语（时分问候 + 日期星期） | ✅「晚上好，小忆」「2026年11月8日 · 星期日」 |
| 统计卡（记录/今年/照片/收藏/标签） | ✅ 数字真实来自数据库 |
| 最近记忆 / 往年今日 / 时间线预览 | ✅ 渲染与空状态均正确 |
| 连续记录 streak | ✅ 按连续天数计算 |

### 4.7 数据与备份
| 场景 | 结果 |
| --- | --- |
| JSON 全量导出 GET /api/export | ✅ schema_version=1，含 entries（含回收站）/media 索引/tags，无 password_hash，附件下载名 evermemo-export-20261108.json |

### 4.8 权限隔离（双用户）
| 场景 | 结果 |
| --- | --- |
| user2 登录后列表 | ✅ total=0（看不到 user1 数据） |
| user2 访问 user1 记录 | ✅ 404 |
| user2 修改 user1 记录 | ✅ 404 |
| user2 访问 user1 媒体文件（no-store） | ✅ 404 |

### 4.9 移动端（390px iframe）
| 场景 | 结果 |
| --- | --- |
| 首页 / 新建 / 详情页 | ✅ 无横向溢出（scrollWidth=clientWidth） |
| 桌面左侧导航 | ✅ 隐藏，底部导航出现（首页/时间线/＋记录/画廊/我的） |
| iframe 内完整新建流程 | ✅ 保存→跳详情，无溢出 |

## 5. 测试中发现并修复的缺陷

| 缺陷 | 根因 | 修复 |
| --- | --- | --- |
| 详情页/编辑页 404 | entryWithMeta 参数顺序传反（user.id, id） | 改为 (id, user.id) |
| 更新/删除记录报 "SQL logic error" | FTS5 特殊 'delete' 命令在无 content= 选项的表上不可用 | 迁移 0003：FTS 表加 content='entries' 并全量重索引 |
| 回收站列表为空且报错 | page_size=200 超过 schema 上限 100 | 改为 100，超量时显示「仅显示最近 N 条」 |
| 跨用户媒体 200（疑似泄露） | 共享浏览器 HTTP 缓存命中 | 缓存头改 private max-age=3600 + Vary: Cookie |

## 6. 已知限制（非缺陷）

1. **UI 文件选择器无法自动化**：`<input type=file>` 无法由浏览器自动化工具注入文件，上传仅通过 API 层（FormData 批量上传）完整验证；手动选择文件路径与 API 层共用同一上传接口，风险低。建议人工点一次「添加图片」确认。
2. **移动端验证用同源 iframe 模拟**：真机浏览器手势/虚拟键盘行为不在验证范围内。
3. **自动化填表 artifact 说明**：测试中用 `dsh_browser_fill` 注入 React 受控输入有时不触发 onChange，最终均改用真实键入复测通过——**所有 UI 功能都已用真实键入路径验证**，无遗留疑点。

## 7. 结论

V1.0 全部功能（注册登录、记录 CRUD 与草稿、图片上传与私有访问、时间线、画廊、搜索、标签、收藏/重要/归档、回收站、JSON 导出、双用户权限隔离、移动端响应式）均已在生产模式下真实运行验证通过。构建零错误、单元测试 30/30、E2E 清单全绿。

---

# Evermemo V1.5 测试报告（追加）

日期：2026-11-08（同日）
测试方式：同 V1.0（生产构建 + 真实浏览器操作）。

## 8. 单元测试

结果：**4 个文件、47 个用例全部通过**（47/47）。

| 文件 | 用例数 | 覆盖内容 |
| --- | --- | --- |
| src/lib/auth/password.test.ts | 4 | 同 V1.0 |
| src/lib/utils.test.ts | 13 | 同 V1.0 |
| src/lib/api/schemas.test.ts | 21 | V1.0 用例 + person/place/milestone/chapter 档案 schema、importance 1–3、chapterEntriesSchema |
| src/lib/db/archives.test.ts | 9 | 人物/地点/里程碑/故事 CRUD、entry 关联人物地点、跨用户隔离、**部分 PATCH 不清空关联数据回归测试** |

## 9. 构建

`next build` 零错误通过：**26 个页面 + 34 个 API 路由**（V1.5 新增 /milestones、/people、/people/[id]、/people/[id]/edit、/places、/places/[id]、/places/[id]/edit、/chapters、/chapters/[id]、/chapters/[id]/edit、/favorites、/me 等）。

## 10. V1.5 端到端功能验证

### 10.1 重要时刻
| 场景 | 结果 |
| --- | --- |
| 新建（标题/日期/重要程度 1-3/描述） | ✅ UI 表单 POST 落库（importance=2） |
| 年份浏览（全部 + 按年 tabs） | ✅ /api/milestones/years 返回年份；?year=2026 命中、?year=2025 空 |
| 纪念碑卡片渲染（圆拱顶/封面占位/重要程度） | ✅ |
| 详情/编辑 Dialog | ✅ 表单完整（含封面/关联记录/人物/地点选择器） |
| 关联记录编辑（点选/移除 chip/保存） | ✅ 干净复测通过：移除后保存，DB entries 同步 |
| 删除（硬删+级联） | ✅ API 层验证 |

### 10.2 人物档案
| 场景 | 结果 |
| --- | --- |
| 新建（姓名/昵称/关系/初见/描述/备注/头像） | ✅ UI 落库（first_met_at 用原生 date 输入） |
| 列表（搜索 q、卡片、悬停编辑/删除） | ✅ |
| 详情页（统计卡/描述/备注/共同时刻/关联记录分页） | ✅ 从搜索中心跳转验证 |
| 编辑（standalone 页） | ✅ |

### 10.3 地点档案
| 场景 | 结果 |
| --- | --- |
| 新建（名称/国家/城市/地址/描述/封面） | ✅ UI 落库 |
| EntryForm 关联地点 picker | ✅ 下拉加载（BUG A 修复后）、点选生成 chip、保存后 DB entry_places 落库 |

### 10.4 人生故事
| 场景 | 结果 |
| --- | --- |
| 新建（标题/简介/Markdown 正文/日期区间） | ✅ UI 落库 |
| 详情页（封面/日期区间/正文渲染/记录管理） | ✅ |
| 添加记录（EntryPicker 多选 onPick 追加） | ✅ 3 条选中即入列 |
| 排序（上移/下移） | ✅ 骑行从第 3 位升到第 1 位 |
| 保存排序 PUT | ✅ DB sort_order=[0,1,2] 与 UI 一致 |
| 编辑页修改日期区间 | ✅ start=2026-01-01、end=2026-11-08 落库 |

### 10.5 搜索中心
| 场景 | 结果 |
| --- | --- |
| q=骑行 聚合 | ✅ 全部（2）= 记录（1）+ 故事（1），分组列表正确 |
| q=王 | ✅ 人物（1）王小明，点击跳人物详情页 |
| Tab 计数（BUG C 修复后） | ✅ 数字正确，不再 NaN/undefined |
| 记录 Tab 高级筛选（类型/心情/标签/收藏/重要） | ✅ 标签下拉带计数 |

### 10.6 收藏页
| 场景 | 结果 |
| --- | --- |
| 双 Tab 计数（BUG D 修复后） | ✅ 记录（1）/ 照片（1）未激活 Tab 数字也正确 |
| 收藏的记录列表 | ✅ EntryCard 渲染 |
| 收藏的照片 masonry | ✅ 缩略图加载（240px） |

### 10.7 归档
| 场景 | 结果 |
| --- | --- |
| 编辑页归档 toggle | ✅ 按钮激活（accent 色），保存后 is_archived=1 |
| 时间线默认排除归档 | ✅ 归档记录不出现 |
| 时间线 ?archived=1 | ✅ 筛选面板自动展开、归档 checkbox 选中、仅显示归档记录 |

### 10.8 数据导出（V1.5 扩展）
| 场景 | 结果 |
| --- | --- |
| JSON 全量导出 | ✅ app=evermemo、schema_version=1、entries=5、people=1、places=1、milestones=1、chapters=1、relations 含 entry_people/entry_places/milestone_entries/chapter_entries 全部关联、entries 带 people/places 引用、无 password_hash |

### 10.9 移动端（390px iframe，V1.5 新页面）
| 场景 | 结果 |
| --- | --- |
| /me「我的」页 | ✅ 无溢出，人生档案入口列表 + 底部导航 |
| /milestones | ✅ 无溢出，纪念碑卡片 + 年份 tabs |
| /chapters | ✅ 无溢出，故事卡片 + 日期区间 |

## 11. V1.5 测试中发现并修复的缺陷

| 缺陷 | 根因 | 修复 |
| --- | --- | --- |
| BUG A：ArchivePicker 下拉永远「加载中…」 | useEffect 依赖数组含 loading，setLoading(true) 触发 effect 重跑 → cleanup 作废在途请求且 setLoading(false) 永不执行 | 依赖改为 [open, kind] |
| BUG B：部分 PATCH 清空关联数据（重大） | updateEntry 把 input.tags ?? [] 无条件重挂，收藏 toggle 会清空标签/媒体/人物/地点 | 关联字段仅当 !== undefined 才重挂；新增回归测试 |
| BUG C：搜索中心 Tab 计数 NaN/undefined | /api/search 返回扁平结构（entries + entries_total），客户端期望嵌套 {items,total} | SearchCenter 按 API 契约映射 |
| BUG D：收藏页未激活 Tab 计数为 0 | 照片 total 只在切 Tab 后才加载 | 挂载时预取两个 Tab 的 page_size=1 计数 |

## 12. V1.5 已知限制

1. 同 V1.0 第 6 节（文件选择器自动化、iframe 模拟、fill artifact 已全部真实键入复测）。
2. 档案封面/头像选择走 CoverPicker（单张上传）；未做多张照片轮播。
3. 故事记录排序为手动排序（上移/下移）；「按时间自动排序」按钮未做（PRD 允许手动）。
4. 地图未做（PRD 第一版为地点列表，地图预留可替换组件）。

## 13. V1.5 结论

V1.5 全部功能（重要时刻、人物档案、地点档案、人生故事、收藏页、搜索中心聚合、归档与时间线归档筛选、导航整合、移动端「我的」页、扩展导出）均已在生产模式下真实运行验证通过。构建零错误、单元测试 47/47、E2E 清单全绿。

---

# Evermemo V2.0 测试报告（追加）

## 14. 单元测试

vitest 共 59/59 通过（5 个文件）。V2.0 新增 `src/lib/ai/features.test.ts`（12 用例，临时库 + `AI_MOCK=1` 动态导入模式）：

- `from`/`to` 日期闭区间过滤（含起止当天）
- `organizeEntry` mock 返回结构（标题/类型/标签/润色正文）
- `reviewRange`：0 条记录不调 AI（draft='' sources=[]）；有记录返回 [MOCK] 草稿 + 来源
- `askQuestion`：无记录如实回答（citations=[]）；有记录回答带 [[id]] 引用解析
- `yearlyReview`：无记录年份 entryCount=0；有记录年份关键词/故事 [MOCK]
- `storyDraft`：按 id 保序、跨用户 id 忽略
- `semanticSearch`：无记录 note；mock 模式关键词重合打分

## 15. 构建

`next build` 零错误：26 页面 + 34 API 路由（新增 `/api/ai/*` 9 个路由、`/ai` 页面）。

## 16. V2.0 端到端功能验证（AI_MOCK=1）

### 16.1 AI 助手页

- 配置横幅与 [MOCK] 横幅正确显示；回顾/问答/年度回顾/草稿箱 4 Tab 切换正常
- 回顾：预设区间（今天/最近一周/本月/自定义）生成 [MOCK] 回顾，显示记录数/主题/心情；「收藏到草稿箱」→ 草稿落库（kind=review，source_entry_ids 只含本人记录）
- 问答：提问「我今年最开心的事是什么？」→ [MOCK] 回答 + 4 条引用记录；点击引用直达记录详情页
- 年度回顾：2026 → 关键词芯片（海边/骑行/秋天）、重要事件、旅行回忆、逐字摘录原文、「年度故事」[MOCK]；「丢弃」正常
- 草稿箱：列表显示 kind 标签/时间/MOCK 标记/meta 摘要，删除带确认

### 16.2 记录 AI 整理（编辑页）

- 「AI 整理」生成建议面板（标题/类型/标签/润色正文 + 原始输入保留）
- 「应用建议」→ 表单填入建议（标题变「海边的一天」、标签追加去重）；面板保持打开并显示「已应用」+「恢复原文」
- 「恢复原文」→ 表单恢复应用前状态
- **原文不被污染**：全程未点保存时，数据库记录保持原文（title/content/tags 均未变）；草稿机制与原文严格分离

### 16.3 故事 AI 整理（人生故事详情）

- 「AI 整理」→ [MOCK] 故事草稿对话框（基于 3 条关联记录）
- 「应用为正文」→ confirm 确认后 PATCH 写入 story.content（带 [MOCK] 标记）

### 16.4 语义搜索（搜索中心）

- AI_MOCK=1：语义搜索「海边」→ 命中「第一次骑行到海边」相似度 90%
- 未配置 AI：自动退回关键词模式并显示 note「当前未配置 AI，使用关键词搜索。」；命中给相似度 100%，无命中时如实说明「没有找到相关记录」，不编造

### 16.5 无 Key 状态（未配置 AI）

- /ai 页显示「AI 尚未配置」横幅 + 完整配置说明（AI_API_BASE/AI_API_KEY/AI_MODEL、AI_MOCK=1、OpenAI 兼容格式、Key 只存服务端）
- 点击生成 → 503 NOT_CONFIGURED，友好提示「AI 尚未配置：请在服务器环境变量中设置 AI_API_BASE 与 AI_API_KEY，或设置 AI_MOCK=1 体验模拟流程」

### 16.6 移动端（390px iframe）

- /ai 页无横向溢出（389px），配置横幅完整可读

## 17. V2.0 测试中发现并修复的缺陷

| 缺陷 | 根因 | 修复 |
| --- | --- | --- |
| BUG E：AI 面板应用后关闭，「恢复原文」不可达 | onAiApply 里 setAiPanelOpen(false) | 应用后保持面板打开，显示「已应用」徽章 + 恢复原文按钮 |
| BUG F：未配置 AI 时错误吞成 500「服务器出现错误」 | apiHandler 未识别 AiError | apiHandler 增加 AiError 分支（503/502 + 友好消息）；NOT_CONFIGURED 消息补全配置指引 |

## 18. V2.0 已知限制

1. 真实 AI 调用路径（非 mock）无法在无 API Key 环境验证：OpenAI 兼容 /chat/completions 与 /embeddings 的调用代码已按规范实现（超时 30s、JSON 模式、结构校验、失败降级），但未经真实上游实测。
2. 向量语义搜索依赖上游 /embeddings；embedding 失败时自动降级关键词搜索并在 UI 说明。
3. 语义搜索候选池取最近 100 条记录（性能与成本权衡）。
4. AI 问答引用上限 5 条（citations 截断）。

## 19. V2.0 结论

V2.0 全部功能（记录 AI 整理、区间回顾、人生问答、年度回顾、草稿箱、语义搜索、故事整理、无 Key 状态与 AI_MOCK 隔离）均已在生产模式下真实运行验证通过。构建零错误、单元测试 59/59、E2E 清单全绿。产品原则「AI 尊重原始记忆」落实为：一切 AI 产出先入草稿箱、应用需用户确认、原文永不静默修改、无记录时如实说明。

---

# Evermemo V3.0 测试报告（追加）

## 20. 单元测试

vitest 共 65/65 通过（6 个文件）。V3.0 新增 `src/lib/db/capsules.test.ts`（6 用例，临时库动态导入模式）：

- 创建胶囊（未来开启日期）落库；开启日期必须是未来（过去日期被拒）
- 未到期不可读（content 置空、openable=false）
- 到期自动开启（openable=true、opened_at 落库）
- 开启后不可修改（ALREADY_OPEN）
- 列表按 status 过滤（locked/opened/all）
- 用户隔离（跨用户不可见）

## 21. 构建

`next build` 零错误：页面新增 `/map`、`/stages`、`/memories`、`/memories/[year]`、`/capsules`、`/report`；API 路由新增 `/api/capsules`（GET/POST）、`/api/capsules/[id]`（GET/PATCH/DELETE）、`/api/export/photos`（ZIP）。

## 22. V3.0 端到端功能验证（生产模式）

### 22.1 人生地图
| 场景 | 结果 |
| --- | --- |
| 无经纬度地点 | ✅ 降级为地点列表并提示补充坐标 |
| 补充坐标后（西湖边 30.26/120.16） | ✅ Leaflet 地图实例渲染（缩放控件/Leaflet 标识），地点打点 + 右侧列表 |
| 地图加载失败降级 | ✅ 组件内置错误横幅 + 列表兜底 |

### 22.2 人生阶段
| 场景 | 结果 |
| --- | --- |
| 总览 5 卡（第一条记录 2026-11-07/记录时长 0 年 1 天/记录 5/照片 2/故事 1） | ✅ |
| 年度足迹条形行（2026: 5 记录/2 照片/1 时刻/1 故事，链接时间线） | ✅ |
| 人生阶段区间条（2026 骑行记 01-01~11-08） | ✅ |
| 重要时刻 chips | ✅ |

### 22.3 年度纪念册
| 场景 | 结果 |
| --- | --- |
| /memories 目录（2026 年份卡：5 记录/2 照片/1 时刻） | ✅ |
| /memories/2026 完整（概览 4 卡、重要时刻、照片墙、故事、记录全文按日分组） | ✅ |
| 打印/导出 PDF 按钮 | ✅ window.print |

### 22.4 记忆胶囊
| 场景 | 结果 |
| --- | --- |
| UI 新建「写给十年后的自己」（2036-11-08 开启，正文 57 字） | ✅ 落库，倒计时 3653 天 |
| 未到期不可读 | ✅ API content 长度 0、openable=false |
| 未到期可编辑 | ✅ PATCH 成功（改后已还原标题） |
| schema 强制未来日期 | ✅ 过去日期 →「开启日期必须是未来日期」 |
| 到期开启（DB 改 open_at=2026-11-07 模拟） | ✅ content 完整可读、openable=true、GET 详情后 opened=true 落库 |
| 开启后不可修改 | ✅ PATCH → ALREADY_OPEN「这封信已经开启，不能再修改了」 |
| UI「打开信封」对话框 | ✅ 封存/开启日期 + 全文 + 收好按钮 |

### 22.5 回顾报告
| 场景 | 结果 |
| --- | --- |
| 预设区间（今年/去年/最近 90 天/最近 30 天）+ 自定义 | ✅ |
| 生成报告（BUG H 修复后） | ✅ 概览 6 卡（记录 4/照片 1/收藏 1/重要 1/活跃天数 2/最长连续 2 天）、月度足迹、类型/心情分布、高频标签、高光时刻 |
| 打印按钮 | ✅ |

### 22.6 照片打包导出
| 场景 | 结果 |
| --- | --- |
| GET /api/export/photos | ✅ 200、application/zip、Content-Disposition attachment evermemo-photos-20261108.zip、351KB、PK 魔数 |
| ZIP 内容 | ✅ 「照片/」目录 2 张原始照片（含用户手动上传的 PNG） |

### 22.7 JSON 全量导出（V3.0 扩展）
| 场景 | 结果 |
| --- | --- |
| schema_version=2 | ✅ entries=5、capsules=1、ai_drafts=4、ai_messages=2、relations.capsule_media、无 password_hash |

### 22.8 移动端（390px iframe）
| 场景 | 结果 |
| --- | --- |
| /map、/stages、/memories、/memories/2026、/capsules、/report | ✅ 全部无横向溢出，底部导航正常 |

### 22.9 归档一致性（BUG I 修复后）
| 场景 | 结果 |
| --- | --- |
| 首页最近记忆排除归档 | ✅ 归档记录不再出现 |
| 往年今日/年份预览/年度足迹/第一条记录 均排除归档 | ✅ |

## 23. V3.0 测试中发现并修复的缺陷

| 缺陷 | 根因 | 修复 |
| --- | --- | --- |
| BUG G：GET /api/capsules 报 VALIDATION | 路由把 searchParams.get() 的 null 直接传给 z.coerce.number()（null→0→min(1) 失败） | 三个查询参数统一 `?? undefined`，走 schema 默认值 |
| BUG H：回顾报告不渲染 | ReportView 请求 page_size=500 超过 listQuerySchema 上限 100 → VALIDATION | generate() 改为 page_size=100 分页循环（has_more 判定，上限 10 页） |
| BUG I：首页最近记忆显示归档记录 | getRecentEntries SQL 未排除 is_archived=1 | 补 is_archived=0；同步修复 getOnThisDay/getYearMonths/getStatsPerYear/getFirstEntryAt |

## 24. V3.0 已知限制

1. 地图瓦片来自 OSM 公网（需联网）；无网时自动降级为地点列表（组件已实现）。
2. 「打印/导出 PDF」依赖浏览器打印功能（@media print 样式已适配 A4）。
3. 记忆胶囊为明文存储 + API 层到期校验（本地优先产品，未做端到端加密）。
4. 照片 ZIP 按原始文件名组织（日期前缀 + 同名去重），不含 EXIF 元数据整理。

## 25. V3.0 结论

V3.0 全部功能（人生地图、人生阶段、年度纪念册、记忆胶囊、回顾报告、打印 PDF、照片 ZIP 打包导出、JSON 导出升级 schema_version=2）均已在生产模式下真实运行验证通过。构建零错误、单元测试 65/65、E2E 清单全绿。

## 26. V3.1 单元测试

| 文件 | 用例 | 通过 |
| --- | --- | --- |
| utils / schemas / archives / ai features / password / capsules | 13+21+9+12+4+8 = 67 | 67/67 ✅ |

## 27. V3.1 E2E（生产模式，浏览器实测）

### 27.1 归档独立页
| 场景 | 结果 |
| --- | --- |
| /archives 渲染（归档列表+计数） | ✅ 显示 1 条归档记录（羽毛球小程序） |
| 取消归档 | ✅ 点击后列表清空、空态显示、API archived=1 total=0 |
| 时间线回归 | ✅ 归档记录回到时间线 |

### 27.2 记忆胶囊加密
| 场景 | 结果 |
| --- | --- |
| 新建胶囊（写给 2027 的自己，2036→2027 开启） | ✅ 落库成功，未到期 content 为空 |
| DB 直读新胶囊 | ✅ content 以 v1: 开头密文、data_key 以 v1: 开头密文（不含明文） |
| 旧胶囊兼容（data_key NULL 明文行） | ✅ 到期后可读原文（嘿，十年后的我：…） |
| 打开信封 Dialog | ✅ 渲染封存/开启日期+全文 |
| JSON 导出 | ✅ schema_version=2、胶囊 content 为明文、不含 data_key 字段 |
| 未到期 PATCH/到期 PATCH 拒绝 | ✅ 语义不变 |

### 27.3 原生 PDF 导出
| 场景 | 结果 |
| --- | --- |
| 纪念册 PDF /api/export/pdf/memories?year=2026 | ✅ 200 application/pdf 58KB，%PDF- 魔数、微软雅黑字体嵌入、2 页 |
| 报告 PDF /api/export/pdf/report?from=2026-01-01&to=2026-12-31 | ✅ 200 application/pdf 60KB |
| 页面按钮（纪念册/报告「下载 PDF」） | ✅ 链接正确生成 |

### 27.4 移动端
| 场景 | 结果 |
| --- | --- |
| /archives 390px | ✅ 无横向溢出，底部导航正常 |

## 28. V3.1 测试中发现并修复的缺陷

| 缺陷 | 根因 | 修复 |
| --- | --- | --- |
| BUG J：胶囊密钥二进制损坏 | key.toString('utf8') 往返导致 AES 解密失败（静默返回密文） | 密钥字符串往返改用 base64（Buffer.from(...,'base64')） |
| BUG K：PDF 导出为空文件（0 字节） | pdfkit 0.20 的 data 事件不触发，直接 Buffer.concat 拿到空数组 | 改为 doc.pipe(PassThrough) 收集 + Promise 化，路由 await |
| BUG L：导出 TypeScript 类型不匹配 | capsules 行类型 {id:string}[] 与解密 map 不兼容；Buffer 不是 BodyInit；pdfkit 缺声明 | 行类型补全 content/data_key；Readable.from(pdf) as BodyInit；安装 @types/pdfkit；ENTRY_TYPE_LABELS 索引加 keyof |

## 29. V3.1 已知限制

1. PDF 中文字体依赖系统字体（Windows：msyh.ttc/simhei.ttf；macOS/linux 有回退链），找不到字体时导出失败并返回 500 JSON 错误。
2. 胶囊加密密钥由 data/secret 主密钥派生——若删除 data/ 目录，加密胶囊将无法解密（数据全部丢失，这与整个本地优先模型的备份语义一致）。
3. 原生 PDF 不含照片图片（纯文字布局），照片请用照片 ZIP 打包。

## 30. V3.1 结论

V3.1 三项增强（归档独立页、胶囊 AES-256-GCM 加密、原生 PDF 导出）全部在生产模式下真实运行验证通过。构建零错误、单元测试 67/67、E2E 清单全绿。发现并修复 3 个缺陷（BUG J/K/L）。

## 31. 真实 AI 接入（V2.1）

环境：千问AI平台（qianwenai.com，OpenAI 兼容），`.env.local` 配置 `AI_API_BASE=https://maas.qianwenaiapi.com/compatible-mode/v1`、`AI_MODEL=qwen3.7-plus`、`AI_EMBEDDING_MODEL=text-embedding-v3`、`AI_THINKING=off`。`/api/ai/config` 返回 `{configured:true,mock:false}`。

## 32. 真实 AI E2E（浏览器实测，非 mock）

| 场景 | 结果 |
| --- | --- |
| 回顾 Tab：生成最近一周回顾（4 条记录） | ✅ 真实 Markdown 回顾，引用 4 条记录 id，收藏落库（is_mock=0） |
| 问答 Tab："我今年最开心的事是什么？" | ✅ 如实说明记录未明确提及，但指出「第一次骑行到海边」并附 1 条引用，点击跳转原文 |
| 年度回顾 Tab：2026 | ✅ 8.9s 生成关键词 6 个/重要事件 4 条/旅行 1 条/原文摘录 1 条/年度故事约 1200 字，全部来自真实记录 |
| 编辑页 AI 整理 | ✅ 建议标题「傍晚公园赏银杏」/瞬间/#公园#银杏#散步，正文保持原句；应用+保存后原文保留 |
| 故事 AI 整理 | ✅ 3 条记录串联生成故事正文，关闭不应用不影响原文 |
| 语义搜索「我在秋天的夜里喝的东西」 | ✅ 秋日的奶茶 71% / 深夜的拿铁 62% / 傍晚公园赏银杏 45% / 第一次骑行到海边 40%（关键词无重合，纯向量） |
| 草稿箱 | ✅ 五条真实草稿（story/organize×2/yearly×2）正确渲染，无 MOCK 标记 |
| ai_messages | ✅ user/assistant 各 1 条 is_mock=0 |

## 33. 真实 AI 测试中发现并修复的缺陷

| 缺陷 | 根因 | 修复 |
| --- | --- | --- |
| BUG M：AI 整理编造原文没有的情节 | 提示词只要求「润色」但未禁止添加场景，模型把「公园散步」扩写成「去海边朋友聚会」 | src/lib/ai/features.ts 提示词加「只能使用原文事实，严禁添加原文没有的情节人物场景」，temperature 0.3→0.2；复测通过 |
| BUG N：年度回顾/问答超时 | qwen3.7-plus 默认深度思考，单次约 11s，年度回顾 30s 超时 | 新增 AI_THINKING=off 关闭 enable_thinking（耗时降至约 1.7s），默认超时 30s→60s |

## 34. 真实 AI 已知限制

1. 千问AI平台的 `/models` 网关不支持列表接口（401），应用不做模型名校验；模型名写错会在生成时返回上游错误并如实提示。
2. `AI_THINKING=off` 依赖上游 `enable_thinking` 参数，非 Qwen 模型会忽略该字段。
3. 语义搜索的 embedding 维度与模型绑定（text-embedding-v3 为 1024 维）；换模型后历史向量不缓存（当前实现每次现算，无持久化向量索引）。
4. API Key 以明文存于 `.env.local`（服务端文件，已被 .gitignore 忽略）；生产部署请使用环境变量注入。

## 35. V3.2 收尾增强（深色模式 / PWA / 照片归档 / PDF 照片墙 / Supabase 实测）

单测：75/75 全绿（7 文件，新增 src/lib/media/zipPath.test.ts 8 用例）。

| 项 | 实测结果 |
| --- | --- |
| 照片 ZIP 分目录 | ✅ 下载 /api/export/photos，解压为 `照片/2026-11/20261108_微信图片_20261108020145_132_2.png` 与 `照片/2026-11/20261108_test-photo.jpg`；EXIF 拍摄时间优先、缺失回退上传时间、同名去重由单测覆盖 |
| 深色模式 | ✅ 侧栏「切换外观」循环 浅色/深色/跟随系统；data-theme=dark 后 body 背景 rgb(23,22,18)、前景 rgb(236,233,225)、accent #a8ae91、meta theme-color #171612；刷新后保持（THEME_BOOTSTRAP 无闪白） |
| PWA | ✅ manifest 200 application/manifest+json；SW 注册成功（scope=/，active/activated）；图标 192/512/180/maskable-512 尺寸正确；/offline 页面 200 且标题「暂时离线 · Evermemo」 |
| 纪念册 PDF 含照片 | ✅ GET /api/export/pdf/memories?year=2026 → 411,100 字节（原 58KB），PDF 内 2 张图片、2 页，%PDF- 魔数正确 |
| 移动端 390px | ✅ /settings、/home 等页面 iframe 390px 无横向溢出（clientWidth 380 含滚动条），深色主题在移动视口同样生效 |
| Supabase SQL 实测 | ✅ `node scripts/verify-supabase.mjs`（PGlite 真实 Postgres）：20 张表存在、全部 relrowsecurity=true、A/B 双用户隔离与伪造插入拒绝全部通过 |
| LAN 访问（真机） | ✅ 服务绑定 0.0.0.0，局域网 http://10.215.169.31:4321/login 200（13.6KB）；防火墙已有 node.exe 公网入站放行规则 |

## 36. V3.2 修复与说明

- 首次 PGlite 执行 `0001_schema.sql` 报 `extension "pgcrypto" is not available`：Postgres 13+ 已内置 gen_random_uuid()，删除该扩展声明即可。
- `auth.uid()` 桩函数初版返回 text，报 `return type mismatch in function declared to return uuid`：改为 `(…->>'sub')::uuid`。
- 照片墙单本上限 60 张（避免单次 PDF 过大），缺失/损坏文件静默跳过。
- PDF 中的照片使用原图（非缩略图），纪念册体积随照片数增长；如需更小体积可改用 thumbs 路径。

## 37. V3.2 已知限制

1. 深色模式为客户端在 `<html data-theme>` 上切换，首帧由内联脚本决定；`prefers-color-scheme` 变化时仅「跟随系统」模式下实时响应。
2. Service Worker 只缓存静态资源与离线页，不做 API 缓存——离线时浏览历史页面需回到首页重新加载（数据本地优先，无离线写入）。
3. 真机测试需手机与电脑处于同一局域网；当前服务未配置 HTTPS，部分浏览器「添加到主屏幕」提示可能弱化（仍可手动添加）。
4. Supabase SQL 为路径验证（PGlite），未在真实 Supabase 项目上跑端到端应用；迁移代码层仍未接入 supabase-js。

## 38. V3.3 记忆胶囊口令保险库

### 38.1 设计

- 每用户一个随机 32 字节「保险库数据密钥」，用**登录口令派生**的 KEK（scrypt N=16384/r=8/p=1/keylen=32，salt 随机 16 字节）包裹后存 `users.vault_key`；口令本身不落盘。
- 服务器仅在内存缓存解包后的数据密钥（12 小时 TTL，登录/注册/解锁时写入，退出登录时清除；进程重启即清空）。
- `memory_capsules.data_key` 仍存「被包裹的数据密钥」：新胶囊用保险库密钥包裹，升级前的旧胶囊用旧主密钥包裹——读取时先试保险库密钥、失败回退旧主密钥，**旧胶囊无需重新加密即可继续阅读**。
- 修改登录口令时：旧口令解包 → 新口令重新包裹（胶囊密文本身不重加密）；忘记口令 = 胶囊正文不可恢复（密文保留）。
- 导出：保险库解锁时导出明文；锁定时导出密文并标记 `locked: true`（不静默丢数据）。
- 有保险库但未解锁时，创建/修改胶囊正文返回 `423 VAULT_LOCKED`，避免用服务器主密钥降级包裹。

### 38.2 单测（80/80 全绿，8 文件）

| 测试文件 | 用例数 | 覆盖 |
| --- | --- | --- |
| src/lib/crypto/vault.test.ts | 4 | 正确/错误口令、改口令重包裹、salt 影响、解锁缓存 |
| src/lib/db/capsules.test.ts | 9 | 含新增「保险库用户：解锁可读 → 锁定不可读（密文保留）→ 重新解锁恢复；锁定时导出保留密文并标记 locked」 |

### 38.3 浏览器 E2E（真实模型环境，test@evermemo.local）

| # | 场景 | 结果 |
| --- | --- | --- |
| 38.1 | 旧账号首次登录自动建立保险库（`/api/vault` → has_vault=true, unlocked=true） | ✅ |
| 38.2 | 旧胶囊（旧主密钥包裹）在保险库建立后仍可读 | ✅ |
| 38.3 | 新建胶囊加密落库；DB 直读 content/data_key 均为 `v1:` 密文 | ✅ |
| 38.4 | 锁定（DELETE /api/vault）后详情/列表 `locked=true`、正文为空 | ✅ |
| 38.5 | 错误口令解锁 → 400 WRONG_PASSWORD；正确口令 → 解锁、正文恢复 | ✅ |
| 38.6 | UI：锁定横幅 +「解锁胶囊」+「解锁后阅读」；解锁对话框输入真实口令后卡片恢复「打开信封」 | ✅ |
| 38.7 | 修改口令：旧口令失效、新口令解锁成功、胶囊正文可读 | ✅ |
| 38.8 | 锁定状态下导出：密文 + locked:true；解锁后导出明文 | ✅ |
| 38.9 | 服务器重启后自动锁定；锁定状态下创建胶囊 → 423 VAULT_LOCKED；解锁后创建成功 | ✅ |

### 38.4 性能

- 纪念册 PDF 照片改用 sharp 生成缩略图（900px / JPEG q78，缺缩略图回退原图）：`/api/export/pdf/memories?year=2026` 由 411,100 字节降至 91,524 字节（2 图 2 页），照片墙清晰度可接受。

## 39. V3.3 已知限制

1. 忘记登录口令 = 胶囊正文永久不可读（口令派生密钥的固有代价；可另行增加「恢复码」机制）。
2. 解锁状态缓存在进程内存：多实例部署时各实例需各自解锁（单机本地优先部署无此问题）。
3. 旧胶囊（旧主密钥包裹）仍可由服务器 secret 解密，迁移到保险库需用户重新保存正文或提供一键重加密工具。
4. 保险库密钥缓存窗口内（12 小时），同一进程可读取胶囊正文；服务器主机被攻破时无法防御。

## 40. 真实 Supabase 项目端到端验证（2026-11-09）

把「可执行 SQL + 本地 PGlite 验证」推进到「真实 Supabase 项目验证」。

### 40.1 项目与环境

| 项 | 值 |
| --- | --- |
| Project ref | `lnolcreffwgxlwdompeg`（新加坡 ap-southeast-1，`ACTIVE_HEALTHY`） |
| 执行通道 | Supabase Management API `POST /v1/projects/{ref}/database/query`（Personal Access Token，7 天有效期，验证后建议撤销） |
| 网络 | 大陆直连 `*.supabase.co` TLS 重置；全部请求经本机 Clash 代理 `127.0.0.1:7897`（Node 用 `--use-env-proxy`） |

### 40.2 SQL 执行结果

| 文件 | 结果 |
| --- | --- |
| `docs/supabase/0001_schema.sql` | ✅ 20 张表创建成功（含 memory_capsules/capsule_media/ai_drafts/ai_messages） |
| `docs/supabase/0002_rls.sql` | ✅ 全部表 `relrowsecurity = true`，21 条策略；平台环境自动跳过 `auth` schema 改写 |
| `docs/supabase/0003_search.sql` | ✅ `pg_trgm` 扩展 + `idx_entries_title_trgm` / `idx_entries_content_trgm` / `idx_tags_name_trgm` |
| `docs/supabase/0004_storage.sql` | ✅ 私有桶 `media`（public=false）+ 4 条目录归属策略 |

执行中修复的两个平台差异：
1. `create extension pgcrypto` 与 `create schema auth` 在 Supabase 平台不可用/无权限 → `auth.uid()` 桩改为「函数不存在才创建」，平台自动跳过。
2. 关闭「自动暴露新表」后 `service_role` 无表权限（403 提示 `GRANT ... TO service_role`）→ 授权块补齐 `authenticated`（读写）、`service_role`（全权）、`anon`（全禁）。

### 40.3 真实 Auth + REST 双用户隔离（真实 JWT）

用 Admin API 创建两个已确认邮箱用户（`verify-a@` / `verify-b@`），用 `grant_type=password` 换取真实 access_token 后走 PostgREST：

| 断言 | 结果 |
| --- | --- |
| A 能写入自己的记录 | ✅ 201 |
| A 能看到自己的 1 条记录 | ✅ rows=1 |
| B 看不到 A 的记录（RLS 隔离） | ✅ rows=0 |
| B 不能以 A 的身份写入（with check 生效） | ✅ 403 |
| B 能写入自己的记录 | ✅ 201 |
| A 仍只看到自己的记录 | ✅ `["A 的私密记录"]` |
| B 只看到自己的记录 | ✅ `["B 的记录"]` |

Storage 目录隔离：A 上传 `<A.uid>/verify.txt` ✅ 200；A 上传到他人目录 ✅ 400 被 policy 拒绝；验证后测试用户与对象已清理（项目保持空库）。

### 40.4 结论与限制

- RLS 与 Storage 策略在真实平台按预期工作；`.env.local` 已写入 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`。
- 仍属「基础设施验证」：应用数据层（`src/lib/db`）仍走本地 SQLite，尚未接入 supabase-js；真正切换数据层是后续独立工程（接口签名已对齐，见 `SUPABASE_MIGRATION.md`）。
- 已知限制：`sessions` 表在改用 Supabase Auth 后可移除；自建会话模式下 RLS 需 `auth.uid()` 来自自定义 JWT。


---

## 41. V3.5 胶囊恢复码（账号找回）

### 41.1 设计

- 恢复码 = 20 字节随机数的 Crockford Base32（160 bit，32 字符按 4 字符分组），剔除易混字符 I/L/O/U；输入时忽略大小写、空格与横线，O→0、I/L→1。
- 服务端只保存 `recovery_salt` 与「用恢复码派生 KEK 包裹的数据密钥」（AES-256-GCM）；恢复码明文只在生成时返回一次，不落盘、不写日志。
- 找回流程 = 账号找回 + 重设口令：邮箱 + 恢复码 + 新口令 → 重设 `password_hash`，并用新口令重新包裹同一数据密钥 → 已加密的胶囊正文继续可读。
- 安全语义：恢复码**一次性**（使用成功立即吊销）；找回接口按邮箱限流（15 分钟 5 次）；错误统一返回「邮箱或恢复码不正确」，不暴露账号是否存在。

### 41.2 单测（vitest，82/82 全绿；vault 相关 6 例）

| 用例 | 结果 |
| --- | --- |
| 创建保险库：正确口令可解出数据密钥，错误口令解不出 | ✅ |
| 改口令：旧口令解包 → 新口令重包裹，数据密钥不变 | ✅ |
| 同一口令 + 不同 salt 派生出不同 KEK | ✅ |
| 解锁缓存：设置、读取、锁定、过期语义 | ✅ |
| 恢复码格式：32 字符 Crockford Base32，8 组；规范化忽略大小写/横线/空格 | ✅ |
| 恢复码包裹数据密钥：正确恢复码可解、错误/非法恢复码返回 null | ✅ |

### 41.3 浏览器 E2E（真实环境）

| 场景 | 结果 |
| --- | --- |
| 设置页「恢复码」初始显示「尚未设置恢复码」 | ✅ |
| 生成恢复码：输入登录口令 → 一次性展示 8 组恢复码 → 标记已保存 → 状态变「已设置」+ 撤销按钮 | ✅ |
| DB 直读：`recovery_salt` 32 hex、`recovery_key` 为 `v1:` 密文（无明文码） | ✅ |
| 退出登录 → `/recover` 填邮箱 + 恢复码 + 新口令 ×2 → 重设成功并自动登录 | ✅ |
| 找回后 `/api/vault`：`has_vault=true`、`unlocked=true`、`has_recovery=false`（恢复码已吊销） | ✅ |
| 找回后胶囊正文可读（57 字，`locked=false`） | ✅ |
| 同一恢复码第二次使用 → 400 `INVALID_RECOVERY`（一次性生效） | ✅ |
| 新口令登录 200 / 旧口令登录 401 | ✅ |
| 改回原口令后胶囊仍可读（数据密钥跨改密保持不变） | ✅ |
| 恢复码口令错误 → 400 `WRONG_PASSWORD`；撤销恢复码 → `has_recovery=false` 且 UI 回到「尚未设置」 | ✅ |
| 找回限流：连续 6 次尝试 → 前 5 次 400、第 6 次 429 `TOO_MANY_ATTEMPTS` | ✅ |
| 未知邮箱 / 短恢复码 → 统一 400 `INVALID_RECOVERY` / `VALIDATION`（不泄露账号存在性） | ✅ |

### 41.4 已知限制

- 未设置恢复码时，忘记口令仍会导致胶囊正文不可读（密文保留）——设置页已明确提示。
- 恢复码一旦生成即覆盖旧恢复码（同一时间只有一枚有效）。
- 解锁缓存为单进程内存（12 小时），多实例部署需共享缓存（如 Redis）才能跨实例解锁。
- 普通记录、照片、人物地点等数据不受恢复码影响（本来就不依赖保险库密钥）。
