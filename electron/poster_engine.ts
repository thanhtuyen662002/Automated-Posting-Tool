import { dbService, Page, Post } from './db'
import { AutomationService } from './automation_service'

export class PosterEngine {
    private isRunning = false;
    private interval: NodeJS.Timeout | null = null;
    private logCallback: (msg: string) => void;
    private onFrame: (jobId: number, frame: string) => void;
    private activeJobs = new Set<number>();
    private healthInterval: NodeJS.Timeout | null = null;

    constructor(logCallback: (msg: string) => void, onFrame: (jobId: number, frame: string) => void) {
        this.logCallback = logCallback;
        this.onFrame = onFrame;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
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
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.interval) clearInterval(this.interval)
        if (this.healthInterval) clearInterval(this.healthInterval)
        this.interval = null;
        this.healthInterval = null;
        this.logCallback('[SYSTEM] Đã tắt bộ máy vận hành Robot.')
    }

    async checkAndPost() {
        if (!this.isRunning) return;

        try {
            // Get max concurrency from settings
            const record = dbService.getSetting('robot_max_concurrency') as any
            const maxConcurrency = record ? parseInt(record.encrypted_value) || 3 : 3

            if (this.activeJobs.size >= maxConcurrency) return;

            const now = new Date().toISOString()
            const posts = dbService.getPosts()
            const duePosts = posts.filter(p => p.status === 'scheduled' && (p.scheduled_at as any) <= now)

            if (duePosts.length === 0) return;

            const availableSlots = maxConcurrency - this.activeJobs.size
            const postsToRun = duePosts.slice(0, availableSlots)

            for (const post of postsToRun) {
                if (!this.isRunning) break;
                if (this.activeJobs.has(post.id)) continue;

                // Run task asynchronously
                this.runTask(post)
            }
        } catch (error: any) {
            console.error('[Poster Engine] Critical Error:', error)
        }
    }

    private async runTask(post: Post) {
        this.activeJobs.add(post.id)
        dbService.updatePostStatus(post.id, 'processing')
        
        try {
            await AutomationService.runPostingTask(
                post.id, 
                (msg) => this.logCallback(msg),
                (jobId, frame) => {
                    if (this.isRunning) this.onFrame(jobId, frame)
                }
            )
            // Notify frontend that job is finished to remove from UI
            this.onFrame(post.id, 'FINISHED') 
        } catch (err: any) {
            console.error(`[Poster Engine] Error in task #${post.id}:`, err)
            this.logCallback(`[SYSTEM-ERROR] Lỗi thực thi bài #${post.id}: ${err.message}`)
        } finally {
            this.activeJobs.delete(post.id)
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

    getStatus() {
        return this.isRunning
    }
}
