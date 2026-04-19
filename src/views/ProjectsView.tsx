import React, { useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  FolderKanban,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  Globe,
  Pencil,
  Facebook,
  Play,
  Instagram,
  Zap,
  MessageCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'

export const ProjectsView: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([])
  const [stats, setStats] = useState({ projects: 0, pages: 0, pendingPosts: 0 })
  const [newProjectName, setNewProjectName] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const PLATFORMS = [
    { id: 'Facebook', label: 'Facebook', color: 'bg-[#1877F2]', icon: Facebook },
    { id: 'TikTok', label: 'TikTok', color: 'bg-black', icon: Zap }, // Using Zap for TikTok flavor or custom
    { id: 'Insta', label: 'Instagram', color: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]', icon: Instagram },
    { id: 'Youtube', label: 'YouTube', color: 'bg-[#FF0000]', icon: Play },
    { id: 'Zalo', label: 'Zalo', color: 'bg-[#0068FF]', icon: MessageCircle }
  ]

  const PlatformIcon = ({ id, className }: { id: string, className?: string }) => {
    switch (id) {
        case 'Facebook':
            return (
                <div className={cn("w-5 h-5 bg-[#1877F2] rounded-full flex items-center justify-center text-white", className)}>
                    <Facebook className="w-3 h-3 fill-current" />
                </div>
            )
        case 'TikTok':
            return (
                <div className={cn("w-5 h-5 bg-black rounded-full flex items-center justify-center", className)}>
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18.77a6.738 6.738 0 01-6.74 6.74c-1.4-.04-2.79-.45-3.99-1.18a6.704 6.704 0 01-2.4-2.35 6.748 6.748 0 01-.35-6.19c.33-1 1-1.9 1.85-2.57.8-.63 1.77-1.04 2.77-1.18v4.02c-.52.07-1.03.24-1.48.52-.4.25-.74.59-.98 1-.22.38-.34.81-.34 1.25.01 1.48 1.22 2.69 2.69 2.7 1.48.01 2.69-1.21 2.7-2.69V.02z"/>
                    </svg>
                </div>
            )
        case 'Insta':
            return (
                <div className={cn("w-5 h-5 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] rounded-md flex items-center justify-center text-white", className)}>
                    <Instagram className="w-3 h-3" />
                </div>
            )
        case 'Youtube':
            return (
                <div className={cn("w-5 h-5 bg-[#FF0000] rounded-md flex items-center justify-center text-white", className)}>
                    <Play className="w-3 h-3 fill-current" />
                </div>
            )
        case 'Zalo':
            return (
                <div className={cn("w-5 h-5 bg-[#0068FF] rounded-md flex items-center justify-center text-white font-black text-[8px]", className)}>
                    Z
                </div>
            )
        default:
            return <Globe className={cn("w-5 h-5 text-muted-foreground", className)} />
    }
  }

  const fetchData = async () => {
    if (!window.ipcRenderer) return
    try {
      const data = await window.ipcRenderer.getProjects()
      setProjects(data || [])
      const sData = await window.ipcRenderer.getStats()
      if (sData) setStats(sData)
    } catch (e) {
      console.error('ProjectsView: Error fetching data:', e)
      toast.error('Không thể tải danh sách dự án')
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddProject = async () => {
    if (!window.ipcRenderer) {
      toast.error('Lỗi hệ thống: IPC chưa sẵn sàng. Vui lòng thử lại sau.')
      return
    }
    if (!newProjectName.trim()) {
      toast.error('Vui lòng nhập tên dự án')
      return
    }
    try {
      if (editingId) {
        await window.ipcRenderer.updateProject(editingId, newProjectName.trim(), selectedPlatforms)
        toast.success('Đã cập nhật dự án')
      } else {
        await window.ipcRenderer.addProject(newProjectName.trim(), selectedPlatforms)
        toast.success('Đã thêm dự án mới')
      }
      setNewProjectName('')
      setSelectedPlatforms([])
      setEditingId(null)
      setIsAddOpen(false)
      fetchData()
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message)
    }
  }

  const openEdit = (p: any) => {
    setEditingId(p.id)
    setNewProjectName(p.name)
    try {
        setSelectedPlatforms(JSON.parse(p.platforms || '[]'))
    } catch (e) {
        setSelectedPlatforms([])
    }
    setIsAddOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.ipcRenderer) {
      toast.error('Lỗi hệ thống: IPC chưa sẵn sàng.')
      return
    }
    try {
      setIsDeleting(true)
      await window.ipcRenderer.deleteProject(id)
      setDeleteConfirmId(null)
      fetchData()
      toast.success('Đã xóa dự án thành công')
    } catch (e: any) {
      toast.error('Lỗi khi xóa: ' + e.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        <span>Quản trị</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary font-extrabold">Dự án & Chiến dịch</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-4xl font-display font-extrabold tracking-tight">Dự án</h2>
          <p className="text-muted-foreground text-sm">Quản lý và theo dõi các tài sản mạng xã hội tự động của bạn.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="primary-gradient h-12 px-6 rounded-xl shadow-lg shadow-primary/20 gap-2">
          <Plus className="w-5 h-5" />
          <span className="font-bold">Thêm Dự án</span>
        </Button>
      </div>

      {/* Metric Cards row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <Card className="border-none shadow-none bg-surface-container-lowest rounded-2xl p-8">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dự án hoạt động</span>
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <FolderKanban className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-5xl font-display font-extrabold tracking-tighter">{stats.projects}</span>
            <span className="text-[10px] font-bold text-muted-foreground">Chiến dịch hiện có</span>
          </div>
        </Card>

        <Card className="border-none shadow-none bg-surface-container-lowest rounded-2xl p-8">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Page đã liên kết</span>
            <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-5xl font-display font-extrabold tracking-tighter">{stats.pages}</span>
            <div className="flex -space-x-2 overflow-hidden">
              {[1, 2, 3].map(n => (
                <div key={n} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-surface-mid" />
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Inventory Table Area */}
      <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] overflow-hidden p-8">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-display font-bold">Danh sách hoạt động</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground"><Filter className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground"><MoreVertical className="w-5 h-5" /></Button>
          </div>
        </div>

        <div className="w-full">
          {/* Table Header */}
          <div className="grid grid-cols-12 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-surface-low rounded-xl mb-4">
            <div className="col-span-5">Tên dự án</div>
            <div className="col-span-2 text-center">Số Page</div>
            <div className="col-span-2 text-center">Tổng bài đăng</div>
            <div className="col-span-2">Ngày tạo</div>
            <div className="col-span-1 text-right">Thao tác</div>
          </div>

          {/* Table Body */}
          <div className="space-y-3">
            {projects.map((p, i) => (
              <div key={i} className="grid grid-cols-12 items-center px-4 py-6 hover:bg-surface-low transition-colors rounded-3xl group">
                <div className="col-span-5 flex items-center gap-4">
                  <div className={cn("w-12 h-12 bg-surface-low rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", p.color)}>
                    {p.icon ? <p.icon className="w-6 h-6" /> : <FolderKanban className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight text-foreground">{p.name}</h4>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {p.platforms && JSON.parse(p.platforms).length > 0 ? JSON.parse(p.platforms).map((plat: string) => (
                            <PlatformIcon key={plat} id={plat} className="opacity-100" />
                        )) : (
                            <span className="text-[9px] text-muted-foreground italic">Chưa gắn nền tảng</span>
                        )}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold",
                    p.pages_count > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {p.pages_count} Trang
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="font-display font-bold text-sm">{p.posts_count?.toLocaleString() || 0}</span>
                </div>
                <div className="col-span-2 text-xs font-medium text-muted-foreground">
                  {p.date || p.created_at || '01/01/2024'}
                </div>
                <div className="col-span-1 flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(p)}>
                    <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteConfirmId(p.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination/Footer */}
          <div className="mt-8 pt-8 border-t border-border/10 flex items-center justify-between text-xs text-muted-foreground">
            <span>Hiển thị {projects.length} dự án</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="w-8 h-8 rounded-lg border-muted/20"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="w-8 h-8 rounded-lg border-muted/20"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Add Project Dialog */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setIsAddOpen(false); setEditingId(null); setNewProjectName(''); setSelectedPlatforms([]); }} />
          <Card className="relative w-full max-w-md border-none shadow-2xl bg-surface-container-lowest rounded-[2.5rem] p-10 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-display font-bold">{editingId ? 'Chỉnh sửa dự án' : 'Tạo dự án mới'}</h3>
                <p className="text-sm text-muted-foreground">{editingId ? 'Cập nhật lại thông tin chiến dịch của bạn.' : 'Nhập tên để bắt đầu quản lý các kênh xã hội của bạn.'}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Tên dự án</label>
                    <Input 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="VD: Chiến dịch Mùa Xuân 2024" 
                    className="h-12 bg-surface-container-low border-none rounded-xl"
                    autoFocus
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Nền tảng mục tiêu</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORMS.map(plat => (
                        <button
                            key={plat.id}
                            type="button"
                            onClick={() => setSelectedPlatforms(prev => 
                                prev.includes(plat.id) ? prev.filter(p => p !== plat.id) : [...prev, plat.id]
                            )}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border-2",
                                selectedPlatforms.includes(plat.id) 
                                    ? "bg-primary/5 border-primary text-primary" 
                                    : "bg-surface-container-low border-transparent text-muted-foreground hover:bg-surface-low"
                            )}
                        >
                            <div className={cn("w-2 h-2 rounded-full", plat.color)} />
                            {plat.label}
                        </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => { setIsAddOpen(false); setEditingId(null); setNewProjectName(''); setSelectedPlatforms([]); }}>Hủy</Button>
                <Button className="flex-1 primary-gradient h-12 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleAddProject}>{editingId ? 'Cập nhật' : 'Tạo ngay'}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {/* Custom Delete Confirmation Modal */}
      <ConfirmDeleteDialog 
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="Xác nhận xóa dự án?"
        itemName={projects.find(p => p.id === deleteConfirmId)?.name}
        loading={isDeleting}
      />
    </div>
  )
}
