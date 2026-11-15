/**
 * V2.0 AI 功能实现：整理 / 回顾 / 问答 / 年度回顾 / 故事整理。
 * 所有输出均为“草稿”：绝不直接写入 entries/chapters，用户确认后由调用方应用。
 * mock 模式（AI_MOCK=1）返回确定性假响应并打 mock 标记，与生产隔离。
 */
import { z } from 'zod';
import { aiChat, aiJson, getAiConfig, AiError } from './index';
import { listEntries } from '@/lib/db/entries';
import type { EntryWithMeta } from '@/lib/types';
import { ENTRY_TYPE_LABELS } from '@/lib/types';

// ---------- 结构化输出 schema ----------

export const organizeSchema = z.object({
  title: z.string().trim().max(120),
  tags: z.array(z.string().trim().max(40)).max(10),
  entry_type: z.enum(['diary', 'moment', 'photo', 'idea', 'event', 'travel', 'custom']),
  polished: z.string().max(20000),
});

export interface OrganizeResult {
  title: string;
  tags: string[];
  entry_type: string;
  polished: string;
  mock: boolean;
}

export const yearlySchema = z.object({
  keywords: z.array(z.string().trim().max(20)).max(10),
  events: z.array(z.string().max(300)).max(10),
  travels: z.array(z.string().max(300)).max(10),
  photos: z.array(z.string().max(200)).max(10), // 引用媒体说明（若无法可靠获得可为空数组）
  quotes: z.array(z.string().max(500)).max(10), // 用户自己的代表性文字（必须原文摘录）
  story: z.string().max(5000),
});

export interface YearlyResult {
  keywords: string[];
  events: string[];
  travels: string[];
  photos: string[];
  quotes: string[];
  story: string;
  entryCount: number;
  mock: boolean;
}

export interface Citation {
  id: string;
  title: string;
  occurred_at: string;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  mock: boolean;
}

// ---------- 上下文组装 ----------

function entryLine(e: EntryWithMeta): string {
  const title = e.title || '（无标题）';
  const content = e.content.replace(/\s+/g, ' ').slice(0, 200);
  return `[[${e.id}]] ${e.occurred_at.slice(0, 10)} · ${ENTRY_TYPE_LABELS[e.entry_type]} · ${title}：${content}`;
}

function excerptLine(e: EntryWithMeta): string {
  const title = e.title || '（无标题）';
  const content = e.content.replace(/\s+/g, ' ').slice(0, 500);
  return `【${e.id}｜${e.occurred_at.slice(0, 10)}｜${ENTRY_TYPE_LABELS[e.entry_type]}｜${title}】${content}`;
}

// ---------- A. AI 记录整理 ----------

export async function organizeEntry(userId: string, rawText: string): Promise<OrganizeResult> {
  const cfg = getAiConfig();
  if (cfg.mock) {
    return {
      title: '海边的一天',
      tags: ['海边', '朋友'],
      entry_type: 'moment',
      polished: `今天去了海边，天气很好。\n\n和朋友聊了很多，晚上吃了一顿很棒的饭。\n\n> 原始输入：${rawText.slice(0, 100)}`,
      mock: true,
    };
  }
  const { data } = await aiJson<unknown>(
    [
      {
        role: 'user',
        content: `你是一位记忆整理助手。请把下面这段用户随手记下的文字整理成结构化内容，只输出 JSON：{"title": 简短标题, "tags": ["2-4个标签"], "entry_type": 记录类型(diary日记/moment瞬间/photo照片/idea想法/event事件/travel旅行/custom自定义), "polished": 润色后的正文(Markdown)}。

【最重要的规则】polished 与 title 只能使用原文中出现过的事实（人物、地点、活动、时间、感受）。严禁添加原文没有的情节、场景或人物，严禁把「公园散步」改写成「去海边玩」。润色仅限：断句、段落、标点、连接词、错别字；可补充原文隐含的语气，但不能新增信息。若原文只有一句话，polished 就保持一句话的规模。

原文：\n${rawText.slice(0, 4000)}`,
      },
    ],
    { temperature: 0.2 }
  );
  const parsed = organizeSchema.safeParse(data);
  if (!parsed.success) throw new AiError('INVALID_RESPONSE', 'AI 整理结果结构不正确');
  return { ...parsed.data, mock: false };
}

