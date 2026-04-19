import { InstagramAutomation } from './platforms/instagram'
import { TikTokAutomation } from './platforms/tiktok'
import { YouTubeAutomation } from './platforms/youtube'
import { FacebookAutomation } from './platforms/facebook'
import { BrowserContext, Page } from 'playwright'

export interface PlatformHandler {
  postToPlatform(
    page: Page,
    postData: any,
    logger: (msg: string) => void
  ): Promise<void>
}

export class PlatformFactory {
  private static handlers: Record<string, PlatformHandler> = {
    Facebook: new FacebookAutomation(),
    Instagram: new InstagramAutomation(),
    TikTok: new TikTokAutomation(),
    YouTube: new YouTubeAutomation()
  }

  static getHandler(platform: string): PlatformHandler | null {
    return this.handlers[platform] || null
  }

  static registerHandler(platform: string, handler: PlatformHandler): void {
    this.handlers[platform] = handler
    console.log(`[PlatformFactory] Đã đăng ký handler cho ${platform}`)
  }

  static getSupportedPlatforms(): string[] {
    return Object.keys(this.handlers)
  }
}
