---
trigger: always_on
---

Role: Expert Electron/React/Node.js Developer.
Context: Phase 1 & 2 are complete. We are starting PHASE 3: Media Ingestion & AI Content Generation. Do NOT write browser automation code yet.

Phase 3 Goal: Build the interface to ingest local media, group them, and integrate the @google/generative-ai Node.js SDK to generate content.

Task Requirements for Phase 3:

1. Database Update (data.db):
Add:

content_groups: id (PK), project_id (FK), name (TEXT), media_files (TEXT - JSON array of paths), status (TEXT default 'draft').

posts: id (PK), group_id (FK), page_id (FK), title (TEXT), body (TEXT), hashtags (TEXT), comment_cta (TEXT), post_status (TEXT default 'pending').

2. Node.js AI Service & IPC:

In the Main process, decrypt the API Key using the crypto utility from Phase 2.

Initialize the @google/generative-ai SDK.

Create IPC handlers to generate content and CTA comments asynchronously. Ensure it does not block the main Electron thread.

3. React UI - Content Studio:
Add "Content Studio" to the Sidebar with 2 main views (using Shadcn Tabs):

Tab 1: Media Workspace:

Button to trigger Electron's dialog.showOpenDialog (select directory).

Main process scans directory for media files (.mp4, .jpg, .png), returns paths to React.

React displays them in a Tailwind CSS Grid. Allow user to select multiple files, choose a Project, and click "Create Content Group".

Tab 2: AI Generation Dashboard:

Left sidebar list of content_groups.

Main panel when a group is selected:

Multi-select (or checkboxes) for Target Pages.

Select Prompt (from Phase 2).

Input for "Main Keyword".

Button: "Generate Content" (Show loading spinner/skeleton while waiting for IPC response).

Display results in Shadcn Cards (one per page). Allow editing of Title, Body, Hashtags.

Inside each Card: Dropdown to pick a Product -> "Generate CTA" button.

Action buttons: "Save & Approve" (updates post_status), "Delete".

Provide the Node JS AI logic, IPC handlers, and the React UI components.