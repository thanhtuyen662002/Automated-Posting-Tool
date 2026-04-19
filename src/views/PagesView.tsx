import React, { useEffect, useState } from 'react'
import {
  Plus,
  Globe,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  MoreHorizontal,
  FolderKanban,
  AlertCircle,
  ShieldCheck,
  Activity,
  ChevronLeft
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'

// Brand Assets
import facebookLogo from '@/assets/facebook.svg'
import tiktokLogo from '@/assets/tiktok.svg'
import youtubeLogo from '@/assets/youtube.svg'
import instagramLogo from '@/assets/instagram.svg'
import zaloLogo from '@/assets/zalo.svg'
import shopeeLogo from '@/assets/shopee.svg'
import { Input } from '@/components/ui/input'

export const PagesView: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([])
  const [pages, setPages] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return localStorage.getItem('pages_selected_project') || 'all'
  })
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [deletePageId, setDeletePageId] = useState<number | null>(null)
  const [isDeletingPage, setIsDeletingPage] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6
  const [formData, setFormData] = useState({
    project_id: '',
    platform: 'Facebook',
    page_name: '',
    page_url: ''
  })

  const fetchData = async () => {
    if (!window.ipcRenderer) return
    try {
      // If silent, we don't clear state (already standard in current version)
      // but we can optimize by fetching in parallel
      const [projs, pgs] = await Promise.all([
        window.ipcRenderer.getProjects(),
        window.ipcRenderer.getPages(selectedProjectId === 'all' ? undefined : Number(selectedProjectId))
      ]);
      
      setProjects(projs || [])
      setPages(pgs || [])
    } catch (e) {
      console.error('PagesView: Error fetching data:', e)
    }
  }

  const fetchPagesOnly = async () => {
    if (!window.ipcRenderer) return
    try {
      const pgs = await window.ipcRenderer.getPages(selectedProjectId === 'all' ? undefined : Number(selectedProjectId))
      setPages(pgs || [])
    } catch (e) {
      console.error('PagesView: Error fetching pages:', e)
    }
  }

  useEffect(() => {
    localStorage.setItem('pages_selected_project', selectedProjectId)
    setCurrentPage(1) // Reset pagination on filter change
    fetchData()
  }, [selectedProjectId, selectedPlatform, selectedStatus])

  // Removed periodic fetchData interval to prevent UI locking and "snapping"

  useEffect(() => {
    if (!window.ipcRenderer) return
    const removeListener = window.ipcRenderer.onBrowserClosed(() => {
      fetchPagesOnly() // Atomic update
      toast.success('Đã cập nhật trạng thái kết nối')
    })
    return () => removeListener()
  }, [selectedProjectId])

  const handleLaunch = async (id: number) => {
    toast.info('Đang mở trình duyệt...')
    const result = await window.ipcRenderer.launchBrowser(id)
    if (!result.success) toast.error('Lỗi: ' + result.error)
    fetchPagesOnly() // Atomic update
  }

  const handleDeletePage = async (id: number) => {
    try {
      setIsDeletingPage(true)
      await window.ipcRenderer.deletePage(id)
      setDeletePageId(null)
      fetchData()
      toast.success('Đã xóa kết nối Page thành công')
    } catch (e: any) {
      toast.error('Lỗi khi xóa: ' + e.message)
    } finally {
      setIsDeletingPage(false)
    }
  }

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true)
    toast.info('Đang quét trạng thái session...')
    try {
      await window.ipcRenderer.checkHealthAll()
      await fetchPagesOnly() // CRITICAL: Only reload the list of pages, not projects/logs
      toast.success('Đã hoàn tất quét trạng thái sức khỏe tài khoản')
    } catch (e: any) {
      toast.error('Lỗi khi quét: ' + e.message)
    } finally {
      setIsCheckingHealth(false)
    }
  }

  const handleAddPage = async () => {
    if (!formData.project_id || !formData.page_name) {
      toast.error('Vui lòng điền đủ thông tin')
      return
    }
    try {
      await window.ipcRenderer.addPage({
        ...formData,
        project_id: Number(formData.project_id)
      })
      setIsAddOpen(false)
      fetchData()
      toast.success('Đã thêm trang mới thành công')
    } catch (e: any) {
      toast.error('Lỗi khi thêm trang: ' + e.message)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'tiktok': return <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center p-2"><img src={tiktokLogo} alt="TikTok" className="w-full h-full object-contain invert" /></div>
      case 'youtube': return <div className="w-10 h-10 bg-[#FF0000]/10 rounded-xl flex items-center justify-center p-2"><img src={youtubeLogo} alt="YouTube" className="w-full h-full object-contain" /></div>
      case 'facebook': return <div className="w-10 h-10 bg-[#1877F2]/10 rounded-xl flex items-center justify-center p-2"><img src={facebookLogo} alt="Facebook" className="w-full h-full object-contain" /></div>
      case 'instagram': return <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400/20 via-red-500/20 to-purple-600/20 rounded-xl flex items-center justify-center p-2"><img src={instagramLogo} alt="Instagram" className="w-full h-full object-contain" /></div>
      case 'zalo': return <div className="w-10 h-10 bg-[#0068FF]/10 rounded-xl flex items-center justify-center p-2"><img src={zaloLogo} alt="Zalo" className="w-full h-full object-contain" /></div>
      case 'shopee': return <div className="w-10 h-10 bg-[#EE4D2D]/10 rounded-xl flex items-center justify-center p-2"><img src={shopeeLogo} alt="Shopee" className="w-full h-full object-contain" /></div>
      default: return <div className="w-10 h-10 bg-surface-container-low rounded-xl flex items-center justify-center"><Globe className="w-6 h-6" /></div>
    }
  }

  const filteredPages = pages.filter(p => {
    const matchPlatform = selectedPlatform === 'all' || p.platform.toLowerCase() === selectedPlatform.toLowerCase();
    const matchStatus = selectedStatus === 'all' || 
      (selectedStatus === 'connected' && p.is_logged_in === 1) || 
      (selectedStatus === 'disconnected' && p.is_logged_in === 0) ||
      (selectedStatus === 'expired' && p.is_logged_in === 2);
    return matchPlatform && matchStatus;
  });

  const totalPages = Math.ceil(filteredPages.length / ITEMS_PER_PAGE);
  const paginatedPages = filteredPages.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const PaginationControl = () => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-center gap-4 mt-8">
            <Button
                variant="ghost"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="w-10 h-10 rounded-xl bg-surface-lowest shadow-sm disabled:opacity-30"
            >
                <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={cn(
                            "w-2.5 h-2.5 rounded-full transition-all duration-300",
                            currentPage === i + 1 ? "bg-primary w-8" : "bg-primary/20 hover:bg-primary/40"
                        )}
                    />
                ))}
            </div>

            <Button
                variant="ghost"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="w-10 h-10 rounded-xl bg-surface-lowest shadow-sm disabled:opacity-30"
            >
                <ChevronRight className="w-5 h-5" />
            </Button>
        </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        <span>Bảng điều khiển</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary">Nền tảng & Phiên hoạt động</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-4xl font-display font-extrabold tracking-tight">Nền tảng & Page</h2>
          <p className="text-muted-foreground text-sm">Quản lý các kết nối tài khoản và phiên đăng nhập hoạt động.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            disabled={isCheckingHealth}
            onClick={handleCheckHealth}
            className="h-12 px-6 rounded-xl border-border/10 bg-surface-lowest hover:bg-surface-low gap-2 text-xs font-bold uppercase tracking-widest shadow-sm"
          >
            {isCheckingHealth ? (
               <Activity className="w-5 h-5 animate-pulse text-amber-500" />
            ) : (
               <ShieldCheck className="w-5 h-5 text-primary" />
            )}
            {isCheckingHealth ? 'Đang quét sức khỏe...' : 'Quét trạng thái tài khoản'}
          </Button>

          <Button onClick={() => setIsAddOpen(true)} className="primary-gradient h-12 px-6 rounded-xl shadow-lg shadow-primary/20 gap-2">
            <Plus className="w-5 h-5 font-bold" />
            <span className="font-bold">Kết nối Page mới</span>
          </Button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-[180px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-xs uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <FilterIcon className="w-4 h-4 text-primary" />
                <SelectValue placeholder="Nền tảng: Tất cả" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Chọn nền tảng</SelectLabel>
                <SelectItem value="all">Tất cả nền tảng</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="zalo">Zalo</SelectItem>
                <SelectItem value="shopee">Shopee</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className={cn(
              "w-[240px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-xs uppercase tracking-widest transition-colors",
              selectedStatus === 'connected' ? "text-emerald-500" : 
              selectedStatus === 'expired' ? "text-red-500" : 
              selectedStatus === 'disconnected' ? "text-slate-400" : "text-slate-500"
            )}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <SelectValue placeholder="Trạng thái: Tất cả" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Trạng thái phiên</SelectLabel>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="connected">Đã kết nối</SelectItem>
                <SelectItem value="disconnected">Chưa đăng nhập</SelectItem>
                <SelectItem value="expired">Cần đăng nhập lại</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[180px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-xs uppercase tracking-widest">
              <div className="flex items-center gap-2 text-blue-500">
                <PackageIcon className="w-4 h-4" />
                <SelectValue placeholder="Tất cả">
                   {selectedProjectId === 'all' ? 'All' : projects.find(p => p.id.toString() === selectedProjectId)?.name}
                </SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Chọn dự án</SelectLabel>
                <SelectItem value="all">Tất cả dự án</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground">
          Hiển thị <span className="font-bold text-foreground">{filteredPages.length}</span> trang đã kết nối
        </div>
      </div>

      {/* Pages Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {paginatedPages.map((p) => (
          <Card key={p.id} className="border-none shadow-none bg-surface-lowest rounded-[2rem] p-6 relative group overflow-hidden">
            {/* Status Badge */}
            <div className="absolute top-6 right-6">
              {p.is_logged_in === 1 ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Đã kết nối
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-[10px] font-bold uppercase tracking-widest text-red-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Ngắt kết nối
                </div>
              )}
            </div>

            <div className="flex flex-col h-full space-y-6">
              {/* Icon & Title */}
              <div className="space-y-4">
                {getPlatformIcon(p.platform)}
                <div>
                  <h3 className="text-xl font-display font-bold leading-none mb-1">{p.page_name}</h3>
                  <p className="text-xs font-medium text-primary/60 truncate">{p.page_url}</p>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-surface-low rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-muted-foreground/10 rounded-lg flex items-center justify-center">
                    <FolderKanban className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60">Dự án liên kết</span>
                    <span className="text-[10px] font-bold">{projects.find(pj => pj.id === p.project_id)?.name || 'Chưa phân loại'}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto pt-2 flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground">Mã: #PG-{p.id}</span>
                <div className="flex items-center gap-1 relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8 rounded-lg text-muted-foreground"
                    onClick={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                  
                  {activeMenuId === p.id && (
                    <div className="absolute bottom-full right-0 mb-2 w-32 bg-surface-lowest border border-border/10 shadow-xl rounded-xl overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <button className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-surface-low transition-colors">Chi tiết</button>
                      <button 
                        className="w-full px-4 py-2 text-left text-[10px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => {
                          setDeletePageId(p.id)
                          setActiveMenuId(null)
                        }}
                      >
                        Xóa Page
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {p.is_logged_in === 0 && (
                <Button onClick={() => handleLaunch(p.id)} className="w-full h-11 bg-foreground text-surface rounded-2xl gap-2 font-bold text-sm shadow-xl shadow-black/10 transition-transform active:scale-95">
                  <ExternalLink className="w-4 h-4" />
                  Mở trình duyệt đăng nhập
                </Button>
              )}
            </div>
          </Card>
        ))}

        {/* Add New Channel Placeholder/Card */}
        <Card 
          onClick={() => setIsAddOpen(true)}
          className="border-2 border-dashed border-border/20 shadow-none bg-surface-container/50 rounded-[2rem] p-6 flex flex-col items-center justify-center text-center space-y-4 hover:bg-surface-container-low transition-colors cursor-pointer group"
        >
          <div className="w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <PlusIcon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Thêm kênh mới</h4>
            <p className="text-xs text-muted-foreground">Thêm một trang khác để<br />mở rộng phạm vi của bạn.</p>
          </div>
        </Card>
      </div>

      <PaginationControl />

      {/* Connection Events Table */}
      <Card className="border-none shadow-none bg-surface-lowest rounded-[2.5rem] p-10 mt-10">
        <div className="flex justify-between items-center mb-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-display font-bold">Trạng thái trình duyệt & Phiên đăng nhập</h3>
            <p className="text-xs text-muted-foreground">Theo dõi và quản lý các kết nối tài khoản theo thời gian thực.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 text-[10px] font-bold">
              {pages.filter(p => p.is_logged_in === 1).length} Sẵn sàng
            </Badge>
            <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50 text-[10px] font-bold">
              {pages.filter(p => p.is_logged_in === 2).length} Cần kiểm tra
            </Badge>
          </div>
        </div>

        <div className="w-full">
          {/* Table Header */}
          <div className="grid grid-cols-12 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/5 bg-surface-low/30 rounded-t-2xl">
            <div className="col-span-3">Nền tảng & Trang</div>
            <div className="col-span-3">Dự án</div>
            <div className="col-span-3">Trạng thái phiên</div>
            <div className="col-span-3 text-right">Thao tác nhanh</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border/5">
            {paginatedPages.length > 0 ? paginatedPages.map((p, i) => (
              <div key={i} className="grid grid-cols-12 items-center px-6 py-6 hover:bg-surface-low/50 transition-colors">
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-low flex items-center justify-center overflow-hidden">
                    {getPlatformIcon(p.platform)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground leading-none">{p.page_name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.platform}</span>
                  </div>
                </div>
                
                <div className="col-span-3">
                  <span className="text-xs font-bold text-foreground/70">
                    {projects.find(pj => pj.id === p.project_id)?.name || 'Chưa phân loại'}
                  </span>
                </div>

                <div className="col-span-3">
                  {p.is_logged_in === 1 ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-bold">Đã đăng nhập</span>
                    </div>
                  ) : p.is_logged_in === 2 ? (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-bold">Cần đăng nhập lại</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-4 h-4 rounded-full border-2 border-dashed border-muted-foreground" />
                      <span className="text-xs font-bold">Chưa đăng nhập</span>
                    </div>
                  )}
                </div>

                <div className="col-span-3 text-right">
                  {p.is_logged_in !== 1 ? (
                    <Button 
                      size="sm" 
                      onClick={() => handleLaunch(p.id)}
                      className="h-8 rounded-lg bg-foreground text-white font-bold text-[10px] px-4"
                    >
                      Kết nối ngay
                    </Button>
                  ) : (
                    <Button 
                      variant="ghost"
                      size="sm" 
                      onClick={() => handleLaunch(p.id)}
                      className="h-8 rounded-lg text-primary font-bold text-[10px] px-4"
                    >
                      Mở trình duyệt
                    </Button>
                  )}
                </div>
              </div>
            )) : (
              <div className="py-20 text-center text-muted-foreground text-sm italic">
                Chưa có Page nào được kết nối.
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Add Page Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
          <Card className="relative w-full max-w-lg border-none shadow-2xl bg-surface-container-lowest rounded-[2.5rem] p-10 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold">Kết nối Page mới</h3>
                <p className="text-sm text-muted-foreground">Nhập thông tin chi tiết của nền tảng bạn muốn kết nối.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Chọn Dự án</label>
                  <Select value={formData.project_id} onValueChange={(v) => setFormData({...formData, project_id: v})}>
                    <SelectTrigger className="w-full h-11 bg-surface-container-low border-none rounded-xl">
                      <SelectValue placeholder="Chọn dự án...">
                        {projects.find(p => p.id.toString() === formData.project_id)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Dự án</SelectLabel>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Nền tảng</label>
                  <Select value={formData.platform} onValueChange={(v) => setFormData({...formData, platform: v})}>
                    <SelectTrigger className="w-full h-11 bg-surface-container-low border-none rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Chọn nền tảng</SelectLabel>
                        <SelectItem value="Facebook">Facebook</SelectItem>
                        <SelectItem value="TikTok">TikTok</SelectItem>
                        <SelectItem value="YouTube">YouTube</SelectItem>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="Zalo">Zalo</SelectItem>
                        <SelectItem value="Shopee">Shopee</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Tên Page</label>
                  <Input 
                    value={formData.page_name}
                    onChange={(e) => setFormData({...formData, page_name: e.target.value})}
                    placeholder="VD: UrbanVibe Official" 
                    className="h-11 bg-surface-container-low border-none rounded-xl" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">URL (Tùy chọn)</label>
                  <Input 
                    value={formData.page_url}
                    onChange={(e) => setFormData({...formData, page_url: e.target.value})}
                    placeholder="VD: facebook.com/vibe" 
                    className="h-11 bg-surface-container-low border-none rounded-xl" 
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setIsAddOpen(false)}>Hủy</Button>
                <Button className="flex-1 primary-gradient h-12 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleAddPage}>Lưu kết nối</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {/* Custom Delete Confirmation Modal */}
      <ConfirmDeleteDialog 
        isOpen={deletePageId !== null}
        onClose={() => setDeletePageId(null)}
        onConfirm={() => deletePageId && handleDeletePage(deletePageId)}
        title="Xóa kết nối Page?"
        description="Hành động này sẽ ngắt hoàn toàn kết nối với Page này. Bạn sẽ cần đăng nhập lại nếu muốn dùng lại."
        itemName={pages.find(p => p.id === deletePageId)?.page_name}
        loading={isDeletingPage}
      />
    </div>
  )
}

// Internal icons helper
const FilterIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="21" y1="4" x2="3" y2="4" /><line x1="18" y1="8" x2="6" y2="8" /><line x1="15" y1="12" x2="9" y2="12" /><line x1="12" y1="16" x2="12" y2="16" />
  </svg>
)
  const PackageIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
  </svg>
)
const PlusIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" /><path d="M12 5v14" />
  </svg>
)
