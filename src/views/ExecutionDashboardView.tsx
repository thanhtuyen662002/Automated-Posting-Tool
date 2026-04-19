import React, { useEffect, useState, useRef } from 'react'
import { 
    Monitor, 
    Smartphone, 
    ShieldCheck,
    Clock,
    AlertCircle, 
    Facebook,
    Instagram,
    Youtube,
    Music2,
    ChevronRight,
    Loader2,
    Box,
    Wifi} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ActiveJob {
    id: number
    projectName: string
    pageName: string
    platform: string
    title: string
    frameData: string // base64
}

export const ExecutionDashboardView: React.FC = () => {
    const [activeJobs, setActiveJobs] = useState<Record<number, ActiveJob>>({})
    const [robotStatus, setRobotStatus] = useState(false)
    const [postsCount, setPostsCount] = useState({ pending: 0, scheduled: 0, published: 0 })
    
    // Cache for post/page metadata to avoid repeated DB hits
    const metadataCache = useRef<Record<number, any>>({})

    const fetchMetadata = async (jobId: number) => {
        if (metadataCache.current[jobId]) return metadataCache.current[jobId]
        
        if (!window.ipcRenderer) return null
        const posts = await window.ipcRenderer.getPosts()
        const post = posts.find((p: any) => p.id === jobId)
        if (!post) return null

        const pages = await window.ipcRenderer.getPages()
        const page = pages.find((pg: any) => pg.id === post.page_id)
        
        const projs = await window.ipcRenderer.getProjects()
        const project = projs.find((pj: any) => pj.id === post.project_id)

        const meta = {
            projectName: project?.name || 'Dự án',
            pageName: page?.page_name || 'Page',
            platform: page?.platform || 'Facebook',
            title: post.title
        }
        metadataCache.current[jobId] = meta
        return meta
    }

    useEffect(() => {
        if (!window.ipcRenderer) return

        const handleFrame = async (_event: any, { jobId, frame }: { jobId: number, frame: string }) => {
            if (frame === 'FINISHED') {
                setActiveJobs(prev => {
                    const next = { ...prev }
                    delete next[jobId]
                    return next
                })
                return
            }

            // If we don't have metadata yet, fetch it
            if (!activeJobs[jobId]) {
                const meta = await fetchMetadata(jobId)
                if (meta) {
                    setActiveJobs(prev => ({
                        ...prev,
                        [jobId]: {
                            id: jobId,
                            ...meta,
                            frameData: frame
                        }
                    }))
                }
            } else {
                // Just update frame
                setActiveJobs(prev => ({
                    ...prev,
                    [jobId]: {
                        ...prev[jobId],
                        frameData: frame
                    }
                }))
            }
        }

        const handleStatusUpdate = async () => {
            const status = await window.ipcRenderer.getEngineStatus()
            setRobotStatus(status)
            
            const stats = await window.ipcRenderer.getStats()
            setPostsCount({
                pending: stats.posts_pending || 0,
                scheduled: stats.posts_scheduled || 0,
                published: stats.posts_published || 0
            })
        }

        const cleanup = window.ipcRenderer.on('engine:frame', handleFrame)
        
        // Initial status check
        handleStatusUpdate()
        const statusInterval = setInterval(handleStatusUpdate, 5000)

        return () => {
            if (cleanup) cleanup()
            clearInterval(statusInterval)
        }
    }, [activeJobs])

    const getPlatformIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'facebook': return <Facebook className="w-4 h-4 text-blue-600" />
            case 'tiktok': return <Music2 className="w-4 h-4 text-slate-900" />
            case 'instagram': return <Instagram className="w-4 h-4 text-pink-600" />
            case 'youtube': return <Youtube className="w-4 h-4 text-red-600" />
            default: return <Box className="w-4 h-4 text-gray-400" />
        }
    }

    const jobList = Object.values(activeJobs)

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <span>Trực tiếp</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-extrabold text-emerald-500">Giám sát Vận hành</span>
            </div>

            {/* Header Content */}
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <h2 className="text-4xl font-display font-extrabold tracking-tight flex items-center gap-4">
                        Robot Đang Thao Tác
                        {robotStatus ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold animate-pulse">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                ĐANG TRỰC TUYẾN
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                ĐÃ TẮT
                            </div>
                        )}
                    </h2>
                    <p className="text-muted-foreground text-sm">Hiển thị thời gian thực các thao tác đăng bài của Robot trên trình duyệt giả lập di động.</p>
                </div>

                <div className="flex gap-4">
                     <div className="flex items-center gap-6 bg-white px-6 py-2 rounded-2xl border border-surface-container-high shadow-sm">
                        <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Đang chờ: <span className="text-foreground">{postsCount.scheduled}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Đã đăng: <span className="text-foreground">{postsCount.published}</span></span>
                        </div>
                        <div className="w-px h-4 bg-surface-container-highest" />
                        <div className="flex items-center gap-2">
                            <Wifi className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold">Luồng chạy: <span className="text-emerald-600">{jobList.length}</span></span>
                        </div>
                     </div>
                </div>
            </div>

            {/* Live Grid */}
            {jobList.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                    {jobList.map((job) => (
                        <Card key={job.id} className="group relative border-none bg-surface-lowest rounded-[2rem] overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 border-transparent hover:border-emerald-500/10">
                            {/* Browser Header / Meta */}
                            <div className="p-4 space-y-2 relative z-10 bg-white/90 backdrop-blur-sm border-b border-surface-container-high/50">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-surface-container rounded-lg">
                                            {getPlatformIcon(job.platform)}
                                        </div>
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground leading-none">{job.pageName}</h4>
                                            <p className="text-[9px] font-bold text-primary/60 truncate max-w-[80px]">{job.projectName}</p>
                                        </div>
                                    </div>
                                    <Badge className="text-[8px] font-black bg-emerald-100 text-emerald-700 border-none px-1.5 h-4">ID #{job.id}</Badge>
                                </div>
                                <h5 className="font-bold text-[11px] truncate">{job.title}</h5>
                            </div>

                            {/* Live Viewport (Mobile Aspect) */}
                            <div className="relative aspect-[360/740] bg-zinc-900 flex items-center justify-center overflow-hidden">
                                {job.frameData ? (
                                    <img 
                                        src={`data:image/jpeg;base64,${job.frameData}`}
                                        className="w-full h-full object-cover transition-opacity duration-300"
                                        alt="Browser Stream"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-3 opacity-20">
                                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                                        <span className="text-[10px] text-white font-bold tracking-widest">ĐANG KẾT NỐI...</span>
                                    </div>
                                )}

                                {/* Overlay for Interaction Feedback */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                            </div>

                            {/* Status Footer */}
                            <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                                <div className="bg-white/90 backdrop-blur shadow-lg border border-surface-container-high p-3 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] font-bold text-emerald-600">ROBOT LIVE</span>
                                    </div>
                                    <Smartphone className="w-3.5 h-3.5 text-muted-foreground/30" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-24 h-24 bg-surface-container-low rounded-[2rem] flex items-center justify-center text-muted-foreground/10 mb-2">
                        <Monitor className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-display font-extrabold tracking-tight">Hệ thống đang sẵn sàng</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                            Hiện chưa có bài viết nào đến giờ đăng. Khi đến giờ, Robot sẽ tự động hiển thị quá trình thao tác tại đây.
                        </p>
                    </div>
                    
                    {!robotStatus && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-1 max-w-sm">
                            <p className="text-xs font-bold text-amber-700 flex items-center justify-center gap-2">
                                <AlertCircle className="w-3 h-3" /> CHƯA BẬT ROBOT
                            </p>
                            <p className="text-[10px] text-amber-600/80">Bạn cần vào phần <strong>Cấu hình AI</strong> để kích hoạt bộ máy vận hành.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
