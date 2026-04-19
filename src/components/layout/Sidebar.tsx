import {
  LayoutDashboard,
  FolderKanban,
  Globe, 
  Settings, 
  LifeBuoy, 
  LogOut,
  Cpu,
  MessageSquareText,
  Tag,
  Sparkles,
  CalendarDays,
  Zap,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'projects', label: 'Dự án', icon: FolderKanban },
  { id: 'pages', label: 'Nền tảng & Page', icon: Globe },
  { id: 'studio', label: 'Xưởng nội dung', icon: Sparkles },
  { id: 'scheduler', label: 'Lịch đăng bài', icon: CalendarDays },
  { id: 'posts', label: 'Quản lý bài viết', icon: FileText },
  { id: 'execution', label: 'Vận hành Robot', icon: Zap },
  { id: 'ai-config', label: 'Cấu hình AI', icon: Cpu },
  { id: 'prompts', label: 'Kho Prompts', icon: MessageSquareText },
  { id: 'products', label: 'Kho Sản phẩm', icon: Tag },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
]

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="w-64 bg-surface-container-low text-on-surface h-screen flex flex-col select-none">
      {/* Brand Header */}
      <div className="px-6 py-8 flex items-center gap-3">
        <div className="w-10 h-10 primary-gradient rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Globe className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg leading-tight">AutoPost</h1>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tự động hóa Chuyên nghiệp</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
              activeTab === item.id
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-surface-mid hover:text-foreground"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 transition-colors",
              activeTab === item.id ? "text-primary-foreground" : "group-hover:text-foreground"
            )} />
            <span className="font-medium text-sm">{item.label}</span>
            {activeTab === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
            )}
          </button>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 space-y-1 mt-auto border-t border-border/10">
        <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
          <LifeBuoy className="w-4 h-4" />
          <span>Hỗ trợ</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors group">
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}
