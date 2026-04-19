const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data.db');
const db = new Database(dbPath);

const rootPath = process.cwd();
const newBaseDir = path.join(rootPath, 'browser_profiles');

console.log('Cập nhật đường dẫn profile cho các trang hiện có...');

const pages = db.prepare('SELECT id, profile_dir, page_name FROM pages').all();

for (const page of pages) {
    if (page.profile_dir) {
        // Extract the folder name from the old path
        const profileDirName = path.basename(page.profile_dir);
        const newPath = path.join(newBaseDir, profileDirName);
        
        console.log(`Cập nhật Page [${page.page_name}]: ${page.profile_dir} -> ${newPath}`);
        db.prepare('UPDATE pages SET profile_dir = ? WHERE id = ?').run(newPath, page.id);
    }
}

console.log('Hoàn tất cập nhật.');
db.close();
