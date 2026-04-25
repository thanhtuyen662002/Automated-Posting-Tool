import React, { useEffect, useState, useRef } from 'react'
import { 
    Sparkles, 
    FolderSearch, 
    Layers, 
    LayoutGrid, 
    ChevronRight, 
    Plus,
    CheckCircle2,
    FileVideo,
    Loader2,
    Check,
    CheckSquare,
    Folders,
    Zap,
    RefreshCw,
    UserCircle,
    Key,
    ShieldCheck,
    FolderSync,
    Wand2,
    Trash2
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'

export const ContentStudioView: React.FC = () => {
    // Media Workspace State
    const [mediaFiles, setMediaFiles] = useState<string[]>([])
    const [selectedFiles, setSelectedFiles] = useState<string[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [groups, setGroups] = useState<any[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState('')
    const [groupName, setGroupName] = useState('')
    const [scanning, setScanning] = useState(false)
    const [automationRoot, setAutomationRoot] = useState('')
    const [isSyncing, setIsSyncing] = useState(false)

    // AI Dashboard State
    const [prompts, setPrompts] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [activeGroup, setActiveGroup] = useState<any>(null)
    const [selectedPromptId, setSelectedPromptId] = useState('')
    const [keyword, setKeyword] = useState('')
    const [selectedProductId, setSelectedProductId] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isAutoGenerating, setIsAutoGenerating] = useState(false)
    const [genStatus, setGenStatus] = useState('')
    const [generatedResults, setGeneratedResults] = useState<Record<number, { title: string, body: string, hashtags: string, comment: string }>>({})
    const [selectedPageIds, setSelectedPageIds] = useState<number[]>([])
    const [availablePages, setAvailablePages] = useState<any[]>([])
    const [automationLogs, setAutomationLogs] = useState<string[]>([])
    const logContainerRef = useRef<HTMLDivElement>(null)

    // Watermark settings
    const [watermarkEnabled, setWatermarkEnabled] = useState(true)
    const [watermarkPos, setWatermarkPos] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right')
    const [watermarkSize, setWatermarkSize] = useState(0.12)
    const [watermarkOpacity, setWatermarkOpacity] = useState(0.8)

    const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null)
    const [isDeletingGroup, setIsDeletingGroup] = useState(false)

    const fetchData = async () => {
        if (!window.ipcRenderer) return
        try {
            const projs = await window.ipcRenderer.getProjects()
            setProjects(projs || [])
            const grps = await window.ipcRenderer.getContentGroups()
            setGroups(grps || [])
            const pms = await window.ipcRenderer.getPrompts('Post')
            setPrompts(pms || [])
            const prods = await window.ipcRenderer.getProducts()
            setProducts(prods || [])
            const pgs = await window.ipcRenderer.getPages()
            setAvailablePages(pgs || [])
        } catch (e) {
            console.error('Fetch data error:', e)
        }
    }

    useEffect(() => {
        fetchData()
        if (window.ipcRenderer) {
            window.ipcRenderer.getAutomationSetting('automation_root_folder').then(root => {
                setAutomationRoot(root)
            })

            // Listen for automation logs
            const handleLog = (msg: string) => {
                setAutomationLogs(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`])
            }
            const cleanupLog = window.ipcRenderer.onEngineLog(handleLog)

            // Poll for generation status
            const interval = setInterval(async () => {
                const status = await window.ipcRenderer.getAutomationGenStatus()
                setIsAutoGenerating(status.isGenerating)
                setGenStatus(status.status)
            }, 2000)
            return () => {
                clearInterval(interval)
                if (cleanupLog) cleanupLog()
            }
        }
    }, [])

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
    }, [automationLogs])

    const handleScan = async () => {
        setScanning(true)
        try {
            const files = await window.ipcRenderer.scanDirectory()
            setMediaFiles(files || [])
            setSelectedFiles([])
            if (files.length > 0) toast.success(`Đã quét được ${files.length} tệp media`)
        } catch (e: any) {
            toast.error('Lỗi quét: ' + e.message)
        } finally {
            setScanning(false)
        }
    }

    const handleSyncRoot = async () => {
        if (!automationRoot) {
            toast.error('Chưa cấu hình Thư mục gốc trong phần Cài đặt AI')
            return
        }
        setIsSyncing(true)
        try {
            await window.ipcRenderer.syncAutomationNow()
            toast.success('Đã yêu cầu đồng bộ từ Thư mục gốc')
            fetchData()
        } catch (e: any) {
            toast.error('Lỗi đồng bộ: ' + e.message)
        } finally {
            setIsSyncing(false)
        }
    }

    const toggleFileSelection = (path: string) => {
        setSelectedFiles(prev => 
            prev.includes(path) ? prev.filter(f => f !== path) : [...prev, path]
        )
    }

    const handleSelectAll = () => {
        if (selectedFiles.length === mediaFiles.length) {
            setSelectedFiles([])
        } else {
            setSelectedFiles([...mediaFiles])
        }
    }

    const handleCreateGroup = async () => {
        if (!selectedProjectId || selectedFiles.length === 0) {
            toast.error('Vui lòng chọn Dự án và chọn ít nhất 1 ảnh/video')
            return
        }

        try {
            if (!groupName.trim()) {
                // Auto-group mode: Create a group for each selected file
                for (const file of selectedFiles) {
                    const fileName = file.split(/[\\\/]/).pop() || 'Untitled'
                    await window.ipcRenderer.addContentGroup({
                        project_id: Number(selectedProjectId),
                        name: fileName,
                        media_files: [file]
                    })
                }
                toast.success(`Đã tự động tạo ${selectedFiles.length} nhóm nội dung từ tên file`)
            } else {
                // Manual group mode: Group all selected files into one
                await window.ipcRenderer.addContentGroup({
                    project_id: Number(selectedProjectId),
                    name: groupName.trim(),
                    media_files: selectedFiles
                })
                toast.success('Đã tạo nhóm nội dung thành công')
            }
            
            setGroupName('')
            setSelectedFiles([])
            fetchData()
        } catch (e: any) {
            toast.error('Lỗi khi tạo: ' + e.message)
        }
    }

    const handleGenerateContent = async () => {
        if (!selectedPromptId || !activeGroup || selectedPageIds.length === 0) {
            toast.error('Vui lòng chọn Prompt, Nhóm nội dung và ít nhất 1 Trang mục tiêu')
            return
        }
        
        setIsGenerating(true)
        setGeneratedResults({})
        
        try {
            const targetPages = availablePages.filter(p => selectedPageIds.includes(p.id))
            
            // Trigger Batch Generation via IPC
            const batchResults = await window.ipcRenderer.generateBatchPosts({
                pages: targetPages,
                projectId: activeGroup.project_id,
                activeGroup,
                selectedPromptId,
                selectedProductId,
                keyword
            })
            
            const newResults: Record<number, any> = {}
            const platforms = ['Facebook', 'TikTok', 'YouTube']
            
            platforms.forEach(plat => {
                const posts = batchResults[plat] || []
                posts.forEach((p: any) => {
                    const pageId = p.pageId || p.id
                    const targetPage = targetPages.find(tp => tp.id === Number(pageId) || tp.page_name === p.pageName)
                    
                    if (targetPage) {
                        newResults[targetPage.id] = {
                            title: p.title || '',
                            body: p.content || '',
                            hashtags: p.hashtags || '',
                            comment: p.comment || ''
                        }
                    }
                })
            })
            
            setGeneratedResults(newResults)
            const count = Object.keys(newResults).length
            if (count > 0) {
                toast.success(`Đã sinh ${count}/${selectedPageIds.length} bản tin thông minh thành công`)
            } else {
                toast.error('Không thể sinh nội dung. Vui lòng kiểm tra lại AI Key hoặc quy định JSON.')
            }
        } catch (e: any) {
            toast.error('Lỗi AI Batch: ' + e.message)
            console.error(e)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSmartAuto = async () => {
        if (!window.ipcRenderer) return
        
        const options: any = {}
        if (activeGroup) {
            options.groupIds = [activeGroup.id]
        } else if (selectedPageIds.length > 0) {
            options.pageIds = selectedPageIds
        }

        try {
            const result = await window.ipcRenderer.triggerSmartGen(options)
            if (result.success) {
                toast.success('Đã bắt đầu quy trình tạo bài viết tự động trong nền.')
            } else {
                toast.error(result.error || 'Không thể bắt đầu quy trình tự động.')
            }
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message)
        }
    }

    const handleDeleteGroup = async (id: number) => {
        try {
            setIsDeletingGroup(true)
            await window.ipcRenderer.deleteContentGroup(id)
            setDeleteGroupId(null)
            fetchData()
            toast.success('Đã xóa nhóm nội dung')
        } catch (e: any) {
            toast.error('Lỗi khi xóa: ' + e.message)
        } finally {
            setIsDeletingGroup(false)
        }
    }

    const isVideo = (path: string) => path.toLowerCase().endsWith('.mp4') || path.toLowerCase().endsWith('.mov')

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <span>Sáng tạo AI</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-extrabold">Xưởng nội dung</span>
            </div>

            {/* Header */}
            <div className="space-y-1">
                <h2 className="text-4xl font-display font-extrabold tracking-tight">Xưởng Nội dung</h2>
                <p className="text-muted-foreground text-sm">Biến các tài nguyên hình ảnh thành những bài viết thu hút bằng trí tuệ nhân tạo.</p>
            </div>

            <Tabs defaultValue="workspace" className="w-full">
                <TabsList className="bg-surface-lowest p-1 rounded-2xl h-14 w-full max-w-xl border border-border/5 mb-8">
                    <TabsTrigger value="workspace" className="flex-1 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Folders className="w-4 h-4" /> Kho Media
                    </TabsTrigger>
                    <TabsTrigger value="automatic" className="flex-1 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Zap className="w-4 h-4" /> Giám sát Tự động
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="flex-1 rounded-xl font-bold text-xs gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Sparkles className="w-4 h-4" /> AI Generator
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: Media Workspace */}
                <TabsContent value="workspace" className="space-y-8">
                    <div className="grid grid-cols-12 gap-8">
                        {/* Directory Scanner & Grid */}
                        <div className="col-span-8 space-y-6">
                            {/* Automation Status Bar */}
                            {automationRoot && (
                                <div className="p-1 px-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between group transition-all hover:bg-primary/10 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <Zap className="w-4 h-4 fill-primary/20" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">Automation Root</p>
                                            <p className="text-xs font-medium truncate opacity-80">{automationRoot}</p>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={handleSyncRoot}
                                        disabled={isSyncing}
                                        className="h-9 px-4 rounded-xl text-primary font-bold hover:bg-primary/10 transition-transform active:scale-95"
                                    >
                                        {isSyncing ? (
                                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                                        ) : <FolderSync className="w-4 h-4 mr-2" />}
                                        Đồng bộ ngay
                                    </Button>
                                </div>
                            )}

                            <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-8 overflow-hidden min-h-[500px] flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                            <LayoutGrid className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-xl font-bold">Thư viện Video/Ảnh</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {mediaFiles.length > 0 && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={handleSelectAll}
                                                className="text-[10px] font-bold uppercase tracking-tight gap-1.5 h-9 px-3 rounded-lg hover:bg-surface-mid"
                                            >
                                                <CheckSquare className="w-3.5 h-3.5" />
                                                {selectedFiles.length === mediaFiles.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                                            </Button>
                                        )}
                                        <Button 
                                            onClick={handleScan} 
                                            disabled={scanning}
                                            className="bg-surface-container-low text-foreground hover:bg-surface-mid rounded-xl h-11 px-5 font-bold gap-2 border-none shadow-none"
                                        >
                                            <FolderSearch className="w-4 h-4" />
                                            {scanning ? 'Đang quét...' : 'Quét thư mục'}
                                        </Button>
                                    </div>
                                </div>

                                {mediaFiles.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                        {mediaFiles.map((f, i) => (
                                            <div 
                                                key={i} 
                                                onClick={() => toggleFileSelection(f)}
                                                className={cn(
                                                    "aspect-square rounded-2xl overflow-hidden cursor-pointer relative group border-2 transition-all",
                                                    selectedFiles.includes(f) ? "border-primary shadow-lg shadow-primary/20 scale-95" : "border-transparent hover:border-primary/20"
                                                )}
                                            >
                                                {isVideo(f) ? (
                                                    <video 
                                                        src={`media://local-file?path=${encodeURIComponent(f)}`} 
                                                        className="w-full h-full object-cover"
                                                        muted
                                                    />
                                                ) : (
                                                    <img 
                                                        src={`media://local-file?path=${encodeURIComponent(f)}`} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                )}
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute top-2 right-2">
                                                    {selectedFiles.includes(f) ? (
                                                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white shadow-md">
                                                            <Check className="w-4 h-4" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-6 h-6 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100">
                                                            {isVideo(f) ? <FileVideo className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center mb-4">
                                            <FolderSearch className="w-10 h-10 opacity-20" />
                                        </div>
                                        <p className="text-sm font-medium">Nhấn "Quét thư mục" để bắt đầu nạp media</p>
                                    </div>
                                )}
                            </Card>
                        </div>

                        {/* Grouping Panel */}
                        <div className="col-span-4 space-y-6">
                            <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-8 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                                        <Layers className="w-4 h-4" />
                                    </div>
                                    <h3 className="font-bold">Tạo Nhóm Nội dung</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Thuộc Dự án</label>
                                        <Select value={selectedProjectId} onValueChange={(v) => v && setSelectedProjectId(v)}>
                                            <SelectTrigger className="w-full bg-surface-low border-none rounded-xl h-12 px-4 font-bold text-sm">
                                                <SelectValue placeholder="Chọn dự án...">
                                                    {projects.find(p => p.id.toString() === selectedProjectId)?.name || "Chọn dự án..."}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Dự án hiện có</SelectLabel>
                                                    {projects.map(p => (
                                                        <SelectItem key={p.id} value={p.id.toString()} className="font-bold">
                                                            {p.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tên nhóm (Page/Chiến dịch)</label>
                                        <Input 
                                            value={groupName}
                                            onChange={(e) => setGroupName(e.target.value)}
                                            placeholder="VD: Video Review Hoa kẽm nhung" 
                                            className="bg-surface-low border-none rounded-xl h-11"
                                        />
                                    </div>
                                    <div className="pt-2 text-[10px] font-bold text-muted-foreground">
                                        FILE ĐANG CHỌN: <span className="text-primary">{selectedFiles.length}</span>
                                    </div>
                                </div>
                                <Button 
                                    onClick={handleCreateGroup}
                                    className="w-full primary-gradient h-12 rounded-xl font-bold shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
                                >
                                    Khởi tạo nội dung mới
                                </Button>
                            </Card>

                            <Card className="border-none shadow-none bg-surface-container-lowest rounded-[2rem] p-6 space-y-4">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nhóm đã lưu ({groups.length})</h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {groups.map((g, i) => (
                                        <div key={i} className="p-4 bg-surface-lowest rounded-2xl flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-surface-low rounded-lg flex items-center justify-center">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold leading-none">{g.name}</p>
                                                    <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-tighter">
                                                        {projects.find(pj => pj.id === g.project_id)?.name || 'Dự án'} • {JSON.parse(g.media_files).length} Media
                                                    </p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100" onClick={() => setDeleteGroupId(g.id)}>
                                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 2: Automatic Monitoring */}
                <TabsContent value="automatic" className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-12 gap-8">
                        {/* Status Card */}
                        <div className="col-span-4 space-y-6">
                            <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-8 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 shadow-lg shadow-amber-200/50">
                                        <Zap className="w-6 h-6 fill-current" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Robot Giám sát</h3>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase w-fit mt-1">
                                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> Đang chạy
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-surface-container-low rounded-2xl space-y-3">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Thư mục nguồn</p>
                                        <p className="text-xs font-bold truncate">{automationRoot || 'Chưa cấu hình'}</p>
                                    </div>
                                    <Button 
                                        className="w-full h-11 bg-white border-2 border-primary/10 text-primary hover:bg-primary/5 rounded-xl font-bold gap-2"
                                        onClick={handleSyncRoot}
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSync className="w-4 h-4" />}
                                        Quét lại ngay
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quy định thông minh</h4>
                                    <div className="space-y-2">
                                        {[
                                            { icon: Folders, text: 'Tự động tạo Dự án mới' },
                                            { icon: CheckCircle2, text: 'Tự động Duyệt Media' },
                                            { icon: Sparkles, text: 'Tự động Gọi AI sinh bài' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                                                <item.icon className="w-4 h-4 text-primary/40" />
                                                <span className="text-xs font-bold text-sky-900">{item.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Activity List */}
                        <div className="col-span-8 flex flex-col gap-6">
                            <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-8 flex-1 overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-500">
                                            <Layers className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-xl font-bold">Tiến độ tài tài nguyên</h3>
                                    </div>
                                    <Badge variant="outline" className="rounded-lg py-1 px-3 border-sky-100 bg-sky-50 text-sky-600 font-bold">
                                        {groups.length} Nhóm tự động
                                    </Badge>
                                </div>

                                {/* Log Terminal */}
                                <div className="mb-6 p-4 bg-slate-900 rounded-2xl font-mono text-[10px] text-emerald-400 overflow-hidden border border-slate-800 shadow-inner">
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            <span className="font-bold uppercase tracking-wider text-emerald-500/80">Nhật ký Robot</span>
                                        </div>
                                        <button 
                                            onClick={() => setAutomationLogs([])}
                                            className="text-white/20 hover:text-white/40 transition-colors"
                                        >
                                            Xóa log
                                        </button>
                                    </div>
                                    <div 
                                        ref={logContainerRef}
                                        className="h-32 overflow-y-auto pr-2 custom-scrollbar space-y-1"
                                    >
                                        {automationLogs.length === 0 ? (
                                            <p className="opacity-30 italic">Đang chờ lệnh từ Robot...</p>
                                        ) : (
                                            automationLogs.map((log, i) => (
                                                <p key={i} className="leading-relaxed border-l-2 border-emerald-500/20 pl-2">{log}</p>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                    {groups.map((g: any, i) => (
                                        <div key={i} className="p-5 bg-surface-container-low rounded-[1.5rem] flex items-center justify-between group hover:bg-surface-mid transition-all border-2 border-transparent hover:border-primary/5">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm">
                                                    {isVideo(JSON.parse(g.media_files)[0]) ? (
                                                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                                            <FileVideo className="w-6 h-6 text-white/20" />
                                                        </div>
                                                    ) : (
                                                        <img 
                                                            src={`media://local-file?path=${encodeURIComponent(JSON.parse(g.media_files)[0])}`} 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm text-sky-950 mb-1">{g.name}</h4>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                                            <Folders className="w-3 h-3" /> {projects.find(p => p.id === g.project_id)?.name || 'Dự án'}
                                                        </span>
                                                        <Badge className={cn(
                                                            "text-[8px] h-5 rounded-md border-none px-2",
                                                            g.status === 'processed' ? "bg-emerald-100 text-emerald-700" : 
                                                            g.status === 'ready' ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
                                                        )}>
                                                            {g.status === 'processed' ? 'ĐÃ SINH BÀI' : g.status === 'ready' ? 'ĐÃ DUYỆT - CHỜ AI' : 'BẢN NHÁP'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {g.status === 'ready' && (
                                                    <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-500 animate-pulse">
                                                        <Sparkles className="w-4 h-4" />
                                                    </div>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="w-9 h-9 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                                                    onClick={() => setDeleteGroupId(g.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {groups.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 py-20">
                                            <Zap className="w-16 h-16 mb-4" />
                                            <p className="font-bold">Chưa có tài nguyên tự động</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 3: AI Dashboard */}
                <TabsContent value="dashboard" className="animate-in fade-in duration-500">
                    <div className="grid grid-cols-12 gap-8">
                        {/* Control Panel */}
                        <div className="col-span-4 space-y-6">
                            <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-8 space-y-8">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">1. Nhóm Nội dung (Trống = Tất cả)</label>
                                        <Select onValueChange={(v) => setActiveGroup(groups.find(g => g.id === Number(v)))}>
                                            <SelectTrigger className="w-full bg-surface-low border-none rounded-xl h-11 px-4 font-bold text-xs">
                                                <SelectValue placeholder="Mặc định: Tất cả nhóm">
                                                    {activeGroup?.name || "Mặc định: Tất cả nhóm"}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Nhóm tài nguyên</SelectLabel>
                                                    {groups.map(g => (
                                                        <SelectItem key={g.id} value={g.id.toString()} className="font-bold">
                                                            {g.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">2. Trang mục tiêu (Bắt buộc)</label>
                                        <Dialog>
                                            <DialogTrigger>
                                                <Button variant="outline" className="w-full bg-surface-low border-none rounded-xl h-11 px-4 justify-between font-bold text-xs overflow-hidden">
                                                    <span className="truncate">
                                                        {selectedPageIds.length === 0 ? "Chọn các Trang mục tiêu..." : `Đã chọn ${selectedPageIds.length} trang`}
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 opacity-50 rotate-90 shrink-0" />
                                                </Button>
                                            </DialogTrigger>
                                            <p className="text-[9px] text-muted-foreground opacity-70 ml-1 italic font-medium">
                                                * Nếu để trống: Hệ thống tự chọn các dự án chưa có bài viết.
                                            </p>
                                            <DialogContent className="max-w-md bg-white border-none rounded-[2.5rem] p-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-300">
                                                <DialogHeader className="space-y-3">
                                                    <DialogTitle className="text-2xl font-display font-extrabold">Danh sách Trang mục tiêu</DialogTitle>
                                                    <DialogDescription className="text-sm text-muted-foreground">
                                                        Chọn các trang bạn muốn đăng bài. AI sẽ sinh nội dung riêng biệt cho từng trang.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                
                                                <div className="mt-6 space-y-4">
                                                    <div className="flex items-center justify-between px-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Trang cá nhân / Fanpage</span>
                                                    </div>
                                                    
                                                    <ScrollArea className="h-[400px] -mx-2 px-2">
                                                        <div className="space-y-2">
                                                            {availablePages.map(pg => (
                                                                <div 
                                                                    key={pg.id} 
                                                                    className={cn(
                                                                        "flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2",
                                                                        selectedPageIds.includes(pg.id) 
                                                                            ? "bg-primary/5 border-primary/20" 
                                                                            : "bg-surface-low border-transparent hover:bg-surface-mid"
                                                                    )}
                                                                    onClick={() => {
                                                                        setSelectedPageIds(prev => 
                                                                            prev.includes(pg.id) ? prev.filter(x => x !== pg.id) : [...prev, pg.id]
                                                                        )
                                                                    }}
                                                                >
                                                                    <Checkbox 
                                                                        checked={selectedPageIds.includes(pg.id)}
                                                                        className="w-5 h-5 border-primary/20 data-[state=checked]:bg-primary"
                                                                    />
                                                                    <div className="flex-1 overflow-hidden flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full bg-surface-container overflow-hidden border border-border/10">
                                                                            {pg.avatar_url ? (
                                                                                <img src={pg.avatar_url} className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <UserCircle className="w-full h-full text-muted-foreground/30 p-1" />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <p className="text-sm font-bold truncate">{pg.page_name}</p>
                                                                            <p className="text-[9px] text-muted-foreground uppercase">{pg.platform} • {pg.handle || 'N/A'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </ScrollArea>
                                                </div>

                                                <div className="mt-8 flex gap-3">
                                                    <Button className="flex-1 primary-gradient h-12 rounded-xl font-bold" onClick={() => (document.querySelector('[data-state="open"]') as any)?.click()}>
                                                        Xác nhận chọn
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">3. Mẫu Prompt</label>
                                        <Select value={selectedPromptId} onValueChange={(v) => v && setSelectedPromptId(v)}>
                                            <SelectTrigger className="w-full bg-surface-low border-none rounded-xl h-11 px-4 font-bold text-xs">
                                                <SelectValue placeholder="Chọn kịch bản AI...">
                                                    {prompts.find(p => p.id.toString() === selectedPromptId)?.name || "Chọn kịch bản AI..."}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className="bg-white border-border/10">
                                                <SelectGroup>
                                                    <SelectLabel>Kịch bản AI</SelectLabel>
                                                    {prompts.map(p => (
                                                        <SelectItem key={p.id} value={p.id.toString()} className="font-bold py-3 pr-8">
                                                            <div className="space-y-1">
                                                                <p>{p.name}</p>
                                                                <p className="text-[9px] font-normal text-muted-foreground line-clamp-1 opacity-70 italic max-w-[200px]">
                                                                    {p.content}
                                                                </p>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>

                                        {/* Placeholder Legend */}
                                        <div className="mt-2 p-3 bg-surface-container-low/50 rounded-xl border border-border/5 space-y-2">
                                            <p className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground flex items-center gap-1.5">
                                                <Key className="w-3 h-3 text-amber-500" /> Danh sách Thẻ dùng chung:
                                            </p>
                                            <div className="grid grid-cols-1 gap-1">
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <code className="text-primary font-bold bg-primary/5 px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/10" onClick={() => {navigator.clipboard.writeText('[TÊN_SẢN_PHẨM]'); toast.success('Đã copy thẻ Tên')}}>[TÊN_SẢN_PHẨM]</code>
                                                    <span className="text-muted-foreground opacity-60">Tên SP</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <code className="text-primary font-bold bg-primary/5 px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/10" onClick={() => {navigator.clipboard.writeText('[LINK_SẢN_PHẨM]'); toast.success('Đã copy thẻ Link')}}>[LINK_SẢN_PHẨM]</code>
                                                    <span className="text-muted-foreground opacity-60">Link SP</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <code className="text-primary font-bold bg-primary/5 px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/10" onClick={() => {navigator.clipboard.writeText('[TỪ_KHÓA]'); toast.success('Đã copy thẻ Từ khóa')}}>[TỪ_KHÓA]</code>
                                                    <span className="text-muted-foreground opacity-60">Từ khóa</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">4. Từ khóa (Mặc định: Tên file)</label>
                                        <Input 
                                            value={keyword}
                                            onChange={(e) => setKeyword(e.target.value)}
                                            placeholder="Gốc: Tên tài nguyên" 
                                            className="bg-surface-low border-none rounded-xl h-11 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">5. Sản phẩm liên kết (Tùy chọn)</label>
                                        <Select value={selectedProductId} onValueChange={(v) => v && setSelectedProductId(v)}>
                                            <SelectTrigger className="w-full bg-surface-low border-none rounded-xl h-11 px-4 font-bold text-xs">
                                                <SelectValue placeholder="Không gắn sản phẩm">
                                                    {products.find(p => p.id.toString() === selectedProductId)?.name || "Không gắn sản phẩm"}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className="bg-white border-border/10">
                                                <SelectGroup>
                                                    <SelectLabel>Sản phẩm của bạn</SelectLabel>
                                                    <SelectItem value="0" className="italic text-muted-foreground">Bỏ chọn sản phẩm</SelectItem>
                                                    {products.map(p => (
                                                        <SelectItem key={p.id} value={p.id.toString()} className="font-bold">
                                                            {p.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        {selectedProductId && selectedProductId !== '0' && (
                                            <p className="text-[9px] text-primary font-bold ml-1 animate-in fade-in">
                                                * AI sẽ tự động điền thông tin và link Shopee vào bài viết.
                                            </p>
                                        )}
                                    </div>

                                    {/* Watermark Config */}
                                    <div className="pt-4 border-t border-border/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Tự động chèn Watermark
                                            </label>
                                            <Switch 
                                                checked={watermarkEnabled} 
                                                onCheckedChange={setWatermarkEnabled}
                                                className="data-[state=checked]:bg-primary"
                                            />
                                        </div>
                                        
                                        {watermarkEnabled && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1 opacity-60">Vị trí chèn</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
                                                            <button 
                                                                key={pos}
                                                                onClick={() => setWatermarkPos(pos as any)}
                                                                className={cn(
                                                                    "px-2 py-1.5 rounded-lg border text-[8px] font-black uppercase transition-all tracking-tighter",
                                                                    watermarkPos === pos ? "bg-primary text-white border-primary" : "bg-surface-low border-transparent text-muted-foreground"
                                                                )}
                                                            >
                                                                {pos.replace('-', ' ')}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="flex-1 space-y-1.5">
                                                        <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1 opacity-60 text-center block">Kích thước</label>
                                                        <div className="px-2">
                                                            <Slider 
                                                                defaultValue={[watermarkSize]} 
                                                                max={0.3} 
                                                                step={0.01} 
                                                                min={0.05}
                                                                onValueChange={(val) => setWatermarkSize(val[0])}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 space-y-1.5">
                                                        <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1 opacity-60 text-center block">Độ đậm</label>
                                                        <div className="px-2">
                                                            <Slider 
                                                                defaultValue={[watermarkOpacity]} 
                                                                max={1} 
                                                                step={0.1} 
                                                                min={0.2}
                                                                onValueChange={(val) => setWatermarkOpacity(val[0])}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground leading-relaxed italic opacity-70">
                                                    * Video sẽ được chèn Avatar và Tên Facebook tự động trước khi đăng.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="h-px bg-border/50 -mx-2 my-4" />

                                <div className="space-y-4">
                                    <Button 
                                        onClick={handleGenerateContent}
                                        disabled={isGenerating || isAutoGenerating}
                                        className={cn(
                                            "w-full h-14 rounded-2xl font-bold shadow-xl transition-all gap-3",
                                            isGenerating ? "bg-surface-mid text-muted-foreground" : "bg-white border-2 border-primary/20 text-primary hover:bg-primary/5 shadow-primary/5"
                                        )}
                                    >
                                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                        {isGenerating ? 'Đang viết bài...' : 'Sinh Bài Viết Đơn'}
                                    </Button>

                                    <Button 
                                        className={cn(
                                            "w-full h-14 rounded-2xl font-bold gap-3 transition-all",
                                            isAutoGenerating 
                                                ? "bg-surface-mid text-muted-foreground cursor-not-allowed" 
                                                : "primary-gradient text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                                        )}
                                        onClick={handleSmartAuto}
                                        disabled={isAutoGenerating || isGenerating}
                                    >
                                        <Sparkles className={cn("w-5 h-5", isAutoGenerating && "animate-spin")} />
                                        {isAutoGenerating ? 'Hệ thống đang xử lý...' : 'Smart AI Auto Generate'}
                                    </Button>

                                    {isAutoGenerating && genStatus && (
                                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-2 animate-pulse">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Progress Status</p>
                                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                                            </div>
                                            <p className="text-xs font-medium opacity-80 leading-relaxed italic">
                                                {genStatus}
                                            </p>
                                        </div>
                                    )}
                                    <p className="text-[9px] text-center text-muted-foreground px-4 leading-relaxed">
                                        * Chế độ <b>Smart Auto</b> sẽ tự động xử lý các dự án/nhóm đã chọn trong nền.
                                    </p>
                                </div>
                            </Card>

                            {/* Resource Summary */}
                            {activeGroup && (
                                <Card className="border-none shadow-none bg-surface-lowest/50 rounded-[2rem] p-6 space-y-4">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tài nguyên đang sử dụng</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {JSON.parse(activeGroup.media_files).map((f: string, i: number) => (
                                            <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border border-border/10 bg-surface-low relative group">
                                                {isVideo(f) ? (
                                                    <video 
                                                        src={`media://local-file?path=${encodeURIComponent(f)}`} 
                                                        className="w-full h-full object-cover"
                                                        muted
                                                    />
                                                ) : (
                                                    <img 
                                                        src={`media://local-file?path=${encodeURIComponent(f)}`} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <p className="text-[8px] text-white font-bold p-1 text-center truncate w-full">
                                                        {f.split(/[\\\/]/).pop()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </div>

                        {/* Result Display */}
                        <div className="col-span-8 space-y-6">
                            {isAutoGenerating ? (
                                <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-12 min-h-[500px] flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="relative">
                                        <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                        <Sparkles className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-display font-bold">Quy trình tự động đang chạy</h3>
                                        <p className="text-muted-foreground max-w-sm mx-auto">AI đang xử lý các bài viết của bạn trong nền. Bạn có thể sang trang khác, hệ thống vẫn sẽ tiếp tục làm việc.</p>
                                        {genStatus && (
                                            <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                                 <p className="text-xs font-bold text-primary italic italic">"{genStatus}"</p>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ) : isGenerating ? (
                                <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-12 min-h-[500px] flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="relative">
                                        <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                        <Sparkles className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-display font-bold">Trí tuệ nhân tạo đang làm việc</h3>
                                        <p className="text-muted-foreground max-w-sm mx-auto">Vui lòng chờ trong giây lát, Google Gemini đang phân tích bối cảnh và viết nội dung cho bạn...</p>
                                    </div>
                                </Card>
                            ) : Object.keys(generatedResults).length > 0 ? (
                                <div className="space-y-6">
                                    {selectedPageIds.map(pageId => {
                                        const result = generatedResults[pageId]
                                        const page = availablePages.find(pg => pg.id === pageId)
                                        if (!result || !page) return null

                                        return (
                                            <Card key={pageId} className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-8 space-y-6 overflow-hidden animate-in slide-in-from-top-4 duration-300">
                                                <div className="flex items-center justify-between border-b border-border/5 pb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-surface-container overflow-hidden border border-border/10">
                                                            {page.avatar_url ? (
                                                                <img src={page.avatar_url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <UserCircle className="w-full h-full text-muted-foreground/30 p-1" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Biến thể cho trang:</p>
                                                            <h4 className="font-bold text-sm">{page.page_name}</h4>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button variant="ghost" size="sm" className="h-8 text-[10px] items-center gap-1.5 font-bold" onClick={() => {
                                                            toast.info('Tính năng sinh riêng lẻ đang phát triển')
                                                        }}>
                                                            <RefreshCw className="w-3 h-3" /> Sinh lại
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tiêu đề (Nổi bật)</label>
                                                        <div className="p-4 bg-surface-low rounded-2xl font-bold text-base border-2 border-primary/5">
                                                            {result.title}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nội dung bài viết</label>
                                                        <div className="p-5 bg-surface-low rounded-2xl text-sm leading-relaxed whitespace-pre-wrap">
                                                            {result.body}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Hashtags</label>
                                                        <div className="p-3 bg-primary/5 text-primary rounded-xl font-medium text-xs">
                                                            {result.hashtags}
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-border/5 flex items-center justify-between">
                                                        <div className="flex gap-2">
                                                            <Button 
                                                                variant="outline" 
                                                                className="h-10 rounded-xl px-4 text-xs font-bold gap-2"
                                                                onClick={async () => {
                                                                    await window.ipcRenderer.addPost({
                                                                        group_id: activeGroup.id,
                                                                        page_id: pageId,
                                                                        project_id: activeGroup.project_id,
                                                                        title: result.title,
                                                                        content: `${result.body}\n\n${result.hashtags}`,
                                                                        media_path: activeGroup.media_files ? JSON.parse(activeGroup.media_files)[0] : '',
                                                                        status: 'draft'
                                                                    })
                                                                    toast.success(`Đã lưu nháp cho ${page.page_name}`)
                                                                }}
                                                            >
                                                                Lưu nháp
                                                            </Button>
                                                        </div>
                                                        <Button 
                                                            className="h-10 primary-gradient rounded-xl px-6 text-xs font-bold shadow-lg shadow-primary/20"
                                                            onClick={async () => {
                                                                await window.ipcRenderer.addPost({
                                                                    group_id: activeGroup.id,
                                                                    page_id: pageId,
                                                                    project_id: activeGroup.project_id,
                                                                    title: result.title,
                                                                    content: `${result.body}\n\n${result.hashtags}`,
                                                                    media_path: activeGroup.media_files ? JSON.parse(activeGroup.media_files)[0] : '',
                                                                    status: 'approved'
                                                                })
                                                                toast.success(`Đã phê duyệt bài viết cho ${page.page_name}`)
                                                            }}
                                                        >
                                                            Duyệt & Đặt lịch
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        )
                                    })}
                                </div>
                            ) : (
                                <Card className="border-none shadow-none bg-surface-lowest/40 border-2 border-dashed border-border/10 rounded-[2.5rem] p-12 min-h-[500px] flex flex-col items-center justify-center text-center">
                                    <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center mb-6 text-muted-foreground/20">
                                        <Sparkles className="w-10 h-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold">Chưa có nội dung sinh ra</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto italic">Vui lòng thiết lập cấu hình bên trái và nhấn nút "Bắt đầu Sinh nội dung" để khởi tạo.</p>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
            
            <ConfirmDeleteDialog 
                isOpen={deleteGroupId !== null}
                onClose={() => setDeleteGroupId(null)}
                onConfirm={() => deleteGroupId && handleDeleteGroup(deleteGroupId)}
                title="Xác nhận xóa Nhóm nội dung?"
                itemName={groups.find(g => g.id === deleteGroupId)?.name}
                loading={isDeletingGroup}
            />
        </div>
    )
}

