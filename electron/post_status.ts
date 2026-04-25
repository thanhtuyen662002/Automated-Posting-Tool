export const POST_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  SCHEDULED: 'scheduled',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  FAILED: 'failed'
} as const

export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS]

const LEGACY_STATUS_MAP: Record<string, PostStatus> = {
  pending: POST_STATUS.DRAFT,
  completed: POST_STATUS.PUBLISHED,
  'in-progress': POST_STATUS.PROCESSING
}

export function normalizePostStatus(status?: string): PostStatus {
  if (!status) return POST_STATUS.DRAFT
  if (Object.values(POST_STATUS).includes(status as PostStatus)) {
    return status as PostStatus
  }
  return LEGACY_STATUS_MAP[status] || POST_STATUS.FAILED
}
