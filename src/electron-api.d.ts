export interface Project {
  id: number;
  name: string;
  platforms?: string; // JSON string
  created_at: string;
  pages_count?: number;
  posts_count?: number;
}

export interface Page {
  id: number;
  project_id: number;
  platform: string;
  page_name: string;
  page_url: string;
  profile_dir: string;
  is_logged_in: number;
}

export interface Post {
  id: number;
  project_id: number;
  page_id: number;
  title: string;
  content: string;
  media_path: string;
  status: string;
  scheduled_at: string;
  comment_cta: string;
  shopee_link: string;
  created_at: string;
}

export interface DashboardStats {
  projects: number;
  pages: number;
  posts_scheduled: number;
  posts_pending: number;
  posts_published: number;
  posts_failed: number;
  pendingPosts: number;
}

export interface ActivityLog {
  id: number;
  page_id?: number;
  project_id?: number;
  type: string;
  status: 'success' | 'failure' | 'warning';
  message: string;
  created_at: string;
  // field for UI
  source_name?: string;
}

export interface IpcRendererAPI {
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => () => void;
  off: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;

  getProjects: () => Promise<Project[]>;
  addProject: (name: string, platforms: string[]) => Promise<Project>;
  updateProject: (id: number, name: string, platforms: string[]) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  
  getPages: (projectId?: number) => Promise<Page[]>;
  addPage: (data: any) => Promise<Page>;
  deletePage: (id: number) => Promise<void>;

  getPosts: (projectId?: number) => Promise<Post[]>;
  addPost: (data: any) => Promise<Post>;
  deletePost: (id: number) => Promise<void>;
  updatePost: (id: number, data: any) => Promise<void>;
  getStats: () => Promise<DashboardStats>;
  getLogs: (limit?: number, projectId?: number) => Promise<ActivityLog[]>;
  addLog: (data: any) => Promise<any>;

  saveApiKey: (key: string, value: string) => Promise<any>;
  getApiKey: (key: string) => Promise<string>;

  getPrompts: (type?: string) => Promise<any[]>;
  addPrompt: (data: any) => Promise<any>;
  updatePrompt: (id: number, data: any) => Promise<void>;
  deletePrompt: (id: number) => Promise<void>;

  getProducts: (projectId?: number) => Promise<any[]>;
  addProduct: (data: any) => Promise<any>;
  deleteProduct: (id: number) => Promise<void>;
  openImage: () => Promise<string | undefined>;

  scanDirectory: () => Promise<string[]>;
  getContentGroups: (projectId?: number) => Promise<any[]>;
  addContentGroup: (data: any) => Promise<any>;
  deleteContentGroup: (id: number) => Promise<void>;
  generatePost: (data: { promptId: number; keyword: string }) => Promise<string>;
  generateCTA: (data: { promptId: number; productId?: number; postContext?: any }) => Promise<string>;
  analyzeMedia: (filePath: string) => Promise<string>;

  getScheduleSettings: (projectId: number) => Promise<any>;
  saveScheduleSettings: (data: any) => Promise<any>;
  updatePostSchedule: (data: { id: number; scheduledAt: string; status?: string }) => Promise<void>;
  runScheduler: (projectId?: number) => Promise<{ count: number }>;

  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  getEngineStatus: () => Promise<boolean>;
  onEngineLog: (callback: (msg: string) => void) => () => void;

  onBrowserClosed: (callback: (pageId: number) => void) => () => void;

  checkHealthAll: () => Promise<{ success: boolean }>;
  checkHealthSingle: (pageId: number) => Promise<{ success: boolean; status: number }>;

  launchBrowser: (pageId: number) => Promise<{ success: boolean; error?: string }>;
  runPost: (pageId: number, postId: number) => Promise<{ success: boolean; error?: string }>;

  // Automation Engine
  saveAutomationSetting: (key: string, value: string) => Promise<any>;
  getAutomationSetting: (key: string) => Promise<string>;
  selectAutomationRoot: () => Promise<string | null>;
  syncAutomationNow: () => Promise<{ success: boolean; error?: string }>;
  getAutomationGenStatus: () => Promise<{ isGenerating: boolean; status: string }>;
  triggerSmartGen: (options?: any) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    ipcRenderer: IpcRendererAPI;
  }
}
