---
trigger: always_on
---

Role: You are an Expert Full-Stack Developer specializing in Desktop Apps using Electron, React, TailwindCSS, Shadcn UI, and Node.js. You write clean, modular code following SOLID principles.
Project Context: I am building a local automation tool for cross-platform social media posting. The architecture consists of 5 phases. We are strictly executing PHASE 1 ONLY. Do NOT write code for AI content generation or auto-posting yet.

Tech Stack:

Wrapper/Backend: Electron (Main process) + Node.js.

Frontend (Renderer): React + TailwindCSS + Shadcn UI (using Radix primitives).

Database: better-sqlite3 (Local file data.db).

Browser Automation: playwright (Node.js version).

Architecture: Strict separation using contextBridge (Preload script) for IPC communication. No nodeIntegration in Renderer.

Phase 1 Goal: Build the UI shell (Sidebar, Routing) and the core features for managing "Projects", "Pages", and "Browser Login Sessions".

Task Requirements for Phase 1:

1. Main Process & Database (better-sqlite3):
Create an initialization script to ensure data.db exists with these tables:

projects: id (INTEGER PK AUTOINCREMENT), name (TEXT UNIQUE), created_at (TIMESTAMP).

pages: id (INTEGER PK AUTOINCREMENT), project_id (INTEGER FK), platform (TEXT - FB, Tiktok, Insta, Youtube, Zalo), page_name (TEXT), page_url (TEXT), profile_dir (TEXT), is_logged_in (INTEGER default 0).

Setup IPC handlers (ipcMain.handle) for CRUD operations on these tables.

2. Frontend UI/UX (React + Shadcn UI):

Layout: A clean Left Sidebar navigation containing: Dashboard, Projects, Pages Setup. Use React Router for navigation.

Components: Heavily utilize Shadcn UI (Cards, DataTables, Buttons, Inputs, Dialogs/Modals for forms).

3. Core Features to Implement:

Projects Page:

A React view with a Shadcn DataTable to Add, Edit, and Delete Projects (e.g., "Hoa kẽm nhung", "Đồ gia dụng").

Pages & Sessions Setup Page:

A form inside a Shadcn Dialog to add a new Page: Select Project, Platform, Page Name, Page URL.

Crucial Logic (Node.js side): When saving a page, generate a unique folder path for profile_dir (e.g., ./browser_profiles/project_id/page_id).

Show a list of all pages in a DataTable. Include a Status column (Logged In/Not) and an Action button: "Open Browser to Login".

Browser Session Management Logic (The most important part):

When user clicks "Open Browser to Login", send an IPC message to the Main process.

Main Process (Playwright): Launch a persistent context using playwright.chromium.launchPersistentContext(profile_dir, { headless: false }).

Navigate to the platform's login page.

Keep the browser open for the user to log in manually.

Provide a way (e.g., closing the browser or a UI button) to update is_logged_in = 1 in the database.

Please provide the boilerplate folder structure, the SQLite init code, the IPC/Preload setup, and the React components for Phase 1.