import { dbService, Post, ScheduleSettings } from './db'
import { POST_STATUS } from './post_status'

export class Scheduler {
    /**
     * Distributes approved posts into scheduled slots based on project settings.
     */
    /**
     * Distributes approved posts into scheduled slots based on project settings.
     * Implements smart interleaving and cross-page collision prevention.
     */
    static async distributeSchedules(projectId?: number) {
        if (!projectId) {
            const projects = dbService.getProjects()
            let totalCount = 0
            for (const project of projects) {
                const result = await this.distributeSchedules(project.id)
                totalCount += result.count
            }
            return { count: totalCount }
        }

        const settings = dbService.getScheduleSettings(projectId)
        const timeWindows = settings 
            ? JSON.parse(settings.time_windows) 
            : ["09:00-11:00", "19:00-22:00"]
            
        const minInterval = settings?.min_interval || 30
        const maxPostsPerDay = settings?.max_posts_per_day || 3
        const posts = dbService.getPostsByStatus(POST_STATUS.APPROVED).filter((p: Post) => p.project_id === projectId)
 
        if (posts.length === 0) return { count: 0 }

        // 1. Group posts by media_path (content group) to enable interleaving
        const groupsMap: Record<string, Post[]> = {}
        for (const p of posts) {
            if (!groupsMap[p.media_path]) groupsMap[p.media_path] = []
            groupsMap[p.media_path].push(p)
        }
        
        // Flatten by interleaving (Video A - Page 1, Video B - Page 1, Video A - Page 2...)
        // This ensures variety in the output sequence
        const groups = Object.values(groupsMap)
        const maxLen = Math.max(...groups.map(g => g.length))
        const orderedPosts: Post[] = []
        for (let i = 0; i < maxLen; i++) {
            for (const group of groups) {
                if (group[i]) orderedPosts.push(group[i])
            }
        }
 
        // 2. State trackers for smart allocation
        const lastScheduledTimePerPage: Record<number, number> = {} // pageId -> timestamp
        const sessionMediaUsage: Record<string, Set<string>> = {} // "dayIndex-winIndex" -> Set of media_paths
        const sessionPageUsage: Record<string, Set<number>> = {}   // "dayIndex-winIndex" -> Set of page_ids
        const dailyPageCount: Record<string, number> = {}           // "dayIndex-pageId" -> Count

        const now = new Date()
        const nowStartOfDay = new Date(now)
        nowStartOfDay.setHours(0, 0, 0, 0)

        // 2.1 PRE-FILL trackers with EXISTING scheduled posts to prevent overlap
        const existingScheduledPosts = dbService.getPostsByStatus(POST_STATUS.SCHEDULED)
        
        for (const sp of existingScheduledPosts) {
            if (!sp.scheduled_at) continue;
            const postTime = new Date(sp.scheduled_at)
            
            // We only care about posts today or in the future
            if (postTime < nowStartOfDay) continue;

            const postStartOfDay = new Date(postTime)
            postStartOfDay.setHours(0, 0, 0, 0)
            
            const localDayOffset = Math.round((postStartOfDay.getTime() - nowStartOfDay.getTime()) / 86400000)
            if (localDayOffset < 0) continue;

            // Track last scheduled time
            if (!lastScheduledTimePerPage[sp.page_id] || lastScheduledTimePerPage[sp.page_id] < postTime.getTime()) {
                lastScheduledTimePerPage[sp.page_id] = postTime.getTime()
            }

            // Track daily page count
            const dailyKey = `${localDayOffset}-${sp.page_id}`
            dailyPageCount[dailyKey] = (dailyPageCount[dailyKey] || 0) + 1

            // Track session usage by determining winIdx
            let matchedWinIdx = -1;
            for (let i = 0; i < timeWindows.length; i++) {
                const [startStr, endStr] = timeWindows[i].split('-')
                const [startH, startM] = startStr.split(':').map(Number)
                const [endH, endM] = endStr.split(':').map(Number)
                
                const winStart = new Date(postStartOfDay)
                winStart.setHours(startH, startM, 0, 0)
                const winEnd = new Date(postStartOfDay)
                winEnd.setHours(endH, endM, 0, 0)

                // If the post time falls within or very close to this window
                if (postTime >= winStart && postTime <= winEnd) {
                    matchedWinIdx = i;
                    break;
                }
            }

            if (matchedWinIdx !== -1) {
                const sessionKey = `${localDayOffset}-${matchedWinIdx}`
                if (!sessionMediaUsage[sessionKey]) sessionMediaUsage[sessionKey] = new Set()
                if (!sessionPageUsage[sessionKey]) sessionPageUsage[sessionKey] = new Set()
                
                sessionMediaUsage[sessionKey].add(sp.media_path)
                sessionPageUsage[sessionKey].add(sp.page_id)
            }
        }

        let scheduledCount = 0
        let dayOffset = 0

        // 3. Allocation Loop
        // We iterate through posts and find the first available slot that fits constraints
        for (const post of orderedPosts) {
            let foundSlot = false
            let localDayOffset = dayOffset

            while (!foundSlot && localDayOffset < 60) { // Look ahead up to 60 days
                const scheduleDate = new Date()
                scheduleDate.setDate(scheduleDate.getDate() + localDayOffset)
                scheduleDate.setSeconds(0, 0)

                // Check daily limit for this page
                const dailyKey = `${localDayOffset}-${post.page_id}`
                if ((dailyPageCount[dailyKey] || 0) >= maxPostsPerDay) {
                    localDayOffset++
                    continue
                }

                for (let winIdx = 0; winIdx < timeWindows.length; winIdx++) {
                    const sessionKey = `${localDayOffset}-${winIdx}`
                    if (!sessionMediaUsage[sessionKey]) sessionMediaUsage[sessionKey] = new Set()
                    if (!sessionPageUsage[sessionKey]) sessionPageUsage[sessionKey] = new Set()

                    // Constraint Check: 
                    // 1. Same video shouldn't be in the same window on different pages (if possible)
                    // 2. Same page shouldn't have multiple videos in the same window
                    if (sessionMediaUsage[sessionKey].has(post.media_path) || sessionPageUsage[sessionKey].has(post.page_id)) {
                        continue
                    }

                    const [startStr, endStr] = timeWindows[winIdx].split('-')
                    const [startH, startM] = startStr.split(':').map(Number)
                    const [endH, endM] = endStr.split(':').map(Number)

                    const winStart = new Date(scheduleDate)
                    winStart.setHours(startH, startM, 0, 0)
                    const winEnd = new Date(scheduleDate)
                    winEnd.setHours(endH, endM, 0, 0)

                    // Skip if window has passed
                    if (winEnd < now) continue

                    // Determine candidate time within window
                    let candidateTime = winStart < now ? new Date(now.getTime() + 10 * 60000) : winStart
                    
                    // Respect minInterval for this page
                    if (lastScheduledTimePerPage[post.page_id]) {
                        const minTime = new Date(lastScheduledTimePerPage[post.page_id] + (minInterval * 60000))
                        if (candidateTime < minTime) candidateTime = minTime
                    }

                    // If candidate time is still within window, we found it!
                    if (candidateTime < winEnd) {
                        dbService.updatePostSchedule(post.id, candidateTime.toISOString(), POST_STATUS.SCHEDULED)
                        
                        // Update trackers
                        lastScheduledTimePerPage[post.page_id] = candidateTime.getTime()
                        sessionMediaUsage[sessionKey].add(post.media_path)
                        sessionPageUsage[sessionKey].add(post.page_id)
                        dailyPageCount[dailyKey] = (dailyPageCount[dailyKey] || 0) + 1
                        
                        foundSlot = true
                        scheduledCount++
                        break
                    }
                }

                if (!foundSlot) localDayOffset++
            }
        }

        return { count: scheduledCount }
    }
}
