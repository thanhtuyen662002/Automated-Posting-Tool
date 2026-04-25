import { useState } from 'react'
import { Search, Bell, HelpCircle } from 'lucide-react'
import { ThemeProvider } from 'next-themes'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './views/Dashboard'
import { ProjectsView } from './views/ProjectsView'
import { PagesView } from './views/PagesView'
import { AIConfigView } from './views/AIConfigView'
import { PromptsView } from './views/PromptsView'
import { ProductsView } from './views/ProductsView'
import { ContentStudioView } from './views/ContentStudioView'
import { ScheduleManagerView } from './views/ScheduleManagerView'
import { ExecutionDashboardView } from './views/ExecutionDashboardView'
import { PostsManagementView } from './views/PostsManagementView'
import { Toaster } from '@/components/ui/sonner'
import { Input } from '@/components/ui/input'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'projects':
        return <ProjectsView />
      case 'pages':
        return <PagesView />
      case 'studio':
        return <ContentStudioView />
      case 'scheduler':
        return <ScheduleManagerView />
      case 'execution':
        return <ExecutionDashboardView />
      case 'posts':
        return <PostsManagementView />
      case 'ai-config':
        return <AIConfigView />
      case 'prompts':
        return <PromptsView />
      case 'products':
        return <ProductsView />
      case 'settings':
        return <AIConfigView />
      default:
        return <Dashboard />
    }
  }

  console.log('App rendering, activeTab:', activeTab)

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <div className="flex h-screen bg-surface">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header Bar */}
          <header className="h-16 border-b border-border/10 bg-surface/40 backdrop-blur-xl flex items-center justify-between px-8 z-10 shrink-0">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm mọi thứ..."
                className="pl-10 h-10 bg-surface-container-low/50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 text-muted-foreground mr-2">
                <button className="relative p-1 hover:text-foreground transition-colors">
                  <Bell className="w-5 h-5" />
                  <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                </button>
                <button className="p-1 hover:text-foreground transition-colors">
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3 pl-6 border-l border-border/10">
                <div className="text-right">
                  <div className="text-sm font-bold leading-none">Thanh Tuyền</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Administrator</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-surface-container border border-border/20 overflow-hidden">
                  <div className="w-full h-full primary-gradient flex items-center justify-center text-white font-bold">V</div>
                </div>
              </div>
            </div>
          </header>

          {/* IPC Missing Warning */}
          {!window.ipcRenderer && (
            <div className="bg-red-500/10 border-b border-red-500/20 text-red-600 p-3 text-center text-xs font-bold flex items-center justify-center gap-2 shrink-0 z-10 relative">
                <HelpCircle className="w-4 h-4" />
                <span>CẢNH BÁO: Bộ xử lý hệ thống (IPC) đang tắt. Có vẻ bạn đang mở ứng dụng trong trình duyệt Web thông thường (như Chrome/Edge) thay vì chạy phần mềm AutoPost Pro. Robot và dữ liệu sẽ không hoạt động.</span>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 lg:px-12">
            <div className="max-w-6xl mx-auto">
              {renderContent()}
            </div>
          </div>
        </main>

        <Toaster richColors position="top-right" />
      </div>
    </ThemeProvider>
  )
}

export default App
