import { chromium } from 'playwright'
import { dbService, Page, Post } from './db'
import { app } from 'electron'
import path from 'node:path'
import { BrowserLauncher } from './browser_launcher'
import { PlatformFactory } from './platform_factory'

export class AutomationService {
    /**
     * Executes the posting script for a specific platform.
     * Enhanced with Multi-Browser Support and Platform Factory pattern.
     */
    static async runPostingTask(postId: number, logger: (msg: string) => void, onFrame?: (jobId: number, frame: string) => void) {
        const posts = dbService.getPosts()
        const post = posts.find(p => p.id === postId)
        if (!post) throw new Error('Không tìm thấy bài viết')

        const pages = dbService.getPages()
        const page = pages.find(p => p.id === post.page_id)
        if (!page) throw new Error('Không tìm thấy trang đích')

        logger(`[${page.platform}] Bắt đầu quy trình tự động đăng bài cho ID: #${post.id}`)
        
        const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
        const userDataDir = page.profile_dir || path.join(rootPath, 'browser_profiles', `page_${page.id}`)

        // Sử dụng BrowserLauncher với multi-browser fallback
        const platformConfig = BrowserLauncher.getPlatformConfig(page.platform)
        
        const context = await BrowserLauncher.launchWithFallback({
            userDataDir,
            headless: false,
            isMobile: platformConfig.isMobile,
            viewport: platformConfig.viewport,
            platform: page.platform
        })

        try {
            const browserPage = context.pages().length > 0 ? context.pages()[0] : await context.newPage()
            
            // CDP SCREENCASTING
            if (onFrame) {
                const client = await browserPage.context().newCDPSession(browserPage)
                await client.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 360, maxHeight: 740 })
                client.on('Page.screencastFrame', (event) => {
                    onFrame(post.id, event.data)
                    client.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
                })
            }

            // Sử dụng PlatformFactory để xử lý đa nền tảng
            const handler = PlatformFactory.getHandler(page.platform)
            
            if (handler) {
                await handler.postToPlatform(browserPage, post, logger)
            } else {
                throw new Error(`Nền tảng ${page.platform} chưa được hỗ trợ. Các nền tảng hiện có: ${PlatformFactory.getSupportedPlatforms().join(', ')}`)
            }

            dbService.updatePostStatus(post.id, 'published')
            logger(`[SUCCESS] Đã đăng bài thành công lên ${page.platform}!`)
            return { success: true }
        } catch (error: any) {
            dbService.updatePostStatus(post.id, 'failed')
            logger(`[ERROR] Lỗi thực thi: ${error.message}`)
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
        if (!pageData) return { success: false, error: 'Page not found' }

        if (logger) logger(`[HEALTH-CHECK] Đang kiểm tra: ${pageData.page_name} (${pageData.platform})...`)

        if (!pageData.profile_dir) {
            if (logger) logger(`[HEALTH-CHECK-SKIP] Trang ${pageData.page_name} chưa có Profile. Vui lòng đăng nhập thủ công trước.`)
            return { success: false, error: 'Profile directory is missing' }
        }

        if (pageData.is_logged_in === 0) {
            if (logger) logger(`[HEALTH-CHECK-SKIP] Trang ${pageData.page_name} chưa được đăng nhập lần đầu.`)
            return { success: true, status: 0 }
        }

        const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
        const userDataDir = pageData.profile_dir || path.join(rootPath, 'browser_profiles', `page_${pageData.id}`)

        // Sử dụng BrowserLauncher với headless mode
        const platformConfig = BrowserLauncher.getPlatformConfig(pageData.platform)
        
        const context = await BrowserLauncher.launchWithFallback({
            userDataDir,
            headless: true,
            isMobile: platformConfig.isMobile,
            viewport: platformConfig.viewport,
            platform: pageData.platform
        })

        try {
            const browserPage = await context.newPage()
            let isOk = false

            if (pageData.platform === 'Facebook') {
                await browserPage.goto('https://www.facebook.com', { waitUntil: 'networkidle', timeout: 30000 })
                const url = browserPage.url()
                
                const isLoggedInElement = await browserPage.$('text="Bạn đang nghĩ gì thế?"') || await browserPage.$('[aria-label="Facebook"]')
                
                if (!url.includes('login') && !url.includes('checkpoint') && isLoggedInElement) {
                    isOk = true
                }
            } else {
                // Fallback for other platforms
                isOk = pageData.is_logged_in === 1
            }

            const newStatus = isOk ? 1 : 2
            dbService.updatePageLoginStatus(pageId, newStatus)
            
            if (logger) logger(`[HEALTH-CHECK] Kết quả: ${isOk ? 'Sẵn sàng' : 'Cần đăng nhập lại'}`)
            return { success: true, status: newStatus }
        } catch (error: any) {
            if (logger) logger(`[HEALTH-CHECK-ERROR] ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            await context.close()
        }
    }
}
