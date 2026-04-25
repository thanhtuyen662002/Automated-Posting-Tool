import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dbService } from './db.js'
import { launchBrowserForLogin, postContent } from './automation.js'
import { encrypt, decrypt } from './crypto_utils.js'
import { AIService } from './ai_service.js'
import { Scheduler } from './scheduler.js'
import { PosterEngine } from './poster_engine.js'
import { AutomationEngine } from './automation_engine.js'
import { AutomationService } from './automation_service.js'
import fs from 'node:fs/promises'
import { POST_STATUS } from './post_status.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
//
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

// Register media protocol to handle local files
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
])


let mainWindow: BrowserWindow | null = null
let posterEngine: PosterEngine | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    icon: path.join(process.env.VITE_PUBLIC || '', 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    title: 'AutoPost Pro - Social Media Automation',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#000000',
    }
  })

  // Initialize Poster Engine with log and frame callbacks
  posterEngine = new PosterEngine(
    (msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine:log', msg)
      }
    },
    (jobId, frame) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine:frame', { jobId, frame })
      }
    }
  )

  // Auto-start Robot if enabled in settings
  const checkAutoStart = async () => {
    const record = dbService.getSetting('robot_active_status') as any
    if (record && record.encrypted_value === 'true') {
        posterEngine?.start()
    }
  }
  checkAutoStart()

  // Initialize Automation Engine
  const automationEngine = new AutomationEngine((msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('engine:log', msg)
    }
  })
  ;(global as any).automationEngine = automationEngine
  automationEngine.start()

  // Test active push message to Renderer-process.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

// ── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('db:get-projects', () => dbService.getProjects())
ipcMain.handle('db:add-project', (_, name, platforms, aiConfig) => dbService.addProject(name, platforms, aiConfig))
ipcMain.handle('db:update-project', (_, { id, name, platforms, aiConfig }) => dbService.updateProject(id, name, platforms, aiConfig))
ipcMain.handle('db:delete-project', (_, id) => dbService.deleteProject(id))

ipcMain.handle('db:get-pages', (_, projectId) => dbService.getPages(projectId))
ipcMain.handle('db:add-page', async (_, data) => {
  // Generate a unique profile directory for the page if not provided
  const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
  const profileDirName = `profile_${data.project_id}_${data.page_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`
  data.profile_dir = path.join(rootPath, 'browser_profiles', profileDirName)
  
  const newPage = dbService.addPage(data) as any
  if (newPage) {
    dbService.addLog({
      page_id: newPage.id,
      project_id: newPage.project_id,
      type: 'Kết nối',
      status: 'success',
      message: `Đã kết nối Page mới: ${newPage.page_name} (${newPage.platform})`
    })
  }
  return newPage
})
ipcMain.handle('db:delete-page', (_, id) => dbService.deletePage(id))
ipcMain.handle('db:update-page', (_, { id, data }) => dbService.updatePage(id, data))

ipcMain.handle('db:get-accounts', (_, projectId) => dbService.getAccounts(projectId))
ipcMain.handle('db:add-account', async (_, data) => {
  // Generate a unique profile directory for the account if not provided
  if (!data.profile_dir) {
    const rootPath = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
    const profileDirName = `profile_${data.project_id}_acc_${data.account_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`
    data.profile_dir = path.join(rootPath, 'browser_profiles', profileDirName)
  }
  return dbService.addAccount(data)
})
ipcMain.handle('db:update-account', (_, { id, data }) => dbService.updateAccount(id, data))
ipcMain.handle('db:delete-account', (_, id) => dbService.deleteAccount(id))
ipcMain.handle('db:update-account-login-status', (_, { id, status }) => dbService.updateAccountLoginStatus(id, status))
ipcMain.handle('db:get-posts', (_, projectId) => dbService.getPosts(projectId))
ipcMain.handle('db:add-post', (_, data) => dbService.addPost(data))
ipcMain.handle('db:delete-post', (_, id) => dbService.deletePost(id))
ipcMain.handle('db:update-post', (_, { id, data }) => dbService.updatePost(id, data))
ipcMain.handle('db:get-stats', () => dbService.getStats())
ipcMain.handle('db:get-logs', (_, limit, projectId) => dbService.getLogs(limit, projectId))
ipcMain.handle('db:add-log', (_, data) => dbService.addLog(data))

