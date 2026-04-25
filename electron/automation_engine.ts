import { dbService } from './db'
import { AIService } from './ai_service'
import fs from 'node:fs'
import path from 'node:path'
import { decrypt } from './crypto_utils'
import { Scheduler } from './scheduler'
import { POST_STATUS } from './post_status'

export class AutomationEngine {
    private isRunning = false;
    private scanInterval: NodeJS.Timeout | null = null;
    private genInterval: NodeJS.Timeout | null = null;
    private schedInterval: NodeJS.Timeout | null = null;
    private logCallback: (msg: string) => void;
    
    private isGenInProgress = false;
    private genStatus = '';

    constructor(logCallback: (msg: string) => void) {
        this.logCallback = logCallback;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logCallback('[AUTOMATION] Đã khởi động hệ thống tự động hóa thông minh.')
        
        // Initial run
        this.runCycle()

        // Set interval for sync (every 5 mins)
        this.scanInterval = setInterval(() => this.runSyncCycle(), 300000)
        // Set interval for generation (every 2 mins)
        this.genInterval = setInterval(() => this.runGenCycle(), 120000)
        // Set interval for scheduling (every 1 min) - Chăm chỉ hơn
        this.schedInterval = setInterval(() => this.runScheduleCycle(), 60000)
    }

    stop() {
        this.isRunning = false;
        if (this.scanInterval) clearInterval(this.scanInterval)
        if (this.genInterval) clearInterval(this.genInterval)
        if (this.schedInterval) clearInterval(this.schedInterval)
        this.logCallback('[AUTOMATION] Đã dừng hệ thống tự động hóa.')
    }

    private async runCycle() {
        await this.runSyncCycle()
        await this.runGenCycle()
        await this.runScheduleCycle()
    }

    /**
     * Phase 1: Scan Root Folder and Map to Projects
     */
    async runSyncCycle() {
        if (!this.isRunning) return;
        
        try {
            const rootPath = await this.getSetting('automation_root_folder')
            const isActive = await this.getSetting('automation_scan_active') === 'true'
            const isAutoMode = await this.getSetting('automation_auto_mode') === 'true'
            
            if (!rootPath || !isActive || !fs.existsSync(rootPath)) return;

            this.logCallback(`[AUTOMATION] Bắt đầu đồng bộ media từ: ${rootPath}`)
            
            const subdirs = (await fs.promises.readdir(rootPath, { withFileTypes: true }))
                .filter(d => d.isDirectory())
                .map(d => d.name)

            const projects = dbService.getProjects()
            
            for (const dirName of subdirs) {
                if (!this.isRunning) break;

                // 1. Find or Create Project
                let project = projects.find(p => p.name.toLowerCase() === dirName.toLowerCase())
                if (!project) {
                    this.logCallback(`[AUTOMATION] Tìm thấy folder mới. Tự động tạo dự án: ${dirName}`)
                    project = dbService.addProject(dirName) as any
                    
                    dbService.addLog({
                        type: 'Tự động hóa',
                        status: 'success',
                        message: `Đã tự động tạo dự án mới từ thư mục: ${dirName}`
                    })
                }

                if (!project) continue;

                // 2. Scan media files in project subdir
                const dirPath = path.join(rootPath, dirName)
                const files = await fs.promises.readdir(dirPath)
                const mediaExtensions = ['.jpg', '.jpeg', '.png', '.mp4', '.mov', '.webp', '.m4v']
                
                const mediaInDir = files
                    .filter(f => mediaExtensions.includes(path.extname(f).toLowerCase()))
                    .map(f => path.join(dirPath, f))

                // 3. Check existing content groups to avoid duplicates
                const existingGroups = dbService.getContentGroups(project.id)
                const existingFiles = new Set()
                existingGroups.forEach((g: any) => {
                    try {
                        const paths = JSON.parse(g.media_files)
                        paths.forEach((p: string) => existingFiles.add(p))
                    } catch(e) {}
                })

                for (const filePath of mediaInDir) {
                    if (existingFiles.has(filePath)) continue;

                    // Add new content group (1 file/group)
                    const fileName = path.basename(filePath)
                    const group = dbService.addContentGroup({
                        project_id: project.id,
                        name: fileName,
                        media_files: [filePath]
                    })
                    
                    if (isAutoMode) {
                        dbService.updateContentGroupStatus((group as any).id, 'ready')
                    }
                    
                    this.logCallback(`[AUTOMATION] Đã thêm media: ${fileName} ${isAutoMode ? '(Tự động duyệt)' : '(Chờ duyệt)'}`)
                }
            }
            this.logCallback('[AUTOMATION] Hoàn tất chu kỳ đồng bộ media.')
            
            if (isAutoMode) {
                this.runGenCycle()
            }
        } catch (error: any) {
            console.error('[Automation Engine] Sync Error:', error)
            this.logCallback(`[AUTOMATION-ERROR] Lỗi đồng bộ: ${error.message}`)
        }
    }

