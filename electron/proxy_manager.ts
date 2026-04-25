import { Page } from './db'

/**
 * Proxy Manager - Xử lý IP tự động qua API (TMProxy, TinProxy)
 * Giúp người dùng không chuyên chỉ cần dán Key là có IP sạch.
 */
export class ProxyManager {
  /**
   * Lấy IP mới nhất từ dịch vụ hoặc hiện tại nếu chưa cần xoay
   */
  static async getResolvedProxy(page: Page): Promise<string> {
    if (!page.proxy_type || page.proxy_type === 'static' || page.proxy_type === 'none') {
      return page.proxy || ''
    }

    const apiKey = (page.proxy || '').trim()
    if (!apiKey) return ''

    try {
      console.log(`[ProxyManager] Đang xử lý IP tự động cho Page #${page.id} (${page.proxy_type})...`)
      
      let resolvedProxy = ''

      if (page.proxy_type === 'tmproxy') {
        resolvedProxy = await this.getTMProxy(apiKey)
      } else if (page.proxy_type === 'tinproxy') {
        resolvedProxy = await this.getTinProxy(apiKey)
      }

      console.log(`[ProxyManager] IP đã giải quyết: ${resolvedProxy || 'Không xác định'}`)
      return resolvedProxy
    } catch (error: any) {
      console.error(`[ProxyManager] Lỗi khi lấy IP từ ${page.proxy_type}:`, error.message)
      return ''
    }
  }

  /**
   * Logic TMProxy (https://tmproxy.com/api-document)
   */
  private static async getTMProxy(apiKey: string): Promise<string> {
    try {
      // 1. Thử lấy IP hiện tại trước
      const currentRes = await fetch('https://tmproxy.com/api/proxy/get-current-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      })
      const currentData = await currentRes.json()

      if (currentData.code === 0 && currentData.data?.https) {
        // Nếu còn hạn và dùng được, trả về luôn
        if (currentData.data.next_request === 0) {
           // Có thể xoay ngay nếu muốn, nhưng ở đây ta ưu tiên dùng tiếp nếu còn sống
        }
        return currentData.data.https
      }

      // 2. Nếu không lấy được hiện tại hoặc cần xoay, gọi lấy IP mới
      const newRes = await fetch('https://tmproxy.com/api/proxy/get-new-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      })
      const newData = await newRes.json()

      if (newData.code === 0 && newData.data?.https) {
        return newData.data.https
      }

      // Nếu đang trong thời gian chờ (cooldown)
      if (newData.code === 5 && currentData.data?.https) {
        return currentData.data.https
      }

      throw new Error(newData.message || 'Lỗi API TMProxy')
    } catch (e: any) {
      throw e
    }
  }

  /**
   * Logic TinProxy (https://tinproxy.com/api-document)
   */
  private static async getTinProxy(apiKey: string): Promise<string> {
    try {
      const res = await fetch(`https://api.tinproxy.com/proxy/get-new-proxy?api_key=${apiKey}`)
      const data = await res.json()

      if (data.success && data.data?.proxy) {
        return data.data.proxy
      }

      // Nếu lỗi cooldown, thử lấy IP hiện tại
      const currentRes = await fetch(`https://api.tinproxy.com/proxy/get-current-proxy?api_key=${apiKey}`)
      const currentData = await currentRes.json()
      
      if (currentData.success && currentData.data?.proxy) {
        return currentData.data.proxy
      }

      throw new Error(data.message || 'Lỗi API TinProxy')
    } catch (e: any) {
      throw e
    }
  }
}
