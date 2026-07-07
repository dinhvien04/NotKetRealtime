# Nối Kết Realtime

Ứng dụng chat realtime gần-production: đăng ký/đăng nhập, chat 1-1, phòng công khai, nhóm, upload ảnh/file/voice, admin dashboard, lọc từ cấm và audit log. Lịch sử chat lưu trên **Neon Postgres**, file media trên **Supabase Storage**.

## Tính năng đã hoàn thành

| Nhóm | Tính năng |
|---|---|
| **Auth** | Đăng ký, đăng nhập, đăng xuất (JWT HttpOnly cookie, Argon2id) |
| | CSRF double-submit cho mọi POST thay đổi dữ liệu |
| | Quên mật khẩu qua OTP email (SMTP) |
| **Profile** | Cập nhật display name, avatar, đổi mật khẩu |
| **Chat 1-1** | Realtime Socket.IO, typing, read receipt, unread count |
| | Edit/delete tin nhắn (cửa sổ chỉnh sửa cấu hình được) |
| | Reactions, reply, tìm kiếm tin nhắn |
| **Public / Group** | Phòng chat công khai, tạo/sửa nhóm, quản lý thành viên |
| **Media** | Upload ảnh, tài liệu, voice message (magic-byte validation) |
| | Bucket public (demo) hoặc private + signed URL (production) |
| **Admin** | Dashboard `/admin` — stats, users, messages, bad words, audit logs |
| | Khóa/mở khóa user, moderation tin nhắn, role admin/moderator |
| **Bảo mật** | Helmet CSP, rate limit, sanitize input, bad-word filter |
| | Socket auth qua JWT — không tin `userId` từ client |
| **Scale** | Health check, structured logging, graceful shutdown |
| | Redis adapter + Redis presence (tùy chọn, multi-instance) |
| | CI GitHub Actions |

**AI chatbot:** Tab AI Bot + API `/api/ai/sessions` (Gemini khi có `GEMINI_API_KEY`, mock trong test).

## Công nghệ

- **Runtime:** Node.js, Express 5, Socket.IO 4
- **Database:** Neon Postgres (`pg`, migration SQL)
- **Storage:** Supabase Storage
- **Auth:** Argon2id, JWT HttpOnly cookie
- **Frontend:** HTML/CSS/JavaScript thuần (MVC, không React)
- **Tùy chọn:** Redis (`@socket.io/redis-adapter`), Nodemailer (SMTP)

## Kiến trúc

```
server.js              HTTP + Socket.IO bootstrap, Redis adapter, graceful shutdown
src/app.js             Express app, helmet, routes, error handlers
src/config/env.js      Biến môi trường
src/db/                Pool Postgres, migrate runner
migrations/            SQL migrations 001–007
src/repositories/      Truy vấn DB (users, conversations, messages, audit…)
src/models/            presence.model.js (in-memory fallback)
src/services/          auth, profile, mailer, storage, presence, redis, bad-word, admin, audit…
src/controllers/       auth, socket, upload, message, conversation, admin, health, pages
src/middlewares/       auth, csrf, role, upload, avatar, socket-auth, socket-origin
src/routes/            REST API + health + web pages
views/                 index.html, chat.html, admin.html
public/                css/style.css, js/client.js, js/admin.js
tests/                 22 test files (API, service, socket integration)
.github/workflows/     ci.yml
```

**Luồng realtime:** Client kết nối Socket.IO với cookie JWT → `socket-auth.middleware` xác thực → `socket.controller` xử lý events. Presence dùng `presence.service` (Redis nếu có `REDIS_URL`, không thì in-memory).

## Cấu hình môi trường

Sao chép `.env.example` thành `.env` và điền các giá trị bắt buộc.

### Biến bắt buộc

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | Connection string Neon (pooled, cho runtime) |
| `JWT_SECRET` | Secret ≥ 32 ký tự — server fail-fast nếu thiếu/ngắn |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SECRET_KEY` | Service role / secret key (upload server-side) |

### Biến khuyến nghị

| Biến | Mô tả |
|---|---|
| `MIGRATION_DATABASE_URL` | Direct connection Neon (không pooler) — dùng cho `db:migrate` |
| `CLIENT_ORIGIN` | Origin frontend, ví dụ `http://localhost:3000` |
| `APP_BASE_URL` | URL public của app (link reset password) |
| `SMTP_*` | Cấu hình gửi OTP quên mật khẩu |
| `OTP_PEPPER` | Pepper hash OTP (mặc định fallback `JWT_SECRET`) |

### Biến tùy chọn

