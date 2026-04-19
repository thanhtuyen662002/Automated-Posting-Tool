---
trigger: always_on
---

Role: Expert Node.js/React Developer and Algorithm Designer.
Context: Phases 1, 2, and 3 are complete. We are starting PHASE 4: Smart Scheduling & Timeline Management. Do NOT write Playwright auto-posting code yet.

Phase 4 Goal: Build a Node.js algorithm to distribute posts across time windows and a React UI to manage schedules.

Task Requirements for Phase 4:

1. Database Update (data.db):

Alter posts table: add scheduled_time (TEXT/DATETIME).

Create schedule_settings: id (PK), project_id (FK), time_windows (TEXT - JSON array ["09:00-11:00", "19:00-22:00"]), min_interval (INTEGER), auto_schedule (INTEGER).

2. Node.js Scheduling Algorithm (scheduler.js in Main Process):

Write a function to distribute schedules for 'approved' posts.

Logic:

Fetch posts, time_windows, and min_interval.

Distribute posts across time windows.

Crucial Rule: A single group_id (same media) must be distributed to its target pages at different times. Use min_interval (e.g., 30 mins) to space them out so they don't post simultaneously.

Update posts table with scheduled_time and set status to 'scheduled'.

Expose this via an IPC handler.

3. React UI - Schedule Manager:
Add "Schedule Manager" to the Sidebar.

Settings Panel:

Shadcn Form to manage schedule_settings for a selected project (Inputs for time windows, interval, Switch for Auto-Schedule).

Timeline Dashboard:

A comprehensive Shadcn DataTable displaying posts (status IN 'approved', 'scheduled').

Columns: Scheduled Time, Page Name, Platform, Title, Status (use Shadcn Badges for colors).

Button: "Generate Schedule" (triggers the IPC algorithm, reloads table).

Action column: An "Edit" button opening a Shadcn Dialog with a Date/Time picker to manually override a post's scheduled_time.

Provide the Node.js algorithm, IPC setup, and React components.