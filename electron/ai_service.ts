import { GoogleGenerativeAI } from '@google/generative-ai'
import { dbService } from './db'
import { decrypt } from './crypto_utils'

export class AIService {
    private static lastSuccessfulConfig: { model: string, version: string } | null = null;
    private static lastRequestTime: number = 0;

    private static async applyRateLimit() {
        const now = Date.now();
        const minInterval = 8000; // 8s to stay under Gemini RPM limits
        const timeSinceLast = now - this.lastRequestTime;
        
        if (timeSinceLast < minInterval) {
            const waitTime = minInterval - timeSinceLast;
            console.log(`[AI Service] Rate limiting: Waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }

    private static async getModel(modelName: string, apiVersion: string = 'v1') {
        const encryptedKey = dbService.getSetting('gemini_api_key') as any
        if (!encryptedKey || !encryptedKey.encrypted_value) {
            throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào phần Cài đặt AI.')
        }

        const apiKey = decrypt(encryptedKey.encrypted_value)
        const genAI = new GoogleGenerativeAI(apiKey)
        // Correct usage: apiVersion MUST be passed as the second argument to getGenerativeModel
        return genAI.getGenerativeModel({ model: modelName }, { apiVersion })
    }

    // Helper to run AI calls with fallback across models and API versions
    private static async runWithFallback(operation: (model: any) => Promise<any>) {
        const modelNames = [
            'gemini-3.1-flash-lite',
            'gemini-3.1-pro',
            'gemini-3-flash',
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-2.0-flash-exp',
            'gemini-pro'
        ]
        const versions = ['v1', 'v1beta']
        
        // 1. Try last successful config first
        if (this.lastSuccessfulConfig) {
            try {
                // Apply rate limit before call
                await this.applyRateLimit();
                
                const model = await this.getModel(this.lastSuccessfulConfig.model, this.lastSuccessfulConfig.version)
                return await operation(model)
            } catch (error: any) {
                // If it's a transient error (503/429), DON'T discard the config, just retry or throw
                const isTransient = error.status === 503 || error.status === 429 || 
                                  error.message?.includes('503') || error.message?.includes('429');
                
                if (isTransient) {
                    console.warn(`[AI Service] Model ${this.lastSuccessfulConfig.model} is busy (503/429). Waiting 10s...`)
                    await new Promise(resolve => setTimeout(resolve, 10000))
                    // Try one more time with same model
                    try {
                        const model = await this.getModel(this.lastSuccessfulConfig.model, this.lastSuccessfulConfig.version)
                        return await operation(model)
                    } catch (retryError) {
                        console.error('[AI Service] Retry failed after 503/429.')
                        throw retryError
                    }
                }

                console.warn(`[AI Service] Cached config ${this.lastSuccessfulConfig.model} failed permanently, re-scanning...`)
                this.lastSuccessfulConfig = null
            }
        }

        let lastError = null

        // 2. Scan through combinations
        for (const version of versions) {
            for (const modelName of modelNames) {
                try {
                    // Apply rate limit before scanning
                    await this.applyRateLimit();
                    
                    console.log(`[AI Service] Scanning: ${modelName} on ${version}`)
                    const model = await this.getModel(modelName, version)
                    const result = await operation(model)
                    
                    this.lastSuccessfulConfig = { model: modelName, version }
                    console.log(`[AI Service] Found working configuration: ${modelName} (${version})`)
                    return result
                } catch (error: any) {
                    lastError = error
                    const isNotFound = error.status === 404 || 
                                     error.status === 403 ||
                                     error.message?.includes('404') || 
                                     error.message?.includes('not found') ||
                                     error.message?.includes('403')

                    if (isNotFound) {
                        continue // Keep scanning
                    }
                    
                    // If 503/429 during scanning, it technically exists but is busy
                    if (error.status === 503 || error.status === 429) {
                        console.warn(`[AI Service] Found ${modelName} but it is currently busy (503/429). Attempting to use it anyway...`)
                        this.lastSuccessfulConfig = { model: modelName, version }
                        throw error // Let the UI or outer loop handle the retry
                    }

                    throw error 
                }
            }
        }
        
        console.error('[AI Service] All model/version combinations failed.')
        throw lastError
    }

    static async generatePostContent(promptContent: string, keyword: string) {
        return this.runWithFallback(async (model) => {
            const fullPrompt = `${promptContent}\n\nTừ khóa chính của bài viết: ${keyword}`
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        })
    }

    static async generateCTAComment(productData: any, promptContent: string) {
        return this.runWithFallback(async (model) => {
            const context = `Sản phẩm: ${productData.name}\nShopee: ${productData.shopee_link}\nZalo: ${productData.zalo_link}\nWeb: ${productData.web_link}`
            const fullPrompt = `${promptContent}\n\nThông tin sản phẩm mục tiêu:\n${context}`
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        })
    }

    static async generateSmartCTAFromPost(context: { caption: string, description: string, shopeeLink: string, mediaAnalysis?: string }, promptContent: string) {
        return this.runWithFallback(async (model) => {
            const contextStr = `
Nội dung bài viết: ${context.caption}
Mô tả bổ sung: ${context.description}
Link Shopee Sản phẩm: ${context.shopeeLink}
${context.mediaAnalysis ? `Phân tích hình ảnh/video: ${context.mediaAnalysis}` : ''}
`.trim()
            const fullPrompt = `
BẠN LÀ CHUYÊN GIA VIẾT BÌNH LUẬN ĐIỀU HƯỚNG (CTA).
DỰA TRÊN NGỮ CẢNH BÀI VIẾT VÀ LINK SẢN PHẨM SAU ĐÂY, HÃY VIẾT MỘT BÌNH LUẬN TỰ NHIÊN, THU HÚT ĐỂ KHUYẾN KHÍCH NGƯỜI DÙNG NHẤP VÀO LINK.

NGỮ CẢNH BÀI VIẾT:
${contextStr}

YÊU CẦU:
${promptContent}

TRẢ VỀ CHỈ NỘI DUNG BÌNH LUẬN, KHÔNG GIẢI THÍCH GÌ THÊM.
`
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        })
    }

    static async analyzeAndRecommendKeywords(analysis: string) {
        return this.runWithFallback(async (model) => {
            const prompt = `Dựa trên mô tả nội dung video/hình ảnh sau đây: "${analysis}". Hãy đề xuất 5-8 từ khóa (keywords) ngắn gọn, phù hợp nhất để SEO và gắn nhãn cho nội dung này. Chỉ trả về các từ khóa cách nhau bằng dấu phẩy, không giải thích thêm.`
            const result = await model.generateContent(prompt)
            const response = await result.response
            return response.text().split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0).join(', ')
        })
    }

    static async generateSmartPostByGuidelines(guidelines: string, analysis: string, keywords: string) {
        return this.runWithFallback(async (model) => {
            const prompt = `
BẠN LÀ CHUYÊN GIA SÁNG TẠO NỘI DUNG MẠNG XÃ HỘI.

ĐÂY LÀ QUY ĐỊNH CHUNG (GUIDELINES):
${guidelines}

ĐÂY LÀ PHÂN TÍCH MEDIA (HÌNH ẢNH/VIDEO):
${analysis}

TỪ KHÓA ĐỀ XUẤT:
${keywords}

YÊU CẦU:
Dựa trên Quy định chung và Phân tích nội dung media, hãy viết một bài đăng hoàn chỉnh bao gồm:
1. Tiêu đề (thu hút).
2. Nội dung bài viết (phù hợp với phong cách trong Quy định chung).
3. Hashtags (liên quan đến nội dung và từ khóa).

Định dạng trả về:
Tiêu đề: ...
Nội dung: ...
Hashtags: ...
`
            const result = await model.generateContent(prompt)
            const response = await result.response
            return response.text()
        })
    }

    static async describeMedia(filePath: string) {
        return this.runWithFallback(async (model) => {
            const fs = await import('fs')
            const path = await import('path')
            
            const stats = fs.statSync(filePath)
            const fileSizeMB = stats.size / (1024 * 1024)
            const fileName = path.basename(filePath)
            
            if (fileSizeMB > 20) {
                return `Đây là một tài nguyên có tên "${fileName}", dung lượng lớn (${fileSizeMB.toFixed(2)}MB). Hãy sinh nội dung dựa trên tên file.`
            }

            const imageData = fs.readFileSync(filePath)
            const prompt = "Hãy nhìn vào hình ảnh/video này và mô tả ngắn gọn nội dung của nó bằng 2-3 câu. Tập trung vào chủ đề chính và các chi tiết nổi bật để làm tư liệu viết bài."
            
            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageData.toString('base64'),
                        mimeType: filePath.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'
                    }
                }
            ])
            const response = await result.response
            return response.text()
        }).catch(err => {
            console.error('[AI Service] Media analysis failed permanently:', err)
            return 'Không thể phân tích nội dung hình ảnh/video này.'
        })
    }
}