    /**
     * Phase 2: Auto-Generate Posts via AI Reasoning Chain
     */
    getGenStatus() {
        return { isGenerating: this.isGenInProgress, status: this.genStatus }
    }

    async triggerManualGen(options?: { projectIds?: number[], groupIds?: number[] }) {
        if (this.isGenInProgress) return { success: false, error: 'AI đang bận xử lý bài viết khác' };
        
        this.runGenCycle(options); // Run in background
        return { success: true };
    }

    async runGenCycle(options?: { projectIds?: number[], groupIds?: number[] }) {
        if (!this.isRunning || this.isGenInProgress) return;

        this.isGenInProgress = true;
        this.genStatus = 'Bắt đầu quy trình sáng tạo bài viết...';
        
        try {
            const isGenActive = await this.getSetting('automation_gen_active') === 'true'
            const isAutoMode = await this.getSetting('automation_auto_mode') === 'true'
            const defaultPromptId = await this.getSetting('automation_default_prompt_id')
            
            if (!isGenActive && !options) {
                this.isGenInProgress = false;
                return;
            }

            // Get groups with status 'ready' (approved for generation)
            let allGroups = dbService.getContentGroups() as any[]
            
            if (options?.groupIds && options.groupIds.length > 0) {
                allGroups = allGroups.filter(g => options.groupIds?.includes(g.id))
            } else if (options?.projectIds && options.projectIds.length > 0) {
                allGroups = allGroups.filter(g => options.projectIds?.includes(g.project_id))
            }

            const groupsToProcess = allGroups.filter(g => g.status === 'ready')

            if (groupsToProcess.length === 0) {
                this.isGenInProgress = false;
                return;
            }

            this.logCallback(`[AI-GENERATOR] Tìm thấy ${groupsToProcess.length} nhóm nội dung sẵn sàng để sinh bài viết.`)
            
            const projects = dbService.getProjects()
            const prompts = dbService.getPrompts() as any[]
            const allPages = dbService.getPages()
            
            const findBestPrompt = (projectId: number, platform: string): any => {
                const pjMatch = prompts.find(p => {
                    const pjIds = JSON.parse(p.project_ids || '[]')
                    const plats = JSON.parse(p.platforms || '[]')
                    return pjIds.includes(projectId) && plats.includes(platform)
                })
                if (pjMatch) return pjMatch

                const pjOnlyMatch = prompts.find(p => {
                    const pjIds = JSON.parse(p.project_ids || '[]')
                    const plats = JSON.parse(p.platforms || '[]')
                    return pjIds.includes(projectId) && plats.length === 0
                })
                if (pjOnlyMatch) return pjOnlyMatch

                const platMatch = prompts.find(p => {
                    const pjIds = JSON.parse(p.project_ids || '[]')
                    const plats = JSON.parse(p.platforms || '[]')
                    return pjIds.length === 0 && plats.includes(platform)
                })
                if (platMatch) return platMatch

                if (defaultPromptId) {
                    return prompts.find(p => p.id === Number(defaultPromptId))
                }
                return null
            }

            for (let i = 0; i < groupsToProcess.length; i++) {
                const group = groupsToProcess[i]
                if (!this.isRunning) break;

                try {
                    this.genStatus = `Đang xử lý (${i+1}/${groupsToProcess.length}): ${group.name}...`
                    this.logCallback(`[AI-GENERATOR] Đang xử lý: ${group.name}`)
                    
                    const mediaFiles = JSON.parse(group.media_files)
                    if (mediaFiles.length === 0) continue;

                    const project = projects.find(p => p.id === group.project_id)
                    if (!project) continue;

                    const targetPlatforms = JSON.parse(project.platforms || '[]')
                    if (targetPlatforms.length === 0) {
                        const skipMsg = `[AI-GENERATOR-SKIP] Dự án "${project.name}" chưa chọn Nền tảng mục tiêu (FB, Tiktok, ...). Robot sẽ bỏ qua dự án này.`
                        this.logCallback(skipMsg)
                        this.genStatus = skipMsg
                        continue;
                    }

                    // STEP 1: Analyze Media (Common for all platforms)
                    const analysis = await AIService.describeMedia(mediaFiles[0], project.id)
                    const keywords = await AIService.analyzeAndRecommendKeywords(analysis)

                    // STEP 2: Collect all target pages and platform prompts for Batch
                    const targetPages = allPages.filter(pg => pg.project_id === group.project_id)
                    if (targetPages.length === 0) {
                        const skipMsg = `[AI-GENERATOR-SKIP] Dự án "${project.name}" chưa có Page mục tiêu nào được kết nối. Robot sẽ bỏ qua.`
                        this.logCallback(skipMsg)
                        this.genStatus = skipMsg
                        continue;
                    }

                    const platformsInvolved = [...new Set(targetPages.map(p => p.platform))]
                    const platformPromptsRecord: Record<string, string> = {}
                    
                    platformsInvolved.forEach(plat => {
                        const prompt = findBestPrompt(group.project_id, plat)
                        if (prompt) platformPromptsRecord[plat] = prompt.content
                    })

                    // STEP 3: Fetch System Batch Prompt
                    const systemBatchPrompt = await this.getBatchSystemPrompt()
                    
                    this.logCallback(`[AI-GENERATOR] Đang sinh nội dung hàng loạt cho ${targetPages.length} trang thuộc ${platformsInvolved.length} nền tảng...`)

                    // STEP 4: Trigger Batch Generation
                    const batchResults = await AIService.generateBatchContent({
                        pages: targetPages,
                        platformPrompts: platformPromptsRecord,
                        systemPrompt: systemBatchPrompt,
                        analysis,
                        keywords,
                        projectId: project.id
                    })

                    // STEP 5: Save results from JSON to Posts table
                    let savedCount = 0;
                    const platforms = ['Facebook', 'TikTok', 'YouTube'];
                    
                    platforms.forEach(plat => {
                        const posts = batchResults[plat] || [];
                        posts.forEach((p: any) => {
                            const pageId = p.pageId || p.id;
                            const pageNameFromAI = (p.pageName || p.tên_trang || '').toLowerCase();
                            
                            // Find corresponding target page in DB by ID or Case-insensitive Name
                            const targetPage = targetPages.find(tp => {
                                if (pageId && tp.id === Number(pageId)) return true;
                                if (pageNameFromAI && tp.page_name.toLowerCase().includes(pageNameFromAI)) return true;
                                return false;
                            });
                            
                            if (targetPage) {
                                dbService.addPost({
                                    project_id: group.project_id,
                                    page_id: targetPage.id,
                                    title: p.title || group.name,
                                    content: `${p.content || ''}\n\n${p.hashtags || ''}`,
                                    comment_cta: p.comment || '',
                                    media_path: mediaFiles[0],
                                    status: isAutoMode ? POST_STATUS.APPROVED : POST_STATUS.DRAFT
                                })
                                savedCount++;
                            } else {
                                this.logCallback(`[AI-GENERATOR-WARN] Không tìm thấy trang khớp với: ${p.pageName || p.id} trong Dự án.`)
                            }
                        });
                    });

                    dbService.updateContentGroupStatus(group.id, 'processed')
                    this.logCallback(`[AI-GENERATOR] Hoàn tất! Đã tạo ${savedCount}/${targetPages.length} bài viết cho nhóm: ${group.name}`)

                } catch (err: any) {
                    this.logCallback(`[AI-GENERATOR-ERROR] Lỗi xử lý ${group.name}: ${err.message}`)
                }
            }

            this.genStatus = 'Hoàn tất quy trình sáng tạo bài viết.'
            
            // Auto-Schedule Trigger (GLOBAL)
            const isAutoScheduleActive = await this.getSetting('automation_auto_schedule_active') === 'true'
            if (isAutoScheduleActive) {
                this.logCallback('[AUTOMATION] Đang tự động phân bổ lịch đăng cho các bài viết mới...')
                const schedResult = await Scheduler.distributeSchedules()
                this.logCallback(`[AUTOMATION] Đã tự động lên lịch cho ${schedResult.count} bài viết.`)
            }

            this.isGenInProgress = false;
            setTimeout(() => { if (this.genStatus === 'Hoàn tất quy trình sáng tạo bài viết.') this.genStatus = ''; }, 3000)

        } catch (error: any) {
            console.error('[Automation Engine] Generation Error:', error)
            this.isGenInProgress = false;
            this.genStatus = 'Lỗi quy trình sáng tạo.'
        }
    }

