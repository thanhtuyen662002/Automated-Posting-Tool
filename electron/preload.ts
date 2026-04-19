import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: any, ...args: any[]) => void) {
    const wrappedListener = (event: any, ...args: any[]) => listener(event, ...args)
    ipcRenderer.on(channel, wrappedListener)
    return () => ipcRenderer.removeListener(channel, wrappedListener)
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, listener] = args
    return ipcRenderer.off(channel, listener)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // Custom APIs for the app
  getProjects: () => ipcRenderer.invoke('db:get-projects'),
  addProject: (name: string, platforms: string[]) => ipcRenderer.invoke('db:add-project', name, platforms),
  updateProject: (id: number, name: string, platforms: string[]) => ipcRenderer.invoke('db:update-project', { id, name, platforms }),
  deleteProject: (id: number) => ipcRenderer.invoke('db:delete-project', id),
  
  getPages: (projectId?: number) => ipcRenderer.invoke('db:get-pages', projectId),
  addPage: (data: any) => ipcRenderer.invoke('db:add-page', data),
  deletePage: (id: number) => ipcRenderer.invoke('db:delete-page', id),

  getPosts: (projectId?: number) => ipcRenderer.invoke('db:get-posts', projectId),
  addPost: (data: any) => ipcRenderer.invoke('db:add-post', data),
  deletePost: (id: number) => ipcRenderer.invoke('db:delete-post', id),
  updatePost: (id: number, data: any) => ipcRenderer.invoke('db:update-post', { id, data }),
  getStats: () => ipcRenderer.invoke('db:get-stats'),
  getLogs: (limit?: number, projectId?: number) => ipcRenderer.invoke('db:get-logs', limit, projectId),
  addLog: (data: any) => ipcRenderer.invoke('db:add-log', data),

  saveApiKey: (key: string, value: string) => ipcRenderer.invoke('settings:save-api-key', { key, value }),
  getApiKey: (key: string) => ipcRenderer.invoke('settings:get-api-key', key),

  getPrompts: (type?: string) => ipcRenderer.invoke('db:get-prompts', type),
  addPrompt: (data: any) => ipcRenderer.invoke('db:add-prompt', data),
  updatePrompt: (id: number, data: any) => ipcRenderer.invoke('db:update-prompt', { id, data }),
  deletePrompt: (id: number) => ipcRenderer.invoke('db:delete-prompt', id),

  getProducts: (projectId?: number) => ipcRenderer.invoke('db:get-products', projectId),
  addProduct: (data: any) => ipcRenderer.invoke('db:add-product', data),
  deleteProduct: (id: number) => ipcRenderer.invoke('db:delete-product', id),
  openImage: () => ipcRenderer.invoke('dialog:open-image'),

  scanDirectory: () => ipcRenderer.invoke('fs:scan-directory'),
  getContentGroups: (projectId?: number) => ipcRenderer.invoke('db:get-content-groups', projectId),
  addContentGroup: (data: any) => ipcRenderer.invoke('db:add-content-group', data),
  deleteContentGroup: (id: number) => ipcRenderer.invoke('db:delete-content-group', id),
  generatePost: (data: { promptId: number; keyword: string }) => ipcRenderer.invoke('ai:generate-post', data),
  generateCTA: (data: { promptId: number; productId?: number; postContext?: any }) => ipcRenderer.invoke('ai:generate-cta', data),
  analyzeMedia: (filePath: string) => ipcRenderer.invoke('ai:analyze-media', filePath),

  getScheduleSettings: (projectId: number) => ipcRenderer.invoke('db:get-schedule-settings', projectId),
  saveScheduleSettings: (data: any) => ipcRenderer.invoke('db:save-schedule-settings', data),
  updatePostSchedule: (data: { id: number; scheduledAt: string; status?: string }) => ipcRenderer.invoke('db:update-post-schedule', data),
  runScheduler: (projectId?: number) => ipcRenderer.invoke('scheduler:run', projectId),

  startEngine: () => ipcRenderer.invoke('engine:start'),
  stopEngine: () => ipcRenderer.invoke('engine:stop'),
  getEngineStatus: () => ipcRenderer.invoke('engine:status'),
  onEngineLog: (callback: (msg: string) => void) => {
    const subscription = (_event: any, msg: string) => callback(msg)
    ipcRenderer.on('engine:log', subscription)
    return () => ipcRenderer.removeListener('engine:log', subscription)
  },

  checkHealthAll: () => ipcRenderer.invoke('browser:check-health-all'),
  checkHealthSingle: (pageId: number) => ipcRenderer.invoke('browser:check-health-single', pageId),
  
  launchBrowser: (pageId: number) => ipcRenderer.invoke('browser:launch', pageId),
  runPost: (pageId: number, postId: number) => ipcRenderer.invoke('automation:run-post', { pageId, postId }),
    onBrowserClosed: (callback: (pageId: number) => void) => {
    const listener = (_: any, pageId: number) => callback(pageId)
    ipcRenderer.on('browser:closed', listener)
    return () => ipcRenderer.removeListener('browser:closed', listener)
  },

  // Automation Engine
  saveAutomationSetting: (key: string, value: string) => ipcRenderer.invoke('automation:save-setting', { key, value }),
  getAutomationSetting: (key: string) => ipcRenderer.invoke('automation:get-setting', key),
  selectAutomationRoot: () => ipcRenderer.invoke('automation:select-root'),
  syncAutomationNow: () => ipcRenderer.invoke('automation:sync-now'),
  getAutomationGenStatus: () => ipcRenderer.invoke('automation:get-gen-status'),
  triggerSmartGen: (options?: any) => ipcRenderer.invoke('automation:trigger-smart-gen', options)
})
