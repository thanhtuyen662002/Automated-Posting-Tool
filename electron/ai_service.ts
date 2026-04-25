import { GoogleGenerativeAI } from '@google/generative-ai'
import { dbService } from './db'
import { decrypt } from './crypto_utils'
import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'

export class AIService {
    private static readonly MODEL_CONFIGS = {
        LITE: {
            name: 'models/gemini-3.1-flash-lite-preview', 
            fallback: 'models/gemini-1.5-flash',
            maxOutputTokens: 2048,
            temperature: 0.7,
        },
        STANDARD: {
            name: 'models/gemini-3.1-flash-lite-preview',
            fallback: 'models/gemini-3-flash-preview',
            maxOutputTokens: 4096,
            temperature: 0.8,
        },
        PRO: {
            name: 'models/gemini-3.1-pro-preview',
            fallback: 'models/gemini-2.5-pro',
            maxOutputTokens: 8192,
            temperature: 0.9,
        },
        BATCH: {
            name: 'models/gemini-3-flash-preview',
            fallback: 'models/gemini-1.5-pro',
            maxOutputTokens: 16383,
            temperature: 1.0,
        }
    };

    private static lastRequestTime: number = 0;
    private static readonly LARGE_FILE_THRESHOLD_MB = 20;
    private static readonly RATE_LIMIT_INTERVAL_MS = 3000;

    private static selectModel(taskType: 'simple' | 'standard' | 'complex' | 'batch' = 'standard') {
        switch (taskType) {
            case 'simple': return this.MODEL_CONFIGS.LITE;
            case 'batch': return this.MODEL_CONFIGS.BATCH;
            case 'complex': return this.MODEL_CONFIGS.PRO;
            case 'standard':
            default: return this.MODEL_CONFIGS.STANDARD;
        }
    }

