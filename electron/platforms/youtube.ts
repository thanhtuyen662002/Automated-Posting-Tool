import { Page } from 'playwright'

/**
 * YouTube Automation Handler
 * Xử lý đăng video lên YouTube Studio
 */
export class YouTubeAutomation {
  async postToPlatform(
    page: Page,
    postData: any,
    logger: (msg: string) => void
  ): Promise<void> {
    logger('Đang truy cập YouTube Studio...')
    await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle', timeout: 90000 })

    // Check login
    if (page.url().includes('accounts.google.com')) {
      throw new Error('Chưa đăng nhập YouTube. Vui lòng đăng nhập lại.')
    }

    logger('Đang mở hộp thoại tải lên...')
    const createBtn = await page.waitForSelector('#create-icon, button:has-text("TẠO"), button:has-text("CREATE")', { timeout: 30000 })
    await createBtn.click()
    
    // Select "Upload video"
    const uploadItem = await page.waitForSelector('text=/Tải video lên|Upload video/i', { timeout: 10000 })
    await uploadItem.click()

    logger('Đang chọn tệp video...')
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 20000 }),
        page.click('#select-files-button', { timeout: 10000 })
    ])
    await fileChooser.setFiles(postData.media_path)

    logger('Đang điền thông tin video...')
    // Title
    const titleBox = await page.waitForSelector('div[role="textbox"][aria-label*="tiêu đề"], div[role="textbox"][aria-label*="title"]', { timeout: 60000 })
    await titleBox.focus()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await page.keyboard.type(postData.title.substring(0, 100), { delay: 30 }) // YT title limit 100

    // Description
    const descBox = await page.waitForSelector('div[role="textbox"][aria-label*="mô tả"], div[role="textbox"][aria-label*="description"]', { timeout: 10000 })
    await descBox.focus()
    await page.keyboard.type(postData.content, { delay: 20 })

    // "Not made for kids" (Mandatory)
    logger('Đang thiết lập đối tượng người xem...')
    const kidsRadio = await page.waitForSelector('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MADE_FOR_KIDS"]', { timeout: 10000 })
    await kidsRadio.click()

    // Next steps flow
    const clickNext = async (step: string) => {
        logger(`Đang chuyển qua bước: ${step}`)
        const nextBtn = await page.waitForSelector('#next-button', { timeout: 15000 })
        await nextBtn.click()
        await page.waitForTimeout(2000)
    }

    await clickNext('Thành phần video')
    await clickNext('Kiểm tra')
    await clickNext('Chế độ hiển thị')

    logger('Đang đặt chế độ công khai...')
    const publicRadio = await page.waitForSelector('tp-yt-paper-radio-button[name="PUBLIC"]', { timeout: 10000 })
    await publicRadio.click()

    logger('Đang nhấn nút Xuất bản...')
    const doneBtn = await page.waitForSelector('#done-button', { timeout: 15000 })
    await doneBtn.click()

    logger('Đang chờ hệ thống xử lý (20s)...')
    await page.waitForTimeout(20000)
  }
}
