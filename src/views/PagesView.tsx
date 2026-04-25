import React, { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Globe,
  ExternalLink,
  ChevronRight,
  MoreHorizontal,
  FolderKanban,
  AlertCircle,
  ShieldCheck,
  Activity,
  RefreshCw,
  UserCircle
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
  const [accounts, setAccounts] = useState<any[]>([])
  const [pages, setPages] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return localStorage.getItem('pages_selected_project') || 'all'
  })
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [editingPageId, setEditingPageId] = useState<number | null>(null)
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null)
  const [deletePageId, setDeletePageId] = useState<number | null>(null)
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    project_id: '',
    account_id: '',
    platform: 'Facebook',
    page_name: '',
    page_url: ''
  })

  const [accountFormData, setAccountFormData] = useState({
    project_id: '',
    platform: 'Facebook',
    account_name: '',
    proxy: '',
    proxy_type: 'none'
  })

  const fetchData = useCallback(async () => {
    if (!window.ipcRenderer) return
    try {
      const [projs, accs, pgs] = await Promise.all([
        window.ipcRenderer.getProjects(),
        window.ipcRenderer.getAccounts(selectedProjectId === 'all' ? undefined : Number(selectedProjectId)),
        window.ipcRenderer.getPages(selectedProjectId === 'all' ? undefined : Number(selectedProjectId))
      ]);
      
      setProjects(projs || [])
      setAccounts(accs || [])
      setPages(pgs || [])
    } catch (e) {
      console.error('PagesView: Error fetching data:', e)
    }
  }, [selectedProjectId, selectedPlatform])

  const fetchPagesOnly = useCallback(async () => {
    if (!window.ipcRenderer) return
    try {
      const [accs, pgs] = await Promise.all([
        window.ipcRenderer.getAccounts(selectedProjectId === 'all' ? undefined : Number(selectedProjectId)),
        window.ipcRenderer.getPages(selectedProjectId === 'all' ? undefined : Number(selectedProjectId))
      ]);
      setAccounts(accs || [])
      setPages(pgs || [])
    } catch (e) {
      console.error('PagesView: Error fetching pages:', e)
    }
  }, [selectedProjectId])

  useEffect(() => {
    localStorage.setItem('pages_selected_project', selectedProjectId)
    fetchData()
  }, [fetchData, selectedProjectId, selectedPlatform])

  useEffect(() => {
    if (!window.ipcRenderer) return
    const removeListener = window.ipcRenderer.onBrowserClosed(() => {
      fetchPagesOnly()
      toast.success('Đã cập nhật trạng thái kết nối')
    })
    return () => removeListener()
  }, [fetchPagesOnly])

  const handleSyncPage = async (pageId: number) => {
    try {
      setIsLoading(true)
      toast.info('Đang bắt đầu đồng bộ thông tin trang...')
      await window.ipcRenderer.syncPageInfo(pageId)
      toast.success('Đã đồng bộ thông tin Page thành công')
      fetchData()
    } catch (e: any) {
      toast.error('Lỗi đồng bộ: ' + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddPage = async () => {
    if (!formData.project_id || !formData.account_id || !formData.page_name) {
      toast.error('Vui lòng điền đủ thông tin Account và Tên Page')
      return
    }
    try {
      if (editingPageId) {
        await window.ipcRenderer.updatePage(editingPageId, {
          ...formData,
          project_id: Number(formData.project_id),
          account_id: Number(formData.account_id)
        })
        toast.success('Đã cập nhật thông tin Page thành công')
      } else {
        await window.ipcRenderer.addPage({
          ...formData,
          project_id: Number(formData.project_id),
          account_id: Number(formData.account_id)
        })
        toast.success('Đã thêm trang mới thành công')
      }
      setIsAddOpen(false)
      setEditingPageId(null)
      fetchData()
    } catch (e: any) {
      toast.error('Lỗi khi lưu trang: ' + e.message)
    }
  }

  const handleSaveAccount = async () => {
    if (!accountFormData.project_id || !accountFormData.account_name) {
      toast.error('Vui lòng điền đủ thông tin dự án và tên tài khoản')
      return
    }
    try {
      if (editingAccountId) {
        await window.ipcRenderer.updateAccount(editingAccountId, {
          ...accountFormData,
          project_id: Number(accountFormData.project_id)
        })
        toast.success('Cập nhật tài khoản thành công')
      } else {
        await window.ipcRenderer.addAccount({
          ...accountFormData,
          project_id: Number(accountFormData.project_id)
        })
        toast.success('Thêm tài khoản mới thành công')
      }
      setIsAccountModalOpen(false)
      setEditingAccountId(null)
      fetchData()
    } catch (e: any) {
      toast.error('Lỗi khi lưu tài khoản: ' + e.message)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return
    try {
      setIsLoading(true)
      await window.ipcRenderer.deleteAccount(deleteAccountId)
      toast.success('Đã xóa tài khoản')
      setDeleteAccountId(null)
      fetchData()
    } catch (e: any) {
      toast.error('Lỗi khi xóa tài khoản: ' + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePage = async () => {
    if (!deletePageId) return
    try {
      setIsLoading(true)
      await window.ipcRenderer.deletePage(deletePageId)
      toast.success('Đã xóa Page')
      setDeletePageId(null)
      fetchData()
    } catch (e: any) {
      toast.error('Lỗi khi xóa Page: ' + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAccounts = accounts.filter(acc => {
    const matchesProject = selectedProjectId === 'all' || 
                          acc.project_id === Number(selectedProjectId) || 
                          acc.project_id === null; // Global accounts show everywhere
    const matchesPlatform = selectedPlatform === 'all' || acc.platform.toLowerCase() === selectedPlatform.toLowerCase()
    return matchesProject && matchesPlatform
  })

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        <span>Bảng điều khiển</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary">Tài khoản & Nền tảng</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-4xl font-display font-extrabold tracking-tight">Tài khoản & Page</h2>
          <p className="text-muted-foreground text-sm">Quản lý các tài khoản (Profiles) và danh sách Page thuộc quyền sở hữu.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => {
              setEditingAccountId(null)
              setAccountFormData({
                project_id: selectedProjectId === 'all' ? '' : selectedProjectId,
                platform: 'Facebook',
                account_name: '',
                proxy: '',
                proxy_type: 'none'
              })
              setIsAccountModalOpen(true)
            }}
            className="h-12 px-6 rounded-xl border-border/10 bg-surface-lowest hover:bg-surface-low gap-2 text-xs font-bold uppercase tracking-widest shadow-sm"
          >
             <Plus className="w-5 h-5 text-primary" />
             Thêm Tài khoản (Profile)
          </Button>

          <Button 
            onClick={() => {
              setEditingPageId(null)
              setFormData({
                project_id: selectedProjectId === 'all' ? '' : selectedProjectId,
                account_id: '',
                platform: 'Facebook',
                page_name: '',
                page_url: ''
              })
              setIsAddOpen(true)
            }} 
            className="primary-gradient h-12 px-6 rounded-xl shadow-lg shadow-primary/20 gap-2"
          >
            <Plus className="w-5 h-5 font-bold" />
            <span className="font-bold">Kết nối Page mới</span>
          </Button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedPlatform} onValueChange={(v) => v && setSelectedPlatform(v)}>
            <SelectTrigger className="w-[180px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-xs uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
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
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={selectedProjectId} onValueChange={(v) => v && setSelectedProjectId(v)}>
            <SelectTrigger className="w-[180px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-xs uppercase tracking-widest text-blue-500">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                <SelectValue placeholder="Tất cả">
                   {selectedProjectId === 'all' ? 'Dự án: Tất cả' : projects.find(p => p.id.toString() === selectedProjectId)?.name}
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

        <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest bg-surface-low px-4 py-2 rounded-full">
          Hệ thống có <span className="text-primary">{accounts.length}</span> Tài khoản & <span className="text-primary">{pages.length}</span> Page
        </div>
      </div>

      {/* Accounts & Pages Hierarchical Grid */}
      <div className="grid gap-6">
        {filteredAccounts.map((acc) => (
          <AccountRow 
            key={acc.id} 
            account={acc} 
            pages={pages.filter(p => p.account_id === acc.id)} 
            projects={projects}
            onEditAccount={() => {
              setAccountFormData({
                project_id: acc.project_id?.toString() || '',
                platform: acc.platform,
                account_name: acc.account_name,
                proxy: acc.proxy || '',
                proxy_type: acc.proxy_type || 'none'
              })
              setEditingAccountId(acc.id)
              setIsAccountModalOpen(true)
            }}
            onDeleteAccount={() => setDeleteAccountId(acc.id)}
            onAddPageToAccount={() => {
              setFormData({
                project_id: acc.project_id ? acc.project_id.toString() : (selectedProjectId === 'all' ? '' : selectedProjectId),
                account_id: acc.id.toString(),
                platform: acc.platform,
                page_name: '',
                page_url: ''
              })
              setEditingPageId(null)
              setIsAddOpen(true)
            }}
            onEditPage={(page) => {
              setEditingPageId(page.id)
              setFormData({
                project_id: page.project_id.toString(),
                account_id: page.account_id ? page.account_id.toString() : '',
                platform: page.platform,
                page_name: page.page_name,
                page_url: page.page_url || ''
              })
              setIsAddOpen(true)
            }}
            onDeletePage={(id) => setDeletePageId(id)}
            onSyncPage={handleSyncPage}
            onLaunch={() => window.ipcRenderer.launchBrowser(acc.id)}
          />
        ))}

        {filteredAccounts.length === 0 && (
          <div className="p-20 border-2 border-dashed border-border/10 rounded-[3rem] flex flex-col items-center justify-center text-center space-y-4">
             <div className="w-16 h-16 bg-surface-low rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
             </div>
             <div className="space-y-1">
                <h3 className="text-xl font-bold">Chưa có tài khoản nào</h3>
                <p className="text-muted-foreground text-sm">Hãy thêm tài khoản (Account) đầu tiên để bắt đầu quản lý các Page.</p>
             </div>
             <Button onClick={() => setIsAccountModalOpen(true)} className="primary-gradient px-8 h-12 rounded-xl font-bold">Thêm ngay</Button>
          </div>
        )}
      </div>

      {/* Account Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAccountModalOpen(false)} />
          <Card className="relative w-full max-w-lg border-none shadow-2xl bg-surface-container-lowest rounded-[2.5rem] p-10 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold">
                  {editingAccountId ? 'Chỉnh sửa Tài khoản' : 'Thêm Tài khoản (Profile)'}
                </h3>
                <p className="text-sm text-muted-foreground">
                   {editingAccountId ? 'Cập nhật lại thông tin đăng nhập và proxy.' : 'Thiết lập trình duyệt và proxy riêng cho tài khoản này.'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Chọn Dự án</label>
                  <Select 
                    value={accountFormData.project_id} 
                    onValueChange={(val) => val && setAccountFormData({...accountFormData, project_id: val})}
                  >
                    <SelectTrigger className="h-11 bg-surface-container-low border-none rounded-xl">
                      <SelectValue placeholder="Chọn dự án liên kết">
                        {projects.find(p => p.id.toString() === accountFormData.project_id)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-xl">
                      <SelectGroup>
                        <SelectLabel>Dự án của bạn</SelectLabel>
                        <SelectItem value="0" className="font-bold text-primary italic">Dùng chung (Tất cả dự án)</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Nền tảng</label>
                    <Select 
                      value={accountFormData.platform} 
                      onValueChange={(val) => val && setAccountFormData({...accountFormData, platform: val})}
                    >
                      <SelectTrigger className="h-11 bg-surface-container-low border-none rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Facebook">Facebook</SelectItem>
                        <SelectItem value="TikTok">TikTok</SelectItem>
                        <SelectItem value="YouTube">YouTube</SelectItem>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Tên gợi nhớ</label>
                    <Input 
                      value={accountFormData.account_name}
                      onChange={(e) => setAccountFormData({...accountFormData, account_name: e.target.value})}
                      placeholder="VD: Via FB 01" 
                      className="h-11 bg-surface-container-low border-none rounded-xl" 
                    />
                  </div>
                </div>

                {/* Safe IP UI */}
                <div className="space-y-4 pt-4 border-t border-border/10">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5" />
                       Chế độ IP An Toàn (Khuyên dùng)
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {['none', 'tmproxy', 'tinproxy', 'static'].map((type) => (
                      <button 
                        key={type}
                        type="button"
                        onClick={() => setAccountFormData({...accountFormData, proxy_type: type})}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5",
                          accountFormData.proxy_type === type ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-surface-container-low text-muted-foreground"
                        )}
                      >
                        {type === 'none' && <Globe className="w-5 h-5" />}
                        {type === 'tmproxy' && <Activity className="w-5 h-5 text-emerald-500" />}
                        {type === 'tinproxy' && <ShieldCheck className="w-5 h-5 text-blue-500" />}
                        {type === 'static' && <MoreHorizontal className="w-5 h-5" />}
                        <span className="text-[10px] font-bold uppercase">
                          {type === 'none' ? 'IP Máy' : type === 'tmproxy' ? 'TMProxy' : type === 'tinproxy' ? 'TinProxy' : 'IP Tĩnh'}
                        </span>
                      </button>
                    ))}
                  </div>

                  {accountFormData.proxy_type !== 'none' && (
                    <div className="space-y-2">
                      <Input 
                        value={accountFormData.proxy}
                        onChange={(e) => setAccountFormData({...accountFormData, proxy: e.target.value})}
                        placeholder={accountFormData.proxy_type === 'static' ? "IP:PORT:USER:PASS" : "Dán API Key vào đây..."} 
                        className="h-11 bg-surface-container-low border-none rounded-xl" 
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" className="flex-1 h-12 rounded-xl border border-border/10" onClick={() => setIsAccountModalOpen(false)}>Hủy</Button>
                <Button className="flex-1 h-12 primary-gradient rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleSaveAccount}>
                   {editingAccountId ? 'Cập nhật' : 'Thêm tài khoản'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Page Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
          <Card className="relative w-full max-w-lg border-none shadow-2xl bg-surface-container-lowest rounded-[2.5rem] p-10 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold">
                  {editingPageId ? 'Chỉnh sửa Page' : 'Kết nối Page mới'}
                </h3>
                <p className="text-sm text-muted-foreground">
                   {editingPageId ? 'Cập nhật lại thông tin Page.' : 'Gán Page vào một tài khoản chủ quản.'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Thuộc Dự án</label>
                    <Select 
                      value={formData.project_id} 
                      onValueChange={(val) => val && setFormData({...formData, project_id: val})}
                    >
                      <SelectTrigger className="h-11 bg-surface-container-low border-none rounded-xl">
                        <SelectValue placeholder="Chọn dự án">
                          {projects.find(p => p.id.toString() === formData.project_id)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Chọn Tài khoản chủ quản</label>
                    <Select 
                      value={formData.account_id} 
                      onValueChange={(val) => {
                        if (!val) return
                        const acc = accounts.find(a => a.id.toString() === val)
                        setFormData({...formData, account_id: val, platform: acc?.platform || 'Facebook'})
                      }}
                    >
                      <SelectTrigger className="h-11 bg-surface-container-low border-none rounded-xl">
                        <SelectValue placeholder="Chọn profile">
                          {accounts.find(a => a.id.toString() === formData.account_id)?.account_name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id.toString()}>
                            {acc.account_name} ({acc.platform})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Tên Page hiển thị</label>
                  <Input 
                    value={formData.page_name}
                    onChange={(e) => setFormData({...formData, page_name: e.target.value})}
                    placeholder="VD: Page Tin Tức 24h" 
                    className="h-11 bg-surface-container-low border-none rounded-xl" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">URL của Page (Tùy chọn)</label>
                  <Input 
                    value={formData.page_url}
                    onChange={(e) => setFormData({...formData, page_url: e.target.value})}
                    placeholder="https://facebook.com/..." 
                    className="h-11 bg-surface-container-low border-none rounded-xl" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" className="flex-1 h-12 rounded-xl border border-border/10" onClick={() => setIsAddOpen(false)}>Hủy</Button>
                <Button className="flex-1 h-12 primary-gradient rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleAddPage}>
                   {editingPageId ? 'Lưu thay đổi' : 'Kết nối Page'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Account Confirm */}
      <ConfirmDeleteDialog 
        isOpen={!!deleteAccountId}
        onClose={() => setDeleteAccountId(null)}
        onConfirm={handleDeleteAccount}
        title="Xóa tài khoản chủ quản?"
        description="Toàn bộ thông tin profile và proxy của tài khoản này sẽ bị xóa. Các Page thuộc tài khoản này sẽ không thể tự động đăng bài được nữa."
        loading={isLoading}
      />

      {/* Delete Page Confirm */}
      <ConfirmDeleteDialog 
        isOpen={!!deletePageId}
        onClose={() => setDeletePageId(null)}
        onConfirm={handleDeletePage}
        title="Xóa kết nối Page?"
        description="Hệ thống sẽ xóa thông tin của Page này khỏi danh sách quản lý."
        loading={isLoading}
      />
    </div>
  )
}

const AccountRow: React.FC<{ 
  account: any, 
  pages: any[], 
  projects: any[],
  onEditAccount: () => void,
  onDeleteAccount: () => void,
  onAddPageToAccount: () => void,
  onEditPage: (page: any) => void,
  onDeletePage: (id: number) => void,
  onSyncPage: (id: number) => void,
  onLaunch: () => void
}> = ({ account, pages, projects, onEditAccount, onDeleteAccount, onAddPageToAccount, onEditPage, onDeletePage, onSyncPage, onLaunch }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  return (
    <div className="bg-surface-lowest rounded-[2.5rem] p-6 shadow-sm border border-border/5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-surface-low rounded-2xl flex items-center justify-center p-3 relative">
             <img src={getPlatformLogo(account.platform)} className="w-full h-full object-contain" />
             {account.is_logged_in === 1 && (
               <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
             )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-display font-bold">{account.account_name}</h3>
              <Badge variant="outline" className="text-[9px] h-4 font-bold uppercase tracking-tighter opacity-70">
                {account.platform}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-medium">
              <span className="flex items-center gap-1">
                <FolderKanban className="w-3 h-3" />
                Dự án: {account.project_id ? (projects.find(pj => pj.id === account.project_id)?.name || 'N/A') : <span className="text-primary font-bold italic">Dùng chung</span>}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                IP: {account.proxy_type === 'none' ? 'Mặc định' : account.proxy_type.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onLaunch} className="h-9 px-4 rounded-xl text-xs font-bold gap-2">
             <ExternalLink className="w-4 h-4" /> Mở Chrome
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setActiveMenuId(activeMenuId === 'acc' ? null : 'acc')} className="w-9 h-9 rounded-xl">
               <MoreHorizontal className="w-4 h-4" />
            </Button>
            {activeMenuId === 'acc' && (
              <div className="absolute right-0 top-full mt-2 w-32 bg-white border border-border/10 shadow-xl rounded-xl overflow-hidden z-20">
                 <button onClick={onEditAccount} className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-surface-low">Sửa Profile</button>
                 <button onClick={onDeleteAccount} className="w-full px-4 py-2 text-left text-[10px] font-bold text-red-500 hover:bg-red-50">Xóa Profile</button>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="w-9 h-9 rounded-xl">
             <ChevronRight className={cn("w-5 h-5 transition-transform", isExpanded && "rotate-90")} />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="pt-4 border-t border-border/5">
          <div className="flex items-center justify-between mb-4 px-2">
             <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">Danh sách Page ({pages.length})</h4>
             <Button variant="ghost" size="sm" onClick={onAddPageToAccount} className="h-7 px-3 text-[10px] font-bold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 gap-1.5">
                <Plus className="w-3 h-3" /> Thêm Page
             </Button>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map(page => (
              <div key={page.id} className="group relative bg-surface-low/50 hover:bg-surface-low border border-border/5 rounded-2xl p-4 transition-all">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-surface-container overflow-hidden border border-border/10 flex-shrink-0">
                      {page.avatar_url ? (
                        <img src={page.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-full h-full text-muted-foreground/30 p-1" />
                      )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="text-sm font-bold truncate">{page.page_name}</span>
                        {page.handle && (
                          <span className="text-[9px] font-black text-primary/70 bg-primary/5 px-1 rounded uppercase tracking-tighter">
                            {page.handle}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {page.page_url || 'N/A'}
                      </div>
                   </div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => onSyncPage(page.id)} className="w-7 h-7 rounded-lg bg-white shadow-sm text-amber-500 hover:text-amber-600"><RefreshCw className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onEditPage(page)} className="w-7 h-7 rounded-lg bg-white shadow-sm text-muted-foreground"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDeletePage(page.id)} className="w-7 h-7 rounded-lg bg-white shadow-sm text-red-500 hover:text-red-600 transition-transform active:scale-90"><Plus className="w-4 h-4 rotate-45" /></Button>
                   </div>
                </div>
              </div>
            ))}
            {pages.length === 0 && (
              <div className="col-span-full py-6 text-center text-[10px] font-medium text-muted-foreground/40 italic">
                Cần thêm Page vào tài khoản này để bắt đầu lên lịch bài đăng.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const getPlatformLogo = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'facebook': return facebookLogo
    case 'tiktok': return tiktokLogo
    case 'youtube': return youtubeLogo
    case 'instagram': return instagramLogo
    case 'zalo': return zaloLogo
    case 'shopee': return shopeeLogo
    default: return ''
  }
}

