---
trigger: always_on
---

Role: Expert Electron, Node.js, and Playwright Developer.
Context: We have successfully completed Phases 1 to 4. We are now entering the final and most crucial phase: PHASE 5: Execution Engine & Auto-Posting.
We will build the background worker and the Playwright automation framework. To keep it manageable, we will implement the actual posting script for ONLY ONE platform first (e.g., Facebook) as a proof of concept.

Phase 5 Goal: Build a background scheduler in Node.js that checks for due posts, executes them using Playwright, streams logs back to React, and updates DB statuses.

Task Requirements for Phase 5:

1. The Background Worker (poster_engine.js in Main Process):

Create a worker system (using setInterval or node-cron) that runs every minute.

Logic: Query the posts table for records where post_status = 'scheduled' AND scheduled_time <= CURRENT_TIMESTAMP.

Process posts sequentially (one by one or with strict concurrency limits) to avoid crashing the local machine with too many Chrome instances.

Update post_status to 'processing' before starting.

2. Playwright Automation Framework:

Create an automation_service.js utility.

Fetch the profile_dir of the target page from the database.

Launch a Playwright instance using chromium.launchPersistentContext(profile_dir, { headless: false }). (Keep it visible for now so we can debug).

Implement the Facebook (or TikTok) Posting Script: - Write a robust script to navigate to the upload page.

Upload the media files (handle both video and images).

Fill in the title, body, and hashtags using page.fill() or page.type(). Ensure you simulate human typing delays.

Click the Post/Publish button.

Wait for the upload to complete (wait for specific success selectors or network idle).

If a comment_cta exists, navigate to the newly created post and inject the comment.

Update post_status to 'published' (on success) or 'failed' (on error). Save the error message if failed.

3. IPC Real-Time Logging:

Create an IPC mechanism (webContents.send) to stream live logs from the Playwright engine to the React frontend (e.g., "Starting browser...", "Uploading media...", "Success").

4. React UI - Auto-Poster Dashboard:

Add a new "Execution Dashboard" to the Sidebar.

A prominent Shadcn Switch/Toggle to Start/Stop the background worker engine.

A "Live Logs" terminal-like window (a scrollable div) that listens to IPC events and displays real-time actions happening in the Node.js background.

A summary view showing statistics for today: X pending, Y published, Z failed.

Constraints:

Error Handling is CRITICAL here. Wrap Playwright actions in try/catch blocks. If a selector is not found (timeout), catch the error, close the browser gracefully, mark the post as 'failed', and move to the next post. Do NOT let the engine crash.

Keep the automation script modular so we can easily add YouTube, TikTok, Zalo later.

Please provide the Node.js Worker/Playwright logic, the IPC logging setup, and the React Execution Dashboard component.