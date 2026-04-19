import { dbService } from './db'
import { AIService } from './ai_service'
import fs from 'node:fs'
import path from 'node:path'
import { decrypt } from './crypto_utils'
import { Scheduler } from './scheduler'

export class AutomationEngine {
    private isRunning = false;
    private scanInterval: NodeJS.Timeout | null = null;
    private genInterval: NodeJS.Timeout | null = null;
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
        // Set interval for generation (every 10 mins)
        this.genInterval = setInterval(() => this.runGenCycle(), 600000)
    }

    stop() {
        this.isRunning = false;
        if (this.scanInterval) clearInterval(this.scanInterval)
        if (this.genInterval) clearInterval(this.genInterval)
        this.logCallback('[AUTOMATION] Đã dừng hệ thống tự động hóa.')
    }

    private async runCycle() {
        await this.runSyncCycle()
        await this.runGenCycle()
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
            
            const subdirs = fs.readdirSync(rootPath, { withFileTypes: true })
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
                const files = fs.readdirSync(dirPath)
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
                        this.logCallback(`[AI-GENERATOR-SKIP] Dự án ${project.name} chưa cấu hình Nền tảng. Hãy thiết lập trong phần Dự án.`)
                        continue;
                    }

                    // STEP 1: Analyze Media (Common for all platforms)
                    const analysis = await AIService.describeMedia(mediaFiles[0])
                    const keywords = await AIService.analyzeAndRecommendKeywords(analysis)

                    // STEP 2: Loop platforms and generate
                    for (const platform of targetPlatforms) {
                        this.logCallback(`[AI-GENERATOR] Đang sinh nội dung cho ${platform} (Dự án: ${project.name})...`)
                        
                        const selectedPrompt = findBestPrompt(group.project_id, platform)
                        if (!selectedPrompt) {
                            this.logCallback(`[AI-GENERATOR-ERROR] Không tìm thấy Prompt phù hợp cho ${platform}.`)
                            continue;
                        }

                        const smartContent = await AIService.generateSmartPostByGuidelines(
                            selectedPrompt.content,
                            analysis,
                            keywords
                        )

                        // Parse the smart response
                        const titleMatch = smartContent.match(/Tiêu đề:\s*(.*)/i)
                        const bodyMatch = smartContent.match(/Nội dung:\s*([\s\S]*?)(?=Hashtags:|$)/i)
                        const hashMatch = smartContent.match(/Hashtags:\s*(.*)/i)

                        const title = (titleMatch ? titleMatch[1].trim() : group.name).replace(/\*\*/g, '').trim()
                        const content = (bodyMatch ? bodyMatch[1].trim() : smartContent).replace(/\*\*/g, '').trim()
                        const hashtags = (hashMatch ? hashMatch[1].trim() : '').replace(/\*\*/g, '').trim()

                        const targetPages = allPages.filter(pg => pg.project_id === group.project_id && pg.platform.toLowerCase() === platform.toLowerCase())
                        
                        if (targetPages.length === 0) {
                            this.logCallback(`[AI-GENERATOR-WARNING] Dự án ${project.name} có Nền tảng ${platform} nhưng chưa có Page kết nối.`)
                            continue;
                        }

                        for (const page of targetPages) {
                            dbService.addPost({
                                project_id: group.project_id,
                                page_id: page.id,
                                title: `[${platform}] ${title}`,
                                content: `${content}\n\n${hashtags}`,
                                media_path: mediaFiles[0],
                                status: 'pending'
                            })
                        }
                    }

                    dbService.updateContentGroupStatus(group.id, 'processed')
                    this.logCallback(`[AI-GENERATOR] Hoàn tất sáng tạo cho: ${group.name}`)

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

            setTimeout(() => { if (this.genStatus === 'Hoàn tất quy trình sáng tạo bài viết.') this.genStatus = ''; this.isGenInProgress = false; }, 3000)

        } catch (error: any) {
            console.error('[Automation Engine] Generation Error:', error)
            this.isGenInProgress = false;
            this.genStatus = 'Lỗi quy trình sáng tạo.'
        }
    }

            this.genStatus = 'Hoàn tất quy trình sáng tạo bài viết.'
            setTimeout(() => { this.genStatus = ''; this.isGenInProgress = false; }, 3000)

        } catch (error: any) {
            console.error('[Automation Engine] Generation Error:', error)
            this.isGenInProgress = false;
        }
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
