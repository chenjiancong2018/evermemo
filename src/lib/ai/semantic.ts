/**
 * V2.0 语义搜索：优先用向量相似度（OpenAI 兼容 /embeddings），
 * 未配置 AI 或调用失败时降级为关键词搜索并如实标注 mode。
 */
import { getAiConfig, toAiError } from './index';
import { listEntries } from '@/lib/db/entries';
import type { EntryWithMeta } from '@/lib/types';

export interface SemanticHit {
  entry: EntryWithMeta;
  score: number;
}

export interface SemanticSearchResult {
  mode: 'vector' | 'keyword' | 'mock';
  hits: SemanticHit[];
  note?: string;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embed(texts: string[]): Promise<number[][]> {
  const cfg = getAiConfig();
  if (cfg.mock) {
    // mock：用字符重叠度伪造向量（仅供开发 UI 流程）
    return texts.map((t) => {
      const v = new Array<number>(64).fill(0);
      for (const ch of t) v[ch.charCodeAt(0) % 64] += 1;
      return v;
    });
  }
  const res = await fetch(`${cfg.apiBase}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({ model: cfg.embeddingModel ?? cfg.model, input: texts }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`embeddings upstream ${res.status}`);
  }
  const json = await res.json();
  const data = json?.data as { embedding: number[] }[] | undefined;
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error('embeddings response shape invalid');
  }
  return data.map((d) => d.embedding);
}

export async function semanticSearch(userId: string, query: string): Promise<SemanticSearchResult> {
  const cfg = getAiConfig();
  const pool = listEntries(userId, { page: 1, page_size: 100 }).items;
  if (pool.length === 0) {
    return { mode: cfg.mock ? 'mock' : 'keyword', hits: [], note: '你还没有任何记录，先去记下一些生活片段吧。' };
  }

  if (cfg.mock) {
    const hits = pool
      .map((entry) => ({
        entry,
        score: entry.content.includes(query.slice(0, 4)) || entry.title.includes(query.slice(0, 4)) ? 0.9 : 0.1,
      }))
      .filter((h) => h.score > 0.5)
      .slice(0, 10);
    return {
      mode: 'mock',
      hits,
      note: hits.length ? undefined : '（模拟模式）没有找到语义相近的记录，仅展示关键词匹配结果。',
    };
  }

  if (!cfg.hasKey) {
    const kw = listEntries(userId, { page: 1, page_size: 10, q: query });
    return {
      mode: 'keyword',
      hits: kw.items.map((entry) => ({ entry, score: 1 })),
      note: kw.total === 0 ? '没有找到相关记录（当前为关键词搜索，配置 AI 后可用语义搜索）。' : '当前未配置 AI，使用关键词搜索。',
    };
  }

  // 向量模式：embedding 查询词 + 候选记录（截断），余弦相似度排序
  try {
    const contents = pool.map((e) => `${e.title} ${e.content}`.slice(0, 500));
    const [qvec, ...evecs] = await embed([query.slice(0, 500), ...contents]);
    const scored = pool
      .map((entry, i) => ({ entry, score: cosine(qvec, evecs[i]) }))
      .filter((h) => h.score >= 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    return {
      mode: 'vector',
      hits: scored,
      note: scored.length ? undefined : '没有找到语义相近的记录，你可以在记录里搜索更具体的关键词。',
    };
  } catch (err) {
    const kw = listEntries(userId, { page: 1, page_size: 10, q: query });
    return {
      mode: 'keyword',
      hits: kw.items.map((entry) => ({ entry, score: 1 })),
      note: `语义搜索暂时不可用（${toAiError(err).message}），已改用关键词搜索。`,
    };
  }
}
