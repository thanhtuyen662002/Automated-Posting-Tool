import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  FolderKanban,
  Globe,
  ChevronRight,
  MoreHorizontal,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Brand Assets
import facebookLogo from '@/assets/facebook.svg'
import tiktokLogo from '@/assets/tiktok.svg'
import youtubeLogo from '@/assets/youtube.svg'
import instagramLogo from '@/assets/instagram.svg'
import zaloLogo from '@/assets/zalo.svg'
import shopeeLogo from '@/assets/shopee.svg'

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    projects: 0,
    pages: 0,
    pendingPosts: 0
  })
  const [posts, setPosts] = useState<any[]>([])
  const distribution = Object.entries(
    posts.reduce((acc: Record<string, number>, p: any) => {
      const key = (p.platform || 'Unknown').toString()
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  ).map(([platform, count]) => ({ platform, reach: count as number }))

  const fetchData = async () => {
    if (!window.ipcRenderer) return
    try {
      const sData = await window.ipcRenderer.getStats()
      if (sData) setStats(sData)
      
      const pData = await window.ipcRenderer.getPosts()
      if (pData) setPosts(pData.slice(0, 5)) // Take last 5
    } catch (e) {
      console.error('Error fetching dashboard data:', e)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getPlatformInfo = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return { logo: facebookLogo, color: 'bg-white' }
      case 'tiktok': return { logo: tiktokLogo, color: 'bg-black' }
      case 'youtube': return { logo: youtubeLogo, color: 'bg-white' }
      case 'instagram': return { logo: instagramLogo, color: 'bg-white' }
      case 'zalo': return { logo: zaloLogo, color: 'bg-white' }
      case 'shopee': return { logo: shopeeLogo, color: 'bg-white' }
      default: return { logo: null, color: 'bg-white' }
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header Area */}
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">Tổng quan</h2>
        <p className="text-muted-foreground text-sm">Chào mừng quay trở lại, đây là thông tin tổng quát của bạn</p>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { label: 'Dự án đang chạy', value: stats.projects, icon: FolderKanban, trend: '+4%', trendColor: 'text-emerald-500' },
          { label: 'Page đã kết nối', value: stats.pages, icon: Globe, status: 'Ổn định', statusColor: 'text-blue-500' },
          { label: 'Nội dung chờ đăng', value: stats.pendingPosts, icon: Calendar, hasAlert: stats.pendingPosts > 0 },
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
                {metric.trend && <span className={cn("text-xs font-bold", metric.trendColor)}>{metric.trend}</span>}
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

      {/* Main Grid: Queue & Info */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Content Queue Summary */}
        <Card className="lg:col-span-2 border-none shadow-none bg-surface-container-lowest rounded-3xl overflow-hidden p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-display font-bold">Danh sách nội dung chờ</h3>
            <Button variant="ghost" size="sm" className="text-primary font-bold gap-1">
              Xem lịch <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-4">
            {posts.length > 0 ? posts.map((item) => {
              const info = getPlatformInfo(item.platform || '');
              return (
                <div key={item.id} className="group flex items-center justify-between p-4 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center p-2.5",
                      info.color
                    )}>
                      {info.logo ? (
                        <img
                          src={info.logo}
                          alt={item.platform}
                          className={cn("w-full h-full object-contain", item.platform?.toLowerCase() === 'tiktok' && "invert")}
                        />
                      ) : <Globe className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm leading-tight">{item.title || 'Không rõ tiêu đề'}</h4>
                      <p className="text-xs text-muted-foreground">Lên lịch lúc {item.scheduled_at || 'Chưa định ngày'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm border",
                      item.status === 'published' || item.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                      item.status === 'failed' ? "bg-red-50 text-red-600 border-red-100" :
                      item.status === 'scheduled' ? "bg-sky-50 text-sky-600 border-sky-100" :
                      "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {item.status === 'published' || item.status === 'completed' ? 'Đã đăng' : 
                       item.status === 'failed' ? 'Gặp lỗi' : 
                       item.status === 'scheduled' ? 'Đã lên lịch' : 
                       'Đang chờ'}</span>
                    <MoreHorizontal className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                  </div>
                </div>
              );
            }) : (
              <div className="py-20 text-center space-y-4 bg-surface-container-low/30 rounded-3xl border-2 border-dashed border-border/10">
                <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm">Chưa có nội dung nào chờ đăng</p>
                  <p className="text-xs text-muted-foreground">Tạo dự án và lên lịch bài viết đầu tiên của bạn ngay.</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Platform Distribution Card */}
          <Card className="border-none shadow-none primary-gradient rounded-3xl p-8 text-white relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <h3 className="font-display font-bold text-base">Phân bổ nền tảng nội dung</h3>
              <div className="space-y-4">
                {distribution.map((d, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-80">
                      <span>{d.platform}</span>
                      <span>{d.reach}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${Math.max(10, Math.round((d.reach / Math.max(1, posts.length)) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Background pattern */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
          </Card>

          {/* Connectivity Health */}
          <Card className="border-none shadow-none bg-surface-lowest rounded-3xl p-8 space-y-6">
            <h3 className="font-display font-bold">Trạng thái kết nối</h3>
            <div className="space-y-4">
              {[
                { label: 'Published', count: posts.filter((p: any) => p.status === 'published').length, color: 'bg-emerald-500' },
                { label: 'Scheduled', count: posts.filter((p: any) => p.status === 'scheduled').length, color: 'bg-amber-500' },
                { label: 'Failed', count: posts.filter((p: any) => p.status === 'failed').length, color: 'bg-red-500' },
              ].map((h, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer p-2 rounded-xl hover:bg-surface-low transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", h.color)} />
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{h.label}</span>
                  </div>
                  <span className="font-display font-bold text-sm">{h.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
