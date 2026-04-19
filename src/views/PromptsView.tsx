import React, { useEffect, useState } from 'react'
import { 
    MessageSquareText, 
    Plus, 
    Trash2, 
    ChevronRight, 
    Filter,
    MessageCircle,
    FileEdit,
    Languages,
    Pencil,
    Facebook,
    Play,
    Instagram,
    Globe,
    Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'

export const PromptsView: React.FC = () => {
    const [prompts, setPrompts] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [filterType, setFilterType] = useState('all')
    const [filterProject, setFilterProject] = useState('all')
    const [filterPlatform, setFilterPlatform] = useState('all')
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [formData, setFormData] = useState<any>({
        name: '',
        type: 'Viết bài',
        content: '',
        project_ids: [],
        platforms: []
    })

    const PLATFORMS = [
        { id: 'Facebook', label: 'FB', color: 'bg-[#1877F2]' },
        { id: 'TikTok', label: 'TikTok', color: 'bg-black' },
        { id: 'Insta', label: 'Insta', color: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]' },
        { id: 'Youtube', label: 'YT', color: 'bg-[#FF0000]' },
        { id: 'Zalo', label: 'Zalo', color: 'bg-[#0068FF]' }
    ]

    const PlatformIcon = ({ id, className }: { id: string, className?: string }) => {
        switch (id) {
            case 'Facebook':
                return (
                    <div className={cn("w-4 h-4 bg-[#1877F2] rounded-full flex items-center justify-center text-white", className)}>
                        <Facebook className="w-2.5 h-2.5 fill-current" />
                    </div>
                )
            case 'TikTok':
                return (
                    <div className={cn("w-4 h-4 bg-black rounded-full flex items-center justify-center", className)}>
                        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18.77a6.738 6.738 0 01-6.74 6.74c-1.4-.04-2.79-.45-3.99-1.18a6.704 6.704 0 01-2.4-2.35 6.748 6.748 0 01-.35-6.19c.33-1 1-1.9 1.85-2.57.8-.63 1.77-1.04 2.77-1.18v4.02c-.52.07-1.03.24-1.48.52-.4.25-.74.59-.98 1-.22.38-.34.81-.34 1.25.01 1.48 1.22 2.69 2.69 2.7 1.48.01 2.69-1.21 2.7-2.69V.02z"/>
                        </svg>
                    </div>
                )
            case 'Insta':
                return (
                    <div className={cn("w-4 h-4 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] rounded-sm flex items-center justify-center text-white", className)}>
                        <Instagram className="w-2.5 h-2.5" />
                    </div>
                )
            case 'Youtube':
                return (
                    <div className={cn("w-4 h-4 bg-[#FF0000] rounded-sm flex items-center justify-center text-white", className)}>
                        <Play className="w-2.5 h-2.5 fill-current" />
                    </div>
                )
            case 'Zalo':
                return (
                    <div className={cn("w-4 h-4 bg-[#0068FF] rounded-sm flex items-center justify-center text-white font-black text-[7px]", className)}>
                        Z
                    </div>
                )
            default:
                return <Globe className={cn("w-4 h-4 text-muted-foreground", className)} />
        }
    }

    const fetchData = async () => {
        if (!window.ipcRenderer) return
        try {
            const pData = await window.ipcRenderer.getPrompts()
            setPrompts(pData || [])
            const jData = await window.ipcRenderer.getProjects()
            setProjects(jData || [])
        } catch (e) {
            console.error('Failed to fetch data:', e)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSave = async () => {
        if (!formData.name || !formData.content) {
            toast.error('Vui lòng điền đầy đủ tên và nội dung câu lệnh')
            return
        }
        try {
            if (editingId) {
                await window.ipcRenderer.updatePrompt(editingId, formData)
                toast.success('Đã cập nhật mẫu câu lệnh')
            } else {
                await window.ipcRenderer.addPrompt(formData)
                toast.success('Đã thêm mẫu câu lệnh mới')
            }
            
            setIsAddOpen(false)
            setEditingId(null)
            setFormData({ name: '', type: 'Viết bài', content: '', project_ids: [], platforms: [] })
            fetchData()
            
            await window.ipcRenderer.addLog({
                type: 'Hệ thống',
                status: 'success',
                message: `${editingId ? 'Cập nhật' : 'Tạo'} mẫu prompt: ${formData.name}`
            })
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message)
        }
    }

    const openEdit = (p: any) => {
        setEditingId(p.id)
        setFormData({
            name: p.name,
            type: p.type,
            content: p.content,
            project_ids: JSON.parse(p.project_ids || '[]'),
            platforms: JSON.parse(p.platforms || '[]')
        })
        setIsAddOpen(true)
    }

    const handleDelete = async (id: number) => {
        try {
            setIsDeleting(true)
            await window.ipcRenderer.deletePrompt(id)
            setDeleteId(null)
            fetchData()
            toast.success('Đã xóa mẫu câu lệnh')
        } catch (e: any) {
            toast.error('Lỗi khi xóa: ' + e.message)
        } finally {
            setIsDeleting(false)
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Comment': return <MessageCircle className="w-4 h-4" />
            case 'Rewrite': return <FileEdit className="w-4 h-4" />
            case 'Translation': return <Languages className="w-4 h-4" />
            default: return <MessageSquareText className="w-4 h-4" />
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <span>Thiết lập</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-extrabold">Kho Prompts</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <h2 className="text-4xl font-display font-extrabold tracking-tight">Mẫu Câu lệnh</h2>
                    <p className="text-muted-foreground text-sm">Quản lý các kịch bản tương tác để điều khiển AI sinh nội dung đúng ý đồ.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="primary-gradient h-12 px-6 rounded-xl shadow-lg shadow-primary/20 gap-2">
                    <Plus className="w-5 h-5 font-bold" />
                    <span className="font-bold">Thêm Prompt mới</span>
                </Button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-4">
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-xs uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-primary" />
                            <SelectValue placeholder="Phân loại: Tất cả" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Phân loại Prompt</SelectLabel>
                            <SelectItem value="all">Toàn bộ loại</SelectItem>
                            <SelectItem value="Post">Viết bài</SelectItem>
                            <SelectItem value="Comment">Viết bình luận</SelectItem>
                            <SelectItem value="Rewrite">Viết lại bài</SelectItem>
                            <SelectItem value="Translation">Dịch thuật</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>

                <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-[200px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-xs uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            <SelectValue placeholder="Dự án: Tất cả" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Theo dự án</SelectLabel>
                            <SelectItem value="all">Toàn bộ dự án</SelectItem>
                            <SelectItem value="global">Chỉ Prompt chung</SelectItem>
                            {projects.map(pj => (
                                <SelectItem key={pj.id} value={pj.id.toString()}>{pj.name}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>

                <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                    <SelectTrigger className="w-[180px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-xs uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-primary" />
                            <SelectValue placeholder="Nền tảng: Tất cả" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Theo nền tảng</SelectLabel>
                            <SelectItem value="all">Toàn bộ</SelectItem>
                            {PLATFORMS.map(plat => (
                                <SelectItem key={plat.id} value={plat.id}>{plat.id}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            {/* Prompts List Area */}
            <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] overflow-hidden p-8">
                <div className="w-full">
                    {/* Header */}
                    <div className="grid grid-cols-12 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-surface-low rounded-xl mb-4">
                        <div className="col-span-4">Tên câu lệnh</div>
                        <div className="col-span-2 text-center">Loại</div>
                        <div className="col-span-5">Nội dung tóm tắt</div>
                        <div className="col-span-1 text-right">Thao tác</div>
                    </div>

                    {/* Body */}
                    <div className="space-y-3">
                        {(() => {
                            const filtered = prompts.filter(p => {
                                const matchType = filterType === 'all' || p.type === filterType;
                                const projectIds = JSON.parse(p.project_ids || '[]');
                                const platforms = JSON.parse(p.platforms || '[]');
                                
                                let matchProject = true;
                                if (filterProject === 'global') {
                                    matchProject = projectIds.length === 0;
                                } else if (filterProject !== 'all') {
                                    matchProject = projectIds.includes(Number(filterProject));
                                }

                                let matchPlatform = true;
                                if (filterPlatform !== 'all') {
                                    matchPlatform = platforms.includes(filterPlatform);
                                }
                                
                                return matchType && matchProject && matchPlatform;
                            });

                            return filtered.length > 0 ? filtered.map((p, i) => (
                                <div key={i} className="grid grid-cols-12 items-center px-4 py-6 hover:bg-surface-low transition-colors rounded-3xl group">
                                    <div className="col-span-4 flex items-center gap-4">
                                        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center flex-shrink-0">
                                            {getTypeIcon(p.type)}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-foreground truncate">{p.name}</h4>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {JSON.parse(p.platforms || '[]').map((plat: string) => (
                                                    <PlatformIcon key={plat} id={plat} />
                                                ))}
                                                {JSON.parse(p.project_ids || '[]').length > 0 && (
                                                    <div className="flex gap-1 items-center bg-surface-mid px-1.5 py-0.5 rounded text-[8px] font-bold text-muted-foreground">
                                                        <Layers className="w-2.5 h-2.5" />
                                                        {JSON.parse(p.project_ids || '[]').length} Dự án
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex justify-center">
                                        <span className="px-3 py-1 bg-surface-container-low rounded-full text-[10px] font-bold text-muted-foreground uppercase">
                                            {p.type === 'Post' ? 'Viết bài' : 
                                             p.type === 'Comment' ? 'Bình luận' :
                                             p.type === 'Rewrite' ? 'Viết lại' :
                                             p.type === 'Translation' ? 'Dịch thuật' : p.type}
                                        </span>
                                    </div>
                                    <div className="col-span-4 text-xs text-muted-foreground truncate pr-10">
                                        {p.content}
                                    </div>
                                    <div className="col-span-2 flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 text-center text-muted-foreground text-sm italic">
                                    Không tìm thấy mẫu câu lệnh nào phù hợp với bộ lọc.
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </Card>

            {/* Add Prompt Dialog */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setIsAddOpen(false); setEditingId(null); setFormData({ name: '', type: 'Viết bài', content: '', project_ids: [], platforms: [] }); }} />
                    <Card className="relative w-full max-w-4xl max-h-[90vh] flex flex-col border-none shadow-2xl bg-surface-container-lowest rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                        <div className="p-10 overflow-y-auto custom-scrollbar">
                            <div className="space-y-8">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-display font-bold">{editingId ? 'Chỉnh sửa Prompt' : 'Thêm Prompt mới'}</h3>
                                    <p className="text-sm text-muted-foreground">Khai báo cấu trúc câu lệnh và chỉ định đối tượng áp dụng.</p>
                                </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Tên gợi nhớ</label>
                                            <Input 
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                placeholder="VD: Viết bài Facebook - Thời trang" 
                                                className="h-12 bg-surface-container-low border-none rounded-xl font-medium"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Loại công năng</label>
                                            <Select value={formData.type} onValueChange={(v: string) => setFormData({...formData, type: v})}>
                                                <SelectTrigger className="w-full h-12 bg-surface-container-low border-none rounded-xl font-medium">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectLabel>Chọn loại công năng</SelectLabel>
                                                        <SelectItem value="Post">Viết bài mới</SelectItem>
                                                        <SelectItem value="Comment">Viết bình luận CTA</SelectItem>
                                                        <SelectItem value="Rewrite">Viết lại/Tối ưu bài</SelectItem>
                                                        <SelectItem value="Translation">Dịch thuật đa quốc gia</SelectItem>
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Nền tảng áp dụng</label>
                                            <div className="grid grid-cols-5 gap-2">
                                                {PLATFORMS.map(plat => (
                                                    <button
                                                        key={plat.id}
                                                        type="button"
                                                        onClick={() => setFormData({
                                                            ...formData,
                                                            platforms: formData.platforms.includes(plat.id) 
                                                                ? formData.platforms.filter((p: string) => p !== plat.id) 
                                                                : [...formData.platforms, plat.id]
                                                        })}
                                                        className={cn(
                                                            "flex flex-col items-center justify-center gap-2 p-2 rounded-xl transition-all border-2",
                                                            formData.platforms.includes(plat.id)
                                                                ? "bg-primary/5 border-primary text-primary"
                                                                : "bg-surface-container-low border-transparent text-muted-foreground grayscale hover:grayscale-0"
                                                        )}
                                                    >
                                                        <PlatformIcon id={plat.id} />
                                                        <span className="text-[8px] font-bold uppercase">{plat.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Dự án áp dụng (Trống = Tất cả)</label>
                                            <div className="max-h-[160px] overflow-y-auto custom-scrollbar space-y-1.5 p-1">
                                                {projects.map(proj => (
                                                    <button
                                                        key={proj.id}
                                                        type="button"
                                                        onClick={() => setFormData({
                                                            ...formData,
                                                            project_ids: formData.project_ids.includes(proj.id)
                                                                ? formData.project_ids.filter((id: number) => id !== proj.id)
                                                                : [...formData.project_ids, proj.id]
                                                        })}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
                                                            formData.project_ids.includes(proj.id)
                                                                ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                                                                : "bg-surface-container-low text-muted-foreground border-transparent hover:bg-surface-low"
                                                        )}
                                                    >
                                                        {proj.name}
                                                        {formData.project_ids.includes(proj.id) && <Plus className="w-3 h-3 rotate-45" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Nội dung Câu lệnh (System Prompt)</label>
                                        <textarea 
                                            value={formData.content}
                                            onChange={(e) => setFormData({...formData, content: e.target.value})}
                                            rows={18}
                                            placeholder="Hãy đóng vai là một chuyên gia Content Marketing..."
                                            className="w-full p-6 bg-surface-container-low border-none rounded-[2rem] text-sm leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>

                                <div className="flex items-center gap-3 pt-6 border-t border-border/5">
                                    <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => { setIsAddOpen(false); setEditingId(null); setFormData({ name: '', type: 'Viết bài', content: '', project_ids: [], platforms: [] }); }}>Hủy bỏ</Button>
                                    <Button className="flex-1 primary-gradient h-12 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleSave}>{editingId ? 'Cập nhật ngay' : 'Tạo Prompt mới'}</Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            <ConfirmDeleteDialog 
                isOpen={deleteId !== null}
                onClose={() => setDeleteId(null)}
                onConfirm={() => deleteId && handleDelete(deleteId)}
                title="Xóa mẫu câu lệnh?"
                itemName={prompts.find(p => p.id === deleteId)?.name}
                loading={isDeleting}
            />
        </div>
    )
}
