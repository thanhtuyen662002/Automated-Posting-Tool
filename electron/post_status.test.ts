import { describe, expect, it } from 'vitest'
import { normalizePostStatus, POST_STATUS } from './post_status'

describe('post status normalization', () => {
  it('maps legacy statuses to unified statuses', () => {
    expect(normalizePostStatus('pending')).toBe(POST_STATUS.DRAFT)
    expect(normalizePostStatus('in-progress')).toBe(POST_STATUS.PROCESSING)
    expect(normalizePostStatus('completed')).toBe(POST_STATUS.PUBLISHED)
  })

  it('keeps canonical statuses unchanged', () => {
    expect(normalizePostStatus('approved')).toBe(POST_STATUS.APPROVED)
    expect(normalizePostStatus('scheduled')).toBe(POST_STATUS.SCHEDULED)
  })

  it('defaults invalid statuses to failed', () => {
    expect(normalizePostStatus('unknown-state')).toBe(POST_STATUS.FAILED)
    expect(normalizePostStatus()).toBe(POST_STATUS.DRAFT)
  })
})
