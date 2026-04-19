import React, { useEffect, useState } from 'react'
import { 
    Tag, 
    Plus, 
    Search, 
    Trash2, 
    ChevronRight, 
    Image as ImageIcon,
    ShoppingBag,
    Globe,
    MessageCircle,
    Link2
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'

export const ProductsView: React.FC = () => {
    const [products, setProducts] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [formData, setFormData] = useState({
        project_id: '',
        name: '',
        shopee_link: '',
        web_link: '',
        zalo_link: '',
        image_path: ''
    })
    const [searchQuery, setSearchQuery] = useState('')
    const [filterProjectId, setFilterProjectId] = useState('all')

    const fetchData = async () => {
        if (!window.ipcRenderer) return
        try {
            const projs = await window.ipcRenderer.getProjects()
            setProjects(projs || [])
            const prods = await window.ipcRenderer.getProducts()
            setProducts(prods || [])
        } catch (e) {
            console.error('Failed to fetch data:', e)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSelectImage = async () => {
        if (!window.ipcRenderer) return
        const path = await window.ipcRenderer.openImage()
        if (path) {
            setFormData({ ...formData, image_path: path })
            toast.success('Đã chọn hình ảnh sản phẩm')
        }
    }

    const handleAdd = async () => {
        if (!formData.project_id || !formData.name) {
            toast.error('Vui lòng chọn dự án và nhập tên sản phẩm')
            return
        }
        try {
            await window.ipcRenderer.addProduct({
                ...formData,
                project_id: Number(formData.project_id)
            })
            setIsAddOpen(false)
            setFormData({ project_id: '', name: '', shopee_link: '', web_link: '', zalo_link: '', image_path: '' })
            fetchData()
            toast.success('Đã thêm sản phẩm mới thành công')
        } catch (e: any) {
            toast.error('Lỗi khi thêm: ' + e.message)
        }
    }

    const handleDelete = async (id: number) => {
        try {
            setIsDeleting(true)
            await window.ipcRenderer.deleteProduct(id)
            setDeleteId(null)
            fetchData()
            toast.success('Đã xóa sản phẩm')
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
                <span>Kho tài nguyên</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-extrabold">Sản phẩm Affiliate</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <h2 className="text-4xl font-display font-extrabold tracking-tight">Kho Sản phẩm</h2>
                    <p className="text-muted-foreground text-sm">Quản lý danh mục hàng hóa và các liên kết tiếp thị liên kết của bạn.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="primary-gradient h-12 px-6 rounded-xl shadow-lg shadow-primary/20 gap-2">
                    <Plus className="w-5 h-5 font-bold" />
                    <span className="font-bold">Thêm Sản phẩm</span>
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Tìm tên sản phẩm..." 
                        className="pl-10 h-11 bg-surface-lowest border-none rounded-xl" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={filterProjectId} onValueChange={setFilterProjectId}>
                    <SelectTrigger className="w-[200px] h-11 bg-surface-lowest border-none rounded-xl font-bold text-[10px] uppercase tracking-widest">
                        <SelectValue placeholder="Dự án: Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Dự án</SelectLabel>
                            <SelectItem value="all">Tất cả dự án</SelectItem>
                            {projects.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            {/* Products Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {products.filter(p => {
                    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
                    const matchesProject = filterProjectId === 'all' || p.project_id.toString() === filterProjectId
                    return matchesSearch && matchesProject
                }).length > 0 ? products.filter(p => {
                    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
                    const matchesProject = filterProjectId === 'all' || p.project_id.toString() === filterProjectId
                    return matchesSearch && matchesProject
                }).map((p, i) => (
                    <Card key={i} className="border-none shadow-none bg-surface-lowest rounded-[2rem] p-6 group relative overflow-hidden flex flex-col">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-20 h-20 bg-surface-low rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-border/5">
                                {p.image_path ? (
                                    <img 
                                        src={p.image_path.startsWith('http') ? p.image_path : `media://local-file?path=${encodeURIComponent(p.image_path)}`} 
                                        alt={p.name} 
                                        className="w-full h-full object-cover" 
                                    />
                                ) : (
                                    <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 truncate">
                                    {projects.find(pj => pj.id === p.project_id)?.name || 'Dự án'}
                                </div>
                                <h3 className="text-lg font-bold leading-tight truncate">{p.name}</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    {p.shopee_link && <ShoppingBag className="w-3.5 h-3.5 text-orange-500" />}
                                    {p.web_link && <Globe className="w-3.5 h-3.5 text-blue-500" />}
                                    {p.zalo_link && <MessageCircle className="w-3.5 h-3.5 text-sky-500" />}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 mt-auto">
                            <div className="p-3 bg-surface-low rounded-xl space-y-2">
                                {p.shopee_link && (
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-muted-foreground font-bold uppercase tracking-tighter">Shopee</span>
                                        <span className="text-foreground truncate max-w-[150px] font-medium">{p.shopee_link}</span>
                                    </div>
                                )}
                                {p.web_link && (
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-muted-foreground font-bold uppercase tracking-tighter">Trang đích</span>
                                        <span className="text-foreground truncate max-w-[150px] font-medium">{p.web_link}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteId(p.id)}
                            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </Card>
                )) : (
                    <div className="col-span-full py-24 text-center">
                        <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground/40">
                            <Tag className="w-8 h-8 font-thin" />
                        </div>
                        <p className="text-sm text-muted-foreground italic">Bộ sưu tập sản phẩm đang trống mã tiếp thị.</p>
                    </div>
                )}
            </div>

            {/* Add Product Dialog */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
                    <Card className="relative w-full max-w-xl border-none shadow-2xl bg-surface-container-lowest rounded-[2.5rem] p-10 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-display font-bold">Thêm Sản phẩm</h3>
                                <p className="text-sm text-muted-foreground">Khai báo thông tin sản phẩm và các liên kết tiếp thị để AI sử dụng.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Lược thuộc Dự án</label>
                                        <Select value={formData.project_id} onValueChange={(v) => setFormData({...formData, project_id: v})}>
                                            <SelectTrigger className="w-full h-11 bg-surface-container-low border-none rounded-xl">
                                                <SelectValue placeholder="Chọn dự án...">
                                                    {projects.find(p => p.id.toString() === formData.project_id)?.name}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Dự án liên kết</SelectLabel>
                                                    {projects.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Tên sản phẩm</label>
                                        <Input 
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            placeholder="VD: Tai nghe Bluetooth ANC" 
                                            className="h-11 bg-surface-container-low border-none rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Ảnh thu nhỏ (Thumbnail)</label>
                                        <div className="flex gap-2">
                                            <Input 
                                                value={formData.image_path}
                                                readOnly
                                                placeholder="Chưa chọn ảnh..." 
                                                className="h-11 bg-surface-container-low border-none rounded-xl text-[10px] truncate"
                                            />
                                            <Button variant="outline" onClick={handleSelectImage} className="h-11 rounded-xl px-3 border-dashed"><Link2 className="w-4 h-4" /></Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-1 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Link Shopee Affiliate</label>
                                        <Input 
                                            value={formData.shopee_link}
                                            onChange={(e) => setFormData({...formData, shopee_link: e.target.value})}
                                            placeholder="https://shope.ee/..." 
                                            className="h-11 bg-surface-container-low border-none rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Link Trang đích / Landing Page</label>
                                        <Input 
                                            value={formData.web_link}
                                            onChange={(e) => setFormData({...formData, web_link: e.target.value})}
                                            placeholder="https://yourstore.com/..." 
                                            className="h-11 bg-surface-container-low border-none rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Số Zalo tư vấn</label>
                                        <Input 
                                            value={formData.zalo_link}
                                            onChange={(e) => setFormData({...formData, zalo_link: e.target.value})}
                                            placeholder="https://zalo.me/..." 
                                            className="h-11 bg-surface-container-low border-none rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-4">
                                <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setIsAddOpen(false)}>Hủy bỏ</Button>
                                <Button className="flex-1 primary-gradient h-12 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleAdd}>Lưu sản phẩm</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            <ConfirmDeleteDialog 
                isOpen={deleteId !== null}
                onClose={() => setDeleteId(null)}
                onConfirm={() => deleteId && handleDelete(deleteId)}
                title="Xóa sản phẩm Affiliate?"
                itemName={products.find(p => p.id === deleteId)?.name}
                loading={isDeleting}
            />
        </div>
    )
}
