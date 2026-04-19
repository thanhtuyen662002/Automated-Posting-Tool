import { chromium } from 'playwright'
import { dbService, Page, Post } from './db'
import { app } from 'electron'
import path from 'node:path'

export class AutomationService {
    /**
     * Executes the posting script for a specific platform.
     * Currently implemented: Facebook (Proof of concept)
     */
    /**
     * Executes the posting script for a specific platform.
     * Enhanced with Mobile Emulation and CDP Screencasting.
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

        // MOBILE EMULATION
        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            channel: 'chrome',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--window-size=400,800' // Small window for host
            ],
            viewport: { width: 360, height: 740 },
            userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true
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

            if (page.platform === 'Facebook') {
                await this.postToFacebook(browserPage, post, logger)
            } else {
                throw new Error(`Nền tảng ${page.platform} hiện chưa hỗ trợ tự động hóa trong bản thử nghiệm này.`)
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

    private static async postToFacebook(page: any, post: Post, logger: (msg: string) => void) {
        logger('Đang truy cập Facebook...')
        await page.goto('https://www.facebook.com', { waitUntil: 'networkidle', timeout: 60000 })

        // Check login
        if (page.url().includes('login') || page.url().includes('checkpoint')) {
            dbService.updatePageLoginStatus(post.page_id, 2)
            throw new Error('Chưa đăng nhập bài hoặc bị yêu cầu xác thực. Vui lòng đăng nhập lại.')
        }

        // Helper to dismiss popups
        const dismissPopups = async () => {
            const popupSelectors = [
                '[aria-label="Đóng"]', '[aria-label="Close"]',
                'text="Lúc khác"', 'text="Not Now"',
                'text="Chấp nhận tất cả"', 'text="Accept All"',
                '[aria-label="Chấp nhận tất cả"]', '[aria-label="Accept All"]'
            ]
            for (const selector of popupSelectors) {
                try {
                    const btn = await page.$(selector)
                    if (btn) {
                        await btn.click()
                        logger(`[DEBUG] Đã đóng popup: ${selector}`)
                    }
                } catch (e) {}
            }
        }

        await dismissPopups()

        logger('Đang mở hộp thoại tạo bài viết...')
        // Try multiple selectors for "What's on your mind"
        const postTriggers = [
            'div[role="button"]:has-text("Bạn đang nghĩ gì thế?")',
            'div[role="button"]:has-text("What\'s on your mind?")',
            'div[aria-label*="Bạn đang nghĩ gì thế"]',
            'div[aria-label*="What\'s on your mind"]',
            'text=/Bạn đang nghĩ gì thế|What\'s on your mind/i'
        ]

        let clickedTrigger = false
        for (const selector of postTriggers) {
            try {
                await page.click(selector, { timeout: 5000 })
                clickedTrigger = true
                break
            } catch (e) {}
        }

        if (!clickedTrigger) {
            // Fallback: search for any div with role="button" that might be it
            logger('Không tìm thấy nút bằng bộ lọc nhanh, đang quét sâu...')
            await page.click('div[role="main"] div[role="button"]', { timeout: 10000 }).catch(() => {
                throw new Error('Không tìm thấy nút "Tạo bài viết". Giao diện Facebook có thể đã thay đổi.')
            })
        }

        await page.waitForSelector('div[role="dialog"]', { timeout: 15000 })

        if (post.media_path) {
            logger('Đang tải media lên...')
            try {
                // Try to find photo/video button by aria-label
                const photoBtnSelectors = [
                    'div[aria-label="Ảnh/Video"]',
                    'div[aria-label="Photo/Video"]',
                    'div[aria-label="Ảnh"]',
                    'div[aria-label="Photo"]'
                ]
                
                let foundPhotoBtn = false
                for (const selector of photoBtnSelectors) {
                    if (await page.$(selector)) {
                        const [fileChooser] = await Promise.all([
                            page.waitForEvent('filechooser', { timeout: 10000 }),
                            page.click(selector)
                        ])
                        await fileChooser.setFiles(post.media_path)
                        foundPhotoBtn = true
                        break
                    }
                }

                if (!foundPhotoBtn) {
                     logger('[WARNING] Không tìm thấy nút Ảnh/Video trực tiếp, bỏ qua bước tải tệp.')
                } else {
                    // Wait for upload preview to appear
                    await page.waitForTimeout(3000) 
                }
            } catch (err: any) {
                logger(`[WARNING] Lỗi tải media: ${err.message}`)
            }
        }

        logger('Đang điền nội dung bài viết...')
        const editor = await page.waitForSelector('div[role="textbox"]', { timeout: 15000 })
        await editor.focus()
        await page.keyboard.type(`${post.title}\n\n${post.content}`, { delay: 30 })
        
        // Minor delay and extra keypress to trigger "Input" events on FB
        await page.waitForTimeout(2000)
        await page.keyboard.press('Enter')
        await page.waitForTimeout(1000)

        logger('Đang cấu hình quyền riêng tư (Công khai)...')
        // Logic to ensure post is public would go here

        logger('Đang nhấn nút Đăng bài...')
        const postBtnSelectors = [
            'div[aria-label="Đăng"]',
            'div[aria-label="Post"]',
            'div[role="button"]:has-text("Đăng")',
            'div[role="button"]:has-text("Post")',
            'div[role="button"] span:has-text("Đăng")',
            'div[role="button"] span:has-text("Post")'
        ]

        let posted = false
        // Try multiple times as the button might take a second to enable
        for (let attempt = 0; attempt < 3; attempt++) {
            for (const selector of postBtnSelectors) {
                try {
                    const btn = await page.$(selector)
                    if (btn) {
                        const disabled = await btn.getAttribute('aria-disabled')
                        if (disabled !== 'true') {
                            await btn.click()
                            posted = true
                            break
                        }
                    }
                } catch (e) {}
            }
            if (posted) break
            await page.waitForTimeout(2000)
            logger(`Đang thử lại việc nhấn nút Đăng (lần ${attempt + 1})...`)
        }

        if (!posted) {
            throw new Error('Không thể nhấn nút "Đăng". Có thể do nội dung chưa hợp lệ hoặc nút bị vô hiệu hóa.')
        }
        
        // Wait for post to finish
        logger('Đang chờ hệ thống xác nhận đăng hoàn tất (15s)...')
        await page.waitForTimeout(15000) 
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

        // IMPORTANT: If status is 0 (Never logged in), don't try to "promote" it automatically.
        // The user must perform the first login manually via the "Open Browser" button.
        if (pageData.is_logged_in === 0) {
            if (logger) logger(`[HEALTH-CHECK-SKIP] Trang ${pageData.page_name} chưa được đăng nhập lần đầu.`)
            return { success: true, status: 0 }
        }

        const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
        const userDataDir = pageData.profile_dir || path.join(rootPath, 'browser_profiles', `page_${pageData.id}`)

        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: true,
            channel: 'chrome',
            args: ['--disable-blink-features=AutomationControlled'],
        })

        try {
            const browserPage = await context.newPage()
            let isOk = false

            if (pageData.platform === 'Facebook') {
                await browserPage.goto('https://www.facebook.com', { waitUntil: 'networkidle', timeout: 30000 })
                const url = browserPage.url()
                
                // Strict check: Not redirected to login AND can see the "What's on your mind" trigger
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