ipcMain.handle('browser:launch', async (_, accountId) => {
  if (typeof accountId !== 'number') {
    return { success: false, error: 'Invalid account id' }
  }
  const accounts = dbService.getAccounts()
  const account = accounts.find((a: any) => a.id === accountId)
  
  if (account) {
    mainWindow?.webContents.send('engine:log', `[${account.platform}] Đang mở trình duyệt cho profile: ${account.account_name}...`)
    
    await launchBrowserForLogin(account, () => {
      // Callback when browser closes
      dbService.updateAccountLoginStatus(account.id, 1)
      mainWindow?.webContents.send('browser:closed', accountId)
    })
    return { success: true }
  }
  return { success: false, error: 'Account not found' }
})

ipcMain.handle('automation:run-post', async (_, { pageId, postId }) => {
  if (typeof pageId !== 'number' || typeof postId !== 'number') {
    return { success: false, error: 'Invalid payload' }
  }
  const pages = dbService.getPages()
  const pageData = pages.find((p: any) => p.id === pageId) as any
  const posts = dbService.getPosts()
  const postData = posts.find((p: any) => p.id === postId) as any

  if (pageData && postData) {
    dbService.updatePostStatus(postId, POST_STATUS.PROCESSING)
    dbService.addLog({
      page_id: pageId,
      project_id: pageData.project_id,
      type: 'Đăng bài',
      status: 'warning',
      message: `Bắt đầu đăng bài: ${postData.title}`
    })

    const result = await postContent(pageData, postData)
    
    if (result.success) {
      dbService.updatePostStatus(postId, POST_STATUS.PUBLISHED)
      dbService.addLog({
        page_id: pageId,
        project_id: pageData.project_id,
        type: 'Đăng bài',
        status: 'success',
        message: `Đã đăng bài thành công: ${postData.title}`
      })
    } else {
      dbService.updatePostStatus(postId, POST_STATUS.FAILED, result.error)
      dbService.addLog({
        page_id: pageId,
        project_id: pageData.project_id,
        type: 'Đăng bài',
        status: 'failure',
        message: `Lỗi đăng bài: ${result.error}`
      })
    }
    return result
  }
  return { success: false, error: 'Post or Page not found' }
})

// ── Phase 2: AI Settings, Prompts, Products ───────────────────────────────────

ipcMain.handle('settings:save-api-key', (_, { key, value }) => {
  const encrypted = encrypt(value)
  return dbService.saveSetting(key, encrypted)
})

ipcMain.handle('settings:get-api-key', (_, key) => {
  const record = dbService.getSetting(key) as any
  if (record && record.encrypted_value) {
    try {
      return decrypt(record.encrypted_value)
    } catch (e) {
      console.error('Decryption failed for key:', key)
      return ''
    }
  }
  return ''
})

ipcMain.handle('db:get-prompts', (_, type) => dbService.getPrompts(type))
ipcMain.handle('db:add-prompt', (_, data) => dbService.addPrompt(data))
ipcMain.handle('db:update-prompt', (_, { id, data }) => dbService.updatePrompt(id, data))
ipcMain.handle('db:delete-prompt', (_, id) => dbService.deletePrompt(id))

ipcMain.handle('db:get-products', (_, projectId) => dbService.getProducts(projectId))
ipcMain.handle('db:add-product', (_, data) => dbService.addProduct(data))
ipcMain.handle('db:delete-product', (_, id) => dbService.deleteProduct(id))

ipcMain.handle('dialog:open-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp'] }]
  })
  return result.filePaths[0]
})

// ── Phase 3: Content Studio & AI Generation ──────────────────────────────────

ipcMain.handle('fs:scan-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled) return []
  
  const dirPath = result.filePaths[0]
  const files = await fs.readdir(dirPath)
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.mp4', '.mov', '.webp']
  
  return files
    .filter(f => mediaExtensions.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(dirPath, f))
})

ipcMain.handle('db:get-content-groups', (_, projectId) => dbService.getContentGroups(projectId))
ipcMain.handle('db:add-content-group', (_, data) => dbService.addContentGroup(data))
ipcMain.handle('db:delete-content-group', (_, id) => dbService.deleteContentGroup(id))