// ---------- B. AI 回顾（今日/本周/月度/年度/自定义区间） ----------

export interface ReviewInput {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  label: string; // 展示用（如「2026年11月」）
}

export interface ReviewResult {
  draft: string;
  sources: string[];
  entryCount: number;
  mock: boolean;
}

export async function reviewRange(userId: string, input: ReviewInput): Promise<ReviewResult> {
  const { items, total } = listEntries(userId, {
    page: 1,
    page_size: 100,
    from: input.start,
    to: input.end,
  });
  const sources = items.map((e) => e.id);
  if (total === 0) {
    // PRD：没有足够数据时明确说明记录不足，不调用 AI、不编造。
    return { draft: '', sources: [], entryCount: 0, mock: false };
  }

  const cfg = getAiConfig();
  const context = items.map(excerptLine).join('\n\n');
  if (cfg.mock) {
    return {
      draft: `[MOCK] ${input.label}回顾（开发环境模拟）\n\n- 你在这个时间段共记录 ${total} 条记忆\n- 主要主题：海边骑行、秋日散步\n- 心情：兴奋、开心、平静\n\n（这是模拟内容，未调用真实 AI 模型。）`,
      sources,
      entryCount: total,
      mock: true,
    };
  }

  const res = await aiChat(
    [
      {
        role: 'user',
        content: `你是用户的人生回顾助手。以下是 ${input.label}（${input.start} 至 ${input.end}）的真实记录（共 ${total} 条，最多展示 ${items.length} 条）。请写一段温暖、克制的回顾总结（Markdown，200-500 字），只基于这些记录，不要编造记录里没有的事情；如果记录很少，就如实说记录不多。每段可注明出自哪条记录（用其 id）。\n\n记录：\n${context}`,
      },
    ],
    { temperature: 0.5 }
  );
  return { draft: res.text, sources, entryCount: total, mock: res.mock };
}

// ---------- C. AI 人生问答（带来源引用） ----------

export async function askQuestion(
  userId: string,
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<AskResult> {
  // 检索策略：query 直接进 FTS 关键词预筛 + 最近记录兜底（embedding 语义检索留待配置后扩展）
  const byQuery = listEntries(userId, { page: 1, page_size: 20, q: question.slice(0, 100) });
  const recent = listEntries(userId, { page: 1, page_size: 10 });
  const seen = new Set<string>();
  const merged: EntryWithMeta[] = [];
  for (const e of [...byQuery.items, ...recent.items]) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      merged.push(e);
    }
  }

  if (merged.length === 0) {
    return {
      answer: '你还没有记录任何记忆，所以这个问题我暂时无法回答。先去记录一些生活瞬间吧。',
      citations: [],
      mock: false,
    };
  }

  const cfg = getAiConfig();
  const context = merged.map(entryLine).join('\n');
  if (cfg.mock) {
    return {
      answer: `[MOCK] 模拟回答（开发环境）：根据你的 ${merged.length} 条相关记录，关于「${question.slice(0, 60)}」，我找到了一些相关内容。请在真实配置 AI 后获得基于记录的准确回答。`,
      citations: merged.slice(0, 5).map((e) => ({
        id: e.id,
        title: e.title || '（无标题）',
        occurred_at: e.occurred_at.slice(0, 10),
      })),
      mock: true,
    };
  }

  const historyLines = history.slice(-6).map((h) => `${h.role}: ${h.content.slice(0, 500)}`).join('\n');
  const res = await aiChat(
    [
      {
        role: 'user',
        content: `你是用户的私人记忆助手，只能依据下面提供的记录回答。规则：1) 回答要具体并引用记录，在句末用 [[记录id]] 标注来源；2) 如果记录里没有答案，明确说「你的记录里没有相关内容」，绝不编造；3) 不要给出心理诊断或人格结论。\n\n用户记录：\n${context}\n\n${historyLines ? `对话历史：\n${historyLines}\n\n` : ''}用户问题：${question.slice(0, 500)}`,
      },
    ],
    { temperature: 0.3, maxTokens: 1500 }
  );
  const ids = [...res.text.matchAll(/\[\[([0-9a-f-]{36})\]\]/g)].map((m) => m[1]);
  const byId = new Map(merged.map((e) => [e.id, e]));
  const citations: Citation[] = [...new Set(ids)]
    .map((id) => byId.get(id))
    .filter((e): e is EntryWithMeta => Boolean(e))
    .map((e) => ({ id: e.id, title: e.title || '（无标题）', occurred_at: e.occurred_at.slice(0, 10) }));
  const answer = res.text.replace(/\[\[[0-9a-f-]{36}\]\]/g, '');
  return { answer: answer.trim(), citations, mock: res.mock };
}

