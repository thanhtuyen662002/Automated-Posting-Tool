import { chromium } from 'playwright'
import { dbService, Page, Post } from './db'
import { app } from 'electron'
import path from 'node:path'
import { BrowserLauncher } from './browser_launcher'
import { ProxyManager } from './proxy_manager'
import { PlatformFactory } from './platform_factory'
import { WatermarkService } from './watermark_service'
import { POST_STATUS } from './post_status'

export class AutomationService {
    private static createTraceId(postId: number) {
        return `post-${postId}-${Date.now().toString(36)}`
    }
    private static isTransientError(error: any): boolean {
        const msg = String(error?.message || '').toLowerCase()
        return ['timeout', 'network', 'target closed', 'detached', 'navigation', '503', '429'].some(token => msg.includes(token))
    }
    /**
     * Executes the posting script for a specific platform.
     * Enhanced with Multi-Browser Support and Platform Factory pattern.
     */
    static async runPostingTask(postId: number, logger: (msg: string) => void, onFrame?: (jobId: number, frame: string) => void) {
        // Find account associated with this post's page
        const post = dbService.getPostById(postId)
        if (!post) throw new Error('Không tìm thấy bài viết')

        const pages = dbService.getPages()
        const page = pages.find(p => p.id === post.page_id)
        if (!page || !page.account_id) throw new Error('Không tìm thấy trang đích hoặc tài khoản chủ quản')

        return this.runAccountPostingSession(page.account_id, [postId], logger, onFrame)
    }