| Biến | Mặc định | Mô tả |
|---|---|---|
| `REDIS_URL` | — | Bật Redis adapter + presence khi scale multi-instance |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `DB_POOL_MAX` | `10` | Max connections pool Postgres |
| `DB_STATEMENT_TIMEOUT_MS` | `10000` | Timeout query (ms) |
| `PRESENCE_TTL_SECONDS` | `300` | TTL presence Redis |
| `SUPABASE_STORAGE_PUBLIC` | `true` | `false` → private bucket + signed URL |
| `SIGNED_URL_TTL_SECONDS` | `3600` | TTL signed URL |
| `MAX_UPLOAD_BYTES` | 6MB | Giới hạn file upload |
| `MAX_VOICE_BYTES` | 10MB | Giới hạn voice |
| `MAX_VOICE_SECONDS` | `120` | Độ dài voice tối đa |
| `MESSAGE_EDIT_WINDOW_MINUTES` | `15` | Cửa sổ chỉnh sửa tin nhắn |

**Không** đưa `DATABASE_URL`, `JWT_SECRET`, Supabase secret, `OTP_PEPPER` ra frontend. **Không** commit file `.env`.

## Setup Neon Postgres

1. Tạo project trên [Neon Console](https://console.neon.tech).
2. Copy **pooled** connection string → `DATABASE_URL`.
3. Copy **direct** connection string (không qua pooler) → `MIGRATION_DATABASE_URL`.
4. Chạy migration:

```bash
npm run db:migrate
```

Kiểm tra trạng thái migration:

```bash
npm run db:status
```

Migrations: `001_init` → `007_ai_attachments` (users, conversations, messages, profile, media, public/group, admin/audit/bad-words, AI, attachments).

## Setup Supabase Storage

1. Supabase Dashboard → **Storage** → **New bucket**
2. Name: `chat-uploads` (hoặc khớp `SUPABASE_STORAGE_BUCKET`)
3. **Demo:** Public bucket ON, `SUPABASE_STORAGE_PUBLIC=true`
4. **Production:** Public OFF, `SUPABASE_STORAGE_PUBLIC=false` — app trả signed URL
5. File size limit: **6MB** (ảnh/file), voice tối đa **10MB**
6. Allowed MIME: jpeg, png, webp, gif, pdf, txt, doc/docx, xls/xlsx, ppt/pptx, webm, ogg, mp4, m4a

## Setup SMTP (quên mật khẩu OTP)

Điền trong `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM="Nối Kết <noreply@example.com>"
APP_BASE_URL=http://localhost:3000
PASSWORD_RESET_OTP_TTL_MINUTES=10
```

Nếu không cấu hình SMTP, API forgot-password vẫn chạy nhưng email không gửi được (phù hợp dev local nếu đọc OTP từ log/test).

## Setup Gemini (tùy chọn)

AI chatbot dùng Google Gemini khi có `GEMINI_API_KEY`. Trong `NODE_ENV=test` hoặc khi thiếu key, server trả mock reply để test không phụ thuộc API ngoài.

## Chạy local

```bash
npm install
cp .env.example .env
# Điền DATABASE_URL, MIGRATION_DATABASE_URL, JWT_SECRET, SUPABASE_*
npm run db:migrate
npm run dev
```

Mở `http://localhost:3000` → đăng ký/đăng nhập → `/chat`. Admin/moderator vào `/admin`.

Production:

```bash
npm start
```

## Test

```bash
npm run check    # syntax check toàn bộ source
npm test         # 22 test files
```

Test DB/API cần `DATABASE_URL` và `JWT_SECRET` trong `.env` (hoặc env CI). CI GitHub Actions dùng secret `DATABASE_URL`.

## Deploy

Khuyến nghị **Render** hoặc **Railway** cho server long-running (Socket.IO cần process luôn chạy, không phù hợp serverless thuần).

### Checklist deploy

1. Set env: `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `APP_BASE_URL`, Supabase keys, SMTP (nếu cần OTP).
2. `NODE_ENV=production`
3. Chạy `npm run db:migrate` một lần (build step hoặc release command).
4. Start: `npm start`
5. **Health check path:** `GET /health/ready` (hoặc `/health/live` cho liveness)
6. **Multi-instance:** set `REDIS_URL` — bắt buộc để presence và broadcast Socket.IO đồng bộ giữa các node

### Redis (scale)

```env
REDIS_URL=redis://default:password@host:6379
```

Khi không có Redis: presence in-memory, Socket.IO single-instance.

## API tóm tắt

### Auth — `/api/auth`

| Method | Path | Mô tả |
|---|---|---|
| POST | `/register` | Đăng ký |
| POST | `/login` | Đăng nhập |
| POST | `/logout` | Đăng xuất |
| POST | `/forgot-password` | Gửi OTP |
| POST | `/verify-reset-otp` | Xác minh OTP |
| POST | `/reset-password` | Đặt mật khẩu mới |
| GET | `/me` | User từ cookie |
| GET | `/session` | User (require auth) |

### CSRF — `GET /api/csrf-token`

Client lấy token trước mọi POST; gửi header `X-CSRF-Token` khớp cookie `notket_csrf`.

### Profile — `/api/users`

| Method | Path | Mô tả |
|---|---|---|
| GET | `/me` | Profile |
| PATCH | `/me` | Cập nhật profile |
| POST | `/me/avatar` | Upload avatar |
| POST | `/me/change-password` | Đổi mật khẩu |

### Messages — `/api/messages`

| Method | Path | Mô tả |
|---|---|---|
| GET | `/search?q=&conversationId=` | Tìm kiếm |
| PATCH | `/:id` | Chỉnh sửa |
| DELETE | `/:id` | Xóa |
| POST/DELETE | `/:id/reactions` | Thêm/xóa reaction |

### Conversations — `/api/conversations`

| Method | Path | Mô tả |
|---|---|---|
| GET | `/public` | Phòng công khai |
| GET/POST | `/groups` | Danh sách / tạo nhóm |
| PATCH | `/:id` | Sửa nhóm |
| GET/POST/DELETE | `/:id/participants` | Thành viên |

### Upload — `POST /api/uploads`

Multipart upload (require auth + CSRF). Trả `file.fileKey` và metadata để gắn vào socket message. `POST /api/uploads/refresh-url` làm mới signed URL khi bucket private.

### Admin — `/api/admin` (admin/moderator)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/stats` | Thống kê |
| GET/PATCH/DELETE | `/users` | Quản lý user |
| GET/PATCH/DELETE | `/messages` | Moderation |
| GET/POST/DELETE | `/bad-words` | Từ cấm |
| GET | `/audit-logs` | Nhật ký audit |

### Health

| Method | Path | Mô tả |
|---|---|---|
| GET | `/health` | Tổng quan |
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Readiness (DB ping) |

## Socket events

| Event | Mô tả |
|---|---|
| `join_chat` | Tham gia phòng public mặc định |
| `load_conversations` | Danh sách hội thoại |
| `load_messages` | Lịch sử theo `conversationId` |
| `load_public_room` / `load_groups` | Public & groups |
| `join_conversation` / `leave_conversation` | Room subscription |
| `private_message` | Chat 1-1 (text/image/file/voice) |
| `public_message` / `group_message` | Chat công khai / nhóm |
| `typing` / `stop_typing` | Đang nhập |
| `mark_read` | Đã đọc |
| `edit_message` / `delete_message` | Sửa/xóa realtime |
| `add_reaction` / `remove_reaction` | Reaction |

Server emit: `private_message`, `public_message`, `group_message`, `message_edited`, `message_deleted`, `message_reaction_added`, `message_reaction_removed`, `message_read`, `typing`, `online_users`, v.v.

## Security notes

- Không commit `.env`; dùng secret manager trên host deploy
- `JWT_SECRET` ≥ 32 ký tự; rotate định kỳ trên production
- Private Supabase bucket + signed URL khuyến nghị cho production
- `REDIS_URL` bắt buộc khi chạy ≥ 2 instance Socket.IO
- Upload chỉ validate MIME + magic bytes cơ bản — **không** có malware scanning
- Rate limit trên auth, upload, message, admin endpoints
- Không dùng `innerHTML` với dữ liệu user trên client

## Hạn chế

| Hạn chế | Ghi chú |
|---|---|
| Presence in-memory | Khi chưa bật `REDIS_URL` — không scale horizontal |
| Attachments DB row | Bảng `attachments` đã có; metadata upload lưu DB, pending registry vẫn in-memory TTL |
| Signed URL refresh | Client tự refresh qua `/api/uploads/refresh-url`; chưa có auto-refresh toàn cục |
| Malware scanning | Upload chỉ kiểm tra loại file cơ bản |
| Public bucket | File URL có thể truy cập công khai nếu `SUPABASE_STORAGE_PUBLIC=true` |
| Xóa message | File trên Supabase có thể còn sau khi xóa record DB |
| Email verification | Chưa có xác minh email khi đăng ký |

## License

MIT