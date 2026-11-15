import { z } from 'zod';
import { ENTRY_TYPES, IMPORTANCE_LEVELS, MOODS } from '@/lib/types';

const importanceSchema = z.union([
  z.literal(IMPORTANCE_LEVELS[0]),
  z.literal(IMPORTANCE_LEVELS[1]),
  z.literal(IMPORTANCE_LEVELS[2]),
]);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('邮箱格式不正确')
  .max(254, '邮箱过长');

export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(128, '密码过长');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: z.string().trim().max(40, '昵称最长 40 字').default(''),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码').max(128),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, '请输入当前密码').max(128),
  new_password: passwordSchema,
});

/** 生成/撤销恢复码：需要提供登录口令确认是本人 */
export const vaultPasswordSchema = z.object({
  password: z.string().min(1, '请输入登录密码').max(128),
});

/** 用恢复码找回账号并重设口令 */
export const recoverAccountSchema = z.object({
  email: emailSchema,
  recovery_code: z.string().trim().min(20, '恢复码格式不正确').max(80, '恢复码格式不正确'),
  new_password: passwordSchema,
});

export const profileSchema = z.object({
  display_name: z.string().trim().max(40, '昵称最长 40 字').default(''),
  bio: z.string().trim().max(300, '简介最长 300 字').default(''),
  timezone: z.string().trim().max(64).default('Asia/Shanghai'),
  locale: z.string().trim().max(16).default('zh-CN'),
});

/** 发生时间：YYYY-MM-DD 或 YYYY-MM-DDTHH:mm（用户本地时间，不换算时区） */
const occurredAtSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T(?:[01]\d|2[0-3]):[0-5]\d)?$/, '日期格式不正确');

export const entryCreateSchema = z.object({
  title: z.string().trim().max(200, '标题最长 200 字').default(''),
  content: z.string().max(100_000, '正文过长').default(''),
  entry_type: z.enum(ENTRY_TYPES).default('diary'),
  occurred_at: occurredAtSchema,
  mood: z.enum(MOODS).nullable().default(null),
  tags: z.array(z.string().trim().max(40, '标签最长 40 字')).max(20, '标签最多 20 个').default([]),
  media_ids: z.array(z.string().uuid()).max(50, '附件最多 50 个').default([]),
  people_ids: z.array(z.string().uuid()).max(30, '人物最多 30 个').default([]),
  places_ids: z.array(z.string().uuid()).max(30, '地点最多 30 个').default([]),
  is_favorite: z.boolean().default(false),
  is_important: z.boolean().default(false),
  is_archived: z.boolean().default(false),
});

export const entryUpdateSchema = entryCreateSchema.partial();

export const tagCreateSchema = z.object({
  name: z.string().trim().min(1, '标签名不能为空').max(40),
  color: z.string().trim().max(32).nullable().default(null),
});

export const mediaPatchSchema = z.object({
  caption: z.string().trim().max(500, '说明最长 500 字').default(''),
  is_favorite: z.boolean().optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(30),
  type: z.enum(ENTRY_TYPES).optional(),
  tag: z.string().trim().max(40).optional(),
  mood: z.enum(MOODS).optional(),
  person: z.string().trim().max(100).optional(),
  place: z.string().trim().max(100).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确').optional(),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确').optional(),
  favorite: z.enum(['1']).optional(),
  important: z.enum(['1']).optional(),
  archived: z.enum(['1']).optional(),
  trash: z.enum(['1']).optional(),
  q: z.string().trim().max(200).optional(),
});

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(60),
  tag: z.string().trim().max(40).optional(),
  favorite: z.enum(['1']).optional(),
  entry_id: z.string().uuid().optional(),
  q: z.string().trim().max(200).optional(),
  year: z.string().regex(/^\d{4}$/, '年份格式不正确').optional(),
});

/* ============ V1.5 人生整理系统 ============ */

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确')
  .nullable()
  .optional();

const optionalText = (max: number, msg: string) => z.string().trim().max(max, msg).nullable().optional();

