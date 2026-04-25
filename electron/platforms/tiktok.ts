import { Page } from 'playwright'
import path from 'node:path'

/**
 * TikTok Automation Handler
 * Xử lý đăng bài lên TikTok (Desktop Upload)
 */
export class TikTokAutomation {
  async postToPlatform(
    page: Page,
    postData: any,
    logger: (msg: string) => void
  ): Promise<void> {
    logger('Đang truy cập TikTok Upload...')
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'networkidle', timeout: 90000 })

    // Check login
    if (page.url().includes('login')) {
      throw new Error('Chưa đăng nhập TikTok. Vui lòng đăng nhập lại.')
    }

    logger('Đang chuẩn bị tệp media...')
    // TikTok upload is usually inside an iframe or uses a specific file input
    const selector = 'input[type="file"]'
    await page.waitForSelector(selector, { timeout: 30000 })
    await page.setInputFiles(selector, postData.media_path)
    
    logger('Đang chờ tệp tải lên và xử lý...')
    // Wait for the upload progress or specific preview element
    await page.waitForSelector('text=/Tải lên hoàn tất|Upload complete/i', { timeout: 120000 }).catch(() => {
        logger('[WARNING] Không thấy thông báo hoàn tất, tiếp tục điền thông tin...')
    })

    logger('Đang điền mô tả video...')
    // Select the caption editor (usually a div with contenteditable or a textarea)
    const captionEditor = await page.waitForSelector('div[contenteditable="true"], .public-DraftEditor-content', { timeout: 20000 })
    await captionEditor.focus()
    
    // Clear existing text if any
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    
    const fullCaption = `${postData.title}\n\n${postData.content}`
    await page.keyboard.type(fullCaption, { delay: 30 })
    await page.waitForTimeout(2000)

    logger('Đang cấu hình quyền riêng tư...')
    // Default is usually public, but we can verify if needed

    logger('Đang nhấn nút Đăng bài...')
    const postBtn = await page.waitForSelector('button:has-text("Đăng"), button:has-text("Post")', { timeout: 20000 })
    
    // Wait for the button to be enabled (it might be disabled while video is processing)
    let isEnabled = false
    for (let i = 0; i < 10; i++) {
        const disabled = await postBtn.getAttribute('disabled')
        if (disabled === null) {
            isEnabled = true
            break
        }
        logger(`[DEBUG] Chờ nút Đăng sẵn sàng... (${i+1}/10)`)
        await page.waitForTimeout(5000)
    }

    if (!isEnabled) {
        throw new Error('Nút "Đăng" vẫn bị vô hiệu hóa sau thời gian chờ. Kiểm tra lại nội dung video.')
    }

    await postBtn.click()
    
    logger('Đang chờ xác nhận thành công (15s)...')
    await page.waitForSelector('text=/Đã đăng|Uploaded/i', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(15000)
  }
}
