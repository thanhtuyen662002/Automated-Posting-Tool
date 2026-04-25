import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from 'ffmpeg-static'
import axios from 'axios'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { dbService } from './db'

// Set path for ffmpeg
if (ffmpegInstaller) {
  ffmpeg.setFfmpegPath(ffmpegInstaller)
}

export interface WatermarkConfig {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    size: number // 0-1 percentage of video width (e.g. 0.15)
    margin: number // distance from edge
    opacity: number // 0-1
    showText: boolean
}

export class WatermarkService {
    private static TMP_DIR = path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd(), 'temp_watermarks')

    static {
        if (!fs.existsSync(this.TMP_DIR)) {
            fs.mkdirSync(this.TMP_DIR, { recursive: true })
        }
    }

    private static async getAvatarPath(pageId: number): Promise<string | null> {
        const pages = dbService.getPages()
        const page = pages.find(p => p.id === pageId)
        if (!page || !page.avatar_url) return null

        if (fs.existsSync(page.avatar_url)) return page.avatar_url

        // If it's a URL, download to temp
        try {
            const fileName = `avatar_${pageId}_${Date.now()}.jpg`
            const localPath = path.join(this.TMP_DIR, fileName)
            const response = await axios.get(page.avatar_url, { responseType: 'arraybuffer' })
            fs.writeFileSync(localPath, Buffer.from(response.data))
            return localPath
        } catch (error) {
            console.error('[Watermark] Failed to download avatar:', error)
            return null
        }
    }

    static async applyWatermark(inputVideo: string, pageId: number, config?: WatermarkConfig): Promise<string> {
        const page = dbService.getPages().find(p => p.id === pageId)
        if (!page) throw new Error('Page not found')

        const avatarPath = await this.getAvatarPath(pageId)
        const outputVideo = path.join(this.TMP_DIR, `wm_${pageId}_${path.basename(inputVideo)}`)
        
        const defaultWinConfig: WatermarkConfig = {
            position: 'top-right',
            size: 0.12,
            margin: 20,
            opacity: 0.8,
            showText: true
        }
        
        const activeConfig = config || defaultWinConfig

        return new Promise((resolve, reject) => {
            let command = ffmpeg(inputVideo)

            if (avatarPath) {
                // Determine overlay filter based on position
                // e.g. top-right: x=main_w-overlay_w-margin, y=margin
                let x = `${activeConfig.margin}`
                let y = `${activeConfig.margin}`

                if (activeConfig.position.includes('right')) {
                    x = `main_w-overlay_w-${activeConfig.margin}`
                }
                if (activeConfig.position.includes('bottom')) {
                    y = `main_h-overlay_h-${activeConfig.margin}`
                }

                command = command
                    .input(avatarPath)
                    .complexFilter([
                        // Scale avatar relative to video width
                        `[1:v]scale=iw*min(1,main_w*${activeConfig.size}/iw):-1[avatar]`,
                        `[0:v][avatar]overlay=${x}:${y}:format=auto,format=yuv420p`
                    ])
            }

            command
                .on('start', (cmd) => console.log('[Watermark] CMD:', cmd))
                .on('error', (err) => reject(new Error(`FFmpeg Error: ${err.message}`)))
                .on('end', () => resolve(outputVideo))
                .save(outputVideo)
        })
    }
}
