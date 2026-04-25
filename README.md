# Automated Posting Tool

Desktop app (Electron + React) để quản lý nội dung, sinh bài bằng AI, lên lịch đăng và tự động đăng đa nền tảng.

## Chức năng chính

- Quản lý dự án, account, page và mapping platform.
- Quản lý media/content groups, sinh bài đơn hoặc batch bằng AI.
- Lên lịch thông minh theo khung giờ và giới hạn bài/ngày.
- Robot auto-post theo lịch, có dashboard giám sát runtime.
- Lưu dữ liệu local bằng SQLite và ghi activity logs.

## Nền tảng hỗ trợ đăng tự động

- Facebook
- Instagram
- TikTok
- YouTube

## Yêu cầu môi trường

- Node.js 24+ (khuyến nghị)
- npm 10+
- FFmpeg (được dùng qua `ffmpeg-static` trong project)

## Cài đặt

```bash
npm install
```

## Chạy local

```bash
npm run dev
```

## Build

```bash
npm run build
npm run dist
```

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm run test
```

## Bảo mật và secrets

- API keys được mã hóa trước khi lưu vào bảng `settings`.
- Electron renderer chỉ gọi IPC qua API whitelisted trong preload (không expose generic IPC).
- Với hệ điều hành hỗ trợ, mã hóa dùng `safeStorage`; fallback local key chỉ dùng khi không khả dụng.

## Trạng thái bài viết (unified)

- `draft` -> `approved` -> `scheduled` -> `processing` -> `published | failed`

Các trạng thái legacy như `pending`, `completed`, `in-progress` sẽ được chuẩn hóa khi chạy app.
