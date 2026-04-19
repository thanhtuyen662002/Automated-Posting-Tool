import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'

const isDev = !app.isPackaged
const dbPath = isDev 
  ? path.join(process.cwd(), 'data.db')
  : path.join(app.getPath('userData'), 'data.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    UNIQUE NOT NULL,
    platforms  TEXT    DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL,
    platform     TEXT    NOT NULL,
    page_name    TEXT    NOT NULL,
    page_url     TEXT,
    profile_dir  TEXT,
    is_logged_in INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL,
    page_id      INTEGER NOT NULL,
    title        TEXT,
    content      TEXT,
    media_path   TEXT,
    status       TEXT    DEFAULT 'pending', -- pending, scheduled, completed, failed
    scheduled_at TIMESTAMP,
    comment_cta  TEXT,
    shopee_link  TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (page_id)    REFERENCES pages(id)    ON DELETE CASCADE
  );
`);

// Migration for comment_cta & shopee_link
try {
  db.exec("ALTER TABLE posts ADD COLUMN comment_cta TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE posts ADD COLUMN shopee_link TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN platforms TEXT DEFAULT '[]'");
} catch (e) {}

try {
  db.exec("ALTER TABLE prompts ADD COLUMN project_ids TEXT DEFAULT '[]'");
} catch (e) {}

try {
  db.exec("ALTER TABLE prompts ADD COLUMN platforms TEXT DEFAULT '[]'");
} catch (e) {}

try {
  db.exec("ALTER TABLE schedule_settings ADD COLUMN max_posts_per_day INTEGER DEFAULT 3");
} catch (e) {}

db.exec(`

  CREATE TABLE IF NOT EXISTS content_groups (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL,
    name         TEXT    NOT NULL,
    media_files  TEXT    NOT NULL, -- JSON array of file paths
    status       TEXT    DEFAULT 'draft',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedule_settings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER UNIQUE NOT NULL,
    time_windows TEXT    NOT NULL, -- JSON array ["09:00-11:00", "19:00-22:00"]
    min_interval INTEGER DEFAULT 30, -- In minutes
    auto_schedule INTEGER DEFAULT 0, -- Boolean
    max_posts_per_day INTEGER DEFAULT 3, 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id      INTEGER,
    project_id   INTEGER,
    type         TEXT    NOT NULL,
    status       TEXT    CHECK(status IN ('success', 'failure', 'warning')) NOT NULL,
    message      TEXT    NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id)    REFERENCES pages(id)    ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key_name        TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    type        TEXT    NOT NULL, -- Post, Comment, Rewrite
    content     TEXT    NOT NULL,
    project_ids TEXT    DEFAULT '[]',
    platforms   TEXT    DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS products (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    shopee_link TEXT,
    web_link    TEXT,
    zalo_link   TEXT,
    image_path  TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  -- Migration for Phase 1/5 stability
  UPDATE pages SET profile_dir = 'default_profile_' || id WHERE profile_dir IS NULL;
`)

// Migrate old profile paths to the new centralized location if necessary
try {
  const userDataPath = app.getPath('userData')
  const rootPath = isDev ? process.cwd() : path.dirname(app.getPath('exe'))
  
  if (userDataPath !== rootPath) {
    db.prepare("UPDATE pages SET profile_dir = REPLACE(profile_dir, ?, ?) WHERE profile_dir LIKE ?")
      .run(userDataPath, rootPath, `%${userDataPath}%`)
  }

  // Handle default_profile_* folders that were recently moved from root to browser_profiles
  const pagesToFix = db.prepare("SELECT id, profile_dir FROM pages WHERE profile_dir LIKE 'default_profile_%' OR (profile_dir NOT LIKE '%browser_profiles%' AND profile_dir NOT LIKE '%/%' AND profile_dir NOT LIKE '%\\%')").all() as any[]
  
  for (const p of pagesToFix) {
    const newPath = path.join(rootPath, 'browser_profiles', path.basename(p.profile_dir))
    db.prepare("UPDATE pages SET profile_dir = ? WHERE id = ?").run(newPath, p.id)
  }
} catch (e) {
  console.error('Migration failed:', e)
}

export interface Project {
  id: number
  name: string
  platforms: string // JSON string
  created_at: string
  // Virtual fields
  pages_count?: number
  posts_count?: number
}

export interface Page {
  id: number
  project_id: number
  platform: string
  page_name: string
  page_url: string
  profile_dir: string
  is_logged_in: number
}

export interface Post {
  id: number
  project_id: number
  page_id: number
  title: string
  content: string
  media_path: string
  status: 'pending' | 'scheduled' | 'processing' | 'published' | 'failed'
  scheduled_at: string
  comment_cta: string
  shopee_link: string
  created_at: string
}

export interface ScheduleSettings {
  id: number
  project_id: number
  time_windows: string // JSON string
  min_interval: number
  max_posts_per_day: number
}

export const dbService = {
  // Projects
  getProjects(): Project[] {
    return db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM pages WHERE project_id = p.id) as pages_count,
        (SELECT COUNT(*) FROM posts WHERE project_id = p.id) as posts_count
      FROM projects p
      ORDER BY created_at DESC
    `).all() as Project[]
  },
  addProject(name: string, platforms: string[] = []) {
    const info = db.prepare('INSERT INTO projects (name, platforms) VALUES (?, ?)').run(name, JSON.stringify(platforms))
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid)
  },
  updateProject(id: number, name: string, platforms: string[]) {
    return db.prepare('UPDATE projects SET name = ?, platforms = ? WHERE id = ?').run(name, JSON.stringify(platforms), id)
  },
  deleteProject(id: number) {
    return db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  },

  // Pages
  getPages(projectId?: number): Page[] {
    if (projectId) {
      return db.prepare('SELECT * FROM pages WHERE project_id = ?').all(projectId) as Page[]
    }
    return db.prepare('SELECT * FROM pages').all() as Page[]
  },
  addPage(data: any) {
    const { project_id, platform, page_name, page_url, profile_dir } = data
    const info = db.prepare(`
      INSERT INTO pages (project_id, platform, page_name, page_url, profile_dir)
      VALUES (?, ?, ?, ?, ?)
    `).run(project_id, platform, page_name, page_url, profile_dir)
    return db.prepare('SELECT * FROM pages WHERE id = ?').get(info.lastInsertRowid)
  },
  deletePage(id: number) {
    return db.prepare('DELETE FROM pages WHERE id = ?').run(id)
  },
  updatePageLoginStatus(id: number, status: number) {
    return db.prepare('UPDATE pages SET is_logged_in = ? WHERE id = ?').run(status, id)
  },

  // Posts
  getPosts(projectId?: number): Post[] {
    if (projectId) {
      return db.prepare('SELECT * FROM posts WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Post[]
    }
    return db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all() as Post[]
  },
  getPendingPosts() {
    return db.prepare("SELECT * FROM posts WHERE status = 'pending' OR status = 'scheduled' ORDER BY scheduled_at ASC").all()
  },
  addPost(data: any) {
    const { project_id, page_id, title, content, media_path, scheduled_at, comment_cta, shopee_link } = data
    const info = db.prepare(`
      INSERT INTO posts (project_id, page_id, title, content, media_path, scheduled_at, comment_cta, shopee_link)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(project_id, page_id, title, content, media_path, scheduled_at, comment_cta, shopee_link)
    return db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid)
  },
  updatePostStatus(id: number, status: string) {
    return db.prepare('UPDATE posts SET status = ? WHERE id = ?').run(status, id)
  },
  deletePost(id: number) {
    return db.prepare('DELETE FROM posts WHERE id = ?').run(id)
  },
  updatePost(id: number, data: any) {
    const { title, content, comment_cta, shopee_link, status } = data
    
    if (status) {
      return db.prepare('UPDATE posts SET title = ?, content = ?, comment_cta = ?, shopee_link = ?, status = ? WHERE id = ?')
        .run(title, content, comment_cta, shopee_link, status, id)
    }
    
    return db.prepare('UPDATE posts SET title = ?, content = ?, comment_cta = ?, shopee_link = ? WHERE id = ?')
      .run(title, content, comment_cta, shopee_link, id)
  },

  // Scheduling (Phase 4)
  getScheduleSettings(projectId: number): ScheduleSettings | undefined {
    return db.prepare('SELECT * FROM schedule_settings WHERE project_id = ?').get(projectId) as ScheduleSettings | undefined
  },
  saveScheduleSettings(data: any) {
    const { project_id, time_windows, min_interval, max_posts_per_day } = data
    return db.prepare(`
      INSERT INTO schedule_settings (project_id, time_windows, min_interval, max_posts_per_day)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET 
        time_windows = excluded.time_windows,
        min_interval = excluded.min_interval,
        max_posts_per_day = excluded.max_posts_per_day
    `).run(project_id, JSON.stringify(time_windows), min_interval, max_posts_per_day || 3)
  },
  getPostsByStatus(status: string): Post[] {
    return db.prepare('SELECT * FROM posts WHERE status = ? ORDER BY created_at ASC').all(status) as Post[]
  },
  updatePostSchedule(id: number, scheduledAt: string, status: string = 'scheduled') {
    return db.prepare('UPDATE posts SET scheduled_at = ?, status = ? WHERE id = ?').run(scheduledAt, status, id)
  },

  // Content Groups (Phase 3)
  getContentGroups(projectId?: number) {
    if (projectId) {
      return db.prepare('SELECT * FROM content_groups WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
    }
    return db.prepare('SELECT * FROM content_groups ORDER BY created_at DESC').all()
  },
  addContentGroup(data: any) {
    const { project_id, name, media_files } = data
    const info = db.prepare('INSERT INTO content_groups (project_id, name, media_files) VALUES (?, ?, ?)').run(project_id, name, JSON.stringify(media_files))
    return db.prepare('SELECT * FROM content_groups WHERE id = ?').get(info.lastInsertRowid)
  },
  deleteContentGroup(id: number) {
    return db.prepare('DELETE FROM content_groups WHERE id = ?').run(id)
  },
  updateContentGroupStatus(id: number, status: string) {
    return db.prepare('UPDATE content_groups SET status = ? WHERE id = ?').run(status, id)
  },

  // Phase 2: Settings, Prompts, Products
  getSetting(key: string) {
    return db.prepare('SELECT encrypted_value FROM settings WHERE key_name = ?').get(key)
  },
  saveSetting(key: string, value: string) {
    return db.prepare(`
      INSERT INTO settings (key_name, encrypted_value)
      VALUES (?, ?)
      ON CONFLICT(key_name) DO UPDATE SET encrypted_value = excluded.encrypted_value
    `).run(key, value)
  },

  getPrompts(type?: string) {
    if (type) {
      return db.prepare('SELECT * FROM prompts WHERE type = ?').all(type)
    }
    return db.prepare('SELECT * FROM prompts').all()
  },
  addPrompt(data: any) {
    const { name, type, content, project_ids = [], platforms = [] } = data
    const info = db.prepare('INSERT INTO prompts (name, type, content, project_ids, platforms) VALUES (?, ?, ?, ?, ?)').run(name, type, content, JSON.stringify(project_ids), JSON.stringify(platforms))
    return db.prepare('SELECT * FROM prompts WHERE id = ?').get(info.lastInsertRowid)
  },
  updatePrompt(id: number, data: any) {
    const { name, type, content, project_ids = [], platforms = [] } = data
    return db.prepare('UPDATE prompts SET name = ?, type = ?, content = ?, project_ids = ?, platforms = ? WHERE id = ?')
      .run(name, type, content, JSON.stringify(project_ids), JSON.stringify(platforms), id)
  },
  deletePrompt(id: number) {
    return db.prepare('DELETE FROM prompts WHERE id = ?').run(id)
  },

  getProducts(projectId?: number) {
    if (projectId) {
      return db.prepare('SELECT * FROM products WHERE project_id = ?').all(projectId)
    }
    return db.prepare('SELECT * FROM products').all()
  },
  addProduct(data: any) {
    const { project_id, name, shopee_link, web_link, zalo_link, image_path } = data
    const info = db.prepare(`
      INSERT INTO products (project_id, name, shopee_link, web_link, zalo_link, image_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(project_id, name, shopee_link, web_link, zalo_link, image_path)
    return db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)
  },
  deleteProduct(id: number) {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id)
  },

  // Stats
  getStats() {
    const projectsCount = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }).count
    const pagesCount = (db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number }).count
    
    // Detailed post stats
    const scheduled = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'scheduled'").get() as { count: number }).count
    const pending = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'pending'").get() as { count: number }).count
    const published = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'published'").get() as { count: number }).count
    const failed = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'failed'").get() as { count: number }).count
    
    return {
      projects: projectsCount,
      pages: pagesCount,
      posts_scheduled: scheduled,
      posts_pending: pending,
      posts_published: published,
      posts_failed: failed,
      pendingPosts: scheduled + pending // For backward compatibility
    }
  },

  // Logs
  getLogs(limit = 50, projectId?: number) {
    let query = `
      SELECT l.*, p.page_name as source_name
      FROM activity_logs l
      LEFT JOIN pages p ON l.page_id = p.id
    `
    const params: any[] = []
    
    if (projectId) {
      query += ' WHERE l.project_id = ? '
      params.push(projectId)
    }
    
    query += ' ORDER BY l.created_at DESC LIMIT ? '
    params.push(limit)
    
    return db.prepare(query).all(...params)
  },
  addLog(data: any) {
    const { page_id, project_id, type, status, message } = data
    return db.prepare(`
      INSERT INTO activity_logs (page_id, project_id, type, status, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(page_id, project_id, type, status, message)
  }
}
