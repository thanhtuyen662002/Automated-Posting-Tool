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
  proxy?: string // Định dạng: host:port hoặc host:port:user:pass
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
    const { userDataDir, headless = false, isMobile = false, viewport, platform, proxy } = options
    
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

    // Proxy Configuration
    const proxyOptions = this.parseProxy(proxy)

    // Strategy 1: Try each channel in order
    for (const channel of this.BROWSER_CHANNELS) {
      try {
        console.log(`[BrowserLauncher] Thử khởi tạo với ${channel}...`)
        
        const context = await chromium.launchPersistentContext(userDataDir, {
          headless,
          channel: channel as any,
          args: defaultArgs,
          proxy: proxyOptions,
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
        proxy: proxyOptions,
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
   * Helper to parse proxy strings
   * Formats: host:port, host:port:user:pass, http://host:port, etc.
   */
  private static parseProxy(proxyStr?: string): { server: string; username?: string; password?: string } | undefined {
    if (!proxyStr || proxyStr.trim() === '') return undefined

    try {
      // 1. Remove protocol if present
      let cleanProxy = proxyStr.replace(/^(http|https|socks5|socks4):\/\//, '')
      
      // 2. Split by colon
      const parts = cleanProxy.split(':')
      
      if (parts.length === 2) {
        // host:port
        return { server: `http://${parts[0]}:${parts[1]}` }
      } else if (parts.length === 4) {
        // host:port:user:pass
        return {
          server: `http://${parts[0]}:${parts[1]}`,
          username: parts[2],
          password: parts[3]
        }
      } else if (proxyStr.includes('@')) {
        // user:pass@host:port
        const url = new URL(proxyStr.startsWith('http') ? proxyStr : `http://${proxyStr}`)
        return {
          server: `${url.protocol}//${url.host}`,
          username: url.username,
          password: url.password
        }
      }

      // Default fallback if logic above doesn't match perfectly but string exists
      return { server: proxyStr.startsWith('http') ? proxyStr : `http://${proxyStr}` }
    } catch (e) {
      console.error('[BrowserLauncher] Lỗi khi nhận diện cấu hình Proxy:', e)
      return undefined
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
        uploadUrl: 'https://m.facebook.com'
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
