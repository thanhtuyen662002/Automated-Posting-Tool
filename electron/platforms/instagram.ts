import { Page } from 'playwright'

/**
 * Instagram Automation Handler
 * Xử lý đăng bài lên Instagram (Mobile Emulation)
 */
export class InstagramAutomation {
  async postToPlatform(
    page: Page,
    postData: any,
    logger: (msg: string) => void
  ): Promise<void> {
    logger('Đang truy cập Instagram...')
    await page.goto('https://www.instagram.com', { waitUntil: 'networkidle', timeout: 60000 })

    // Check login
    if (page.url().includes('accounts/login')) {
      throw new Error('Chưa đăng nhập Instagram. Vui lòng đăng nhập lại.')
    }

    // Helper to dismiss popups
    const dismissPopups = async () => {
        const popupSelectors = [
            'button:has-text("Lúc khác")', 'button:has-text("Not Now")',
            'button:has-text("Để sau")', 'button:has-text("Skip")',
            '[aria-label="Đóng"]', '[aria-label="Close"]'
        ]
        for (const selector of popupSelectors) {
            try {
                const btn = await page.$(selector)
                if (btn) {
                    await btn.click()
                    logger(`[DEBUG] Đã đóng popup: ${selector}`)
                    await page.waitForTimeout(1000)
                }
            } catch (e) {}
        }
    }

    await dismissPopups()

    logger('Đang mở hộp thoại tạo bài viết...')
    // Look for the "New Post" button (Plus icon)
    const plusSelectors = [
        '[aria-label="Bài viết mới"]',
        '[aria-label="New Post"]',
        'svg[aria-label="Bài viết mới"]',
        'svg[aria-label="New Post"]',
        '[data-testid="new-post-button"]'
    ]

    let foundPlus = false
    for (const selector of plusSelectors) {
        try {
            await page.click(selector, { timeout: 5000 })
            foundPlus = true
            break
        } catch (e) {}
    }

    if (!foundPlus) {
        // Fallback: search for any button that looks like a Plus
        await page.click('nav div[role="button"]:has(svg)', { timeout: 10000 }).catch(() => {
            throw new Error('Không tìm thấy nút "Tạo bài viết". Giao diện Instagram có thể đã thay đổi.')
        })
    }

    logger('Đang chọn tệp media...')
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15000 }),
        // Look for the specific upload button inside the dialog
        page.click('button:has-text("Chọn từ máy tính")', { timeout: 5000 }).catch(() => 
            page.click('button:has-text("Select from computer")')
        ).catch(() => 
            page.click('div[role="dialog"] button')
        )
    ])

    await fileChooser.setFiles(postData.media_path)
    await page.waitForTimeout(3000)

    // Instagram has a "Next" button flow
    const clickNext = async () => {
        const nextSelectors = ['button:has-text("Tiếp")', 'button:has-text("Next")']
        for (const selector of nextSelectors) {
            const btn = await page.$(selector)
            if (btn) {
                await btn.click()
                await page.waitForTimeout(2000)
                return true
            }
        }
        return false
    }

    logger('Đang chuyển qua các bước cấu hình...')
    await clickNext() // After upload
    await clickNext() // After filters

    logger('Đang điền chú thích bài viết...')
    const captionEditor = await page.waitForSelector('div[aria-label="Viết chú thích..."], div[aria-label="Write a caption..."]', { timeout: 10000 })
    await captionEditor.focus()
    await page.keyboard.type(`${postData.title}\n\n${postData.content}`, { delay: 30 })
    await page.waitForTimeout(1000)

    logger('Đang nhấn nút Chia sẻ...')
    const shareSelectors = ['button:has-text("Chia sẻ")', 'button:has-text("Share")']
    let shared = false
    for (const selector of shareSelectors) {
        try {
            const btn = await page.$(selector)
            if (btn) {
                await btn.click()
                shared = true
                break
            }
        } catch (e) {}
    }

    if (!shared) {
        throw new Error('Không thể nhấn nút "Chia sẻ".')
    }

    logger('Đang chờ xác nhận hoàn tất (20s)...')
    await page.waitForTimeout(20000)
  }
}
