import React, { useEffect, useState } from 'react'
import { 
    Key, 
    Save, 
    ShieldCheck, 
    Cpu, 
    ChevronRight, 
    Lock, 
    FolderSync, 
    Zap, 
    Sparkles, 
    Files,
    Settings2,
    Plus,
    Trash2,
    Play,
    Clock,
    Layers,
    Monitor
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export const AIConfigView: React.FC = () => {
    // Core Settings
    const [geminiKey, setGeminiKey] = useState('')
    const [qwenKey, setQwenKey] = useState('')
    const [loading, setLoading] = useState(true)
    const [projects, setProjects] = useState<any[]>([])

    // Automation Settings
    const [automationRoot, setAutomationRoot] = useState('')
    const [autoScan, setAutoScan] = useState(false)
    const [autoGen, setAutoGen] = useState(false)
    const [autoMode, setAutoMode] = useState(false)

    // Schedule Settings (New)
    const [selectedSchedProjectId, setSelectedSchedProjectId] = useState<string>('')
    const [schedSettings, setSchedSettings] = useState({
        time_windows: ['09:00-11:00', '19:00-22:00'],
        min_interval: 30,
        max_posts_per_day: 3
    })
    const [autoSchedule, setAutoSchedule] = useState(false)
    const [robotActive, setRobotActive] = useState(false)
    const [maxConcurrency, setMaxConcurrency] = useState(3)
    const [robotHeadless, setRobotHeadless] = useState(true)
    const [batchPrompt, setBatchPrompt] = useState('')

    const loadData = async () => {
        if (!window.ipcRenderer) return
        try {
            const key = await window.ipcRenderer.getApiKey('gemini_api_key')
            setGeminiKey(key)

            const qKey = await window.ipcRenderer.getApiKey('qwen_api_key')
            setQwenKey(qKey)

            const root = await window.ipcRenderer.getAutomationSetting('automation_root_folder')
            setAutomationRoot(root)

            const scan = await window.ipcRenderer.getAutomationSetting('automation_scan_active')
            setAutoScan(scan === 'true')

            const gen = await window.ipcRenderer.getAutomationSetting('automation_gen_active')
            setAutoGen(gen === 'true')

            const mode = await window.ipcRenderer.getAutomationSetting('automation_auto_mode')
            setAutoMode(mode === 'true')

            const sched = await window.ipcRenderer.getAutomationSetting('automation_auto_schedule_active')
            setAutoSchedule(sched === 'true')

            const robot = await window.ipcRenderer.getAutomationSetting('robot_active_status')
            setRobotActive(robot === 'true')

            const threads = await window.ipcRenderer.getAutomationSetting('robot_max_concurrency')
            setMaxConcurrency(threads ? parseInt(threads) : 3)

            const headless = await window.ipcRenderer.getAutomationSetting('robot_headless_mode')
            setRobotHeadless(headless !== 'false') // default to true

            const bPrompt = await window.ipcRenderer.getBatchPrompt()
            setBatchPrompt(bPrompt || '')

            const projs = await window.ipcRenderer.getProjects()
            setProjects(projs || [])
            if (projs.length > 0) {
                setSelectedSchedProjectId(projs[0].id.toString())
                fetchScheduleSettings(projs[0].id)
            }
        } catch (e) {
            console.error('Failed to load settings:', e)
        } finally {
            setLoading(false)
        }
    }

    const fetchScheduleSettings = async (projectId: number) => {
        if (!window.ipcRenderer) return
        try {
            const s = await window.ipcRenderer.getScheduleSettings(projectId)
            if (s) {
                setSchedSettings({
                    time_windows: JSON.parse(s.time_windows),
                    min_interval: s.min_interval,
                    max_posts_per_day: s.max_posts_per_day || 3
                })
            } else {
                setSchedSettings({
                    time_windows: ['09:00-11:00', '19:00-22:00'],
                    min_interval: 30,
                    max_posts_per_day: 3
                })
            }
        } catch (e) {
            console.error('Fetch schedule settings error:', e)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (selectedSchedProjectId) {
            fetchScheduleSettings(Number(selectedSchedProjectId))
        }
    }, [selectedSchedProjectId])

    const handleSaveApiKey = async (provider: 'gemini' | 'qwen') => {
        if (!window.ipcRenderer) return
        try {
            const keyName = provider === 'gemini' ? 'gemini_api_key' : 'qwen_api_key'
            const keyValue = provider === 'gemini' ? geminiKey : qwenKey
            
            await window.ipcRenderer.saveApiKey(keyName, keyValue)
            toast.success(`Đã lưu cấu hình ${provider === 'gemini' ? 'Google Gemini' : 'Qwen AI'} thành công`)
            window.ipcRenderer.addLog({
                type: 'Hệ thống',
                status: 'success',
                message: `Đã cập nhật cấu hình ${provider === 'gemini' ? 'Google Gemini' : 'Qwen AI'} API Key`
            })
        } catch (e: any) {
            toast.error('Lỗi khi lưu: ' + e.message)
        }
    }

    const handleSaveAutomation = async () => {
        if (!window.ipcRenderer) return
        try {
            await window.ipcRenderer.saveAutomationSetting('automation_root_folder', automationRoot)
            await window.ipcRenderer.saveAutomationSetting('automation_scan_active', autoScan.toString())
            await window.ipcRenderer.saveAutomationSetting('automation_gen_active', autoGen.toString())
            await window.ipcRenderer.saveAutomationSetting('automation_auto_mode', autoMode.toString())
            await window.ipcRenderer.saveAutomationSetting('automation_auto_schedule_active', autoSchedule.toString())
            await window.ipcRenderer.saveAutomationSetting('robot_active_status', robotActive.toString())
            await window.ipcRenderer.saveAutomationSetting('robot_max_concurrency', maxConcurrency.toString())
            await window.ipcRenderer.saveAutomationSetting('robot_headless_mode', robotHeadless.toString())

            // If robot active status changed, trigger engine start/stop
            if (robotActive) {
                await window.ipcRenderer.startEngine()
            } else {
                await window.ipcRenderer.stopEngine()
            }
            
            if (autoGen) {
                await window.ipcRenderer.triggerSmartGen()
            }

            await window.ipcRenderer.saveBatchPrompt(batchPrompt)
            
            toast.success('Đã lưu cấu hình tự động hóa thông minh')
            window.ipcRenderer.addLog({
                type: 'Hệ thống',
                status: 'success',
                message: 'Đã cập nhật cấu hình Tự động hóa thông minh'
            })
        } catch (e: any) {
            toast.error('Lỗi khi lưu: ' + e.message)
        }
    }

    const handleSaveScheduleSettings = async () => {
        if (!window.ipcRenderer || !selectedSchedProjectId) return
        try {
            await window.ipcRenderer.saveScheduleSettings({
                project_id: Number(selectedSchedProjectId),
                ...schedSettings
            })
            toast.success('Đã lưu cấu hình lịch đăng bài')
        } catch (e: any) {
            toast.error('Lỗi khi lưu: ' + e.message)
        }
    }

    const handleRunScheduler = async () => {
        if (!window.ipcRenderer) return
        toast.info('Đang phân bổ lịch đăng cho toàn bộ dự án...')
        try {
            // Passing undefined/null to run for ALL projects
            const result = await window.ipcRenderer.runScheduler()
            toast.success(`Thành công! Đã lên lịch cho tổng cộng ${result.count} bài viết`)
            
            window.ipcRenderer.addLog({
                type: 'Lịch trình',
                status: 'success',
                message: `Robot đã hoàn tất lên lịch tự động cho tất cả dự án (${result.count} bài)`
            })
        } catch (e: any) {
            toast.error('Lỗi lên lịch: ' + e.message)
        }
    }

    const handleSelectRoot = async () => {
        const path = await window.ipcRenderer.selectAutomationRoot()
        if (path) setAutomationRoot(path)
    }

    if (loading) return (
        <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <span>Thiết lập</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-extrabold">Cấu hình Robot & AI</span>
            </div>

            {/* Header */}
            <div className="space-y-1">
                <h2 className="text-4xl font-display font-extrabold tracking-tight">Cấu hình Hệ thống</h2>
                <p className="text-muted-foreground text-sm">Quản lý API Key, Quy trình Tự động hóa và Lịch trình đăng bài bài bản.</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2 items-start">
                {/* Column 1: AI Key & Schedule */}
                <div className="space-y-8">
                    {/* Gemini AI Card */}
                    <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-10 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 primary-gradient rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                                    <Cpu className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-display font-extrabold">Google Gemini</h3>
                                    <p className="text-xs text-muted-foreground">Mẫu ngôn ngữ lớn từ Google DeepMind</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                <ShieldCheck className="w-3 h-3" /> Đã bảo vệ
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Gemini API Key</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                <Input 
                                    type="password"
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    placeholder="Nhập API Key của bạn..."
                                    className="h-14 pl-12 bg-surface-container-low border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/20"
                                />
                            </div>
                            <p className="text-[10px] italic text-muted-foreground px-1 py-1">
                                AES-256-CBC mã hóa cục bộ. Chúng tôi không bao giờ chia sẻ khóa này.
                            </p>
                        </div>

                        <Button 
                            onClick={() => handleSaveApiKey('gemini')}
                            className="w-full h-14 primary-gradient rounded-2xl font-bold gap-2 shadow-xl shadow-primary/20 transition-transform active:scale-[0.98]"
                        >
                            <Save className="w-5 h-5" />
                            Lưu cấu hình Gemini
                        </Button>
                    </Card>

                    {/* Qwen AI Card */}
                    <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-10 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200/50">
                                    <Sparkles className="w-8 h-8 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-display font-extrabold text-purple-900">Qwen AI (Vision)</h3>
                                    <p className="text-xs text-muted-foreground">Mạnh mẽ về OCR & Phân tích Media phức tạp</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                <ShieldCheck className="w-3 h-3" /> Đã bảo vệ
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Qwen / OpenRouter API Key</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                <Input 
                                    type="password"
                                    value={qwenKey}
                                    onChange={(e) => setQwenKey(e.target.value)}
                                    placeholder="Nhập API Key cho Qwen..."
                                    className="h-14 pl-12 bg-surface-container-low border-none rounded-2xl focus-visible:ring-1 focus-visible:ring-purple-200"
                                />
                            </div>
                            <p className="text-[10px] italic text-muted-foreground px-1 py-1">
                                Hỗ trợ Qwen2-VL cho khả năng OCR video cực mạnh.
                            </p>
                        </div>

                        <Button 
                            onClick={() => handleSaveApiKey('qwen')}
                            className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold gap-2 shadow-xl shadow-purple-200/50 transition-transform active:scale-[0.98]"
                        >
                            <Save className="w-5 h-5" />
                            Lưu cấu hình Qwen
                        </Button>
                    </Card>

                    {/* How to use */}
                    <div className="p-8 bg-surface-lowest rounded-[2.5rem] space-y-4 border-2 border-dashed border-surface-container-high">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                            <Key className="w-5 h-5" />
                        </div>
                        <h4 className="font-extrabold text-lg">Cách lấy API Key?</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Truy cập vào <strong>Google AI Studio</strong> để tạo API Key miễn phí. Key này hỗ trợ Gemini 1.5 Flash/Pro cho việc sinh nội dung tự động.
                        </p>
                        <a 
                            href="https://aistudio.google.com/app/apikey" 
                            target="_blank" 
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline pt-2"
                        >
                            Lấy API Key ngay <ChevronRight className="w-3 h-3" />
                        </a>
                    </div>

                    {/* Schedule Settings Card */}
                    <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-10 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-200/50">
                                    <Settings2 className="w-8 h-8 text-sky-500" />
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className="text-2xl font-display font-extrabold text-sky-900">Cài đặt Lịch đăng</h3>
                                    <p className="text-xs text-muted-foreground">Khung giờ vàng & Phân bổ thông minh</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3 pt-2">
                                 <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Chọn Dự án để Cấu hình</label>
                                 <Select value={selectedSchedProjectId} onValueChange={(v) => v && setSelectedSchedProjectId(v)}>
                                    <SelectTrigger className="w-full h-14 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/10 px-6 text-sm font-bold text-sky-900 shadow-sm overflow-hidden text-left">
                                        <div className="flex items-center gap-3">
                                            <Settings2 className="w-4 h-4 text-primary/40" />
                                            <SelectValue>
                                                {projects.find(p => p.id.toString() === selectedSchedProjectId)?.name || 'Chọn dự án...'}
                                            </SelectValue>
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                                        <SelectGroup>
                                            <SelectLabel className="px-4 py-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground/50">Dự án hiện có</SelectLabel>
                                            {projects.map(p => (
                                                <SelectItem key={p.id} value={p.id.toString()} className="rounded-xl py-3 px-4 cursor-pointer">
                                                    <div className="flex flex-col">
                                                        <div className="font-bold text-sm">{p.name}</div>
                                                        <div className="text-[10px] text-muted-foreground">{p.posts_count || 0} bài viết</div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Khung giờ vàng (Windows)</label>
                                {schedSettings.time_windows.map((window, idx) => (
                                    <div key={idx} className="flex gap-2 group animate-in slide-in-from-right-2 duration-300">
                                        <div className="relative flex-1">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                            <Input 
                                                value={window}
                                                onChange={(e) => {
                                                    const newWindows = [...schedSettings.time_windows]
                                                    newWindows[idx] = e.target.value
                                                    setSchedSettings({...schedSettings, time_windows: newWindows})
                                                }}
                                                placeholder="HH:mm-HH:mm" 
                                                className="bg-surface-container-low border-none rounded-xl h-12 pl-12 text-xs font-mono font-bold"
                                            />
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="rounded-xl h-12 w-12 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => {
                                                const newW = schedSettings.time_windows.filter((_, i) => i !== idx)
                                                setSchedSettings({...schedSettings, time_windows: newW})
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button 
                                    variant="outline" 
                                    className="w-full border-dashed rounded-xl h-12 text-[10px] font-bold uppercase tracking-widest gap-2"
                                    onClick={() => setSchedSettings({...schedSettings, time_windows: [...schedSettings.time_windows, '09:00-11:00']})}
                                >
                                    <Plus className="w-3 h-3" /> Thêm khung giờ mới
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Khoảng cách tối thiểu</label>
                                        <span className="text-xs font-bold text-primary">{schedSettings.min_interval} phút</span>
                                    </div>
                                    <Input 
                                        type="number"
                                        value={schedSettings.min_interval}
                                        onChange={(e) => setSchedSettings({...schedSettings, min_interval: Number(e.target.value)})}
                                        className="bg-surface-container-low border-none rounded-xl h-12 font-bold focus:ring-1 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Mỗi Page tối đa / Ngày</label>
                                        <span className="text-xs font-bold text-primary">{schedSettings.max_posts_per_day} bài</span>
                                    </div>
                                    <Input 
                                        type="number"
                                        value={schedSettings.max_posts_per_day}
                                        onChange={(e) => setSchedSettings({...schedSettings, max_posts_per_day: Number(e.target.value)})}
                                        className="bg-surface-container-low border-none rounded-xl h-12 font-bold focus:ring-1 focus:ring-primary/20"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <Button 
                                    variant="secondary"
                                    onClick={handleSaveScheduleSettings}
                                    className="h-12 rounded-xl font-bold gap-2 text-xs"
                                >
                                    <Save className="w-4 h-4" />
                                    Lưu cấu hình
                                </Button>
                                <Button 
                                    onClick={handleRunScheduler}
                                    className="h-12 primary-gradient text-white rounded-xl font-bold gap-2 px-3 shadow-lg shadow-primary/20 transition-all active:scale-95 overflow-hidden"
                                >
                                    <Play className="w-4 h-4 fill-current text-white flex-shrink-0" />
                                    <span className="text-xs leading-tight text-left">Tự động lên lịch</span>
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Column 2: Smart Automation stack */}
                <div className="space-y-8">
                    <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-10 space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200/50">
                                <Zap className="w-8 h-8 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-display font-extrabold text-amber-900">Tự động hóa Thông minh</h3>
                                <p className="text-xs text-muted-foreground">Tự động hóa thư mục & AI Content</p>
                            </div>
                        </div>

                        <div className="space-y-6 pt-2">
                            {/* Root Folder */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Thư mục Media Gốc</label>
                                <div className="flex gap-2">
                                    <div className={cn(
                                        "flex-1 h-12 px-4 flex items-center text-xs text-muted-foreground bg-surface-container-low rounded-xl truncate border border-transparent transition-all",
                                        automationRoot && "text-foreground font-medium bg-surface-container-highest"
                                    )}>
                                        {automationRoot || 'Chưa chọn thư mục...'}
                                    </div>
                                    <Button 
                                        size="icon"
                                        variant="secondary"
                                        className="h-12 w-12 rounded-xl flex-shrink-0"
                                        onClick={handleSelectRoot}
                                    >
                                        <FolderSync className="w-5 h-5" />
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
                                    Thư mục con sẽ được tự động ánh xạ thành các Dự án.
                                </p>
                            </div>

                            {/* Switches */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container-high transition-colors hover:bg-surface-container-highest/50">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Files className="w-4 h-4 text-primary" /> Tự động quét Media
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground">Nhận diện file/thư mục mới mỗi 5 phút</p>
                                    </div>
                                    <Switch checked={autoScan} onCheckedChange={setAutoScan} />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container-high transition-colors hover:bg-surface-container-highest/50">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-primary" /> Tự động sinh bài viết
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground">Kích hoạt AI viết bài khi có media mới</p>
                                    </div>
                                    <Switch checked={autoGen} onCheckedChange={setAutoGen} />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container-high transition-colors hover:bg-surface-container-highest/50">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-primary" /> Tự động hóa hoàn toàn
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground">Tự duyệt media & tự sinh bài bài viết</p>
                                    </div>
                                    <Switch checked={autoMode} onCheckedChange={setAutoMode} />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container-high transition-colors hover:bg-surface-container-highest/50">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-primary" /> Tự động Lên lịch (Auto-Schedule)
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground">Phân bổ giờ đăng toàn hệ thống sau khi AI sinh bài</p>
                                    </div>
                                    <Switch checked={autoSchedule} onCheckedChange={setAutoSchedule} />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container-high transition-colors hover:bg-surface-container-highest/50">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Play className="w-4 h-4 text-emerald-500" /> Vận hành Robot (Auto-Post)
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground">Kích hoạt quy trình tự động đăng bài theo lịch</p>
                                    </div>
                                    <Switch checked={robotActive} onCheckedChange={setRobotActive} />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container-high transition-colors hover:bg-surface-container-highest/50">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Monitor className="w-4 h-4 text-purple-500" /> Chạy ngầm (Ẩn Trình duyệt)
                                        </h4>
                                        <p className="text-[10px] text-muted-foreground">Chrome sẽ hoạt động ẩn để không làm phiền bạn</p>
                                    </div>
                                    <Switch checked={robotHeadless} onCheckedChange={setRobotHeadless} />
                                </div>

                                <div className="space-y-3 p-4 bg-surface-container-low rounded-2xl border border-surface-container-high">
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold flex items-center gap-2">
                                                <Layers className="w-4 h-4 text-amber-500" /> Số luồng tối đa
                                            </h4>
                                            <p className="text-[10px] text-muted-foreground">Số trang thao tác cùng lúc (2-12)</p>
                                        </div>
                                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">{maxConcurrency} luồng</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="2" 
                                        max="12" 
                                        value={maxConcurrency} 
                                        onChange={(e) => setMaxConcurrency(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <div className="flex justify-between text-[8px] text-muted-foreground font-bold uppercase">
                                        <span>2 (Yếu)</span>
                                        <span>12 (Mạnh)</span>
                                    </div>
                                </div>
                            </div>

                            <Button 
                                variant="secondary"
                                onClick={handleSaveAutomation}
                                className="w-full h-14 rounded-2xl font-bold gap-2 mt-2"
                            >
                                <Save className="w-5 h-5" />
                                Cập nhật Tự động hóa
                            </Button>
                        </div>
                    </Card>

                    {/* Batch System Prompt Editor */}
                    <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-10 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                                <Sparkles className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-display font-extrabold text-emerald-900">Quy định Batch JSON</h3>
                                <p className="text-xs text-muted-foreground">Prompt ngầm điều khiển logic sinh bài hàng loạt</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
                                Đây là mã nguồn prompt quan trọng nhất để Robot hiểu cách gom 14-30 trang vào 1 lần viết bài. 
                                <strong> Lưu ý:</strong> Phải yêu cầu AI trả về đúng định dạng JSON để Robot có thể đọc được bài viết.
                            </p>
                            
                            <textarea 
                                value={batchPrompt}
                                onChange={(e) => setBatchPrompt(e.target.value)}
                                placeholder="Nhập quy định logic JSON tại đây..."
                                className="w-full h-[400px] p-6 bg-surface-container-low border-none rounded-[2rem] text-sm font-medium leading-relaxed focus:ring-2 focus:ring-emerald-500/20 custom-scrollbar resize-none"
                            />
                            
                            {!batchPrompt && (
                                <Button 
                                    variant="ghost" 
                                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-2 h-auto"
                                    onClick={() => setBatchPrompt(`BẠN LÀ CHUYÊN GIA SÁNG TẠO NỘI DUNG MẠNG XÃ HỘI ĐA NỀN TẢNG.

NHIỆM VỤ CỦA BẠN:
Dựa trên thông tin Media và danh sách các Trang mục tiêu dưới đây, hãy viết nội dung bài đăng độc nhất cho TỪNG TRANG.

YÊU CẦU CHẶT CHẼ:
1. Độc nhất (Unique): Mỗi bài viết cho cùng một nền tảng phải có văn phong, cách đặt vấn đề và cấu trúc khác nhau hoàn toàn.
2. Phù hợp nền tảng:
   - Facebook: Hấp dẫn, gần gũi, có tiêu đề thu hút.
   - TikTok: Ngắn gọn, trendy, tập trung vào CTA nhanh.
   - YouTube: Chuyên nghiệp hoặc hào hứng, dùng nhiều hashtags liên quan.

ĐỊNH DẠNG ĐẦU RA (JSON BẮT BUỘC):
Bạn phải trả về duy nhất một khối JSON hợp lệ theo cấu trúc sau (không có văn bản ngoài JSON):
{
  "Facebook": [
    { "pageId": number, "pageName": "string", "title": "string", "content": "string", "hashtags": "string", "comment": "string" }
  ],
  "TikTok": [
    { "pageId": number, "pageName": "string", "title": "string", "content": "string", "hashtags": "string", "comment": "string" }
  ],
  "YouTube": [
    { "pageId": number, "pageName": "string", "title": "string", "content": "string", "hashtags": "string", "comment": "string" }
  ]
}

LƯU Ý QUAN TRỌNG:
- Trường "comment" là bình luận đầu tiên dùng để gắn link sản phẩm hoặc CTA.
- Nếu danh sách trang quá dài, hãy cố gắng viết hết mức có thể.
- Chỉ trả về JSON, không giải thích.`)}
                                >
                                    Sử dụng mẫu chuẩn hệ thống
                                </Button>
                            )}

                            <Button 
                                onClick={handleSaveAutomation}
                                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold gap-2 shadow-xl shadow-emerald-200"
                            >
                                <Save className="w-5 h-5" />
                                Lưu Quy định Batch JSON
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
