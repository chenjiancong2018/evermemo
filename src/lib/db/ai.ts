/** V2.0 AI 草稿与问答消息数据层（与原始记录严格分离） */
import { getDb } from './index';
import { newId } from '@/lib/ai';

export type DraftKind = 'organize' | 'review' | 'ask' | 'yearly' | 'story';
export type DraftStatus = 'pending' | 'applied' | 'discarded';

export interface AiDraftRow {
  id: string;
  user_id: string;
  kind: DraftKind;
  title: string;
  content: string;
  meta: string; // JSON
  source_entry_ids: string; // JSON 字符串数组
  status: DraftStatus;
  is_mock: number;
  created_at: string;
  applied_at: string | null;
}

export interface AiMessageRow {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: string; // JSON
  is_mock: number;
  created_at: string;
}

export interface DraftInput {
  kind: DraftKind;
  title?: string;
  content: string;
  meta?: unknown;
  sourceEntryIds?: string[];
  isMock?: boolean;
}

export function createDraft(userId: string, input: DraftInput): AiDraftRow {
  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO ai_drafts (id, user_id, kind, title, content, meta, source_entry_ids, status, is_mock)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    id,
    userId,
    input.kind,
    input.title ?? '',
    input.content,
    JSON.stringify(input.meta ?? {}),
    JSON.stringify(input.sourceEntryIds ?? []),
    input.isMock ? 1 : 0
  );
  return getDraft(userId, id)!;
}

export function getDraft(userId: string, id: string): AiDraftRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM ai_drafts WHERE id = ? AND user_id = ?').get(id, userId) as
    | AiDraftRow
    | undefined;
  return row ?? null;
}

export function listDrafts(userId: string, kind?: DraftKind, limit = 50): AiDraftRow[] {
  const db = getDb();
  if (kind) {
    return db
      .prepare('SELECT * FROM ai_drafts WHERE user_id = ? AND kind = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, kind, limit) as AiDraftRow[];
  }
  return db
    .prepare('SELECT * FROM ai_drafts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as AiDraftRow[];
}

export function updateDraftStatus(userId: string, id: string, status: DraftStatus): boolean {
  const db = getDb();
  const appliedAt = status === 'applied' ? new Date().toISOString() : null;
  const res = db
    .prepare('UPDATE ai_drafts SET status = ?, applied_at = ? WHERE id = ? AND user_id = ?')
    .run(status, appliedAt, id, userId);
  return res.changes > 0;
}

export function updateDraftContent(userId: string, id: string, content: string): boolean {
  const db = getDb();
  const res = db.prepare('UPDATE ai_drafts SET content = ? WHERE id = ? AND user_id = ?').run(content, id, userId);
  return res.changes > 0;
}

export function deleteDraft(userId: string, id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM ai_drafts WHERE id = ? AND user_id = ?').run(id, userId);
  return res.changes > 0;
}

export interface MessageInput {
  role: 'user' | 'assistant';
  content: string;
  citations?: { id: string; title: string; occurred_at: string }[];
  isMock?: boolean;
}

export function addMessage(userId: string, input: MessageInput): AiMessageRow {
  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO ai_messages (id, user_id, role, content, citations, is_mock) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, input.role, input.content, JSON.stringify(input.citations ?? []), input.isMock ? 1 : 0);
  return db.prepare('SELECT * FROM ai_messages WHERE id = ?').get(id) as AiMessageRow;
}

export function listMessages(userId: string, limit = 100): AiMessageRow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM ai_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?')
    .all(userId, limit) as AiMessageRow[];
}

export function clearMessages(userId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM ai_messages WHERE user_id = ?').run(userId);
}
