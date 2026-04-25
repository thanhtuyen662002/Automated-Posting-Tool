import { dbService, Page, Post } from './db'
import { AutomationService } from './automation_service'
import { POST_STATUS } from './post_status'

export class PosterEngine {
    private isRunning = false;
    private interval: NodeJS.Timeout | null = null;
    private logCallback: (msg: string) => void;
    private onFrame: (jobId: number, frame: string) => void;
    private activeAccounts = new Set<number>();
    private healthInterval: NodeJS.Timeout | null = null;
    private discoveryInterval: NodeJS.Timeout | null = null;
    private commentInterval: NodeJS.Timeout | null = null;

    constructor(logCallback: (msg: string) => void, onFrame: (jobId: number, frame: string) => void) {
        this.logCallback = logCallback;
        this.onFrame = onFrame;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        // Recover posts stuck in processing after crashes/restarts.
        const recovered = dbService.markStuckPostsFailed(30)
        if (recovered.changes > 0) {
            this.logCallback(`[SYSTEM] Đã phục hồi ${recovered.changes} bài bị treo và chuyển sang failed.`)
        }
        this.logCallback('[SYSTEM] Đã bật bộ máy vận hành Robot.')
        
        // Initial check
        this.checkAndPost()

        // Schedule periodic check
        this.interval = setInterval(() => {
            this.checkAndPost()
        }, 15000) // Every 15 seconds for faster response
        
        this.logCallback('[SYSTEM] Chu kỳ quét sức khỏe tài khoản tự động (30 phút) đã được kích hoạt.')
        this.healthInterval = setInterval(() => {
            this.checkAllHealth()
        }, 1800000)

        // Link Discovery Cycle (Every 10 mins)
        this.discoveryInterval = setInterval(() => {
            this.runLinkDiscoveryCycle()
        }, 600000)

        // Comment Cycle (Every 5 mins)
        this.commentInterval = setInterval(() => {
            this.runCommentCycle()
        }, 300000)    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.interval) clearInterval(this.interval)
        if (this.healthInterval) clearInterval(this.healthInterval)
        if (this.discoveryInterval) clearInterval(this.discoveryInterval)
        if (this.commentInterval) clearInterval(this.commentInterval)
        this.interval = null;
        this.healthInterval = null;
        this.discoveryInterval = null;
        this.commentInterval = null;
        this.logCallback('[SYSTEM] Đã tắt bộ máy vận hành Robot.')
    }

    async checkAndPost() {
        if (!this.isRunning) return;

        try {
            // Get max concurrency from settings (now means max browsers/accounts at once)
            const record = dbService.getSetting('robot_max_concurrency') as any
            const maxConcurrency = record ? parseInt(record.encrypted_value) || 3 : 3

            if (this.activeAccounts.size >= maxConcurrency) return;

            const now = new Date().toISOString()
            const duePosts = dbService.getDueScheduledPosts(now)

            if (duePosts.length === 0) return;

            // Group due posts by Account ID
            const pages = dbService.getPages()
            const postGroupsByAccount: Record<number, number[]> = {}

            for (const post of duePosts) {
                const page = pages.find(pg => pg.id === post.page_id)
                if (page && page.account_id) {
                    if (!postGroupsByAccount[page.account_id]) {
                        postGroupsByAccount[page.account_id] = []
                    }
                    postGroupsByAccount[page.account_id].push(post.id)
                }
            }

            const accountIdsToRun = Object.keys(postGroupsByAccount).map(Number)
            
            for (const accountId of accountIdsToRun) {
                if (!this.isRunning) break;
                if (this.activeAccounts.size >= maxConcurrency) break;
                if (this.activeAccounts.has(accountId)) continue;

                const postIds = postGroupsByAccount[accountId]
                // Run task asynchronously for this account
                this.runAccountSession(accountId, postIds)
            }
        } catch (error: any) {
            console.error('[Poster Engine] Critical Error:', error)
        }
    }

    private async runAccountSession(accountId: number, postIds: number[]) {
        this.activeAccounts.add(accountId)
        
        // Mark all posts as processing to prevent other checks from picking them up
        for (const id of postIds) {
            dbService.updatePostStatus(id, POST_STATUS.PROCESSING)
        }
        
        try {
            this.logCallback(`[SYSTEM] Bắt đầu phiên làm việc cho Tài khoản #${accountId} (${postIds.length} bài đăng).`)
            
            await AutomationService.runAccountPostingSession(
                accountId,
                postIds,
                (msg) => this.logCallback(msg),
                (jobId, frame) => {
                    if (this.isRunning) this.onFrame(jobId, frame)
                }
            )

            for (const id of postIds) {
                this.onFrame(id, 'FINISHED')
            }
        } catch (err: any) {
            console.error(`[Poster Engine] Error in account session #${accountId}:`, err)
            this.logCallback(`[SYSTEM-ERROR] Lỗi phiên làm việc Tài khoản #${accountId}: ${err.message}`)
        } finally {
            this.activeAccounts.delete(accountId)
            // Trigger next check immediately if space is available
            this.checkAndPost()
        }
    }

    async checkAllHealth() {
        if (!this.isRunning) return;
        this.logCallback('[SYSTEM] Bắt đầu chu kỳ quét sức khỏe tài khoản định kỳ...')
        const pages = dbService.getPages()
        for (const page of pages) {
            if (!this.isRunning) break;
            await AutomationService.checkPageHealth(page.id, (msg) => this.logCallback(msg))
        }
    }

    async runLinkDiscoveryCycle() {
        if (!this.isRunning) return;
        
        const pendingLinkPosts = dbService.getPostsMissingLink()
        if (pendingLinkPosts.length === 0) return;

        this.logCallback(`[SYSTEM] Phát hiện ${pendingLinkPosts.length} bài viết cần săn link. Đang bắt đầu luồng tìm kiếm...`)
        
        // Group by account to avoid multiple browsers for same profile
        const accounts = dbService.getAccounts()
        const pages = dbService.getPages()
        const groups: Record<number, number[]> = {}

        for (const p of pendingLinkPosts) {
            const page = pages.find(pg => pg.id === p.page_id)
            if (page && page.account_id) {
                if (!groups[page.account_id]) groups[page.account_id] = []
                groups[page.account_id].push(p.id)
            }
        }

        for (const accountId of Object.keys(groups).map(Number)) {
            if (!this.isRunning) break;
            // Run discovery session
            AutomationService.discoverPostLink(
                accountId, 
                groups[accountId], 
                (msg) => this.logCallback(msg),
                (jobId, frame) => {
                    if (this.isRunning) this.onFrame(jobId, frame)
                }
            ).catch(err => console.error(`[Discovery Error] Acc #${accountId}:`, err))
        }
    }

    async runCommentCycle() {
        if (!this.isRunning) return;

        const pendingCommentPosts = dbService.getPostsPendingComment()
        if (pendingCommentPosts.length === 0) return;

        this.logCallback(`[SYSTEM] Phát hiện ${pendingCommentPosts.length} bài viết đang chờ bình luận CTA. Đang bắt đầu luồng bình luận...`)

        // Group by account
        const pages = dbService.getPages()
        const groups: Record<number, number[]> = {}

        for (const p of pendingCommentPosts) {
            const page = pages.find(pg => pg.id === p.page_id)
            if (page && page.account_id) {
                if (!groups[page.account_id]) groups[page.account_id] = []
                groups[page.account_id].push(p.id)
            }
        }

        for (const accountId of Object.keys(groups).map(Number)) {
            if (!this.isRunning) break;
            // Run comment session
            AutomationService.postCommentByUrl(
                accountId, 
                groups[accountId], 
                (msg) => this.logCallback(msg),
                (jobId, frame) => {
                    if (this.isRunning) this.onFrame(jobId, frame)
                }
            ).catch(err => console.error(`[Comment Error] Acc #${accountId}:`, err))
        }
    }

    getStatus() {
        return this.isRunning
    }
}
