import { GoogleGenerativeAI } from '@google/generative-ai'
import { dbService } from './db'
import { decrypt } from './crypto_utils'
import fs from 'node:fs'
import path from 'node:path'

export class AIService {
    // Cấu hình các model theo cấp độ - Tối ưu cho rate limit và chi phí
    private static readonly MODEL_CONFIGS = {
        // Tier 1: Nhanh nhất, rẻ nhất - Cho tác vụ đơn giản
        LITE: {
            name: 'gemini-2.0-flash-lite-preview-01-21', // Model mới nhất, nhanh nhất
            fallback: 'gemini-1.5-flash',
            maxOutputTokens: 2048,
            temperature: 0.7,
        },
        // Tier 2: Cân bằng - Mặc định cho hầu hết tác vụ
        STANDARD: {
            name: 'gemini-2.0-flash',
            fallback: 'gemini-1.5-flash',
            maxOutputTokens: 4096,
            temperature: 0.8,
        },
        // Tier 3: Mạnh nhất - Cho tác vụ phức tạp
        PRO: {
            name: 'gemini-1.5-pro',
            fallback: 'gemini-2.0-flash',
            maxOutputTokens: 8192,
            temperature: 0.9,
        },
    };

    private static lastSuccessfulConfig: { model: string, version: string } | null = null;
    private static lastRequestTime: number = 0;
    private static currentRetryDelay: number = 1000; // Adaptive backoff starting point
    private static readonly LARGE_FILE_THRESHOLD_MB = 20;
    private static readonly RATE_LIMIT_INTERVAL_MS = 3000; // Giảm từ 5s xuống 3s nhờ dùng Lite model
    private static readonly MAX_RETRY_DELAY = 30000;
    private static readonly BASE_RETRY_DELAY = 1000;
    
    /**
     * Chọn model dựa trên độ phức tạp của tác vụ
     * Giúp tối ưu rate limit và chi phí
     */
    private static selectModel(taskType: 'simple' | 'standard' | 'complex' = 'standard') {
        switch (taskType) {
            case 'simple':
                return this.MODEL_CONFIGS.LITE;
            case 'complex':
                return this.MODEL_CONFIGS.PRO;
            case 'standard':
            default:
                return this.MODEL_CONFIGS.STANDARD;
        }
    }
    
