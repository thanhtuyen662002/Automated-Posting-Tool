import React, { useEffect, useState } from 'react'
// Metadata: UI Redesigned and Actions Activated
import { 
    FileText, 
    Search, 
    MoreHorizontal, 
    Eye, 
    Edit, 
    Trash2, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Loader2,
    Globe,
    ExternalLink,
    ChevronRight,
    RefreshCw,
    LayoutGrid,
    Calendar,
    Save,
    Sparkles
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'

export const PostsManagementView: React.FC = () => {
    const [posts, setPosts] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [pages, setPages] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [projectFilter, setProjectFilter] = useState('all')
    
    // Actions state
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    
    // Edit/View state
    const [editingPost, setEditingPost] = useState<any | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isViewOnly, setIsViewOnly] = useState(false)
    const [editFormData, setEditFormData] = useState({ title: '', content: '', comment_cta: '', shopee_link: '' })
    const [isUpdating, setIsUpdating] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [selectedProductId, setSelectedProductId] = useState<string>('')
    const [isGeneratingCTA, setIsGeneratingCTA] = useState(false)
    const [ctaPrompts, setCtaPrompts] = useState<any[]>([])
    const [selectedCtaPromptId, setSelectedCtaPromptId] = useState<string>('')

    const fetchData = async () => {
        if (!window.ipcRenderer) return
        setLoading(true)
        try {
            const allPosts = await window.ipcRenderer.getPosts()
            const projs = await window.ipcRenderer.getProjects()
            const pgs = await window.ipcRenderer.getPages()
            const prods = await window.ipcRenderer.getProducts()
            const prompts = await window.ipcRenderer.getPrompts('Comment')
            
            setPosts(allPosts || [])
            setProjects(projs || [])
            setPages(pgs || [])
            setProducts(prods || [])
            setCtaPrompts(prompts || [])
            
            if (prompts && prompts.length > 0) {
                setSelectedCtaPromptId(prompts[0].id.toString())
            }
        } catch (e) {
            console.error('Fetch error:', e)
            toast.error('Không thể tải danh sách bài viết')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleDelete = async (id: number) => {
        try {
            setIsDeleting(true)
            await window.ipcRenderer.deletePost(id)
            setDeleteId(null)
            fetchData()
            toast.success('Đã xóa bài viết vĩnh viễn')
        } catch (e: any) {
            toast.error('Lỗi khi xóa: ' + e.message)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleOpenEdit = (post: any, viewOnly = false) => {
        setEditingPost(post)
        setEditFormData({ 
            title: post.title || '', 
            content: post.content || '',
            comment_cta: post.comment_cta || '',
            shopee_link: post.shopee_link || ''
        })
        setIsViewOnly(viewOnly)
        // Reset product selection if the post already has a shopee_link
        setSelectedProductId('')
        setIsEditOpen(true)
    }

    const handleApprove = async (id: number) => {
        if (!window.ipcRenderer) return
        try {
            await window.ipcRenderer.updatePost(id, { status: 'approved' })
            toast.success('Đã duyệt bài viết. Robot sẽ tự động xếp lịch.')
            fetchData()
        } catch (e: any) {
            toast.error('Lỗi khi duyệt bài: ' + e.message)
        }
    }

    const handleGenerateCTA = async () => {
        if (!window.ipcRenderer || !selectedCtaPromptId) {
            toast.error('Vui lòng chọn Mẫu Prompt')
            return
        }

        if (!selectedProductId && !editFormData.shopee_link) {
            toast.error('Vui lòng chọn Sản phẩm hoặc nhập Link Shopee')
            return
        }
        
        setIsGeneratingCTA(true)
        try {
            // Priority: User's custom link in the post, then selected product
            let shopeeLink = editFormData.shopee_link
            if (!shopeeLink && selectedProductId) {
                const prod = products.find(p => p.id.toString() === selectedProductId)
                shopeeLink = prod?.shopee_link || ''
            }

            const cta = await window.ipcRenderer.generateCTA({
                productId: selectedProductId ? Number(selectedProductId) : undefined,
                promptId: Number(selectedCtaPromptId),
                postContext: {
                    title: editFormData.title,
                    content: editFormData.content,
                    shopeeLink: shopeeLink,
                    mediaPath: editingPost?.media_path
                }
            })
            setEditFormData({ ...editFormData, comment_cta: cta })
            toast.success('Đã sinh bình luận CTA thông minh')
        } catch (e: any) {
            toast.error('Lỗi khi sinh CTA: ' + e.message)
        } finally {
            setIsGeneratingCTA(false)
        }
    }

    const handleUpdate = async () => {
        if (!editingPost) return
        try {
            setIsUpdating(true)
            await window.ipcRenderer.updatePost(editingPost.id, editFormData)
            setIsEditOpen(false)
            fetchData()
            toast.success('Đã cập nhật bài viết thành công')
        } catch (e: any) {
            toast.error('Lỗi khi cập nhật: ' + e.message)
        } finally {
            setIsUpdating(false)
        }
    }

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'published':
                return { label: 'Đã đăng', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 }
            case 'scheduled':
                return { label: 'Đã lên lịch', color: 'bg-sky-50 text-sky-600 border-sky-100', icon: Clock }
            case 'pending':
                return { label: 'Chờ duyệt', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: FileText }
            case 'processing':
                return { label: 'Đang đăng', color: 'bg-primary/5 text-primary border-primary/10', icon: Loader2 }
            case 'failed':
                return { label: 'Thất bại', color: 'bg-red-50 text-red-600 border-red-100', icon: AlertCircle }
            default:
                return { label: status, color: 'bg-slate-50 text-slate-600 border-slate-100', icon: FileText }
        }
    }

    const filteredPosts = posts.filter(post => {
        const matchesSearch = (post.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             post.content?.toLowerCase().includes(searchTerm.toLowerCase()))
        const matchesStatus = statusFilter === 'all' || post.status === statusFilter
        const matchesProject = projectFilter === 'all' || post.project_id.toString() === projectFilter
        return matchesSearch && matchesStatus && matchesProject
    })

    const formatTime = (iso: string) => {
        if (!iso) return '---'
        return new Date(iso).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        })
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">
                <span>Quản lý</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary/70 font-extrabold">Danh sách Bài viết</span>
            </div>

            {/* Header Area */}
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <h2 className="text-4xl font-display font-extrabold tracking-tight">Quản lý Bài viết</h2>
                    <p className="text-muted-foreground text-sm">Theo dõi và kiểm soát tất cả bài đăng trên đa nền tảng.</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        onClick={fetchData} 
                        className="rounded-xl h-11 px-4 gap-2 border-dashed border-border/40 hover:bg-surface-low transition-all"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Làm mới</span>
                    </Button>
                </div>
            </div>

            {/* Top Metrics Cards (Dashboard Style) */}
            <div className="grid gap-6 md:grid-cols-4">
                {[
                    { label: 'Tổng bài viết', value: posts.length, icon: FileText, hasAlert: false },
                    { label: 'Đã xuất bản', value: posts.filter(p => p.status === 'published').length, icon: CheckCircle2, status: 'Ổn định', statusColor: 'text-emerald-500' },
                    { label: 'Đang xếp hàng', value: posts.filter(p => ['pending', 'scheduled'].includes(p.status)).length, icon: Calendar, hasAlert: posts.filter(p => ['pending', 'scheduled'].includes(p.status)).length > 0 },
                    { label: 'Vấn đề/Lỗi', value: posts.filter(p => p.status === 'failed').length, icon: AlertCircle, hasAlert: posts.filter(p => p.status === 'failed').length > 0 },
                ].map((metric, i) => (
                    <Card key={i} className="border-none shadow-none bg-surface-container-lowest rounded-2xl p-6">
                        <CardContent className="p-0 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className={cn(
                                    "p-3 rounded-xl",
                                    metric.hasAlert ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
                                )}>
                                    <metric.icon className="w-6 h-6" />
                                </div>
                                {metric.status && <span className={cn("text-[10px] font-bold uppercase tracking-wider", metric.statusColor)}>{metric.status}</span>}
                                {metric.hasAlert && <div className="w-2 h-2 rounded-full bg-red-500" />}
                            </div>
                            <div>
                                <div className="text-4xl font-display font-bold leading-none mb-1">{metric.value}</div>
                                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{metric.label}</div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Smart Filter Bar (Products Page Style) */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Tìm theo tiêu đề hoặc nội dung..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 bg-surface-lowest border-none rounded-xl font-medium"
                    />
                </div>
                
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="w-[180px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-[10px] uppercase tracking-widest">
                        <SelectValue placeholder="Dự án: Tất cả" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectGroup>
                            <SelectLabel>Dự án</SelectLabel>
                            <SelectItem value="all">Tất cả dự án</SelectItem>
                            {projects.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-[10px] uppercase tracking-widest">
                        <SelectValue placeholder="Trạng thái: Tất cả" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectGroup>
                            <SelectLabel>Trạng thái</SelectLabel>
                            <SelectItem value="all">Mọi trạng thái</SelectItem>
                            <SelectItem value="published">Đã đăng</SelectItem>
                            <SelectItem value="scheduled">Đã lên lịch</SelectItem>
                            <SelectItem value="pending">Chờ duyệt</SelectItem>
                            <SelectItem value="processing">Đang đăng</SelectItem>
                            <SelectItem value="failed">Thất bại</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            {/* Main Table */}
            <Card className="border-none shadow-none bg-surface-container-lowest rounded-3xl overflow-hidden p-6">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 text-left border-b border-border/5">
                                <th className="px-6 py-4">Nội dung bài viết</th>
                                <th className="px-6 py-4">Nguồn xuất bản</th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                                <th className="px-6 py-4">Kế hoạch đăng</th>
                                <th className="px-6 py-4 text-right">Tác vụ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                            <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase">Đang đồng bộ dữ liệu bài viết...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPosts.length > 0 ? (
                                filteredPosts.map((post) => {
                                    const status = getStatusInfo(post.status)
                                    const page = pages.find(pg => pg.id === post.page_id)
                                    const project = projects.find(pr => pr.id === post.project_id)
                                    
                                    return (
                                        <tr key={post.id} className="group hover:bg-surface-low transition-all duration-300">
                                            <td className="px-6 py-6 border-none max-w-md">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-16 h-16 rounded-2xl bg-surface-low overflow-hidden flex-shrink-0 border border-border/5 relative shadow-sm group-hover:scale-105 transition-transform duration-500">
                                                        {post.media_path ? (
                                                            post.media_path.toLowerCase().endsWith('.mp4') || post.media_path.toLowerCase().endsWith('.mov') ? (
                                                                <video 
                                                                    src={`media://local-file?path=${encodeURIComponent(post.media_path)}`}
                                                                    className="w-full h-full object-cover"
                                                                    muted
                                                                />
                                                            ) : (
                                                                <img 
                                                                    src={`media://local-file?path=${encodeURIComponent(post.media_path)}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            )
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/10 bg-surface-mid">
                                                                <FileText className="w-8 h-8" />
                                                            </div>
                                                        )}
                                                        {post.media_path?.toLowerCase().match(/\.(mp4|mov)$/i) && (
                                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                                                <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                                    <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent translate-x-0.5" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black tracking-widest text-primary uppercase">{project?.name || 'Dự án'}</span>
                                                        </div>
                                                        <h4 className="font-bold text-sm truncate leading-none text-foreground">{post.title || 'Bài viết mới'}</h4>
                                                        <p className="text-[11px] text-muted-foreground truncate opacity-60 leading-tight">{post.content}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            <td className="px-6 py-6 border-none">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm",
                                                        page?.platform.toLowerCase() === 'fb' ? 'bg-[#1877F2]' : 
                                                        page?.platform.toLowerCase() === 'tiktok' ? 'bg-[#000000]' : 'bg-[#E1306C]'
                                                    )}>
                                                        <Globe className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold truncate max-w-[150px]">{page?.page_name || 'Nguồn không xác định'}</div>
                                                        <div className="text-[10px] text-muted-foreground/60 uppercase font-black">{page?.platform || 'Global'}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-6 border-none text-center">
                                                <Badge className={cn("px-3 py-1 rounded-full text-[10px] font-bold border-none shadow-sm", status.color)}>
                                                    <status.icon className="w-3.5 h-3.5 mr-1.5 inline" />
                                                    {status.label}
                                                </Badge>
                                            </td>

                                            <td className="px-6 py-6 border-none">
                                                <div className="space-y-0.5">
                                                    <div className="text-[11px] font-black text-foreground">
                                                        {post.scheduled_at ? formatTime(post.scheduled_at) : 'Thủ công'}
                                                    </div>
                                                    <div className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
                                                        {post.scheduled_at ? 'Đã lên lịch' : 'Chưa định lịch'}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-6 border-none text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 bg-surface-low rounded-xl group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                                            <MoreHorizontal className="w-5 h-5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-[1.5rem] border-none shadow-2xl animate-in zoom-in-95 duration-200">
                                                        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-3">Tác vụ bài viết</DropdownMenuLabel>
                                                        {post.status === 'pending' && (
                                                            <DropdownMenuItem onClick={() => handleApprove(post.id)} className="rounded-xl px-4 py-3 gap-3 cursor-pointer group/item text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50">
                                                                <CheckCircle2 className="w-4 h-4 transition-transform group-hover/item:scale-110" />
                                                                <span className="text-xs font-bold text-emerald-600">Phê duyệt (Approve)</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => handleOpenEdit(post, true)} className="rounded-xl px-4 py-3 gap-3 cursor-pointer group/item">
                                                            <Eye className="w-4 h-4 text-primary transition-transform group-hover/item:scale-110" />
                                                            <span className="text-xs font-bold">Xem toàn bộ</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleOpenEdit(post, false)} className="rounded-xl px-4 py-3 gap-3 cursor-pointer group/item">
                                                            <Edit className="w-4 h-4 text-amber-500 transition-transform group-hover/item:scale-110" />
                                                            <span className="text-xs font-bold">Chỉnh sửa nội dung</span>
                                                        </DropdownMenuItem>
                                                        {post.status === 'published' && (
                                                            <DropdownMenuItem className="rounded-xl px-4 py-3 gap-3 cursor-pointer text-sky-500 group/item">
                                                                <ExternalLink className="w-4 h-4 transition-transform group-hover/item:scale-110" />
                                                                <span className="text-xs font-bold">Đi đến bài đăng</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator className="my-2 opacity-5" />
                                                        <DropdownMenuItem 
                                                            onClick={() => setDeleteId(post.id)}
                                                            className="rounded-xl px-4 py-3 gap-3 cursor-pointer text-red-500 hover:text-red-600 group/item"
                                                        >
                                                            <Trash2 className="w-4 h-4 transition-transform group-hover/item:scale-110" />
                                                            <span className="text-xs font-bold">Gỡ bỏ khỏi hệ thống</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-32 text-center">
                                        <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                                            <div className="w-24 h-24 bg-surface-low rounded-[2.5rem] flex items-center justify-center text-muted-foreground/10 border-2 border-dashed border-border/10">
                                                <LayoutGrid className="w-10 h-10" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="text-xl font-bold tracking-tight">Trống danh sách bài viết</p>
                                                <p className="text-sm text-muted-foreground italic leading-relaxed">Không tìm thấy bất kỳ bài viết nào phù hợp với các tiêu chí lọc hiện tại của bạn.</p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                className="rounded-2xl h-12 px-8 font-bold text-xs uppercase tracking-widest border-2 border-primary/20 text-primary hover:bg-primary/5 shadow-xl shadow-primary/5" 
                                                onClick={() => { setSearchTerm(''); setStatusFilter('all'); setProjectFilter('all'); }}
                                            >
                                                Xóa bộ lọc
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Edit / View Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border-none p-10 bg-surface-container-lowest animate-in zoom-in-95 duration-300 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-display font-extrabold flex items-center gap-3">
                            {isViewOnly ? (
                                <>
                                    <Eye className="w-6 h-6 text-primary" />
                                    <span>Chi tiết bài viết</span>
                                </>
                            ) : (
                                <>
                                    <Edit className="w-6 h-6 text-amber-500" />
                                    <span>Chỉnh sửa nội dung</span>
                                </>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Tiêu đề bài viết</label>
                                <Input 
                                    value={editFormData.title}
                                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                    readOnly={isViewOnly}
                                    className="h-12 bg-surface-low border-none rounded-2xl font-bold text-sm focus-visible:ring-primary/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Nội dung bài viết</label>
                                <Textarea 
                                    value={editFormData.content}
                                    onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                                    readOnly={isViewOnly}
                                    placeholder="Nội dung chính của bài viết..."
                                    className="min-h-[180px] bg-surface-low border-none rounded-2xl py-4 font-medium text-sm leading-relaxed resize-none focus-visible:ring-primary/20"
                                />
                            </div>

                            {!isViewOnly && (
                                <div className="p-5 bg-amber-50/50 rounded-3xl border border-amber-100 space-y-4">
                                    <div className="flex items-center gap-2 text-amber-700">
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Tiếp thị Affiliate (CTA)</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                            <SelectTrigger className="h-10 bg-white border-none rounded-xl text-[10px] font-bold">
                                                <SelectValue placeholder="Chọn sản phẩm..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-xl">
                                                {products.map(p => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Select value={selectedCtaPromptId} onValueChange={setSelectedCtaPromptId}>
                                            <SelectTrigger className="h-10 bg-white border-none rounded-xl text-[10px] font-bold">
                                                <SelectValue placeholder="Mẫu CTA..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-xl">
                                                {ctaPrompts.map(p => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button 
                                        onClick={handleGenerateCTA}
                                        disabled={isGeneratingCTA || !selectedProductId}
                                        className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest gap-2 shadow-lg shadow-amber-200"
                                    >
                                        {isGeneratingCTA ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Sinh bình luận CTA
                                    </Button>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Bình luận CTA / Link Shopee</label>
                                <Textarea 
                                    value={editFormData.comment_cta}
                                    onChange={(e) => setEditFormData({ ...editFormData, comment_cta: e.target.value })}
                                    readOnly={isViewOnly}
                                    placeholder="Nội dung bình luận điều hướng khách hàng..."
                                    className="min-h-[100px] bg-sky-50/30 border-none rounded-2xl py-3 font-medium text-xs leading-relaxed resize-none focus-visible:ring-primary/20"
                                />
                            </div>
                        </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Link Shopee Sản phẩm</label>
                                    <div className="relative">
                                        <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                                        <Input 
                                            value={editFormData.shopee_link}
                                            onChange={(e) => setEditFormData({ ...editFormData, shopee_link: e.target.value })}
                                            readOnly={isViewOnly}
                                            placeholder="https://shope.ee/..."
                                            className="h-12 pl-12 bg-sky-50/50 border-none rounded-2xl font-bold text-sm focus-visible:ring-primary/20 text-sky-700"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground italic ml-1 opacity-60">AI sẽ dùng link này để viết lời giới thiệu sản phẩm.</p>
                                </div>

                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Tài nguyên đính kèm</label>
                            <div className="aspect-square bg-surface-low rounded-3xl overflow-hidden border border-border/5 shadow-inner flex items-center justify-center relative group">
                                {editingPost?.media_path ? (
                                    editingPost.media_path.toLowerCase().endsWith('.mp4') || editingPost.media_path.toLowerCase().endsWith('.mov') ? (
                                        <video 
                                            src={`media://local-file?path=${encodeURIComponent(editingPost.media_path)}`}
                                            className="w-full h-full object-cover"
                                            controls
                                        />
                                    ) : (
                                        <img 
                                            src={`media://local-file?path=${encodeURIComponent(editingPost.media_path)}`}
                                            className="w-full h-full object-cover"
                                        />
                                    )
                                ) : (
                                    <FileText className="w-16 h-16 text-muted-foreground/10" />
                                )}
                            </div>
                            <div className="p-4 bg-surface-low rounded-2xl space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-muted-foreground uppercase opacity-60">Trạng thái</span>
                                    <Badge className={cn("px-2 py-0 border-none", editingPost ? getStatusInfo(editingPost.status).color : "")}>
                                        {editingPost ? getStatusInfo(editingPost.status).label : ""}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-muted-foreground uppercase opacity-60">Ngày tạo</span>
                                    <span className="text-foreground">{editingPost ? formatTime(editingPost.created_at) : "---"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-3 sm:justify-start">
                        {!isViewOnly ? (
                            <Button 
                                onClick={handleUpdate} 
                                disabled={isUpdating}
                                className="primary-gradient h-12 px-8 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 gap-2 flex-1 sm:flex-none"
                            >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>Lưu thay đổi</span>
                            </Button>
                        ) : null}
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsEditOpen(false)}
                            className="h-12 px-8 rounded-2xl font-black text-xs uppercase tracking-widest bg-surface-low hover:bg-surface-mid flex-1 sm:flex-none"
                        >
                            {isViewOnly ? "Đóng" : "Hủy bỏ"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog 
                isOpen={deleteId !== null}
                onClose={() => setDeleteId(null)}
                onConfirm={() => deleteId && handleDelete(deleteId)}
                title="Gỡ bài viết này?"
                itemName={posts.find(p => p.id === deleteId)?.title || 'Bài viết không tiêu đề'}
                loading={isDeleting}
            />
        </div>
    )
}
