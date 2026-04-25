import { Page } from 'playwright'
import { Page as DBPage } from '../db'

/**
 * Facebook Automation Handler
 * Xử lý đăng bài lên Facebook (Tự động rẽ nhánh Mobile/Desktop)
 * 
 * LUỒNG VIDEO 5 BƯỚC (Desktop):
 *  B1: Upload file → thử nhập nội dung vào textbox step-1
 *  B2: "Chỉnh sửa thước phim" → bấm Tiếp
 *  B3: "Cài đặt thước phim" → nhập mô tả (nếu B1 không được) → nếu có shopee → "Kiếm tiền"
 *  B4: "Kiếm tiền" → "Thêm liên kết sản phẩm"
 *  B5: Nhập URL Shopee → Lưu → quay về B3 → Đăng
 */
export class FacebookAutomation {

  // ==========================================
  // HÀM ĐIỀU HƯỚNG CHÍNH (ENTRY POINT)
  // ==========================================
  async postToPlatform(
    page: Page,
    postData: any,
    logger: (msg: string) => void
  ): Promise<void> {

    const mediaPaths = postData.media_path
      ? (Array.isArray(postData.media_path) ? postData.media_path : [postData.media_path])
      : [];

    const isVideo = mediaPaths.some((p: string) => p.toLowerCase().match(/\.(mp4|mov|avi|wmv)$/));

    if (isVideo) {
      logger('==================================================');
      logger('[SYSTEM] PHÁT HIỆN VIDEO: KÍCH HOẠT LUỒNG DESKTOP WEB');
      logger('==================================================');
      await this.postViaDesktop(page, postData, mediaPaths, logger);
    } else {
      logger('==================================================');
      logger('[SYSTEM] CHẾ ĐỘ TEXT/ẢNH: KÍCH HOẠT LUỒNG MOBILE WEB');
      logger('==================================================');
      await this.postViaMobile(page, postData, mediaPaths, logger);
    }
  }