ipcMain.handle('ai:generate-post', async (_, { promptId, keyword, projectId, productId }) => {
  const prompts = dbService.getPrompts()
  const prompt = prompts.find((p: any) => p.id === promptId) as any
  if (!prompt) throw new Error('Mẫu prompt không tồn tại')
  
  let productData = null
  if (productId) {
    const products = dbService.getProducts()
    productData = products.find((p: any) => p.id === productId)
  }
  
  return await AIService.generatePostContent(prompt.content, keyword, projectId, productData)
})

ipcMain.handle('ai:generate-cta', async (_, { promptId, productId, postContext }) => {
  const prompts = dbService.getPrompts()
  const prompt = prompts.find((p: any) => p.id === promptId) as any
  if (!prompt) throw new Error('Mẫu prompt không tồn tại')

  // Case 1: Smart Generation based on Post Context
  if (postContext) {
    let mediaAnalysis = ''
    if (postContext.mediaPath) {
      try {
        mediaAnalysis = await AIService.describeMedia(postContext.mediaPath)
      } catch (e) {
        console.error('[Main] Media analysis failed for CTA:', e)
      }
    }

    return await AIService.generateSmartCTAFromPost({
      caption: postContext.title,
      description: postContext.content,
      shopeeLink: postContext.shopeeLink,
      mediaAnalysis
    }, prompt.content, postContext.projectId)
  }

  // Case 2: Legacy Product-based Generation
  const products = dbService.getProducts()
  const product = products.find((p: any) => p.id === productId) as any
  
  if (!product) throw new Error('Sản phẩm không tồn tại')
  
  return await AIService.generateCTAComment(product, prompt.content, product.project_id)
})

ipcMain.handle('ai:analyze-media', async (_, { filePath, projectId }) => {
  return await AIService.describeMedia(filePath, projectId)
})

ipcMain.handle('ai:get-batch-prompt', async () => {
  const record = dbService.getSetting('automation_batch_system_prompt') as any
  if (record && record.encrypted_value) {
    try {
      return decrypt(record.encrypted_value)
    } catch {
      return record.encrypted_value
    }
  }
  return ""
})

ipcMain.handle('ai:save-batch-prompt', async (_, prompt) => {
  return dbService.saveSetting('automation_batch_system_prompt', encrypt(prompt))
})

ipcMain.handle('ai:generate-batch-posts', async (_, { pages, projectId, activeGroup, selectedPromptId, selectedProductId, keyword }) => {
  const mediaFiles = JSON.parse(activeGroup.media_files)
  const analysis = await AIService.describeMedia(mediaFiles[0], projectId)
  const keywords = await AIService.analyzeAndRecommendKeywords(analysis)
  
  const prompts = dbService.getPrompts()
  const platformPrompts: Record<string, string> = {}
  
  const platforms = [...new Set(pages.map((p: any) => p.platform))]
  platforms.forEach(plat => {
    // Find prompt for this platform/project
    const pMatch = prompts.find((p: any) => {
      const pjIds = JSON.parse(p.project_ids || '[]')
      const plats = JSON.parse(p.platforms || '[]')
      return pjIds.includes(projectId) && plats.includes(plat)
    })
    if (pMatch) platformPrompts[plat as string] = (pMatch as any).content
  })

  // Fallback to selectedPromptId if no platform-specific prompt found
  if (Object.keys(platformPrompts).length === 0 && selectedPromptId) {
    const selectedP = prompts.find((p: any) => p.id === Number(selectedPromptId))
    if (selectedP) {
      platforms.forEach(plat => { platformPrompts[plat as string] = (selectedP as any).content })
    }
  }

  const systemPromptRecord = dbService.getSetting('automation_batch_system_prompt') as any
  const defaultPrompt = `BẠN LÀ CHUYÊN GIA SÁNG TẠO NỘI DUNG MẠNG XÃ HỘI.
NHIỆM VỤ: Viết bài độc nhất cho từng trang mục tiêu.
ĐỊNH DẠNG TRẢ VỀ: JSON hợp lệ với cấu trúc:
{
  "Facebook": [{ "pageId": number, "pageName": "string", "title": "string", "content": "string", "hashtags": "string", "comment": "string" }],
  "TikTok": [...],
  "YouTube": [...]
}
LƯU Ý: Mỗi bài viết phải khác nhau hoàn toàn. Chỉ trả về JSON.`;

  const systemPrompt = systemPromptRecord ? decrypt(systemPromptRecord.encrypted_value) : defaultPrompt;

  return await AIService.generateBatchContent({
    pages,
    platformPrompts,
    systemPrompt,
    analysis,
    keywords,
    projectId
  })
})

