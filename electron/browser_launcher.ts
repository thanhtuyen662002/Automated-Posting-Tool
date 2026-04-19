import { chromium } from 'playwright'
import { BrowserContext } from 'playwright'

/**
 * Enhanced Browser Launcher with Multi-Browser Support
 * Giải quyết hạn chế: Cần Chrome cài đặt sẵn
 */

export interface BrowserLaunchOptions {
  userDataDir: string
  headless?: boolean
  isMobile?: boolean
  viewport?: { width: number; height: number }
  platform?: string
}

export class BrowserLauncher {
  private static readonly BROWSER_CHANNELS = [
    'chrome',
    'chrome-beta',
    'chrome-dev',
    'chrome-canary',
    'msedge',
    'msedge-beta',
    'msedge-dev',
    'chromium'
  ] as const

  /**
   * Try to launch browser with multiple fallback strategies
   * Ưu tiên: Chrome → Edge → Chromium stock
   */
  static async launchWithFallback(options: BrowserLaunchOptions): Promise<BrowserContext> {
    const { userDataDir, headless = false, isMobile = false, viewport, platform } = options
    
    const defaultArgs = [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]

    const mobileOptions = isMobile ? {
      userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
      deviceScaleFactor: 2,
      hasTouch: true,
      viewport: viewport || { width: 360, height: 740 }
    } : {
      viewport: viewport || { width: 1280, height: 800 }
    }

    // Strategy 1: Try each channel in order
    for (const channel of this.BROWSER_CHANNELS) {
      try {
        console.log(`[BrowserLauncher] Thử khởi tạo với ${channel}...`)
        
        const context = await chromium.launchPersistentContext(userDataDir, {
          headless,
          channel: channel as any,
          args: defaultArgs,
          ...mobileOptions
        })

        console.log(`[BrowserLauncher] Thành công với ${channel}`)
        return context
      } catch (error: any) {
        console.warn(`[BrowserLauncher] ${channel} không khả dụng:`, error.message)
        continue
      }
    }

    // Strategy 2: Launch without channel (use system chromium)
    console.log('[BrowserLauncher] Thử khởi tạo Chromium mặc định...')
    try {
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless,
        args: [...defaultArgs, '--no-sandbox'],
        ...mobileOptions
      })
      
      console.log('[BrowserLauncher] Thành công với Chromium mặc định')
      return context
    } catch (error: any) {
      console.error('[BrowserLauncher] Tất cả phương thức khởi tạo đều thất bại')
      throw new Error(
        'Không tìm thấy trình duyệt tương thích. Vui lòng cài đặt Chrome, Edge hoặc Chromium.'
      )
    }
  }

  /**
   * Get platform-specific configurations
   */
  static getPlatformConfig(platform: string): {
    isMobile: boolean
    viewport: { width: number; height: number }
    uploadUrl: string
  } {
    const configs: Record<string, any> = {
      Facebook: {
        isMobile: true,
        viewport: { width: 360, height: 740 },
        uploadUrl: 'https://www.facebook.com'
      },
      Instagram: {
        isMobile: true,
        viewport: { width: 360, height: 740 },
        uploadUrl: 'https://www.instagram.com'
      },
      TikTok: {
        isMobile: false,
        viewport: { width: 1280, height: 800 },
        uploadUrl: 'https://www.tiktok.com/upload'
      },
      YouTube: {
        isMobile: false,
        viewport: { width: 1280, height: 800 },
        uploadUrl: 'https://www.youtube.com/upload'
      },
      Linkedin: {
        isMobile: false,
        viewport: { width: 1280, height: 800 },
        uploadUrl: 'https://www.linkedin.com/feed'
      },
      Twitter: {
        isMobile: false,
        viewport: { width: 1280, height: 800 },
        uploadUrl: 'https://twitter.com/home'
      }
    }

    return configs[platform] || {
      isMobile: false,
      viewport: { width: 1280, height: 800 },
      uploadUrl: 'https://www.google.com'
    }
  }
}
