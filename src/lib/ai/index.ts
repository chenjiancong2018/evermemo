/**
 * V2.0 AI 服务层：OpenAI 兼容 Chat Completions 客户端（fetch 实现，不引 SDK）。
 *
 * 产品原则（PRD）：
 * - AI 只润色/总结/整理，绝不虚构记忆；所有产出走“草稿机制”，用户确认后才可应用。
 * - API Key 只存在于服务端环境变量，绝不下发客户端。
 * - 无可靠来源时必须明确说明，而不是编造。
 * - 无 Key 时不伪造成功：返回 AI_NOT_CONFIGURED。
 * - 开发测试用 AI_MOCK=1 显式开启 mock（响应带 is_mock 标记），与生产隔离。
 */
import { randomUUID } from 'node:crypto';

export interface AiConfig {
  model: string | null;
  /** embedding 模型（语义搜索用），未设置时回退 model */
  embeddingModel: string | null;
  apiBase: string | null;
  hasKey: boolean;
  mock: boolean;
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCallOptions {
  /** 温度（默认 0.4，总结类任务更低更稳定） */
  temperature?: number;
  /** 最大输出 token（默认 2000） */
  maxTokens?: number;
  /** 超时毫秒（默认 30s） */
  timeoutMs?: number;
  /** 要求 JSON 输出（走 response_format json_object，并追加指令） */
  json?: boolean;
}

export class AiError extends Error {
  code: 'NOT_CONFIGURED' | 'TIMEOUT' | 'UPSTREAM' | 'INVALID_RESPONSE' | 'MOCK_DISABLED';
  constructor(code: AiError['code'], message: string) {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}

export function getAiConfig(): AiConfig {
  const model = process.env.AI_MODEL ?? null;
  return {
    model,
    embeddingModel: process.env.AI_EMBEDDING_MODEL ?? model,
    apiBase: process.env.AI_API_BASE ?? null,
    hasKey: Boolean(process.env.AI_API_KEY),
    mock: process.env.AI_MOCK === '1',
  };
}

/** 客户端可见的配置状态（绝不包含 Key） */
export function getAiPublicConfig() {
  const cfg = getAiConfig();
  return {
    configured: Boolean(cfg.model && cfg.apiBase && cfg.hasKey),
    mock: cfg.mock,
    model: cfg.model,
    embeddingModel: cfg.embeddingModel,
    apiBase: cfg.apiBase,
  };
}

export function aiEnabled(): boolean {
  const cfg = getAiConfig();
  if (cfg.mock) return true;
  return Boolean(cfg.model && cfg.apiBase && cfg.hasKey);
}

/** 判断错误类型 */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  return new AiError('UPSTREAM', err instanceof Error ? err.message : 'AI 服务异常');
}

/**
 * 调用 OpenAI 兼容 Chat Completions。
 * mock 模式下返回确定性响应（caller 自己按 json 需求构造），并带 MOCK 前缀标记。
 */
export async function aiChat(
  messages: AiChatMessage[],
  opts: AiCallOptions = {}
): Promise<{ text: string; mock: boolean }> {
  const cfg = getAiConfig();
  if (cfg.mock) {
    // 开发 mock：与生产隔离，响应明确标注 [MOCK]。
    const last = messages[messages.length - 1]?.content ?? '';
    const mockText = `[MOCK] 这是开发环境模拟的 AI 响应，未调用真实模型。你最后说：${last.slice(0, 120)}`;
    return { text: mockText, mock: true };
  }
  if (!cfg.model || !cfg.apiBase || !cfg.hasKey) {
    throw new AiError(
      'NOT_CONFIGURED',
      'AI 尚未配置：请在服务器环境变量中设置 AI_API_BASE 与 AI_API_KEY，或设置 AI_MOCK=1 体验模拟流程'
    );
  }

  const { temperature = 0.4, maxTokens = 2000, timeoutMs = 60000, json = false } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    // 兼容 Qwen 系的思考开关（千问AI平台/DashScope 支持 enable_thinking）。
    // 本产品的任务是整理/回顾/问答，关闭思考更快更省；用 AI_THINKING=on 可恢复。
    if (process.env.AI_THINKING === 'off') body.enable_thinking = false;
    if (json) body.response_format = { type: 'json_object' };

    const res = await fetch(`${cfg.apiBase.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AiError('UPSTREAM', `AI 服务返回 ${res.status}${text ? `：${text.slice(0, 200)}` : ''}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.length === 0) {
      throw new AiError('INVALID_RESPONSE', 'AI 返回内容为空或格式不正确');
    }
    return { text, mock: false };
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiError('TIMEOUT', 'AI 服务响应超时');
    }
    throw new AiError('UPSTREAM', err instanceof Error ? err.message : 'AI 服务异常');
  } finally {
    clearTimeout(timer);
  }
}

/** 要求 JSON 输出并解析（带结构校验，失败抛 INVALID_RESPONSE） */
export async function aiJson<T>(
  messages: AiChatMessage[],
  opts: AiCallOptions = {}
): Promise<{ data: T; mock: boolean }> {
  const sys: AiChatMessage = {
    role: 'system',
    content: '你必须只输出一个合法的 JSON 对象，不要输出任何其他文本或代码块。',
  };
  const res = await aiChat([sys, ...messages], { ...opts, json: true });
  let data: T;
  try {
    data = JSON.parse(res.text) as T;
  } catch {
    throw new AiError('INVALID_RESPONSE', 'AI 返回的 JSON 无法解析');
  }
  return { data, mock: res.mock };
}

export function newId(): string {
  return randomUUID();
}
