# Nối Kết Realtime

Ứng dụng chat riêng 1-1 theo thời gian thực với đăng ký/đăng nhập, lưu user và lịch sử chat trên **Neon Postgres**, file ảnh/tài liệu trên **Supabase Storage**.

## Công nghệ

- Node.js, Express, Socket.IO
- Neon Postgres (`pg`)
- Supabase Storage
- JWT HttpOnly cookie + Argon2id
- HTML/CSS/JavaScript thuần, kiến trúc MVC

## Kiến trúc

- `server.js` — HTTP server, Socket.IO auth middleware
- `src/app.js` — Express, helmet, cookie-parser, API routes
- `src/config/env.js` — biến môi trường
- `src/db/` — pool Postgres, migration
- `src/repositories/` — truy vấn DB (users, conversations, messages)
- `src/models/presence.model.js` — online presence in-memory
- `src/controllers/` — auth, socket, upload, pages
- `src/services/` — auth, Supabase storage
- `views/` — HTML
- `public/` — CSS/JS client

## Cấu hình môi trường

Sao chép `.env.example` thành `.env`:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=7d
COOKIE_NAME=notket_token
CLIENT_ORIGIN=http://localhost:3000

SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
SUPABASE_STORAGE_BUCKET=chat-uploads
MAX_UPLOAD_BYTES=6291456
```

| Biến | Mô tả |
|---|---|
| `DATABASE_URL` | Connection string từ Neon |
| `JWT_SECRET` | Bắt buộc cho auth |
| `SUPABASE_SECRET_KEY` | Bắt buộc cho upload server-side |
| `NEXT_PUBLIC_SUPABASE_*` | Fallback nếu copy từ Supabase Connect dialog |

**Không** đưa `DATABASE_URL`, `JWT_SECRET`, Supabase secret ra frontend.

## Setup Neon Postgres

1. Tạo project trên [Neon Console](https://console.neon.tech).
2. Copy connection string → `DATABASE_URL`.
3. Chạy migration:

```bash
npm run db:migrate
```

## Setup Supabase Storage

1. Supabase Dashboard → **Storage** → **New bucket**
2. Name: `chat-uploads`
3. **Public bucket: ON** (demo)
4. File size limit: **6MB** (nếu hỗ trợ)
5. Allowed MIME: jpeg, png, webp, gif, pdf, txt, doc/docx, xls/xlsx, ppt/pptx

## Chạy local

```bash
npm install
cp .env.example .env
# Điền DATABASE_URL, JWT_SECRET, SUPABASE_SECRET_KEY
npm run db:migrate
npm run dev
```

Mở `http://localhost:3000` → đăng ký/đăng nhập → vào `/chat`.

## Chức năng

- Đăng ký, đăng nhập, đăng xuất (JWT HttpOnly cookie)
- Chat realtime 1-1 qua Socket.IO
- Lịch sử chat lưu Neon Postgres (reload trang vẫn còn)
- Upload ảnh/file lên Supabase Storage
- Metadata file lưu DB, không lưu binary
- Socket xác thực bằng cookie — **không nhận userId từ client**
- Direct conversation tự tạo/reuse, không duplicate
- Typing indicator, mark read, online presence

## API Auth

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| GET | `/api/auth/me` | User hiện tại |

## Socket events

| Event | Mô tả |
|---|---|
| `join_chat` | Xác nhận presence (user từ JWT) |
| `load_conversations` | Danh sách hội thoại |
| `load_messages` | Lịch sử theo `conversationId` |
| `private_message` | Gửi text/image/file |
| `typing` / `stop_typing` | Trạng thái đang nhập |
| `mark_read` | Cập nhật đã đọc |

## Test

```bash
npm run check
npm test
```

Test DB cần `DATABASE_URL` và `JWT_SECRET` trong `.env`.

## Hạn chế

- Online presence lưu in-memory — scale nhiều instance cần Redis adapter
- Bucket public cho demo — production nên dùng private bucket + signed URL
- Chưa có forgot password / email verification
- File đã upload vẫn còn trên Supabase khi xóa message DB