    private static async applyRateLimit() {
        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        if (timeSinceLast < this.RATE_LIMIT_INTERVAL_MS) {
            await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_INTERVAL_MS - timeSinceLast));
        }
        this.lastRequestTime = Date.now();
    }

    private static processPromptWithPlaceholders(prompt: string, data: { product?: any, keyword?: string }) {
        let processed = prompt;
        const { product, keyword } = data;

        if (product) {
            // 1. Thẻ chính thức
            const officialTags = [
                { regex: /\[TÊN_SẢN_PHẨM\]/g, value: product.name },
                { regex: /\[LINK_SẢN_PHẨM\]/g, value: product.shopee_link || product.web_link || '' },
                { regex: /\[TỪ_KHÓA\]/g, value: keyword || '' }
            ];
            officialTags.forEach(tag => processed = processed.replace(tag.regex, tag.value));

            // 2. Thẻ linh hoạt (Tiếng Việt)
            const productNames = [
                /\[Tên loại hoa\/mẫu kẽm nhung\]/gi,
                /\[Tên mẫu hoa của bạn vào đây\]/gi,
                /\[Tên sản phẩm\]/gi,
                /\[Sản phẩm\]/gi,
                /\[Tên váy\/đầm\/quần\]/gi,
                /\[Tên mẫu thời trang\]/gi,
                /\[Tên đồ gia dụng\]/gi,
                /\[Tên món ăn\]/gi
            ];
            productNames.forEach(regex => {
                processed = processed.replace(regex, product.name);
            });

            // 3. Link placeholders
            const linkPlaceholders = [
                /\[Link Shopee tại đây\]/gi,
                /\[Link Shopee\]/gi,
                /\[Link sản phẩm\]/gi,
                /\[Link bio\]/gi,
                /\[Link tại đây\]/gi,
                /\[Link mua hàng\]/gi
            ];
            linkPlaceholders.forEach(regex => {
                processed = processed.replace(regex, product.shopee_link || product.web_link || '');
            });

            processed = processed.replace(/\[Link Web\]/gi, product.web_link || '');
            processed = processed.replace(/\[Link Zalo\]/gi, product.zalo_link || '');
        }

        if (keyword) {
            processed = processed.replace(/\[TỪ_KHÓA\]/g, keyword);
            processed = processed.replace(/\[Từ khóa\]/gi, keyword);
            processed = processed.replace(/\[KEYWORD\]/gi, keyword);
        }

        return processed;
    }

    private static async analyzeLargeFile(filePath: string): Promise<string> {
        const stats = fs.statSync(filePath)
        const fileSizeMB = stats.size / (1024 * 1024)
        const fileName = path.basename(filePath)
        const ext = path.extname(fileName).toLowerCase()

        if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
            return `Video: ${fileName} (${fileSizeMB.toFixed(1)}MB). Hãy sinh nội dung dựa trên tên file và ngữ cảnh dự án.`;
        }

        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            try {
                const imageData = fs.readFileSync(filePath)
                return await this.analyzeImageDirect(imageData, fileName, ext);
            } catch (err) {
                return `Hình ảnh: ${fileName} (${fileSizeMB.toFixed(1)}MB). Hãy sinh nội dung dựa trên tên file.`;
            }
        }

        return `Tệp tin: ${fileName} (${fileSizeMB.toFixed(1)}MB).`;
    }

    private static async analyzeImageDirect(imageData: Buffer, fileName: string, ext: string): Promise<string> {
        const modelConfig = this.selectModel('simple');
        return this.runWithFallback(async (model) => {
            const prompt = "Hãy nhìn vào hình ảnh này và mô tả ngắn gọn nội dung của nó bằng 2-3 câu.";
            const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

            const result = await model.generateContent([
                prompt,
                { inlineData: { data: imageData.toString('base64'), mimeType } }
            ]);
            const response = await result.response;
            return response.text();
        }, modelConfig).catch(err => {
            console.warn(`[AI Service] Fallback analysis cho ${fileName}`);
            return `Hình ảnh: ${fileName}. Hãy sinh nội dung dựa trên tên file.`;
        });
    }

    private static async getModel(modelName: string, apiVersion: string = 'v1beta') {
        const encryptedKey = dbService.getSetting('gemini_api_key') as any;
        const apiKey = decrypt(encryptedKey.encrypted_value);
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: modelName }, { apiVersion });
    }

    private static async runWithFallback(
        operation: (model: any) => Promise<any>,
        config: { name: string, fallback: string }
    ) {
        try {
            await this.applyRateLimit();
            const model = await this.getModel(config.name)
            return await operation(model)
        } catch (error: any) {
            const isRateLimited = error.status === 429 || error.message?.includes('429');
            const isOverloaded = error.status === 503 || error.message?.includes('503');

            if (isRateLimited || isOverloaded) {
                console.warn(`[AI Service] Model ${config.name} ${isRateLimited ? 'hết lượt dùng' : 'quá tải'}. Đang chuyển sang fallback...`)

                if (config.fallback) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        const fallbackModel = await this.getModel(config.fallback)
                        return await operation(fallbackModel)
                    } catch (fallbackError) {
                        // Cứu cánh cuối cùng là model LITE (500 RPD)
                        if (config.fallback !== this.MODEL_CONFIGS.LITE.name) {
                            console.warn(`[AI Service] Thử model cứu cánh LITE (500 RPD)...`)
                            try {
                                const liteModel = await this.getModel(this.MODEL_CONFIGS.LITE.name)
                                return await operation(liteModel)
                            } catch (e) {
                                throw fallbackError;
                            }
                        }
                        throw fallbackError;
                    }
                }
            }
            throw error;
        }
    }

    private static async getProviderConfig(projectId?: number): Promise<{ provider: 'google' | 'qwen', model: string }> {
        if (!projectId) return { provider: 'google', model: this.MODEL_CONFIGS.STANDARD.name }

        const projects = dbService.getProjects()
        const project = projects.find(p => p.id === projectId) as any
        if (project && project.ai_config) {
            try {
                return JSON.parse(project.ai_config)
            } catch (e) {
                console.error('[AI Service] Failed to parse ai_config, using default')
            }
        }
        return { provider: 'google', model: this.MODEL_CONFIGS.STANDARD.name }
    }

    private static async getQwenClient() {
        const encryptedKey = dbService.getSetting('qwen_api_key') as any;
        const apiKey = decrypt(encryptedKey.encrypted_value);
        return new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
    }

    static async generatePostContent(promptContent: string, keyword: string, projectId?: number, productData?: any) {
        const config = await this.getProviderConfig(projectId)
        const processedPrompt = this.processPromptWithPlaceholders(promptContent, { product: productData, keyword })

        if (config.provider === 'qwen') {
            const client = await this.getQwenClient()
            await this.applyRateLimit()
            const response = await client.chat.completions.create({
                model: config.model || 'qwen/qwen2.5-72b-instruct',
                messages: [{ role: 'user', content: `${processedPrompt}\n\nTừ khóa chính: ${keyword}` }]
            })
            return response.choices[0].message.content || ''
        }

        const modelConfig = this.selectModel('complex');
        return this.runWithFallback(async (model) => {
            const fullPrompt = `${processedPrompt}\n\nTừ khóa chính: ${keyword}`
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        }, modelConfig);
    }

    static async generateCTAComment(productData: any, promptContent: string, projectId?: number) {
        const config = await this.getProviderConfig(projectId)
        const processedPrompt = this.processPromptWithPlaceholders(promptContent, { product: productData })

        if (config.provider === 'qwen') {
            const client = await this.getQwenClient()
            await this.applyRateLimit()
            const context = `Sản phẩm: ${productData.name}`
            const response = await client.chat.completions.create({
                model: config.model || 'qwen/qwen2.5-72b-instruct',
                messages: [{ role: 'user', content: `${processedPrompt}\n\nNgữ cảnh: ${context}` }]
            })
            return response.choices[0].message.content || ''
        }

        const modelConfig = this.selectModel('simple');
        return this.runWithFallback(async (model) => {
            const context = `Sản phẩm: ${productData.name}`
            const fullPrompt = `${processedPrompt}\n\nNgữ cảnh: ${context}`
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        }, modelConfig);
    }

    static async generateSmartCTAFromPost(context: { caption: string, description: string, shopeeLink: string, mediaAnalysis?: string }, promptContent: string, projectId?: number) {
        const config = await this.getProviderConfig(projectId)
        const contextStr = `Nội dung: ${context.caption}`
        const fullPrompt = `Hãy viết một bình luận CTA dựa trên ngữ cảnh: ${contextStr}\nYêu cầu: ${promptContent}`

        if (config.provider === 'qwen') {
            const client = await this.getQwenClient()
            await this.applyRateLimit()
            const response = await client.chat.completions.create({
                model: config.model || 'qwen/qwen2.5-72b-instruct',
                messages: [{ role: 'user', content: fullPrompt }]
            })
            return response.choices[0].message.content || ''
        }

        const modelConfig = this.selectModel('simple');
        return this.runWithFallback(async (model) => {
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        }, modelConfig);
    }

    static async analyzeAndRecommendKeywords(analysis: string) {
        const modelConfig = this.selectModel('simple');
        return this.runWithFallback(async (model) => {
            const prompt = `Đề xuất 5-8 từ khóa cho nôi dung: "${analysis}". Chỉ trả về các từ khóa cách nhau bằng dấu phẩy.`
            const result = await model.generateContent(prompt)
            const response = await result.response
            return response.text().split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0).join(', ')
        }, modelConfig);
    }

    static async generateSmartPostByGuidelines(promptContent: string, analysis: string, keywords: string, projectId?: number) {
        const config = await this.getProviderConfig(projectId)
        const fullPrompt = `Guideline: ${promptContent}\nAnalysis: ${analysis}\nKeywords: ${keywords}`

        if (config.provider === 'qwen') {
            const client = await this.getQwenClient()
            await this.applyRateLimit()
            const response = await client.chat.completions.create({
                model: config.model || 'qwen/qwen2.5-72b-instruct',
                messages: [{ role: 'user', content: fullPrompt }]
            })
            return response.choices[0].message.content || ''
        }

        const modelConfig = this.selectModel('complex')
        return this.runWithFallback(async (model) => {
            const result = await model.generateContent(fullPrompt)
            const response = await result.response
            return response.text()
        }, modelConfig)
    }

    static async describeMedia(filePath: string, projectId?: number) {
        const config = await this.getProviderConfig(projectId)
        const stats = fs.statSync(filePath)
        const fileSizeMB = stats.size / (1024 * 1024)
        const ext = path.extname(filePath).toLowerCase()
        const fileName = path.basename(filePath)
        const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)

        // 1. Xử lý file quá lớn (không thể upload trực tiếp Base64)
        if (fileSizeMB > this.LARGE_FILE_THRESHOLD_MB) {
            return await this.analyzeLargeFile(filePath)
        }

        // 2. Nếu dùng Qwen (OpenRouter) - hỗ trợ Vision
        if (config.provider === 'qwen') {
            try {
                const client = await this.getQwenClient()
                const base64Data = fs.readFileSync(filePath).toString('base64')
                const response = await client.chat.completions.create({
                    model: config.model || 'qwen/qwen2.5-vl-72b-instruct',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Hãy mô tả chi tiết nội dung của file media này để phục vụ viết bài quảng cáo bán hàng.' },
                                {
                                    type: 'image_url',
                                    image_url: { url: `data:image/jpeg;base64,${base64Data}` }
                                }
                            ]
                        }
                    ]
                })
                return response.choices[0].message.content || 'Không thể mô tả nội dung.'
            } catch (e) {
                console.warn('[AI Service] Qwen Vision failed, falling back to basic analysis')
            }
        }

        // 3. Mặc định dùng Gemini
        const imageData = fs.readFileSync(filePath)
        const modelConfig = this.selectModel('simple');

        return this.runWithFallback(async (model) => {
            const prompt = "Hãy nhìn vào nội dung này và mô tả ngắn gọn nội dung của nó bằng 3-5 câu chi tiết về màu sắc, kiểu dáng, bối cảnh.";
            return await model.generateContent([
                prompt,
                { inlineData: { data: imageData.toString('base64'), mimeType: isVideo ? 'video/mp4' : 'image/jpeg' } }
            ])
        }, modelConfig).then(async (result) => {
            const response = await result.response
            return response.text()
        }).catch(() => `Tệp tin: ${fileName}. Hãy sinh nội dung dựa trên tên tệp.`);
    }

    static async generateBatchContent(params: {
        pages: any[],
        platformPrompts: Record<string, string>,
        systemPrompt: string,
        analysis: string,
        keywords: string,
        projectId: number
    }): Promise<any> {
        const { pages, platformPrompts, systemPrompt, analysis, keywords, projectId } = params;
        const pagesList = pages.map(p => `- ID: ${p.id}, Tên: ${p.page_name}, Nền tảng: ${p.platform}`).join('\n');

        let platformContext = "YÊU CẦU RIÊNG CHO TỪNG NỀN TẢNG:\n";
        Object.entries(platformPrompts).forEach(([plat, prompt]) => {
            platformContext += `[${plat}]: ${prompt}\n`;
        });

        const fullPrompt = `${systemPrompt}\n\nPHÂN TÍCH MEDIA:\n${analysis}\n\nTỪ KHÓA:\n${keywords}\n\nDANH SÁCH TRANG:\n${pagesList}\n\n${platformContext}`.trim();

        try {
            const rawResponse = await this.executeAIRequest(fullPrompt, projectId, 'batch');
            let results: any = { Facebook: [], TikTok: [], YouTube: [] };
            results = this.parseBatchResponse(rawResponse, results);

            let missingPages = this.getMissingPages(pages, results);
            let retryCount = 0;
            const MAX_RETRIES = 2;

            while (missingPages.length > 0 && retryCount < MAX_RETRIES) {
                console.log(`[AI Service] Missing ${missingPages.length} posts, retrying...`);
                retryCount++;
                const continuationPrompt = `Tiếp tục sinh nội dung cho các trang sau: ${missingPages.map(p => p.page_name).join(', ')}`;
                const partialResponse = await this.executeAIRequest(continuationPrompt, projectId, 'batch');
                results = this.parseBatchResponse(partialResponse, results);
                missingPages = this.getMissingPages(pages, results);
            }

            return results;
        } catch (error: any) {
            console.error('[AI Service] Batch generation error:', error);
            throw error;
        }
    }

    private static async executeAIRequest(prompt: string, projectId: number, taskType: 'standard' | 'complex' | 'batch' | 'simple'): Promise<string> {
        const config = await this.getProviderConfig(projectId);

        if (config.provider === 'qwen') {
            const client = await this.getQwenClient();
            await this.applyRateLimit();
            const response = await client.chat.completions.create({
                model: config.model || 'qwen/qwen2.5-72b-instruct',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' } as any
            });
            return response.choices[0].message.content || '';
        }

        const modelConfig = this.selectModel(taskType);
        return this.runWithFallback(async (model) => {
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json'
                }
            });
            const response = await result.response;
            return response.text();
        }, modelConfig);
    }

    private static normalizePlatform(plat: string): string {
        const p = plat.toLowerCase().trim();
        if (p.includes('facebook') || p === 'fb') return 'Facebook';
        if (p.includes('tiktok')) return 'TikTok';
        if (p.includes('youtube') || p === 'yt') return 'YouTube';
        if (p.includes('instagram') || p === 'insta' || p === 'ig') return 'Instagram';
        if (p.includes('zalo')) return 'Zalo';
        return plat;
    }

    private static parseBatchResponse(raw: string, currentResults: any): any {
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            const cleanJson = jsonMatch ? jsonMatch[0] : raw;

            let parsed: any = {};
            try {
                parsed = JSON.parse(cleanJson);
            } catch (e) {
                parsed = this.tryRecoverPartialJSON(cleanJson);
            }

            Object.keys(parsed).forEach(key => {
                const normKey = this.normalizePlatform(key);
                if (currentResults[normKey] && Array.isArray(parsed[key])) {
                    currentResults[normKey] = [...currentResults[normKey], ...parsed[key]];
                }
            });
            if (parsed.posts && Array.isArray(parsed.posts)) {
                parsed.posts.forEach((p: any) => {
                    const platform = this.normalizePlatform(p.platform || p.nền_tảng || '');
                    if (currentResults[platform]) currentResults[platform].push(p);
                });
            }

            return currentResults;
        } catch (e) {
            console.error('[AI Service] Parse error:', e);
            return currentResults;
        }
    }

    private static tryRecoverPartialJSON(text: string): any {
        let stack = 0;
        let lastValidIndex = -1;

        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') stack++;
            if (text[i] === '}') {
                stack--;
                if (stack >= 0) lastValidIndex = i;
            }
        }

        if (lastValidIndex !== -1) {
            let partial = text.substring(0, lastValidIndex + 1);
            while (stack > 0) {
                partial += '}';
                stack--;
            }
            try { return JSON.parse(partial); } catch (e) { return {}; }
        }
        return {};
    }

    private static getMissingPages(allPages: any[], currentResults: any): any[] {
        const foundIds = new Set([
            ...currentResults.Facebook.map((p: any) => p.pageId || p.id),
            ...currentResults.TikTok.map((p: any) => p.pageId || p.id),
            ...currentResults.YouTube.map((p: any) => p.pageId || p.id)
        ]);

        return allPages.filter(p => !foundIds.has(p.id));
    }
}
