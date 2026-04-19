import { Page } from 'playwright'

/**
 * Facebook Automation Handler
 * Xử lý đăng bài lên Facebook với mobile emulation
 */
export class FacebookAutomation {
  async postToPlatform(
    page: Page,
    postData: any,
    logger: (msg: string) => void
  ): Promise<void> {
    logger('Đang truy cập Facebook...')
    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle', timeout: 60000 })

    // Check login
    if (page.url().includes('login') || page.url().includes('checkpoint')) {
      throw new Error('Chưa đăng nhập hoặc bị yêu cầu xác thực. Vui lòng đăng nhập lại.')
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
      logger('Không tìm thấy nút bằng bộ lọc nhanh, đang quét sâu...')
      await page.click('div[role="main"] div[role="button"]', { timeout: 10000 }).catch(() => {
        throw new Error('Không tìm thấy nút "Tạo bài viết". Giao diện Facebook có thể đã thay đổi.')
      })
    }

    await page.waitForSelector('div[role="dialog"]', { timeout: 15000 })

    if (postData.media_path) {
      logger('Đang tải media lên...')
      try {
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
            await fileChooser.setFiles(postData.media_path)
            foundPhotoBtn = true
            break
          }
        }

        if (!foundPhotoBtn) {
          logger('[WARNING] Không tìm thấy nút Ảnh/Video trực tiếp, bỏ qua bước tải tệp.')
        } else {
          await page.waitForTimeout(3000) 
        }
      } catch (err: any) {
        logger(`[WARNING] Lỗi tải media: ${err.message}`)
      }
    }

    logger('Đang điền nội dung bài viết...')
    const editor = await page.waitForSelector('div[role="textbox"]', { timeout: 15000 })
    await editor.focus()
    await page.keyboard.type(`${postData.title}\n\n${postData.content}`, { delay: 30 })
    
    await page.waitForTimeout(2000)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

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
    
    logger('Đang chờ hệ thống xác nhận đăng hoàn tất (15s)...')
    await page.waitForTimeout(15000)
  }
}