export const personCreateSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(100, '姓名最长 100 字'),
  nickname: z.string().trim().max(100).nullable().optional(),
  avatar_media_id: z.string().uuid().nullable().optional(),
  relationship_type: z.string().trim().max(60, '关系最长 60 字').nullable().optional(),
  description: optionalText(1000, '简介最长 1000 字'),
  first_met_at: dateOnlySchema,
  notes: optionalText(2000, '备注最长 2000 字'),
});

export const personUpdateSchema = personCreateSchema.partial().refine(
  (v) => v.name !== undefined || v.nickname !== undefined || v.relationship_type !== undefined || v.description !== undefined || v.first_met_at !== undefined || v.notes !== undefined || v.avatar_media_id !== undefined,
  { message: '至少提供一个字段' }
);

export const placeCreateSchema = z.object({
  name: z.string().trim().min(1, '地点名称不能为空').max(200, '地点名最长 200 字'),
  country: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  description: optionalText(2000, '描述最长 2000 字'),
  cover_media_id: z.string().uuid().nullable().optional(),
});

export const placeUpdateSchema = placeCreateSchema.partial().refine(
  (v) => v.name !== undefined || v.country !== undefined || v.city !== undefined || v.address !== undefined || v.latitude !== undefined || v.longitude !== undefined || v.description !== undefined || v.cover_media_id !== undefined,
  { message: '至少提供一个字段' }
);

export const milestoneCreateSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(200, '标题最长 200 字'),
  description: optionalText(5000, '描述最长 5000 字'),
  occurred_at: occurredAtSchema,
  cover_media_id: z.string().uuid().nullable().optional(),
  importance: importanceSchema.default(1),
  entry_ids: z.array(z.string().uuid()).max(100).default([]),
  person_ids: z.array(z.string().uuid()).max(50).default([]),
  place_ids: z.array(z.string().uuid()).max(50).default([]),
});

export const milestoneUpdateSchema = milestoneCreateSchema.partial();

export const chapterCreateSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(200, '标题最长 200 字'),
  description: optionalText(2000, '简介最长 2000 字'),
  content: optionalText(100_000, '正文过长'),
  cover_media_id: z.string().uuid().nullable().optional(),
  start_date: dateOnlySchema,
  end_date: dateOnlySchema,
});

export const chapterUpdateSchema = chapterCreateSchema.partial();

export const chapterEntriesSchema = z.object({
  entry_ids: z.array(z.string().uuid()).max(200),
});

export const archiveListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(60),
  q: z.string().trim().max(200).optional(),
});

/* ============ V3.0 记忆胶囊 ============ */

export const capsuleCreateSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(100, '标题过长'),
  content: z.string().trim().min(1, '正文不能为空').max(20000, '正文过长'),
  open_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '开启日期格式不正确')
    .refine((d) => d > new Date().toISOString().slice(0, 10), '开启日期必须是未来日期'),
  media_ids: z.array(z.string().uuid()).max(9, '最多附带 9 张照片').optional(),
});

export const capsuleUpdateSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(100, '标题过长').optional(),
  content: z.string().trim().min(1, '正文不能为空').max(20000, '正文过长').optional(),
  open_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '开启日期格式不正确')
    .refine((d) => d > new Date().toISOString().slice(0, 10), '开启日期必须是未来日期')
    .optional(),
  media_ids: z.array(z.string().uuid()).max(9, '最多附带 9 张照片').optional(),
});

export const capsuleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['locked', 'opened', 'all']).optional(),
});

/* ============ V2.0 AI 助手 ============ */

const dateOnlyRequired = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确');

export const aiOrganizeSchema = z.object({
  content: z.string().trim().min(1, '内容不能为空').max(20000, '内容过长'),
});

export const aiReviewSchema = z.object({
  start: dateOnlyRequired,
  end: dateOnlyRequired,
  label: z.string().trim().min(1).max(100).optional(),
});

export const aiAskSchema = z.object({
  question: z.string().trim().min(1, '问题不能为空').max(500, '问题最长 500 字'),
});

export const aiYearlySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
});

export const aiStorySchema = z.object({
  entry_ids: z.array(z.string().uuid()).min(1).max(200),
});

export const aiSemanticSearchSchema = z.object({
  query: z.string().trim().min(1).max(200),
});

export const aiDraftPatchSchema = z.object({
  status: z.enum(['pending', 'applied', 'discarded']),
});