    /**
     * Executes multiple posts for a single account in one browser session.
     */
    static async runAccountPostingSession(accountId: number, postIds: number[], logger: (msg: string) => void, onFrame?: (jobId: number, frame: string) => void) {
        const accounts = dbService.getAccounts()
        const account = accounts.find(a => a.id === accountId)
        if (!account) throw new Error('Không tìm thấy tài khoản')

        const pages = dbService.getPages()
        const posts = dbService.getPostsByIds(postIds)

        logger(`[${account.platform}] Bắt đầu phiên làm việc cho Tài khoản: ${account.account_name} (${postIds.length} bài)`)
        
        const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
        const userDataDir = account.profile_dir || path.join(rootPath, 'browser_profiles', `acc_${account.id}`)

        // Resolve IP
        const resolvedProxy = await ProxyManager.getResolvedProxy(account as any)

        const platformConfig = BrowserLauncher.getPlatformConfig(account.platform)
        
        // --- DYNAMIC BROWSER MODE ---
        // Nếu là Facebook và có ít nhất một bài đăng là Video, dùng Desktop Mode để hỗ trợ upload video lớn
        let isMobile = platformConfig.isMobile
        let viewport = platformConfig.viewport

        if (account.platform === 'Facebook') {
            const hasVideo = posts.some(p => postIds.includes(p.id) && p.media_path && p.media_path.toLowerCase().match(/\.(mp4|mov|avi|wmv)$/))
            if (hasVideo) {
                logger('[SYSTEM] Phát hiện Video: Tạm thời chuyển sang chế độ Desktop để hỗ trợ upload Video lớn...')
                isMobile = false
                viewport = { width: 1280, height: 800 }
            }
        }
        // ----------------------------

        // Fetch headless configuration
        const headlessRecord = dbService.getSetting('robot_headless_mode') as any
        let isHeadless = true // default
        if (headlessRecord && headlessRecord.encrypted_value) {
            // Note: Since we don't encrypt boolean settings strictly in the UI, we just check the value
            // Actually, in automation_engine and here, we should try decrypt first
            try {
                const decrypted = require('./crypto_utils').decrypt(headlessRecord.encrypted_value)
                isHeadless = decrypted !== 'false'
            } catch {
                isHeadless = headlessRecord.encrypted_value !== 'false'
            }
        }

        const context = await BrowserLauncher.launchWithFallback({
            userDataDir,
            headless: isHeadless,
            isMobile: isMobile,
            viewport: viewport,
            platform: account.platform,
            proxy: resolvedProxy
        })

        try {
            const browserPage = context.pages().length > 0 ? context.pages()[0] : await context.newPage()
            const handler = PlatformFactory.getHandler(account.platform)

            if (!handler) {
                throw new Error(`Nền tảng ${account.platform} chưa được hỗ trợ.`)
            }

            for (const postId of postIds) {
                const post = posts.find(p => p.id === postId)
                if (!post) continue

                const page = pages.find(pg => pg.id === post.page_id)
                if (!page) {
                    logger(`[ERROR] Không tìm thấy trang cho bài #${postId}. Bỏ qua.`)
                    continue
                }

                const traceId = this.createTraceId(postId)
                logger(`[TRACE:${traceId}] [PROCESS] Đang xử lý bài #${postId} cho Page: ${page.page_name}`)
                
                // --- Watermark Logic ---
                let processedPost = { ...post }
                if (processedPost.media_path && processedPost.media_path.toLowerCase().endsWith('.mp4')) {
                    try {
                        const project = dbService.getProjects().find(p => p.id === post.project_id) as any
                        if (project && project.watermark_config) {
                            const wmConfig = typeof project.watermark_config === 'string' ? JSON.parse(project.watermark_config) : project.watermark_config
                            if (wmConfig && wmConfig.enabled !== false) {
                                logger(`[PROCESS] Đang chèn Watermark cho video của ${page.page_name}...`)
                                const watermarkedPath = await WatermarkService.applyWatermark(post.media_path, page.id, wmConfig)
                                processedPost.media_path = watermarkedPath
                                logger(`[SUCCESS] Đã tạo video Branding: ${path.basename(watermarkedPath)}`)
                            }
                        }
                    } catch (wmError: any) {
                        logger(`[WARNING] Lỗi chèn Watermark: ${wmError.message}. Tiến hành đăng video gốc.`)
                    }
                }
                // -----------------------

                // CDP SCREENCASTING update per post
                if (onFrame) {
                    const client = await browserPage.context().newCDPSession(browserPage)
                    await client.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 360, maxHeight: 740 })
                    client.on('Page.screencastFrame', (event) => {
                        onFrame(postId, event.data)
                        client.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
                    })
                }

                try {
                    // Logic Switch Page nếu cần
                    if (handler.switchPage) {
                        await handler.switchPage(browserPage, page.page_url, logger)
                    }

                    const idempotencyKey = dbService.buildPostIdempotencyKey({
                        page_id: processedPost.page_id,
                        media_path: processedPost.media_path,
                        scheduled_at: processedPost.scheduled_at,
                        title: processedPost.title
                    })
                    if (dbService.hasIdempotencyConflict(idempotencyKey, postId)) {
                        logger(`[TRACE:${traceId}] [SKIP] Bỏ qua bài #${postId} do trùng idempotency key.`)
                        continue
                    }
                    let lastError: any = null
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await handler.postToPlatform(browserPage, processedPost, logger)
                            if (processedPost.comment_cta && handler.postCommentCTA) {
                                try {
                                    await handler.postCommentCTA(browserPage, processedPost.comment_cta, logger)
                                    dbService.updatePost(postId, { comment_status: 'completed' })
                                } catch (ctaError: any) {
                                    logger(`[WARNING] Comment ngay sau khi đăng thất bại: ${ctaError.message}. Sẽ thử lại ở luồng săn link.`)
                                    dbService.updatePost(postId, { comment_status: 'pending' })
                                }
                            }
                            dbService.updatePostStatus(postId, POST_STATUS.PUBLISHED)
                            logger(`[TRACE:${traceId}] [SUCCESS] Đã đăng bài #${postId} thành công (attempt ${attempt}).`)
                            lastError = null
                            break
                        } catch (postError: any) {
                            lastError = postError
                            const transient = this.isTransientError(postError)
                            logger(`[TRACE:${traceId}] [ERROR] Bài #${postId} lỗi attempt ${attempt}: ${postError.message}`)
                            if (!transient || attempt === 3) {
                                break
                            }
                            await browserPage.waitForTimeout(1500 * attempt)
                        }
                    }
                    if (lastError) {
                        dbService.updatePostStatus(postId, POST_STATUS.FAILED, lastError.message)
                    }
                } catch (postError: any) {
                    dbService.updatePostStatus(postId, POST_STATUS.FAILED, postError.message)
                    logger(`[TRACE:${traceId}] [ERROR] Bài #${postId} thất bại: ${postError.message}`)
                }

                // Chờ một chút giữa các Page để tránh bị quét
                if (postIds.indexOf(postId) < postIds.length - 1) {
                    const delay = 5000 + Math.random() * 5000
                    logger(`[SYSTEM] Nghỉ ${Math.round(delay/1000)} giây trước khi sang Page tiếp theo...`)
                    await browserPage.waitForTimeout(delay)
                }
            }

            return { success: true }
        } catch (error: any) {
            logger(`[CRITICAL-ERROR] Lỗi phiên: ${error.message}`)
            throw error
        } finally {
            await context.close()
        }
    }

    /**
     * Checks the login status of a page without showing the browser.
     */
    static async checkPageHealth(pageId: number, logger?: (msg: string) => void) {
        const pages = dbService.getPages()
        const pageData = pages.find(p => p.id === pageId)
        if (!pageData || !pageData.account_id) return { success: false, error: 'Page context missing' }

        const accounts = dbService.getAccounts()
        const account = accounts.find(a => a.id === pageData.account_id)
        if (!account) return { success: false, error: 'Account not found' }

        if (logger) logger(`[HEALTH-CHECK] Đang kiểm tra: ${pageData.page_name} thuộc Tài khoản ${account.account_name}...`)

        if (!account.profile_dir && !account.id) {
            if (logger) logger(`[HEALTH-CHECK-SKIP] Tài khoản ${account.account_name} chưa có Profile.`)
            return { success: false, error: 'Profile directory is missing' }
        }

        const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
        const userDataDir = account.profile_dir || path.join(rootPath, 'browser_profiles', `acc_${account.id}`)

        if (account.is_logged_in === 0) {
            if (logger) logger(`[HEALTH-CHECK-SKIP] Tài khoản ${account.account_name} chưa được đăng nhập lần đầu.`)
            return { success: true, status: 0 }
        }

        // Sử dụng BrowserLauncher với headless mode
        const platformConfig = BrowserLauncher.getPlatformConfig(account.platform)
        
        // Resolve IP tự động
        const resolvedProxy = await ProxyManager.getResolvedProxy(account as any)

        const context = await BrowserLauncher.launchWithFallback({
            userDataDir,
            headless: true,
            isMobile: platformConfig.isMobile,
            viewport: platformConfig.viewport,
            platform: account.platform,
            proxy: resolvedProxy
        })

        try {
            const browserPage = await context.newPage()
            let isOk = false

            if (account.platform === 'Facebook') {
                await browserPage.goto('https://www.facebook.com', { waitUntil: 'networkidle', timeout: 30000 })
                const url = browserPage.url()
                
                const isLoggedInElement = await browserPage.$('text="Bạn đang nghĩ gì thế?"') || await browserPage.$('[aria-label="Facebook"]')
                
                if (!url.includes('login') && !url.includes('checkpoint') && isLoggedInElement) {
                    isOk = true
                }
            } else {
                // Fallback for other platforms
                isOk = account.is_logged_in === 1
            }

            const newStatus = isOk ? 1 : 2
            dbService.updateAccountLoginStatus(account.id, newStatus)
            
            if (logger) logger(`[HEALTH-CHECK] Kết quả: ${isOk ? 'Sẵn sàng' : 'Cần đăng nhập lại'}`)
            return { success: true, status: newStatus }
        } catch (error: any) {
            if (logger) logger(`[HEALTH-CHECK-ERROR] ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            await context.close()
        }
    }

    /**
     * Syncs page information (handle, avatar) from the platform.
     */
    static async syncPageInfo(pageId: number, logger: (msg: string) => void) {
        const pages = dbService.getPages()
        const pageData = pages.find(p => p.id === pageId)
        if (!pageData || !pageData.account_id) throw new Error('Không tìm thấy dữ liệu trang hoặc tài khoản')

        const accounts = dbService.getAccounts()
        const account = accounts.find(a => a.id === pageData.account_id)
        if (!account) throw new Error('Không tìm thấy tài khoản')

        const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
        const userDataDir = account.profile_dir || path.join(rootPath, 'browser_profiles', `acc_${account.id}`)

        const platformConfig = BrowserLauncher.getPlatformConfig(account.platform)
        const resolvedProxy = await ProxyManager.getResolvedProxy(account as any)

        const context = await BrowserLauncher.launchWithFallback({
            userDataDir,
            headless: false, // Show browser for better debugging and reliable sync
            isMobile: platformConfig.isMobile,
            viewport: platformConfig.viewport,
            platform: account.platform,
            proxy: resolvedProxy
        })

        try {
            const browserPage = await context.newPage()
            const handler = PlatformFactory.getHandler(account.platform)
            
            if (!handler || !handler.syncPageInfo) {
                throw new Error(`Nền tảng ${account.platform} không hỗ trợ đồng bộ thông tin.`)
            }

            // Navigate to page URL
            await browserPage.goto(pageData.page_url, { waitUntil: 'networkidle', timeout: 60000 })
            
            const info = await handler.syncPageInfo(browserPage, logger, pageData)
            
            // Update DB
            dbService.updatePage(pageId, {
                ...pageData,
                page_name: info.pageName || pageData.page_name,
                handle: info.handle || pageData.handle,
                avatar_url: info.avatarUrl || pageData.avatar_url
            })

            logger(`[SUCCESS] Đã đồng bộ thông tin thành công: ${info.handle || 'N/A'}`)
            return { success: true, info }
        } catch (error: any) {
            logger(`[ERROR] Đồng bộ thất bại: ${error.message}`)
            throw error
        } finally {
            await context.close()
        }
    }
    /**
     * Finds the URL of a published post.
     */
    static async discoverPostLink(accountId: number, postIds: number[], logger: (msg: string) => void, onFrame?: (jobId: number, frame: string) => void) {
        const accounts = dbService.getAccounts()
        const account = accounts.find(a => a.id === accountId)
        if (!account) throw new Error('Không tìm thấy tài khoản')

        const posts = dbService.getPostsByIds(postIds)
        const pages = dbService.getPages()

        const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
        const userDataDir = account.profile_dir || path.join(rootPath, 'browser_profiles', `acc_${account.id}`)
        const resolvedProxy = await ProxyManager.getResolvedProxy(account as any)

        const context = await BrowserLauncher.launchWithFallback({
            userDataDir,
            headless: true,
            isMobile: true, // Use mobile for faster discovery
            viewport: { width: 390, height: 844 },
            platform: account.platform,
            proxy: resolvedProxy
        })

        try {
            const browserPage = await context.newPage()
            const handler = PlatformFactory.getHandler(account.platform)

            if (!handler || !(handler as any).findPostLink) {
                throw new Error(`Nền tảng ${account.platform} không hỗ trợ săn link.`)
            }

            for (const postId of postIds) {
                const post = posts.find(p => p.id === postId)
                if (!post) continue

                const page = pages.find(pg => pg.id === post.page_id)
                if (!page) continue

                // CDP SCREENCASTING
                if (onFrame) {
                    const client = await browserPage.context().newCDPSession(browserPage)
                    await client.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 360, maxHeight: 740 })
                    client.on('Page.screencastFrame', (event) => {
                        onFrame(postId, event.data)
                        client.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
                    })
                }

                try {
                    const postUrl = await (handler as any).findPostLink(browserPage, post, logger)
                    if (postUrl) {
                        dbService.updatePost(postId, { post_url: postUrl })
                        logger(`[SUCCESS] Đã săn được link bài #${postId}: ${postUrl}`)
                    }
                } catch (e: any) {
                    logger(`[ERROR] Săn link bài #${postId} thất bại: ${e.message}`)
                }
                
                if (onFrame) onFrame(postId, 'FINISHED')
            }
        } finally {
            await context.close()
        }
    }

    /**
     * Posts a comment to a specific post URL.
     */
    static async postCommentByUrl(accountId: number, postIds: number[], logger: (msg: string) => void, onFrame?: (jobId: number, frame: string) => void) {
        const accounts = dbService.getAccounts()
        const account = accounts.find(a => a.id === accountId)
        if (!account) throw new Error('Không tìm thấy tài khoản')

        const posts = dbService.getPostsByIds(postIds)
        const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
        const userDataDir = account.profile_dir || path.join(rootPath, 'browser_profiles', `acc_${account.id}`)
        const resolvedProxy = await ProxyManager.getResolvedProxy(account as any)

        const context = await BrowserLauncher.launchWithFallback({
            userDataDir,
            headless: true,
            isMobile: false, // Use desktop for more reliable commenting
            viewport: { width: 1280, height: 800 },
            platform: account.platform,
            proxy: resolvedProxy
        })

        try {
            const browserPage = await context.newPage()
            const handler = PlatformFactory.getHandler(account.platform)

            if (!handler || !handler.postCommentCTA) {
                throw new Error(`Nền tảng ${account.platform} không hỗ trợ comment link.`)
            }

            for (const postId of postIds) {
                const post = posts.find(p => p.id === postId)
                if (!post || !post.post_url || !post.comment_cta) continue

                // CDP SCREENCASTING
                if (onFrame) {
                    const client = await browserPage.context().newCDPSession(browserPage)
                    await client.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 640, maxHeight: 400 })
                    client.on('Page.screencastFrame', (event) => {
                        onFrame(postId, event.data)
                        client.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
                    })
                }

                try {
                    await (handler as any).postCommentCTA(browserPage, post.comment_cta, logger, post.post_url)
                    dbService.updatePost(postId, { comment_status: 'completed', comment_error: null })
                    logger(`[SUCCESS] Đã comment CTA vào bài #${postId}`)
                } catch (e: any) {
                    dbService.updatePost(postId, { comment_status: 'failed', comment_error: e.message })
                    logger(`[ERROR] Comment bài #${postId} thất bại: ${e.message}`)
                }
                
                if (onFrame) onFrame(postId, 'FINISHED')
            }
        } finally {
            await context.close()
        }
    }
}