// ---------- D. AI 年度回顾 ----------

export async function yearlyReview(userId: string, year: number): Promise<YearlyResult> {
  const { items, total } = listEntries(userId, {
    page: 1,
    page_size: 200,
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  });
  if (total === 0) {
    return { keywords: [], events: [], travels: [], photos: [], quotes: [], story: '', entryCount: 0, mock: false };
  }

  const cfg = getAiConfig();
  if (cfg.mock) {
    return {
      keywords: ['海边', '骑行', '秋天'],
      events: ['第一次骑行到海边（模拟）'],
      travels: ['海边骑行（模拟）'],
      photos: [],
      quotes: [`${items[0]?.content.slice(0, 80) ?? ''}（模拟摘录）`],
      story: `[MOCK] ${year} 年，你共记录 ${total} 条记忆（开发环境模拟年度回顾，未调用真实模型）。`,
      entryCount: total,
      mock: true,
    };
  }

  const context = items.map(excerptLine).join('\n\n');
  const { data } = await aiJson<unknown>(
    [
      {
        role: 'user',
        content: `你是用户的年度回顾助手。以下是 ${year} 年的真实记录（共 ${total} 条）。请只输出 JSON：{"keywords": ["3-6个年度关键词"], "events": ["重要事件, 每项一句话"], "travels": ["旅行回忆, 没有则空数组"], "photos": ["值得珍藏的照片描述, 无法可靠获得则空数组"], "quotes": ["用户自己的代表性文字, 必须逐字摘录原文, 最多3条"], "story": "300-600字的年度故事总结"}。只基于记录，不编造；没有的字段给空数组。\n\n记录：\n${context}`,
      },
    ],
    { temperature: 0.6, maxTokens: 3000 }
  );
  const parsed = yearlySchema.safeParse(data);
  if (!parsed.success) throw new AiError('INVALID_RESPONSE', 'AI 年度回顾结果结构不正确');
  return { ...parsed.data, entryCount: total, mock: false };
}

// ---------- E. AI 故事整理 ----------

export interface StoryDraftResult {
  draft: string;
  sources: string[];
  entryCount: number;
  mock: boolean;
}

export async function storyDraft(userId: string, entryIds: string[]): Promise<StoryDraftResult> {
  // 精确取记录（保证排序与权限）
  const items: EntryWithMeta[] = [];
  {
    const all = listEntries(userId, { page: 1, page_size: 500 });
    const byId = new Map(all.items.map((e) => [e.id, e]));
    for (const id of entryIds) {
      const e = byId.get(id);
      if (e) items.push(e);
    }
  }
  if (items.length === 0) {
    return { draft: '', sources: [], entryCount: 0, mock: false };
  }

  const cfg = getAiConfig();
  if (cfg.mock) {
    return {
      draft: `[MOCK] 故事草稿（开发环境模拟）\n\n这是基于 ${items.length} 条关联记录模拟生成的故事正文。请在真实配置 AI 后获得基于记录的故事整理。`,
      sources: items.map((e) => e.id),
      entryCount: items.length,
      mock: true,
    };
  }

  const context = items.map(excerptLine).join('\n\n');
  const res = await aiChat(
    [
      {
        role: 'user',
        content: `你是用户的故事整理助手。以下是这个人生故事关联的 ${items.length} 条真实记录（按时间顺序）。请把它们串成一个连贯、有叙事感的故事正文（Markdown，400-800 字），只基于记录内容，不编造细节；结尾不要写「以上为 AI 生成」之类的话。\n\n记录：\n${context}`,
      },
    ],
    { temperature: 0.7, maxTokens: 2000 }
  );
  return { draft: res.text, sources: items.map((e) => e.id), entryCount: items.length, mock: res.mock };
}
