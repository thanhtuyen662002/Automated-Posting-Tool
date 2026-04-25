import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import crypto from 'node:crypto'
import { POST_STATUS, PostStatus, normalizePostStatus } from './post_status'

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
    name       TEXT    UNIQUE,
    platforms  TEXT    DEFAULT '[]',
    ai_config  TEXT    DEFAULT '{"provider":"google","model":"gemini-1.5-flash"}',
    watermark_config TEXT DEFAULT '{"position":"top-right","size":0.12,"margin":20,"opacity":0.8,"showText":true}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER, -- Nullable for global accounts
    platform     TEXT    NOT NULL,
    account_name TEXT    NOT NULL,
    profile_dir  TEXT,
    is_logged_in INTEGER DEFAULT 0,
    proxy        TEXT    DEFAULT '',
    proxy_type   TEXT    DEFAULT 'static', -- none, static, tmproxy, tinproxy
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL,
    account_id   INTEGER,
    platform     TEXT    NOT NULL,
    page_name    TEXT    NOT NULL,
    page_url     TEXT,
    handle       TEXT, -- e.g. @thanhtuyen
    avatar_url   TEXT, -- local path or remote URL
    profile_dir  TEXT,
    is_logged_in INTEGER DEFAULT 0,
    proxy        TEXT    DEFAULT '',
    proxy_type   TEXT    DEFAULT 'static', -- none, static, tmproxy, tinproxy
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL,
    page_id      INTEGER NOT NULL,
    title        TEXT,
    content      TEXT,
    media_path   TEXT,
    status       TEXT    DEFAULT 'draft', -- draft, approved, scheduled, processing, published, failed
    scheduled_at TIMESTAMP,
    processing_started_at TIMESTAMP,
    idempotency_key TEXT,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
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
  db.exec("ALTER TABLE posts ADD COLUMN processing_started_at TIMESTAMP");
} catch (e) {}
try {
  db.exec("ALTER TABLE posts ADD COLUMN idempotency_key TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE posts ADD COLUMN attempts INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE posts ADD COLUMN last_error TEXT");
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

try {
  db.exec("ALTER TABLE projects ADD COLUMN ai_config TEXT DEFAULT '{\"provider\":\"google\",\"model\":\"gemini-1.5-flash\"}'");
} catch (e) {}

try {
  db.exec("ALTER TABLE pages ADD COLUMN account_id INTEGER");
} catch (e) {}

try {
  db.exec("ALTER TABLE pages ADD COLUMN handle TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE pages ADD COLUMN avatar_url TEXT");
} catch (e) {}
try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON posts(status, scheduled_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_idempotency_key ON posts(idempotency_key)");
} catch (e) {}
try {
  // Normalize legacy statuses to unified state machine
  db.exec(`
    UPDATE posts SET status = 'processing' WHERE status IN ('in-progress');
    UPDATE posts SET status = 'published' WHERE status IN ('completed');
    UPDATE posts SET status = 'draft' WHERE status IN ('pending');
    UPDATE posts SET status = 'failed' WHERE status NOT IN ('draft','approved','scheduled','processing','published','failed');
  `)
} catch (e) {}

try {
  db.exec("ALTER TABLE posts ADD COLUMN post_url TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE posts ADD COLUMN comment_status TEXT DEFAULT 'pending'");
} catch (e) {}
try {
  db.exec("ALTER TABLE posts ADD COLUMN comment_error TEXT");
} catch (e) {}
try {
  // Post-migration: if no comment_cta, set status to none
  db.exec("UPDATE posts SET comment_status = 'none' WHERE comment_cta IS NULL OR comment_cta = ''");
} catch (e) {}

// Migration for project-agnostic accounts
try {
  const tableInfo = db.prepare("PRAGMA table_info(accounts)").all() as any[]
  const projectIdInfo = tableInfo.find(c => c.name === 'project_id')
  if (projectIdInfo && projectIdInfo.notnull === 1) {
    console.log('[DB Migration] Removing NOT NULL constraint from accounts.project_id...')
    db.exec(`
      PRAGMA foreign_keys=OFF;
      BEGIN TRANSACTION;
      CREATE TABLE accounts_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id   INTEGER,
        platform     TEXT    NOT NULL,
        account_name TEXT    NOT NULL,
        profile_dir  TEXT,
        is_logged_in INTEGER DEFAULT 0,
        proxy        TEXT    DEFAULT '',
        proxy_type   TEXT    DEFAULT 'static',
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      INSERT INTO accounts_new SELECT * FROM accounts;
      DROP TABLE accounts;
      ALTER TABLE accounts_new RENAME TO accounts;
      COMMIT;
      PRAGMA foreign_keys=ON;
    `)
  }
} catch (e) {
  console.error('[DB Migration Error] Making project_id nullable failed:', e)
}

// Migration script: Move page profile/proxy info to accounts
try {
  const pagesWithoutAccount = db.prepare("SELECT * FROM pages WHERE account_id IS NULL").all() as any[]
  if (pagesWithoutAccount.length > 0) {
    console.log(`[DB Migration] Moving ${pagesWithoutAccount.length} pages to account-centric model...`)
    for (const p of pagesWithoutAccount) {
      // 1. Create a dummy account for each existing page to preserve its settings
      const info = db.prepare(`
        INSERT INTO accounts (project_id, platform, account_name, profile_dir, is_logged_in, proxy, proxy_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        p.project_id, 
        p.platform, 
        p.page_name, // Use page name as account name for migration
        p.profile_dir, 
        p.is_logged_in, 
        p.proxy || '', 
        p.proxy_type || 'static'
      )
      
      const accountId = info.lastInsertRowid
      
      // 2. Link page to the new account
      db.prepare("UPDATE pages SET account_id = ? WHERE id = ?").run(accountId, p.id)
    }
  }
} catch (e) {
  console.error('[DB Migration Error] Migrating pages to accounts failed:', e)
}

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
  ai_config: string // JSON string {"provider": string, "model": string}
  created_at: string
  // Virtual fields
  pages_count?: number
  posts_count?: number
}

export interface Account {
  id: number
  project_id: number
  platform: string
  account_name: string
  profile_dir: string
  is_logged_in: number
  proxy: string
  proxy_type: string
  created_at: string
}

export interface Page {
  id: number
  project_id: number
  account_id: number
  platform: string
  page_name: string
  page_url: string
  handle?: string
  avatar_url?: string
  profile_dir?: string
  is_logged_in?: number
  proxy?: string
  proxy_type?: string
  cookies?: string
  user_agent?: string
}

export interface Post {
  id: number
  project_id: number
  page_id: number
  title: string
  content: string
  media_path: string
  status: PostStatus
  scheduled_at: string
  comment_cta: string
  shopee_link: string
  created_at: string
  post_url?: string
  comment_status?: string
  comment_error?: string
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
  addProject(name: string, platforms: string[] = [], aiConfig?: any) {
    const config = aiConfig || { provider: 'google', model: 'gemini-1.5-flash' }
    const info = db.prepare('INSERT INTO projects (name, platforms, ai_config) VALUES (?, ?, ?)').run(name, JSON.stringify(platforms), JSON.stringify(config))
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid)
  },
  updateProject(id: number, name: string, platforms: string[], aiConfig?: any) {
    if (aiConfig) {
      return db.prepare('UPDATE projects SET name = ?, platforms = ?, ai_config = ? WHERE id = ?').run(name, JSON.stringify(platforms), JSON.stringify(aiConfig), id)
    }
    return db.prepare('UPDATE projects SET name = ?, platforms = ? WHERE id = ?').run(name, JSON.stringify(platforms), id)
  },
  deleteProject(id: number) {
    return db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  },

  // Accounts
  getAccounts(projectId?: number): Account[] {
    if (projectId) {
      return db.prepare('SELECT * FROM accounts WHERE project_id = ? OR project_id IS NULL ORDER BY created_at DESC').all(projectId) as Account[]
    }
    return db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as Account[]
  },
  addAccount(data: any) {
    const { project_id, platform, account_name, profile_dir, proxy, proxy_type } = data
    // Convert empty string or 0 to null for global accounts
    const pid = (project_id === '' || project_id === '0' || project_id === 0) ? null : Number(project_id)
    
    const info = db.prepare(`
      INSERT INTO accounts (project_id, platform, account_name, profile_dir, proxy, proxy_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(pid, platform, account_name, profile_dir, proxy || '', proxy_type || 'static')
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid)
  },
  updateAccount(id: number, data: any) {
    const { project_id, platform, account_name, profile_dir, proxy, proxy_type } = data
    const pid = (project_id === '' || project_id === '0' || project_id === 0) ? null : Number(project_id)
    
    return db.prepare(`
      UPDATE accounts 
      SET project_id = ?, platform = ?, account_name = ?, profile_dir = ?, proxy = ?, proxy_type = ? 
      WHERE id = ?
    `).run(pid, platform, account_name, profile_dir, proxy || '', proxy_type || 'static', id)
  },
  deleteAccount(id: number) {
    return db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
  },
  updateAccountLoginStatus(id: number, status: number) {
    return db.prepare('UPDATE accounts SET is_logged_in = ? WHERE id = ?').run(status, id)
  },

  // Pages
  getPages(projectId?: number): Page[] {
    if (projectId) {
      return db.prepare('SELECT * FROM pages WHERE project_id = ?').all(projectId) as Page[]
    }
    return db.prepare('SELECT * FROM pages').all() as Page[]
  },
  addPage(data: any) {
    const { project_id, account_id, platform, page_name, page_url, handle, avatar_url } = data
    const info = db.prepare(`
      INSERT INTO pages (project_id, account_id, platform, page_name, page_url, handle, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(project_id, account_id, platform, page_name, page_url, handle, avatar_url)
    return db.prepare('SELECT * FROM pages WHERE id = ?').get(info.lastInsertRowid)
  },
  deletePage(id: number) {
    return db.prepare('DELETE FROM pages WHERE id = ?').run(id)
  },
  updatePage(id: number, data: any) {
    const { project_id, account_id, platform, page_name, page_url, handle, avatar_url } = data
    return db.prepare(`
      UPDATE pages 
      SET project_id = ?, account_id = ?, platform = ?, page_name = ?, page_url = ?, handle = ?, avatar_url = ? 
      WHERE id = ?
    `).run(project_id, account_id, platform, page_name, page_url, handle, avatar_url, id)
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
  getPostById(id: number): Post | undefined {
    return db.prepare('SELECT * FROM posts WHERE id = ? LIMIT 1').get(id) as Post | undefined
  },
  getPostsByIds(ids: number[]): Post[] {
    if (!ids.length) return []
    const placeholders = ids.map(() => '?').join(',')
    return db.prepare(`SELECT * FROM posts WHERE id IN (${placeholders})`).all(...ids) as Post[]
  },
  getDueScheduledPosts(nowIso: string): Post[] {
    return db.prepare(`
      SELECT * FROM posts
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
    `).all(nowIso) as Post[]
  },
  getPendingPosts() {
    return db.prepare("SELECT * FROM posts WHERE status IN ('approved', 'scheduled') ORDER BY scheduled_at ASC").all()
  },
  buildPostIdempotencyKey(data: any): string {
    const raw = `${data.page_id || ''}|${data.media_path || ''}|${data.scheduled_at || ''}|${data.title || ''}`
    return crypto.createHash('sha256').update(raw).digest('hex')
  },
  addPost(data: any) {
    const { project_id, page_id, title, content, media_path, scheduled_at, comment_cta, shopee_link } = data
    const normalizedStatus = normalizePostStatus(data.status)
    const idempotencyKey = this.buildPostIdempotencyKey({ page_id, media_path, scheduled_at, title })
    const info = db.prepare(`
      INSERT INTO posts (project_id, page_id, title, content, media_path, status, scheduled_at, comment_cta, shopee_link, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(project_id, page_id, title, content, media_path, normalizedStatus, scheduled_at, comment_cta, shopee_link, idempotencyKey)
    return db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid)
  },
  updatePostStatus(id: number, status: string, errorMessage?: string) {
    const normalizedStatus = normalizePostStatus(status)
    if (normalizedStatus === POST_STATUS.PROCESSING) {
      return db.prepare('UPDATE posts SET status = ?, processing_started_at = CURRENT_TIMESTAMP, attempts = attempts + 1 WHERE id = ?')
        .run(normalizedStatus, id)
    }
    if (normalizedStatus === POST_STATUS.FAILED) {
      return db.prepare('UPDATE posts SET status = ?, last_error = ?, processing_started_at = NULL WHERE id = ?')
        .run(normalizedStatus, errorMessage || null, id)
    }
    return db.prepare('UPDATE posts SET status = ?, processing_started_at = NULL WHERE id = ?').run(normalizedStatus, id)
  },
  deletePost(id: number) {
    return db.prepare('DELETE FROM posts WHERE id = ?').run(id)
  },
  getPostsMissingLink(): Post[] {
    return db.prepare("SELECT * FROM posts WHERE status = 'published' AND post_url IS NULL AND created_at > datetime('now', '-3 days')").all() as Post[]
  },
  getPostsPendingComment(): Post[] {
    return db.prepare("SELECT * FROM posts WHERE status = 'published' AND post_url IS NOT NULL AND comment_status = 'pending' AND comment_cta IS NOT NULL AND comment_cta != ''").all() as Post[]
  },
  updatePost(id: number, data: any) {
    const fields: string[] = []
    const params: any[] = []

    // Map các trường được phép update
    const allowedFields = [
      'title', 'content', 'comment_cta', 'shopee_link', 'status', 
      'scheduled_at', 'media_path', 'page_id', 'last_error',
      'post_url', 'comment_status', 'comment_error'
    ]
    
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        fields.push(`${key} = ?`)
        params.push(key === 'status' ? normalizePostStatus(data[key]) : data[key])
      }
    }

    if (fields.length === 0) return { changes: 0 }

    params.push(id)
    const sql = `UPDATE posts SET ${fields.join(', ')} WHERE id = ?`
    return db.prepare(sql).run(...params)
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
    return db.prepare('SELECT * FROM posts WHERE status = ? ORDER BY created_at ASC').all(normalizePostStatus(status)) as Post[]
  },
  updatePostSchedule(id: number, scheduledAt: string, status: string = POST_STATUS.SCHEDULED) {
    const normalizedStatus = normalizePostStatus(status)
    return db.prepare('UPDATE posts SET scheduled_at = ?, status = ?, idempotency_key = ? WHERE id = ?')
      .run(scheduledAt, normalizedStatus, this.buildPostIdempotencyKey({ page_id: (db.prepare('SELECT page_id FROM posts WHERE id = ?').get(id) as any)?.page_id, media_path: (db.prepare('SELECT media_path FROM posts WHERE id = ?').get(id) as any)?.media_path, scheduled_at: scheduledAt, title: (db.prepare('SELECT title FROM posts WHERE id = ?').get(id) as any)?.title }), id)
  },
  findStuckProcessingPosts(timeoutMinutes: number) {
    return db.prepare(`
      SELECT * FROM posts
      WHERE status = 'processing'
        AND processing_started_at IS NOT NULL
        AND datetime(processing_started_at) <= datetime('now', ?)
    `).all(`-${timeoutMinutes} minutes`) as Post[]
  },
  markStuckPostsFailed(timeoutMinutes = 30) {
    return db.prepare(`
      UPDATE posts
      SET status = 'failed',
          last_error = COALESCE(last_error, 'processing_timeout'),
          processing_started_at = NULL
      WHERE status = 'processing'
        AND processing_started_at IS NOT NULL
        AND datetime(processing_started_at) <= datetime('now', ?)
    `).run(`-${timeoutMinutes} minutes`)
  },
  hasIdempotencyConflict(idempotencyKey: string, exceptPostId?: number) {
    const row = db.prepare(`
      SELECT id FROM posts
      WHERE idempotency_key = ?
        AND status IN ('processing', 'published')
        ${exceptPostId ? 'AND id != ?' : ''}
      LIMIT 1
    `).get(...(exceptPostId ? [idempotencyKey, exceptPostId] : [idempotencyKey])) as { id: number } | undefined
    return Boolean(row)
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
    const pending = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE status IN ('draft','approved')").get() as { count: number }).count
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
