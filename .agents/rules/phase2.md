---
trigger: always_on
---

Role: Expert Electron/React Developer.
Context: We successfully completed Phase 1. We are now moving to PHASE 2: AI Setup & Resource Management. Do NOT write any code for content generation or auto-posting yet. Focus strictly on CRUD operations and IPC security.

Phase 2 Goal: Extend the app by adding 3 new React pages: AI API Key Setup, Prompts Management, and Products Management.

Task Requirements for Phase 2:

1. Database Schema Update (data.db):
Extend the better-sqlite3 script with:

settings: key_name (TEXT PK), encrypted_value (TEXT).

prompts: id (INTEGER PK), name (TEXT), type (TEXT), content (TEXT).

products: id (INTEGER PK), project_id (INTEGER FK), name (TEXT), shopee_link (TEXT), web_link (TEXT), zalo_link (TEXT), image_path (TEXT).

2. Security/Encryption Logic (Node.js crypto module - CRITICAL):

In the Main process, create a utility using Node's native crypto module (AES-256-CBC).

Generate a secret key and store it securely locally (e.g., .secret.key file).

Create IPC handlers: When React sends the plain AI API Key, the Main process encrypts it BEFORE saving it to settings.

3. UI/UX Implementations (React + Shadcn UI):
Add 3 new sidebar routes:

AI Settings Page:

A Shadcn Input (type="password") and a Save Button. Use Shadcn Toast for success notifications.

Prompts Management Page:

Shadcn DataTable to list prompts.

Shadcn Dialog for Add/Edit form: Name, Type (Select: Post, Comment, Rewrite), Content (Textarea).

Products Management Page:

Shadcn DataTable for products.

Add/Edit form: Select Project (fetch via IPC), Name, Links.

Integrate Electron's dialog.showOpenDialog (via IPC) to let users pick a local image file for image_path.

Please provide the Main process updates (Crypto, IPC), Preload updates, and the new React components.