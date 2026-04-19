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
    Calendar as CalendarIcon
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
    DialogFooter
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
            case 'scheduled': return <Badge className="bg-sky-500 text-white border-none">Đã lên lịch</Badge>
            case 'approved': return <Badge className="bg-emerald-500 text-white border-none">Đã duyệt</Badge>
            case 'published': return <Badge className="bg-emerald-100 text-emerald-700 border-none">Đã đăng</Badge>
            case 'failed': return <Badge className="bg-red-100 text-red-700 border-none">Lỗi</Badge>
            default: return <Badge variant="outline" className="text-muted-foreground">{status}</Badge>
        }
    }

    const formatDateTime = (iso: string) => {
        if (!iso) return 'Chưa lên lịch'
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
                        className="h-12 primary-gradient text-white rounded-xl shadow-lg shadow-primary/20 font-bold px-6 gap-2"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        Tự động lên lịch Toàn cục
                    </Button>
                </div>
            </div>

            <div className="w-full">
                {/* Timeline Dashboard */}
                <div className="space-y-6">
                    <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-8 overflow-hidden min-h-[600px] flex flex-col">
                        <div className="flex items-center gap-4 mb-8">
                             <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-500">
                                <CalendarDays className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-bold">Timeline bài đăng</h3>
                        </div>

                        <div className="w-full">
                            {/* Header */}
                            <div className="grid grid-cols-12 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-surface-low rounded-xl mb-4">
                                <div className="col-span-4">Bài viết & Nội dung</div>
                                <div className="col-span-2">Nền tảng</div>
                                <div className="col-span-3">Thời gian dự kiến</div>
                                <div className="col-span-2 text-center">Trạng thái</div>
                                <div className="col-span-1"></div>
                            </div>

                            {/* Body */}
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {posts.length > 0 ? (
                                    posts
                                        .sort((a,b) => {
                                            if (!a.scheduled_at) return 1
                                            if (!b.scheduled_at) return -1
                                            return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
                                        })
                                        .map((p, i) => (
                                            <div key={i} className="grid grid-cols-12 items-center px-4 py-5 hover:bg-surface-low transition-colors rounded-3xl group border border-transparent hover:border-border/5">
                                                <div className="col-span-4 flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-surface-container rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
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
                                                            <CalendarIcon className="w-5 h-5 text-muted-foreground/30" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[9px] font-black tracking-widest text-primary uppercase leading-none mb-1">
                                                            {projects.find(pj => pj.id === p.project_id)?.name || 'Dự án'}
                                                        </div>
                                                        <h4 className="font-bold text-xs truncate pr-4">{p.title || 'Không có tiêu đề'}</h4>
                                                        <p className="text-[10px] text-muted-foreground truncate opacity-60">ID: #{p.id}</p>
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{pages.find(pg => pg.id === p.page_id)?.platform || 'Không xác định'}</span>
                                                </div>
                                                <div className="col-span-3">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5 text-primary/40" />
                                                        <span className={cn(
                                                            "text-[11px] font-bold",
                                                            p.scheduled_at ? "text-foreground" : "text-muted-foreground italic"
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
                                                        className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-50"
                                                    >
                                                        <Edit className="w-4 h-4 text-amber-500" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                ) : (
                                    <div className="py-20 text-center flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center text-muted-foreground/20">
                                            <Clock4 className="w-8 h-8" />
                                        </div>
                                        <p className="text-sm text-muted-foreground italic">Chưa có bài viết nào đang chờ xử lý.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Edit Schedule Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="rounded-[2.5rem] border-none p-10 bg-surface-lowest shadow-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-display font-extrabold flex items-center gap-3">
                            <Clock4 className="w-6 h-6 text-amber-500" />
                            <span>Thay đổi thời gian đăng</span>
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-6 space-y-6">
                        <div className="p-4 bg-surface-low rounded-2xl border border-border/5 space-y-2">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bài viết đang chọn</h4>
                            <p className="font-bold text-sm text-sky-900 truncate">{editingPost?.title || 'Không có tiêu đề'}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Chọn thời gian mới</label>
                            <Input 
                                type="datetime-local"
                                value={newScheduledTime}
                                onChange={(e) => setNewScheduledTime(e.target.value)}
                                className="h-14 bg-surface-low border-none rounded-2xl font-bold text-sm focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:justify-start">
                        <Button 
                            onClick={handleUpdateSchedule}
                            disabled={isUpdating}
                            className="primary-gradient h-12 px-8 rounded-2xl font-bold flex-1"
                        >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Lưu thay đổi
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsEditDialogOpen(false)}
                            className="h-12 px-8 rounded-2xl font-bold bg-surface-container-low"
                        >
                            Hủy
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

