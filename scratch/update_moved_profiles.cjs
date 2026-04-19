const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'data.db');
const db = new Database(dbPath);

const rootPath = process.cwd();
const browserProfilesDir = path.join(rootPath, 'browser_profiles');

const profileNames = ['default_profile_1', 'default_profile_3'];

console.log('Đang cập nhật đường dẫn CSDL cho các profile đã di chuyển...');

for (const name of profileNames) {
    const newPath = path.join(browserProfilesDir, name);
    
    // Tìm page có profile_dir chứa tên này
    const pages = db.prepare('SELECT id, profile_dir, page_name FROM pages WHERE profile_dir LIKE ?').all(`%${name}%`);
    
    if (pages.length > 0) {
        for (const page of pages) {
            console.log(`Cập nhật Page [${page.page_name}]: ${page.profile_dir} -> ${newPath}`);
            db.prepare('UPDATE pages SET profile_dir = ? WHERE id = ?').run(newPath, page.id);
        }
    } else {
        console.log(`Không tìm thấy bản ghi nào trong DB khớp với: ${name}`);
    }
}

console.log('Hoàn tất cập nhật.');
db.close();