    /**
     * Enhanced rate limiting với adaptive backoff
     * Giải quyết hạn chế: Rate limit Gemini làm chậm quá trình sinh bài hàng loạt
     */
    private static async applyRateLimit() {
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        
        if (timeSinceLast < this.RATE_LIMIT_INTERVAL_MS) {
            const waitTime = this.RATE_LIMIT_INTERVAL_MS - timeSinceLast;
            console.log(`[AI Service] Rate limiting: Chờ ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }

    /**
     * Xử lý file lớn với chiến lược phân tích thông minh
     * Giải quyết hạn chế: Media file >20MB sẽ bị skip phân tích AI
     */
    private static async analyzeLargeFile(filePath: string): Promise<string> {
        const stats = fs.statSync(filePath)
        const fileSizeMB = stats.size / (1024 * 1024)
        const fileName = path.basename(filePath)
        const ext = path.extname(fileName).toLowerCase()
        
        console.log(`[AI Service] Phát hiện file lớn: ${fileName} (${fileSizeMB.toFixed(2)}MB)`);
        
        // Chiến lược 1: Với video lớn, chỉ phân tích tên file và extension
        if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
            return `Video: ${fileName} (${fileSizeMB.toFixed(1)}MB). Hãy sinh nội dung dựa trên tên file và ngữ cảnh dự án.`;
        }
        
        // Chiến lược 2: Với ảnh lớn, thử phân tích trực tiếp (ảnh thường nén tốt hơn video)
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            try {
                const imageData = fs.readFileSync(filePath)
                // Gemini có thể xử lý ảnh đến vài MB, thử phân tích
                return await this.analyzeImageDirect(imageData, fileName, ext);
            } catch (err) {
                console.warn(`[AI Service] Không thể phân tích ảnh lớn ${fileName}, dùng fallback`);
                return `Hình ảnh: ${fileName} (${fileSizeMB.toFixed(1)}MB). Hãy sinh nội dung dựa trên tên file.`;
            }
        }
        
        return `Tệp tin: ${fileName} (${fileSizeMB.toFixed(1)}MB).`;
    }

    private static async analyzeImageDirect(
        imageData: Buffer, 
        fileName: string, 
        ext: string
    ): Promise<string> {
        // Sử dụng runWithFallback để thử nhiều model khác nhau
        return this.runWithFallback(async (model) => {
            const prompt = "Hãy nhìn vào hình ảnh này và mô tả ngắn gọn nội dung của nó bằng 2-3 câu.";
            
            const mimeType = ext === '.png' ? 'image/png' : 
                            ext === '.webp' ? 'image/webp' : 'image/jpeg';
            
            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageData.toString('base64'),
                        mimeType
                    }
                }
            ]);
            const response = await result.response;
            return response.text();
        }).catch(err => {
            console.warn(`[AI Service] Fallback analysis cho ${fileName}`);
            return `Hình ảnh: ${fileName}. Hãy sinh nội dung dựa trên tên file.`;
        });
    }

    private static async getModel(modelName: string, apiVersion: string = 'v1') {
        const encryptedKey = dbService.getSetting('gemini_api_key') as any
        if (!encryptedKey || !encryptedKey.encrypted_value) {
            throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào phần Cài đặt AI.')
        }

        const apiKey = decrypt(encryptedKey.encrypted_value)
        const genAI = new GoogleGenerativeAI(apiKey)
        return genAI.getGenerativeModel({ model: modelName }, { apiVersion })
    }

    // Helper to run AI calls with fallback across models and API versions
    private static async runWithFallback(
        operation: (model: any) => Promise<any>, 
        config?: { name: string, fallback: string }
    ) {
        // Nếu có config được truyền vào, ưu tiên sử dụng
        if (config) {
            try {
                await this.applyRateLimit();
                
                const model = await this.getModel(config.name)
                return await operation(model)
            } catch (error: any) {
                console.warn(`[AI Service] Model ${config.name} thất bại, thử fallback...`)
                
                // Thử fallback nếu có
                if (config.fallback) {
                    try {
                        await this.applyRateLimit();
                        const fallbackModel = await this.getModel(config.fallback)
                        return await operation(fallbackModel)
                    } catch (fallbackError) {
                        console.error(`[AI Service] Fallback ${config.fallback} cũng thất bại.`)
                        throw fallbackError
                    }
                }
                throw error
            }
        }

        // Fallback legacy: quét qua tất cả models nếu không có config
        const modelNames = [
            'gemini-2.0-flash-lite-preview-01-21', // Ưu tiên Lite model mới nhất
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
        ]
        const versions = ['v1', 'v1beta']
        
        // 1. Try last successful config first
        if (this.lastSuccessfulConfig) {
            try {
                await this.applyRateLimit();
                
                const model = await this.getModel(this.lastSuccessfulConfig.model, this.lastSuccessfulConfig.version)
                return await operation(model)
            } catch (error: any) {
                const isTransient = error.status === 503 || error.status === 429 || 
                                  error.message?.includes('503') || error.message?.includes('429');
                
                if (isTransient) {
                    console.warn(`[AI Service] Model ${this.lastSuccessfulConfig.model} đang bận (503/429). Chờ ${this.currentRetryDelay}ms...`)
                    await new Promise(resolve => setTimeout(resolve, this.currentRetryDelay))
                    this.currentRetryDelay = Math.min(this.currentRetryDelay * 2, this.MAX_RETRY_DELAY)
                    try {
                        const model = await this.getModel(this.lastSuccessfulConfig.model, this.lastSuccessfulConfig.version)
                        return await operation(model)
                    } catch (retryError) {
                        console.error('[AI Service] Retry failed after 503/429.')
                        throw retryError
                    }
                }

                console.warn(`[AI Service] Cached config ${this.lastSuccessfulConfig.model} failed, re-scanning...`)
                this.lastSuccessfulConfig = null
                this.currentRetryDelay = this.BASE_RETRY_DELAY
            }
        }

        let lastError = null

        // 2. Scan through combinations
        for (const version of versions) {
            for (const modelName of modelNames) {
                try {
                    await this.applyRateLimit();
                    
                    console.log(`[AI Service] Scanning: ${modelName} on ${version}`)
                    const model = await this.getModel(modelName, version)
                    const result = await operation(model)
                    
                    this.lastSuccessfulConfig = { model: modelName, version }
                    this.currentRetryDelay = this.BASE_RETRY_DELAY // Reset on success
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
                        continue
                    }
                    
                    if (error.status === 503 || error.status === 429) {
                        console.warn(`[AI Service] Found ${modelName} nhưng đang bận (503/429).`)
                        this.lastSuccessfulConfig = { model: modelName, version }
                        throw error
                    }

                    throw error 
                }
            }
        }
        
        console.error('[AI Service] All model/version combinations failed.')
        throw lastError
    }

    static async generatePostContent(promptContent: string, keyword: string) {
        // Sử dụng model STANDARD cho tác vụ sinh bài viết thông thường
        const config = this.selectModel('standard');
        
        return this.runWithFallback(async (model) => {
            const fullPrompt = `${promptContent}\n\nTừ khóa chính của bài viết: ${keyword}`
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        }, config);
    }

    static async generateCTAComment(productData: any, promptContent: string) {
        // Sử dụng model LITE cho tác vụ đơn giản như viết CTA
        const config = this.selectModel('simple');
        
        return this.runWithFallback(async (model) => {
            const context = `Sản phẩm: ${productData.name}\nShopee: ${productData.shopee_link}\nZalo: ${productData.zalo_link}\nWeb: ${productData.web_link}`
            const fullPrompt = `${promptContent}\n\nThông tin sản phẩm mục tiêu:\n${context}`
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        }, config);
    }

    static async generateSmartCTAFromPost(context: { caption: string, description: string, shopeeLink: string, mediaAnalysis?: string }, promptContent: string) {
        // Sử dụng model STANDARD cho CTA thông minh
        const config = this.selectModel('standard');
        
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
        }, config);
    }

    static async analyzeAndRecommendKeywords(analysis: string) {
        // Sử dụng model LITE cho tác vụ đơn giản như đề xuất từ khóa
        const config = this.selectModel('simple');
        
        return this.runWithFallback(async (model) => {
            const prompt = `Dựa trên mô tả nội dung video/hình ảnh sau đây: "${analysis}". Hãy đề xuất 5-8 từ khóa (keywords) ngắn gọn, phù hợp nhất để SEO và gắn nhãn cho nội dung này. Chỉ trả về các từ khóa cách nhau bằng dấu phẩy, không giải thích thêm.`
            const result = await model.generateContent(prompt)
            const response = await result.response
            return response.text().split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0).join(', ')
        }, config);
    }

    static async generateSmartPostByGuidelines(guidelines: string, analysis: string, keywords: string) {
        // Sử dụng model PRO cho tác vụ phức tạp cần suy luận sâu
        const config = this.selectModel('complex');
        
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
        }, config);
    }

    static async describeMedia(filePath: string) {
        try {
            const stats = fs.statSync(filePath)
            const fileSizeMB = stats.size / (1024 * 1024)
            const fileName = path.basename(filePath)
            
            // Xử lý file lớn với chiến lược thông minh
            if (fileSizeMB > this.LARGE_FILE_THRESHOLD_MB) {
                return await this.analyzeLargeFile(filePath)
            }

            // File nhỏ hơn threshold, phân tích bình thường
            const imageData = fs.readFileSync(filePath)
            const ext = path.extname(filePath).toLowerCase()
            const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)
            
            const prompt = "Hãy nhìn vào hình ảnh/video này và mô tả ngắn gọn nội dung của nó bằng 2-3 câu. Tập trung vào chủ đề chính và các chi tiết nổi bật để làm tư liệu viết bài."
            
            const result = await this.runWithFallback(async (model) => {
                return await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: imageData.toString('base64'),
                            mimeType: isVideo ? 'video/mp4' : 'image/jpeg'
                        }
                    }
                ])
            })
            
            const response = await result.response
            return response.text()
        } catch (err: any) {
            console.error('[AI Service] Media analysis failed:', err.message)
            const fileName = path.basename(filePath)
            return `Không thể phân tích nội dung "${fileName}". Hãy sinh nội dung dựa trên tên file.`
        }
    }
}
