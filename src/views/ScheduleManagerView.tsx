import React, { useEffect, useState } from 'react'
import { 
    CalendarDays, 
    Clock, 
    Save, 
    Play, 
    Edit, 
    Clock4, 
    ChevronRight,
    Loader2,
    Calendar as CalendarIcon,
    ShieldCheck
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Brand Assets
import facebookLogo from '@/assets/facebook.svg'
import tiktokLogo from '@/assets/tiktok.svg'
import youtubeLogo from '@/assets/youtube.svg'
import instagramLogo from '@/assets/instagram.svg'
import zaloLogo from '@/assets/zalo.svg'
import shopeeLogo from '@/assets/shopee.svg'

export const ScheduleManagerView: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([])
    const [posts, setPosts] = useState<any[]>([])
    const [pages, setPages] = useState<any[]>([])
    
    const isVideo = (path: string) => {
        if (!path) return false
        const ext = path.split('.').pop()?.toLowerCase()
        return ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')
    }

    // Edit states
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingPost, setEditingPost] = useState<any | null>(null)
    const [newScheduledTime, setNewScheduledTime] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)

    const fetchData = async () => {
        if (!window.ipcRenderer) return
        try {
            const projs = await window.ipcRenderer.getProjects()
            setProjects(projs || [])

            const pgs = await window.ipcRenderer.getPages()
            setPages(pgs || [])

            const allPosts = await window.ipcRenderer.getPosts()
            setPosts(allPosts || [])
        } catch (e) {
            console.error('Fetch data error:', e)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleRunScheduler = async () => {
        if (!window.ipcRenderer) return
        toast.info('Đang phân bổ lịch đăng cho toàn bộ dự án...')
        try {
            const result = await window.ipcRenderer.runScheduler() // Global scheduler
            fetchData()
            toast.success(`Thành công! Đã lên lịch cho tổng cộng ${result.count} bài viết`)
        } catch (e: any) {
            toast.error('Lỗi lên lịch: ' + e.message)
        }
    }

    const handleEditClick = (post: any) => {
        setEditingPost(post)
        if (post.scheduled_at) {
            // Convert ISO to local datetime-local format (YYYY-MM-DDTHH:mm)
            const date = new Date(post.scheduled_at)
            const localISO = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
            setNewScheduledTime(localISO)
        } else {
            setNewScheduledTime(new Date().toISOString().slice(0, 16))
        }
        setIsEditDialogOpen(true)
    }

    const handleUpdateSchedule = async () => {
        if (!window.ipcRenderer || !editingPost) return
        try {
            setIsUpdating(true)
            await window.ipcRenderer.updatePostSchedule({
                id: editingPost.id,
                scheduledAt: new Date(newScheduledTime).toISOString(),
                status: 'scheduled'
            })
            setIsEditDialogOpen(false)
            fetchData()
            toast.success('Đã cập nhật thời gian đăng bài')
        } catch (e: any) {
            toast.error('Lỗi khi cập nhật: ' + e.message)
        } finally {
            setIsUpdating(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'scheduled': 
                return (
                    <Badge className="bg-sky-50 text-sky-600 border border-sky-100 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">
                        <Clock className="w-3 h-3 mr-1" /> Đã lên lịch
                    </Badge>
                )
            case 'approved': 
                return (
                    <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Đã duyệt
                    </Badge>
                )
            case 'published': 
            case 'completed':
                return (
                    <Badge className="bg-emerald-500 text-white border-none px-3 py-1 rounded-full text-[10px] font-bold shadow-md">
                        <Save className="w-3 h-3 mr-1" /> Đã hoàn tất
                    </Badge>
                )
            case 'processing':
                return (
                    <Badge className="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm animate-pulse">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Đang đăng...
                    </Badge>
                )
            case 'failed': 
                return (
                    <Badge className="bg-red-500 text-white border-none px-3 py-1 rounded-full text-[10px] font-bold shadow-md">
                        Lỗi hệ thống
                    </Badge>
                )
            default: 
                return (
                    <Badge className="bg-surface-container-high text-muted-foreground border-none px-3 py-1 rounded-full text-[10px] font-bold">
                        Chờ xử lý
                    </Badge>
                )
        }
    }

    const formatDateTime = (iso: string) => {
        if (!iso) return 'Chờ phân bổ...'
        return new Date(iso).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <span>Quản lý</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-extrabold">Lịch đăng & Timeline</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <h2 className="text-4xl font-display font-extrabold tracking-tight">Timeline thông minh</h2>
                    <p className="text-muted-foreground text-sm">Tự động phân phối bài đăng vào các khung giờ vàng để tối ưu tương tác.</p>
                </div>
                <div className="flex gap-4">
                    <Button 
                        onClick={handleRunScheduler}
                        className="h-12 primary-gradient text-white rounded-xl shadow-xl shadow-primary/20 font-bold px-8 gap-2 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        Tự động lên lịch
                    </Button>
                </div>
            </div>

            <div className="w-full">
                {/* Timeline Dashboard */}
                <div className="space-y-6">
                    <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-10 overflow-hidden min-h-[600px] flex flex-col">
                        <div className="flex items-center gap-4 mb-10">
                             <div className="w-14 h-14 bg-sky-50 rounded-[1.25rem] flex items-center justify-center text-sky-500 shadow-inner">
                                <CalendarDays className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-display font-extrabold">Lộ trình bài đăng</h3>
                                <p className="text-xs text-muted-foreground">Phân tích dòng chảy nội dung theo thời gian</p>
                            </div>
                        </div>

                        <div className="w-full">
                            {/* Header */}
                            <div className="grid grid-cols-12 px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 bg-surface-low rounded-2xl mb-6">
                                <div className="col-span-4">Thông tin bài viết</div>
                                <div className="col-span-2">Nền tảng</div>
                                <div className="col-span-3">Thời gian đăng</div>
                                <div className="col-span-2 text-center">Trạng thái</div>
                                <div className="col-span-1"></div>
                            </div>

                            {/* Body */}
                            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {posts.length > 0 ? (
                                    posts
                                        .sort((a,b) => {
                                            if (!a.scheduled_at) return 1
                                            if (!b.scheduled_at) return -1
                                            return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
                                        })
                                        .map((p, i) => (
                                            <div key={i} className="grid grid-cols-12 items-center px-6 py-4 hover:bg-surface-low/80 transition-all rounded-[1.5rem] group border border-transparent hover:border-border/5 hover:translate-x-1">
                                                <div className="col-span-4 flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-surface-container rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
                                                        {p.media_path ? (
                                                            isVideo(p.media_path) ? (
                                                                <video 
                                                                    src={`media://local-file?path=${encodeURIComponent(p.media_path)}`} 
                                                                    className="w-full h-full object-cover"
                                                                    muted
                                                                />
                                                            ) : (
                                                                <img 
                                                                    src={`media://local-file?path=${encodeURIComponent(p.media_path)}`} 
                                                                    className="w-full h-full object-cover" 
                                                                />
                                                            )
                                                        ) : (
                                                            <CalendarIcon className="w-6 h-6 text-muted-foreground/20" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[10px] font-black tracking-widest text-primary/60 uppercase leading-none mb-1.5 font-display">
                                                            {projects.find(pj => pj.id === p.project_id)?.name || 'Dự án'}
                                                        </div>
                                                        <h4 className="font-extrabold text-sm truncate pr-4 text-sky-950">{p.title || 'Mẫu bài viết mới'}</h4>
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    {(() => {
                                                        const platform = pages.find(pg => pg.id === p.page_id)?.platform || ''
                                                        let logo = ''
                                                        switch (platform.toLowerCase()) {
                                                            case 'facebook': logo = facebookLogo; break;
                                                            case 'tiktok': logo = tiktokLogo; break;
                                                            case 'instagram': logo = instagramLogo; break;
                                                            case 'youtube': logo = youtubeLogo; break;
                                                            case 'zalo': logo = zaloLogo; break;
                                                            case 'shopee': logo = shopeeLogo; break;
                                                        }
                                                        if (!logo) return <Badge variant="outline" className="text-[9px] uppercase font-bold">{platform || '???'}</Badge>
                                                        return (
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-6 h-6 bg-surface-lowest rounded-lg p-1.5 shadow-sm border border-border/5">
                                                                    <img src={logo} className="w-full h-full object-contain" />
                                                                </div>
                                                                <span className="text-[10px] font-black text-muted-foreground/80 uppercase tracking-wider">{platform}</span>
                                                            </div>
                                                        )
                                                    })()}
                                                </div>

                                                <div className="col-span-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center">
                                                            <Clock className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <span className={cn(
                                                            "text-xs font-bold",
                                                            p.scheduled_at ? "text-foreground" : "text-muted-foreground italic opacity-50 text-[10px]"
                                                        )}>
                                                            {formatDateTime(p.scheduled_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="col-span-2 flex justify-center">
                                                    {getStatusBadge(p.status)}
                                                </div>
                                                <div className="col-span-1 text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleEditClick(p)}
                                                        className="w-10 h-10 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-amber-100 hover:text-amber-600"
                                                    >
                                                        <Edit className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                ) : (
                                    <div className="py-24 text-center flex flex-col items-center gap-6">
                                        <div className="w-20 h-20 bg-surface-container-low rounded-[2rem] flex items-center justify-center text-muted-foreground/10 rotate-12">
                                            <Clock4 className="w-10 h-10" />
                                        </div>
                                        <p className="text-sm text-muted-foreground font-medium italic opacity-50">Dòng thời gian đang trống. Hãy sinh nội dung để bắt đầu.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Edit Schedule Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="rounded-[2.5rem] border-none p-0 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)] sm:max-w-[500px] overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-8 sm:p-10 space-y-8">
                        
                        {/* Header Dialog */}
                        <DialogHeader>
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 primary-gradient rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-primary/20 shrink-0">
                                    <Clock4 className="w-7 h-7" />
                                </div>
                                <div className="space-y-1 text-left mt-1">
                                    <DialogTitle className="text-2xl font-display font-extrabold text-sky-950 tracking-tight">
                                        Lịch đăng bài
                                    </DialogTitle>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Tùy chỉnh thời gian Robot</p>
                                </div>
                            </div>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                            {/* Khối hiển thị bài viết */}
                            <div className="p-6 bg-surface-lowest rounded-3xl border-2 border-surface-container-low space-y-3 relative overflow-hidden group shadow-sm hover:border-primary/20 hover:shadow-md transition-all duration-300">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-125 duration-700" />
                                
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 relative">Đang chọn nội dung</h4>
                                
                                <p className="font-extrabold text-base text-sky-950 relative leading-snug line-clamp-2 pr-2">
                                    {editingPost?.title || 'Bài viết không tiêu đề'}
                                </p>
                                
                                <div className="flex items-center gap-3 relative pt-2">
                                    <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1.5 rounded-lg uppercase tracking-wider">ID: #{editingPost?.id}</span>
                                    <span className="text-[8px] text-muted-foreground/30">●</span>
                                    <span className="text-[11px] font-semibold text-muted-foreground/60 italic">Cấu hình riêng</span>
                                </div>
                            </div>

                            {/* Khối chọn thời gian */}
                            <div className="space-y-3 bg-white">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-sky-950 ml-1">Thời gian đăng mới</label>
                                <div className="relative group">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/40 group-focus-within:text-primary transition-colors duration-300" />
                                    <Input 
                                        type="datetime-local"
                                        value={newScheduledTime}
                                        onChange={(e) => setNewScheduledTime(e.target.value)}
                                        className="h-14 pl-12 bg-surface-lowest border-2 border-surface-container-high hover:border-primary/30 rounded-2xl font-bold text-sm focus-visible:ring-4 focus-visible:ring-primary/10 transition-all shadow-sm w-full"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground/50 italic px-2">💡 Gợi ý: Hãy chọn khung giờ có tương tác cao (Giờ vàng).</p>
                            </div>
                        </div>

                        {/* Nút hành động */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-surface-container-low">
                             <Button 
                                variant="ghost" 
                                onClick={() => setIsEditDialogOpen(false)}
                                className="h-12 px-6 rounded-2xl font-bold text-sm text-muted-foreground hover:bg-surface-low hover:text-sky-950 transition-all"
                            >
                                Hủy bỏ
                            </Button>
                            <Button 
                                onClick={handleUpdateSchedule}
                                disabled={isUpdating}
                                className="primary-gradient h-12 px-8 rounded-2xl font-bold text-sm text-white shadow-xl shadow-primary/25 hover:translate-y-[-2px] active:translate-y-[0px] transition-all disabled:opacity-50 gap-2"
                            >
                                {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Lưu lịch đăng
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