    /**
     * Phase 3: Independent Scheduling Cycle (The "Hardworking" part)
     */
    async runScheduleCycle() {
        if (!this.isRunning) return;

        try {
            const isAutoScheduleActive = await this.getSetting('automation_auto_schedule_active') === 'true'
            if (!isAutoScheduleActive) return;

            // Check if there are any approved posts without scheduled_at
            const posts = dbService.getPosts() as any[]
            const pendingScheduling = posts.filter(p => p.status === 'approved' && !p.scheduled_at)

            if (pendingScheduling.length > 0) {
                this.logCallback(`[AUTOMATION] Phát hiện ${pendingScheduling.length} bài viết mới được duyệt. Đang tự động xếp lịch...`)
                const schedResult = await Scheduler.distributeSchedules()
                if (schedResult.count > 0) {
                    this.logCallback(`[AUTOMATION] Robot đã xếp lịch xong cho ${schedResult.count} bài viết.`)
                }
            }
        } catch (error: any) {
            console.error('[Automation Engine] Schedule Cycle Error:', error)
        }
    }

    private async getBatchSystemPrompt(): Promise<string> {
        const record = dbService.getSetting('automation_batch_system_prompt') as any
        if (record && record.encrypted_value) {
            try {
                return decrypt(record.encrypted_value)
            } catch {
                return record.encrypted_value
            }
        }
        return `BẠN LÀ CHUYÊN GIA SÁNG TẠO NỘI DUNG MẠNG XÃ HỘI.
NHIỆM VỤ: Viết bài độc nhất cho từng trang mục tiêu.
ĐỊNH DẠNG TRẢ VỀ: JSON hợp lệ với cấu trúc:
{
  "Facebook": [{ "pageId": number, "pageName": "string", "title": "string", "content": "string", "hashtags": "string", "comment": "string" }],
  "TikTok": [...],
  "YouTube": [...]
}
LƯU Ý: Mỗi bài viết phải khác nhau hoàn toàn. Chỉ trả về JSON.`;
    }

    private async getSetting(key: string): Promise<string> {
        const record = dbService.getSetting(key) as any
        if (record && record.encrypted_value) {
            try {
                return decrypt(record.encrypted_value)
            } catch {
                return record.encrypted_value
            }
        }
        return ''
    }
}