  // ==========================================
  // LUỒNG 1: ĐĂNG VIDEO - DESKTOP (5 BƯỚC)
  // ==========================================
  private async postViaDesktop(
    page: Page,
    postData: any,
    mediaPaths: string[],
    logger: (msg: string) => void
  ): Promise<void> {

    // --- Chuẩn bị nội dung text ---
    const parts = [postData.title, postData.content, postData.hashtags];
    const fullContent = parts
      .filter(p => p !== undefined && p !== null && String(p).trim() !== '')
      .join('\n\n');
    const shopeeLink: string | null = postData.shopee_link?.trim() || null;

    // 1. Ép về www.facebook.com
    const desktopUrl = this.forceDesktopUrl(page.url());
    if (page.url() !== desktopUrl) {
      logger('[PROCESS] Đang chuyển hướng sang giao diện Desktop...');
      await page.goto(desktopUrl, { waitUntil: 'networkidle', timeout: 60000 });
    }

    const isLoggedIn = await page.isVisible('[aria-label="Facebook"]') || await page.isVisible('svg[aria-label="Facebook"]');
    if (!isLoggedIn && (page.url().includes('login') || page.url().includes('checkpoint'))) {
      throw new Error('Chưa đăng nhập. Vui lòng kiểm tra lại tài khoản.');
    }

    // =========================================================
    // BƯỚC 1: MỞ FORM VÀ UPLOAD VIDEO
    // =========================================================
    logger('[B1] Đang tìm khung soạn thảo Desktop...');
    await page.waitForTimeout(3000);

    const triggerLocators = [
      'div[role="button"]:has-text("nghĩ gì")',
      'div[role="button"]:has-text("What\'s on your mind")',
      'div[role="button"]:has-text("Viết gì đó")',
      'span:has-text("nghĩ gì")'
    ];

    let clicked = false;
    for (const sel of triggerLocators) {
      try {
        const trigger = page.locator(sel).first();
        if (await trigger.isVisible()) {
          await trigger.click();
          clicked = true;
          break;
        }
      } catch (e) { }
    }
    if (!clicked) throw new Error('Không thể mở form đăng bài trên Desktop.');

    // Chờ dialog đầu tiên xuất hiện
    const dialog = page.locator('div[role="dialog"]:visible').first();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Upload file video
    logger('[B1] Đang tìm nút tải Video lên...');
    let fileChooser: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logger(`[B1] Thử click nút Ảnh/Video (Cách ${attempt}/3)...`);
        [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 8000 }),
          (async () => {
            if (attempt === 1) {
              const btn = dialog.locator('div[role="button"][aria-label*="video" i], div[role="button"][aria-label*="Ảnh" i]').first();
              if (await btn.isVisible()) await btn.click({ force: true });
            } else if (attempt === 2) {
              const addText = dialog.locator('text="Thêm vào bài viết của bạn", text="Add to your post"').first();
              if (await addText.isVisible()) {
                const btn = addText.locator('xpath=./ancestor::div[3]//div[@role="button"]').first();
                if (await btn.isVisible()) await btn.click({ force: true });
              }
            } else {
              await page.evaluate(() => {
                const activeDialog = document.querySelector('div[role="dialog"]:not([aria-hidden="true"])');
                if (!activeDialog) return;
                const walker = document.createTreeWalker(activeDialog, NodeFilter.SHOW_TEXT, null);
                let node: Node | null;
                while ((node = walker.nextNode())) {
                  if (node.nodeValue?.includes('Thêm vào bài viết') || node.nodeValue?.includes('Add to your')) {
                    let parent = (node as Text).parentElement;
                    for (let i = 0; i < 5; i++) {
                      if (!parent) break;
                      const btns = parent.querySelectorAll<HTMLElement>('div[role="button"]');
                      if (btns.length > 0) { btns[0].click(); return; }
                      parent = parent.parentElement;
                    }
                  }
                }
              });
            }
          })()
        ]);
        if (fileChooser) break;
      } catch (e) { /* thử cách tiếp */ }
    }

    if (!fileChooser) {
      throw new Error('Đã thử 3 chiến thuật nhưng không mở được cửa sổ chọn file.');
    }

    await fileChooser.setFiles(mediaPaths);
    logger('[B1] ✅ Đã đẩy file Video. Chờ xử lý...');

    // Thử nhập nội dung ngay tại textbox của Bước 1 (data-lexical-editor)
    // Chờ editor xuất hiện sau khi upload
    let contentInjectedAtStep1 = false;
    if (fullContent.length > 0) {
      try {
        logger('[B1] Đang thử nhập nội dung vào textbox bước 1...');
        await page.waitForTimeout(3000);

        const injected = await page.evaluate(async (textToInsert: string) => {
          // Tìm editor đang hiển thị trong dialog active
          const activeDialog = document.querySelector('div[role="dialog"]:not([aria-hidden="true"])');
          if (!activeDialog) return false;
          const editorDiv = activeDialog.querySelector<HTMLElement>('[data-lexical-editor="true"]');
          if (!editorDiv) return false;

          // Clear và focus
          const p = editorDiv.querySelector('p');
          if (p) p.innerHTML = '';
          editorDiv.focus();
          editorDiv.click();

          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true, cancelable: true, clipboardData: new DataTransfer()
          });
          pasteEvent.clipboardData?.setData('text/plain', textToInsert);
          editorDiv.dispatchEvent(pasteEvent);
          await new Promise(r => setTimeout(r, 600));
          editorDiv.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
          editorDiv.dispatchEvent(new KeyboardEvent('keyup',  { key: ' ', code: 'Space', bubbles: true }));
          return true;
        }, fullContent);

        if (injected) {
          contentInjectedAtStep1 = true;
          logger('[B1] ✅ Đã nhập nội dung vào textbox bước 1 thành công.');
        }
      } catch (e: any) {
        logger(`[B1] ⚠️ Không nhập được ở bước 1, sẽ nhập ở bước 3: ${e.message}`);
      }
    }

    // =========================================================
    // BƯỚC 1→2: BẤM "TIẾP" (Chuyển sang "Chỉnh sửa thước phim")
    // LƯU Ý: Facebook pre-render nhiều bước trong DOM → dùng getBoundingClientRect
    // để đảm bảo chỉ click nút đang THẬT SỰ hiển thị trên màn hình (bước 1)
    // =========================================================
    await page.waitForTimeout(2000);
    logger('[B1→B2] Bấm nút TIẾP (đang hiển thị ở bước 1)...');
    await this.clickVisibleButton(page, ['Tiếp', 'Next'], logger, 30000);

    // =========================================================
    // BƯỚC 2: "CHỈNH SỬA THƯỚC PHIM" - Chờ upload xong rồi bấm Tiếp
    // =========================================================
    logger('[B2] Đang ở bước Chỉnh sửa thước phim - Chờ upload hoàn tất...');
    await this.waitForVideoUploadComplete(page, logger);

    logger('[B2→B3] Bấm nút TIẾP để sang bước Cài đặt thước phim...');
    await this.clickVisibleButton(page, ['Tiếp', 'Next'], logger, 30000);

    // =========================================================
    // BƯỚC 3: "CÀI ĐẶT THƯỚC PHIM"
    // - Nhập mô tả nếu bước 1 không nhập được
    // - Nếu có shopee_link: kéo xuống → "Kiếm tiền" → B4/B5 → Lưu → quay lại B3
    // - Bấm "Đăng"
    // =========================================================
    logger('[B3] Đang ở bước Cài đặt thước phim...');
    await page.waitForTimeout(2000);

    // Nhập nội dung vào textarea "Mô tả thước phim" nếu bước 1 chưa nhập được
    if (fullContent.length > 0 && !contentInjectedAtStep1) {
      logger('[B3] Đang nhập mô tả vào textarea bước 3...');
      await this.fillDescriptionTextareaStep3(page, fullContent, logger);
    }

    // Xử lý Shopee link nếu có
    if (shopeeLink) {
      logger(`[B3] Phát hiện Shopee Link. Đang thực hiện quy trình gắn sản phẩm...`);
      await this.handleShopeeAffiliateLink(page, shopeeLink, logger);
    }

    // Bấm ĐĂNG tại Bước 3
    logger('[B3] Bấm nút ĐĂNG để hoàn tất...');
    const posted = await this.clickPostButton(page, logger);
    if (!posted) {
      throw new Error('Timeout: Không thể tìm thấy và bấm nút Đăng ở bước 3.');
    }

    logger('✅ Đã nhấn xuất bản! Đang chờ hệ thống Meta xác nhận (15s)...');
    await page.waitForTimeout(15000);
  }

  // =========================================================
  // HÀM PHỤ - NHẬP NỘI DUNG VÀO TEXTAREA "Mô tả thước phim"
  // (Bước 3 - "Cài đặt thước phim")
  // =========================================================
  private async fillDescriptionTextareaStep3(
    page: Page,
    content: string,
    logger: (msg: string) => void
  ): Promise<void> {
    try {
      // Textarea có placeholder "Mô tả thước phim của bạn..."
      const textarea = page.locator('textarea[placeholder*="Mô tả"], textarea[placeholder*="description"], textarea[placeholder*="caption"]').first();
      if (await textarea.isVisible({ timeout: 5000 })) {
        await textarea.click();
        await textarea.fill(content);
        logger('[B3] ✅ Đã nhập nội dung vào textarea mô tả.');
        await page.waitForTimeout(1000);
        return;
      }

      // Fallback: tìm contenteditable trong bước 3
      const injected = await page.evaluate(async (textToInsert: string) => {
        const activeDialog = document.querySelector<HTMLElement>('div[role="dialog"]:not([aria-hidden="true"])');
        if (!activeDialog) return false;

        // Tìm textarea
        const ta = activeDialog.querySelector<HTMLTextAreaElement>('textarea');
        if (ta) {
          ta.focus();
          ta.value = textToInsert;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // Tìm contenteditable
        const editor = activeDialog.querySelector<HTMLElement>('[contenteditable="true"]');
        if (editor) {
          editor.focus();
          editor.click();
          const dt = new DataTransfer();
          dt.setData('text/plain', textToInsert);
          editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
          await new Promise(r => setTimeout(r, 500));
          return true;
        }
        return false;
      }, content);

      if (injected) {
        logger('[B3] ✅ Đã nhập nội dung vào editor bước 3 (fallback JS).');
      } else {
        logger('[B3] ⚠️ Không tìm thấy textarea mô tả ở bước 3.');
      }
    } catch (e: any) {
      logger(`[B3] ⚠️ Lỗi khi nhập mô tả: ${e.message}`);
    }
  }

  // =========================================================
  // HÀM PHỤ - XỬ LÝ SHOPEE AFFILIATE LINK
  // B3 → Kiếm tiền → Thêm liên kết sản phẩm → Nhập URL → Lưu → B3
  // =========================================================
  private async handleShopeeAffiliateLink(
    page: Page,
    shopeeUrl: string,
    logger: (msg: string) => void
  ): Promise<void> {
    try {
      // Kéo xuống cuối dialog để tìm nút "Kiếm tiền"
      logger('[SHOPEE] Đang cuộn xuống tìm nút "Kiếm tiền"...');
      await page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('div[role="dialog"]:not([aria-hidden="true"])');
        if (dialog) dialog.scrollTop = dialog.scrollHeight;
      });
      await page.waitForTimeout(1500);

      // Tìm và bấm "Kiếm tiền"
      const monetizeBtn = page.locator(
        'div[role="button"]:has-text("Kiếm tiền"), div[role="button"]:has-text("Monetization"), [aria-label*="Kiếm tiền"]'
      ).first();

      if (!await monetizeBtn.isVisible({ timeout: 5000 })) {
        logger('[SHOPEE] ⚠️ Không tìm thấy nút "Kiếm tiền". Bỏ qua gắn link.');
        return;
      }

      await monetizeBtn.click({ force: true });
      logger('[SHOPEE] Đã bấm "Kiếm tiền". Chờ giao diện B4...');
      await page.waitForTimeout(2000);

      // ---- BƯỚC 4: Trang "Kiếm tiền" ----
      // Tìm "Thêm liên kết sản phẩm"
      const addLinkBtn = page.locator(
        'div[role="button"]:has-text("Thêm liên kết sản phẩm"), div[role="listitem"]:has-text("Thêm liên kết sản phẩm")'
      ).first();

      if (!await addLinkBtn.isVisible({ timeout: 8000 })) {
        logger('[SHOPEE] ⚠️ Không tìm thấy "Thêm liên kết sản phẩm". Thử back về B3...');
        await this.clickAriaBackButton(page, logger);
        return;
      }

      await addLinkBtn.click({ force: true });
      logger('[SHOPEE] Đã bấm "Thêm liên kết sản phẩm". Chờ giao diện B5...');
      await page.waitForTimeout(2000);

      // ---- BƯỚC 5: Form "Thêm liên kết sản phẩm" ----
      // Tìm input URL - thử nhiều selector
      logger('[SHOPEE] Đang nhập URL Shopee...');
      let inputFound = false;
      const inputSelectors = [
        'input[placeholder*="URL"]',
        'input[type="url"]',
        'input[placeholder*="url"]',
        'input[placeholder*="liên kết"]',
        'input[type="text"]'
      ];
      for (const sel of inputSelectors) {
        try {
          const inp = page.locator(sel).first();
          if (await inp.isVisible({ timeout: 3000 })) {
            await inp.click();
            await inp.fill(shopeeUrl);
            logger(`[SHOPEE] ✅ Đã nhập URL (${sel}): ${shopeeUrl}`);
            inputFound = true;
            break;
          }
        } catch (e) { }
      }

      if (!inputFound) {
        logger('[SHOPEE] ⚠️ Không tìm thấy ô nhập URL. Thử back 2 lần...');
        await this.clickAriaBackButton(page, logger);
        await page.waitForTimeout(1500);
        await this.clickAriaBackButton(page, logger);
        return;
      }

      await page.waitForTimeout(1500);

      // Bấm nút "Lưu" - dùng clickVisibleButton để tránh bấm nhầm
      logger('[SHOPEE] Đang bấm nút Lưu...');
      await this.clickVisibleButton(page, ['Lưu', 'Save'], logger, 10000);
      logger('[SHOPEE] ✅ Đã bấm Lưu. Chờ Facebook xử lý...');
      await page.waitForTimeout(3000);

      // Sau khi Lưu xong → Facebook tự về B4 "Kiếm tiền"
      // Cần bấm Back 1 lần để về B3 "Cài đặt thước phim"
      logger('[SHOPEE] Bấm Back: từ B4 "Kiếm tiền" → về B3 "Cài đặt thước phim"...');
      await this.clickAriaBackButton(page, logger);
      await page.waitForTimeout(2000);

      logger('[SHOPEE] ✅ Hoàn thành! Đang ở B3, sẵn sàng bấm Đăng.');

    } catch (e: any) {
      logger(`[SHOPEE] ⚠️ Lỗi trong quy trình gắn link: ${e.message}. Đang cố quay về B3...`);
      try {
        await this.clickAriaBackButton(page, logger);
        await page.waitForTimeout(1500);
        await this.clickAriaBackButton(page, logger);
        await page.waitForTimeout(1500);
      } catch (be) { }
    }
  }

  // =========================================================
  // HÀM PHỤ - CLICK NÚT ĐANG THẬT SỰ HIỂN THỊ TRONG VIEWPORT
  // Dùng getBoundingClientRect lấy tọa độ thực rồi page.mouse.click
  // để bypass overlay data-visualcompletion="ignore" của Facebook
  // =========================================================
  private async clickVisibleButton(
    page: Page,
    labels: string[],
    logger: (msg: string) => void,
    timeout = 30000
  ): Promise<void> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        // Tìm nút khớp text và đang hiển thị trong viewport, trả về tọa độ
        const coords = await page.evaluate((labelList: string[]) => {
          const allBtns = Array.from(
            document.querySelectorAll<HTMLElement>('[role="button"]')
          );

          for (const btn of allBtns) {
            const text = btn.innerText?.trim() || btn.textContent?.trim() || '';
            const matches = labelList.some(l => text === l || text.startsWith(l));
            if (!matches) continue;

            if (btn.getAttribute('aria-disabled') === 'true') continue;

            const rect = btn.getBoundingClientRect();
            const inViewport =
              rect.width > 0 &&
              rect.height > 0 &&
              rect.top >= 0 &&
              rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
              rect.left >= 0 &&
              rect.right <= (window.innerWidth || document.documentElement.clientWidth);

            if (!inViewport) continue;

            const style = window.getComputedStyle(btn);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              parseFloat(style.opacity) === 0
            ) continue;

            // Trả về tọa độ tâm nút thay vì click trực tiếp
            return {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              label: text
            };
          }
          return null;
        }, labels);

        if (coords) {
          logger(`[NAV] Tìm thấy nút "${coords.label}" tại (${Math.round(coords.x)}, ${Math.round(coords.y)}). Đang click chuột...`);
          await page.mouse.click(coords.x, coords.y);
          logger(`[NAV] ✅ Đã bấm nút "${coords.label}" bằng tọa độ chuột thực tế.`);
          await page.waitForTimeout(2500);
          return;
        }
      } catch (e) { }
      await page.waitForTimeout(1500);
    }

    throw new Error(`Không tìm thấy nút [${labels.join('/')}] hiển thị trong viewport sau ${timeout / 1000}s`);
  }


  // =========================================================
  // HÀM PHỤ - BẤM NÚT TRONG ACTIVE DIALOG
  // =========================================================
  private async clickButtonInActiveDialog(
    page: Page,
    labels: string[],
    logger: (msg: string) => void,
    timeout = 30000
  ): Promise<void> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        const activeDialog = page.locator('div[role="dialog"]:visible').last();

        for (const label of labels) {
          // Dùng nhiều chiến thuật tìm nút
          const selectors = [
            `div[role="button"]:has-text("${label}")`,
            `[role="button"]:has-text("${label}")`,
            `button:has-text("${label}")`
          ];
          for (const sel of selectors) {
            const btn = activeDialog.locator(sel).last();
            try {
              if (await btn.isVisible({ timeout: 1000 }) && await btn.getAttribute('aria-disabled') !== 'true') {
                await btn.scrollIntoViewIfNeeded();
                await btn.click({ force: true });
                logger(`[NAV] ✅ Đã bấm nút "${label}".`);
                await page.waitForTimeout(2500);
                return;
              }
            } catch (e) { }
          }
        }
      } catch (e) { }
      await page.waitForTimeout(1500);
    }
    throw new Error(`Không tìm thấy nút [${labels.join('/')}] sau ${timeout / 1000}s`);
  }

  // =========================================================
  // HÀM PHỤ - BẤM NÚT BACK
  // =========================================================
  private async clickBackButton(
    page: Page,
    logger: (msg: string) => void
  ): Promise<void> {
    const backSelectors = [
      '[aria-label="Quay lại"]',
      '[aria-label="Back"]',
      'div[role="button"]:has-text("Quay lại")',
      'svg[aria-hidden="true"]:near(div[role="button"])'
    ];
    for (const sel of backSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click({ force: true });
          logger(`[NAV] Đã bấm nút Back.`);
          await page.waitForTimeout(2000);
          return;
        }
      } catch (e) { }
    }
    logger('[NAV] ⚠️ Không tìm thấy nút Back.');
  }

 // =========================================================
  // HÀM PHỤ - BẤM NÚT BACK BẰNG TỌA ĐỘ CHUỘT THỰC TẾ (ĐÃ FIX)
  // =========================================================
  private async clickAriaBackButton(
    page: Page,
    logger: (msg: string) => void,
    timeout = 15000
  ): Promise<void> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        const coords = await page.evaluate(() => {
          const selectors = [
            '[aria-label="Quay lại"][role="button"]',
            '[aria-label="Back"][role="button"]',
          ];
          
          for (const sel of selectors) {
            // Lấy TẤT CẢ các nút thay vì chỉ lấy nút đầu tiên
            const btns = Array.from(document.querySelectorAll<HTMLElement>(sel));
            
            // Duyệt ngược từ cuối mảng (ưu tiên các dialog render sau cùng / nằm trên cùng)
            for (let i = btns.length - 1; i >= 0; i--) {
              const btn = btns[i];
              
              // Bỏ qua nếu nút nằm trong một dialog/thành phần đang bị ẩn
              if (btn.closest('[aria-hidden="true"]')) continue;

              const rect = btn.getBoundingClientRect();
              
              // Kiểm tra xem nút có thực sự kích thước và nằm trong viewport không
              const inViewport =
                rect.width > 0 &&
                rect.height > 0 &&
                rect.top >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.left >= 0 &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth);

              // Kiểm tra style hiển thị
              const style = window.getComputedStyle(btn);
              const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;

              if (inViewport && isVisible) {
                return {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                  label: btn.getAttribute('aria-label')
                };
              }
            }
          }
          return null;
        });

        if (coords) {
          logger(`[NAV] Tìm thấy nút "${coords.label}" tại (${Math.round(coords.x)}, ${Math.round(coords.y)}). Đang click...`);
          await page.mouse.click(coords.x, coords.y);
          logger(`[NAV] ✅ Đã bấm nút Quay lại bằng tọa độ chuột thực tế.`);
          await page.waitForTimeout(2000);
          return;
        }
      } catch (e) { }
      await page.waitForTimeout(1000);
    }

    throw new Error(`[NAV] ⚠️ Không xác định được tọa độ nút Back hợp lệ sau ${timeout / 1000}s.`);
  }

  // =========================================================
  // HÀM PHỤ - BẤM BUTTON "ĐĂNG"
  // =========================================================
  private async clickPostButton(
    page: Page,
    logger: (msg: string) => void,
    timeout = 60000
  ): Promise<boolean> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        const activeDialog = page.locator('div[role="dialog"]:visible').last();
        const postBtn = activeDialog.locator(
          'div[role="button"]:has-text("Đăng"), div[role="button"]:has-text("Publish"), div[role="button"]:has-text("Post")'
        ).last();

        if (await postBtn.isVisible({ timeout: 1000 }) && await postBtn.getAttribute('aria-disabled') !== 'true') {
          await postBtn.click({ force: true });
          logger('[PROCESS] ✅ Đã bấm nút ĐĂNG!');
          return true;
        }
      } catch (e) { }
      await page.waitForTimeout(2000);
    }
    return false;
  }

  // =========================================================
  // HÀM PHỤ - CHỜ VIDEO UPLOAD HOÀN TẤT (Bước 2)
  // =========================================================
  private async waitForVideoUploadComplete(
    page: Page,
    logger: (msg: string) => void,
    maxWaitMs = 300000  // tối đa 5 phút
  ): Promise<void> {
    logger('[B2] Chờ video upload và xử lý xong...');
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      try {
        // Kiểm tra nút "Tiếp" có enabled không
        const activeDialog = page.locator('div[role="dialog"]:visible').last();
        const nextBtn = activeDialog.locator(
          'div[role="button"]:has-text("Tiếp"), div[role="button"]:has-text("Next")'
        ).last();

        if (await nextBtn.isVisible({ timeout: 2000 })) {
          const isDisabled = await nextBtn.getAttribute('aria-disabled') === 'true';
          if (!isDisabled) {
            logger('[B2] ✅ Nút Tiếp đã sẵn sàng - Video đã xử lý xong!');
            return;
          }
          logger(`[B2] ⏳ Đang xử lý video... (${Math.round((Date.now() - start) / 1000)}s)`);
        }

        // Kiểm tra icon "Đã tải lên xong" (100%)
        const uploadDone = await page.evaluate(() => {
          const icons = document.querySelectorAll('i[aria-label="Đã tải lên xong"]');
          return icons.length > 0;
        });
        if (uploadDone) {
          logger('[B2] ✅ Phát hiện icon upload xong!');
          await page.waitForTimeout(2000);
          return;
        }

      } catch (e) { }
      await page.waitForTimeout(3000);
    }
    logger('[B2] ⚠️ Timeout chờ video - tiếp tục thực hiện ngay...');
  }


  // ==========================================
  // LUỒNG 2: ĐĂNG TEXT/ẢNH TRÊN MOBILE WEB
  // ==========================================
  private async postViaMobile(
    page: Page,
    postData: any,
    mediaPaths: string[],
    logger: (msg: string) => void
  ): Promise<void> {

    const mobileUrl = this.forceMobileUrl(page.url())
    if (page.url() !== mobileUrl) {
      logger('[SYSTEM] Đang ép về bản di động m.facebook.com...')
      await page.goto(mobileUrl, { waitUntil: 'networkidle', timeout: 60000 })
    }

    const dismissPopups = async () => {
      const pages = page.context().pages()
      if (pages.length > 1) {
        for (let i = 1; i < pages.length; i++) {
          try { await pages[i].close() } catch (e) { }
        }
      }
      const popupSelectors = [
        '[aria-label="Đóng"]', '[aria-label="Close"]', 'text="Lúc khác"', 'text="Not Now"',
        'text="Chấp nhận tất cả"', 'text="Accept All"', 'div[role="button"]:has-text("X")'
      ]
      for (const selector of popupSelectors) {
        try {
          const btn = await page.$(selector)
          if (btn && await btn.isVisible()) {
            await btn.click()
            await page.waitForTimeout(1000)
          }
        } catch (e) { }
      }
    }

    await dismissPopups()

    logger('Reset vị trí cuộn về đầu trang để quét...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    const tryFindAndClickTrigger = async () => {
      const composerSelectors = [
        'div[data-sigil="touchable composer"]',
        'a[href*="/composer/mbasic/"]',
        'div[role="button"]:has-text("nghĩ gì")',
        'div[role="button"]:has-text("Tạo bài viết")'
      ];

      for (const selector of composerSelectors) {
        try {
          const triggers = page.locator(selector).locator('visible=true');
          const count = await triggers.count();

          for (let i = 0; i < count; i++) {
            const trigger = triggers.nth(i);
            const box = await trigger.boundingBox();
            if (!box || box.y < 40) continue;

            await trigger.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await trigger.evaluate((el: HTMLElement) => el.click());
            await page.waitForTimeout(2500);

            const isDialogOpen = await page.isVisible('div[role="dialog"]') || await page.isVisible('textarea');
            if (isDialogOpen) return true;

            await page.keyboard.press('Escape');
            await page.mouse.click(2, 2);
            await page.waitForTimeout(1000);
          }
        } catch (e) { }
      }
      return false;
    };

    let clickedTrigger = await tryFindAndClickTrigger();

    if (!clickedTrigger) {
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(1500);
        clickedTrigger = await tryFindAndClickTrigger();
        if (clickedTrigger) break;
      }
    }

    if (!clickedTrigger) throw new Error('Bot mất dấu nút Tạo bài viết trên Mobile.');

    await page.waitForTimeout(2500);

    logger('Đang điền nội dung bài viết...');
    try {
      const editorLocators = ['textarea', '[data-sigil="composer-textarea"]', 'div[role="textbox"]'];
      let foundEditor = false;
      for (const sel of editorLocators) {
        const editor = page.locator(sel).first();
        if (await editor.isVisible()) {
          await editor.click();
          await page.waitForTimeout(500);

          const parts = [postData.title, postData.content, postData.hashtags];
          const fullContent = parts
            .filter(p => p !== undefined && p !== null && String(p).trim() !== '')
            .join('\n\n');

          await editor.fill(fullContent);
          await page.keyboard.press('Space');
          logger('[SUCCESS] Đã điền xong nội dung.');
          foundEditor = true;
          break;
        }
      }
      if (!foundEditor) throw new Error('Không tìm thấy ô nhập văn bản.');
    } catch (e: any) {
      logger(`[WARNING] Lỗi khi điền text: ${e.message}`);
    }

    await page.waitForTimeout(2000);

    if (mediaPaths.length > 0) {
      logger('Đang tải ảnh lên Mobile...');
      try {
        const uploadBtn = page.getByText('Ảnh', { exact: true }).first();
        if (await uploadBtn.isVisible()) {
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 12000 }),
            uploadBtn.click({ force: true })
          ]);
          await fileChooser.setFiles(mediaPaths);
          await page.waitForTimeout(7000);
        }
      } catch (err: any) {
        try {
          const fallbackInput = await page.$('input[type="file"]');
          if (fallbackInput) {
            await fallbackInput.setInputFiles(mediaPaths);
            await page.waitForTimeout(5000);
          }
        } catch (e) { }
      }
    }

    logger('Đang chuẩn bị nhấn nút Đăng...');
    await page.waitForTimeout(3000);

    let posted = false;
    const postBtnLocators = [
      'div[role="button"]:has-text("ĐĂNG")',
      'div[role="button"]:has-text("POST")',
      'button:has-text("ĐĂNG")',
      'div[aria-label="Đăng"]'
    ];

    for (const sel of postBtnLocators) {
      try {
        const btns = page.locator(sel).locator('visible=true');
        const count = await btns.count();
        if (count > 0) {
          const btn = btns.nth(count - 1);
          const isDisabled = await btn.getAttribute('aria-disabled') === 'true' || await btn.getAttribute('disabled') !== null;
          if (!isDisabled) {
            await btn.click({ force: true });
            posted = true;
            break;
          }
        }
      } catch (e) { }
    }

    if (!posted) {
      posted = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('div[role="button"], button')) as HTMLElement[];
        const submitBtns = btns.filter(b =>
          b.innerText && (b.innerText.toUpperCase().trim() === 'ĐĂNG' || b.innerText.toUpperCase().trim() === 'POST') &&
          b.getAttribute('aria-disabled') !== 'true'
        );
        if (submitBtns.length > 0) {
          submitBtns[submitBtns.length - 1].click();
          return true;
        }
        return false;
      });
    }

    if (!posted) throw new Error('Không thể bấm nút "Đăng" trên Mobile.');

    logger('Đang chờ hệ thống xác nhận đăng hoàn tất (15s)...');
    await page.waitForTimeout(15000);
  }

  // ==========================================
  // CÁC HÀM TIỆN ÍCH ĐỒNG BỘ UI
  // ==========================================
  async switchPage(
    page: Page,
    pageUrl: string | null | undefined,
    logger: (msg: string) => void
  ): Promise<void> {
    if (!pageUrl) {
      logger('[WARNING] Không có URL Page để chuyển đổi, sử dụng tài khoản hiện tại.')
      return
    }

    logger(`[SWITCH] Đang di chuyển tới Page: ${pageUrl}`)
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 })

    const switchSelectors = [
      'div[aria-label^="Chuyển sang"]', 'div[aria-label^="Switch to"]',
      'text="Chuyển ngay"', 'text="Switch Now"', 'button:has-text("Chuyển")'
    ]

    for (const selector of switchSelectors) {
      try {
        const switchBtn = await page.$(selector)
        if (switchBtn) {
          logger(`[SWITCH] Phát hiện nút chuyển đổi ngữ cảnh, đang click...`)
          await switchBtn.click()
          await page.waitForTimeout(10000)
          logger('[SWITCH] Đã thực hiện chuyển đổi thành công.')
          return
        }
      } catch (e) { }
    }
  }

  async syncPageInfo(
    browserPage: Page,
    logger: (msg: string) => void,
    dbPage: DBPage
  ): Promise<{ handle?: string, avatarUrl?: string, pageName?: string }> {
    logger('[SYNC] Đang đồng bộ thông tin trang...')

    const currentUrl = browserPage.url()
    if (currentUrl.includes('business.facebook.com') || currentUrl.includes('www.facebook.com')) {
      const mobileUrl = currentUrl
        .replace('business.facebook.com', 'm.facebook.com')
        .replace('www.facebook.com', 'm.facebook.com')
      await browserPage.goto(mobileUrl, { waitUntil: 'networkidle', timeout: 60000 })
    }

    const url = browserPage.url()
    let handle = undefined
    let pageName = undefined

    if (url.includes('id=')) {
      const match = url.match(/id=(\d+)/)
      if (match) handle = '@' + match[1]
    } else {
      const urlParts = url.split('/')
      if (urlParts.length >= 4) {
        const lastPart = urlParts[3].split('?')[0]
        if (lastPart && !['profile.php', 'pages', 'groups'].includes(lastPart)) {
          handle = '@' + lastPart
        }
      }
    }

    try {
      const nameSelectors = ['h1', 'h3.header-title', 'div#m-top-blue-bar span', 'div[data-sigil="marea"] b']
      for (const sel of nameSelectors) {
        const el = await browserPage.$(sel)
        if (el) {
          const text = await el.innerText()
          if (text && text.trim().length > 0) {
            pageName = text.trim()
            break
          }
        }
      }
    } catch (e) { }

    let avatarUrl = undefined
    const isBusinessSuite = url.includes('business.facebook.com')

    try {
      const containerSelectors = isBusinessSuite
        ? ['div[role="navigation"]', 'div[role="main"]', '.x1n2onr6']
        : ['div[data-testid="profile_header"]', '#profile_pic_education', 'div[data-sigil="marea"]', 'div#objects_container']

      let searchScope = browserPage as any
      for (const sel of containerSelectors) {
        try {
          const container = await browserPage.$(sel)
          if (container) { searchScope = container; break }
        } catch (e) { }
      }

      const avatarSelectors = [
        'image[preserveAspectRatio="xMidYMid slice"]',
        'img[alt*="Ảnh đại diện"]',
        'img[alt*="Ảnh hồ sơ"]',
        'img[src*="scontent"]'
      ]

      for (const selector of avatarSelectors) {
        try {
          const imgs = await searchScope.$$(selector)
          for (const img of imgs) {
            const isPersonal = await img.evaluate((el: any) => {
              if (el.closest('[role="banner"], [aria-label*="Tài khoản"]')) return true;
              const rect = el.getBoundingClientRect();
              return (rect.width < 50 && rect.height < 50);
            })
            if (isPersonal) continue;

            const src = await img.getAttribute('xlink:href') || await img.getAttribute('src')
            if (src && src.startsWith('http')) {
              avatarUrl = src; break
            }
          }
        } catch (e) { }
        if (avatarUrl) break
      }
    } catch (e: any) { }

    return { handle, avatarUrl, pageName }
  }

  private forceMobileUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      if (urlObj.hostname.includes('facebook.com') && !urlObj.hostname.startsWith('m.')) {
        urlObj.hostname = 'm.facebook.com'
      }
      return urlObj.toString()
    } catch (e) {
      return url.replace(/^(https?:\/\/)?(www\.|web\.)?facebook\.com/, '$1m.facebook.com')
    }
  }

  private forceDesktopUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      if (urlObj.hostname.startsWith('m.facebook.com')) {
        urlObj.hostname = 'www.facebook.com'
      }
      return urlObj.toString()
    } catch (e) {
      return url.replace(/^(https?:\/\/)?(m\.)?facebook\.com/, '$1www.facebook.com')
    }
  }

  async postCommentCTA(
    page: Page,
    commentText: string,
    logger: (msg: string) => void,
    postUrl?: string
  ): Promise<void> {
    const trimmed = (commentText || '').trim()
    if (!trimmed) return

    if (postUrl) {
      logger(`[CTA] Đang điều hướng trực tiếp tới link bài viết: ${postUrl}`)
      await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 60000 })
    }

    logger('[CTA] Đang thử chèn bình luận CTA...')
    await page.waitForTimeout(3500)

    const editorSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      'textarea[placeholder*="Viết bình luận"]',
      'textarea[placeholder*="Write a comment"]',
      'div[aria-label*="Viết bình luận"][role="textbox"]',
      'div[aria-label*="Write a comment"][role="textbox"]',
      'form textarea'
    ]

    for (const selector of editorSelectors) {
      try {
        const editor = page.locator(selector).first()
        if (await editor.isVisible({ timeout: 5000 })) {
          await editor.click({ force: true })
          await page.waitForTimeout(500)
          
          if (selector.includes('textarea')) {
            await editor.fill(trimmed)
          } else {
            // Dùng keyboard type để an toàn hơn với contenteditable
            await page.keyboard.type(trimmed)
          }
          
          await page.waitForTimeout(1000)
          await page.keyboard.press('Enter')
          logger('[CTA] ✅ Đã gửi bình luận CTA.')
          await page.waitForTimeout(2000)
          return
        }
      } catch (e) { }
    }

    logger('[CTA] ⚠️ Không tìm thấy ô bình luận phù hợp.')
    throw new Error('Không tìm thấy ô bình luận')
  }

  async findPostLink(
    page: Page,
    postData: any,
    logger: (msg: string) => void
  ): Promise<string | null> {
    logger(`[FIND-LINK] Đang săn link cho bài viết: "${postData.title}"`)
    
    // Thử vào trang cá nhân/page trước
    const currentUrl = page.url()
    const mobileUrl = this.forceMobileUrl(currentUrl)
    if (currentUrl !== mobileUrl) {
        await page.goto(mobileUrl, { waitUntil: 'networkidle' })
    }

    // 1. Cuộn xuống 1-2 lần để load bài mới
    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(2000)

    // 2. Quét các bài viết để tìm link dựa trên tiêu đề hoặc mô tả
    const postLink = await page.evaluate((title: string) => {
        const links = Array.from(document.querySelectorAll('a'))
        // Tìm link có href chứa /posts/, /videos/, hoặc /reel/
        const postLinks = links.filter(l => 
            l.href.includes('/posts/') || 
            l.href.includes('/videos/') || 
            l.href.includes('/reel/') ||
            l.href.includes('permalink.php')
        )

        for (const link of postLinks) {
            // Tìm container chứa link này
            let parent = link.parentElement
            for (let i = 0; i < 15; i++) {
                if (!parent) break
                const text = parent.innerText || ''
                if (title && text.includes(title.substring(0, 30))) {
                    return link.href
                }
                parent = parent.parentElement
            }
        }
        return null
    }, postData.title)

    if (postLink) {
        logger(`[FIND-LINK] ✅ Đã tìm thấy link: ${postLink}`)
        return postLink
    }

    // 3. Dự phòng: Vào Nhật ký hoạt động (Activity Log)
    logger('[FIND-LINK] Thử tìm trong Nhật ký hoạt động...')
    const activityUrl = mobileUrl.endsWith('/') ? mobileUrl + 'allactivity' : mobileUrl + '/allactivity'
    await page.goto(activityUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    const linkFromActivity = await page.evaluate((title: string) => {
        const items = Array.from(document.querySelectorAll('div[role="listitem"], div[data-sigil="marea"]'))
        for (const item of items) {
            const text = (item as HTMLElement).innerText || ''
            if (title && text.includes(title.substring(0, 20))) {
                const link = item.querySelector('a')
                if (link) return (link as HTMLAnchorElement).href
            }
        }
        return null
    }, postData.title)

    if (linkFromActivity) {
        logger(`[FIND-LINK] ✅ Tìm thấy link từ Activity Log: ${linkFromActivity}`)
        return linkFromActivity
    }

    logger('[FIND-LINK] ⚠️ Không tìm thấy link bài viết.')
    return null
  }
}