// ── Phase 4: Scheduling & Timeline ───────────────────────────────────────────

ipcMain.handle('db:get-schedule-settings', (_, projectId) => dbService.getScheduleSettings(projectId))
ipcMain.handle('db:save-schedule-settings', (_, data) => dbService.saveScheduleSettings(data))
ipcMain.handle('db:update-post-schedule', (_, { id, scheduledAt, status }) => dbService.updatePostSchedule(id, scheduledAt, status))

ipcMain.handle('scheduler:run', (_, projectId) => Scheduler.distributeSchedules(projectId))

// ── Phase 5: Execution Engine ────────────────────────────────────────────────

ipcMain.handle('engine:start', () => posterEngine?.start())
ipcMain.handle('engine:stop', () => posterEngine?.stop())
ipcMain.handle('engine:status', () => posterEngine?.getStatus())

// ── Automation Engine (Smart Sync & Auto-Gen) ────────────────────────────────

ipcMain.handle('automation:save-setting', (_, { key, value }) => {
    return dbService.saveSetting(key, encrypt(String(value ?? '')))
})

ipcMain.handle('automation:get-setting', (_, key) => {
    const record = dbService.getSetting(key) as any
    if (!record) return ''
    try {
      return decrypt(record.encrypted_value)
    } catch {
      return record.encrypted_value
    }
})

ipcMain.handle('automation:select-root', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled) return null
    return result.filePaths[0]
})

ipcMain.handle('automation:sync-now', async () => {
    if ((global as any).automationEngine) {
        await (global as any).automationEngine.runSyncCycle()
        return { success: true }
    }
    return { success: false, error: 'Engine not initialized' }
})

ipcMain.handle('automation:get-gen-status', async () => {
    if ((global as any).automationEngine) {
        return (global as any).automationEngine.getGenStatus()
    }
    return { isGenerating: false, status: '' }
})

ipcMain.handle('automation:trigger-smart-gen', async (_, options) => {
    if ((global as any).automationEngine) {
        return (global as any).automationEngine.triggerManualGen(options)
    }
    return { success: false, error: 'Engine not initialized' }
})

// ── Health Check ─────────────────────────────────────────────────────────────

// ── Health Check ─────────────────────────────────────────────────────────────

ipcMain.handle('browser:check-health-single', async (_, pageId: number) => {
    return AutomationService.checkPageHealth(pageId, (msg) => {
        mainWindow?.webContents.send('engine:log', msg)
    })
})

ipcMain.handle('automation:sync-page-info', async (_, pageId: number) => {
    return AutomationService.syncPageInfo(pageId, (msg) => {
        mainWindow?.webContents.send('engine:log', msg)
    })
})

ipcMain.handle('browser:check-health-all', async () => {
    const pages = dbService.getPages() as any[]
    for (const page of pages) {
        await AutomationService.checkPageHealth(page.id, (msg) => {
            mainWindow?.webContents.send('engine:log', msg)
        })
    }
    return { success: true }
})

// ── App Lifetime ─────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    mainWindow = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Handle media:// protocol for local file access
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('path')
      
      if (filePath) {
        // Path normalization is often helpful on Windows
        const normalizedPath = path.normalize(filePath)
        
        // Ensure the file exists before attempting fetch
        try {
            await fs.access(normalizedPath)
            return net.fetch(pathToFileURL(normalizedPath).toString())
        } catch (err) {
            console.error('[Protocol] File not accessible:', normalizedPath)
            return new Response('File not found', { status: 404 })
        }
      }
      
      return new Response('Media Path Missing', { status: 400 })
    } catch (error) {
      console.error('Media protocol error:', error)
      return new Response('Protocol Error', { status: 500 })
    }
  })
  
  createWindow()
})
