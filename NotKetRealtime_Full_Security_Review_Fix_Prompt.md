# NotKetRealtime — Full Security Review & Fix Prompt

> Copy toàn bộ file này đưa cho Kiro / Cline / Cursor / Codex để nó review và sửa dự án `dinhvien04/NotKetRealtime` theo từng phase.  
> Mục tiêu: sửa lỗi bảo mật, lỗi logic, tối ưu database/socket/upload, và hoàn thiện các chức năng còn thiếu theo scope báo cáo đồ án.

---

## 0. Vai trò của AI agent

Bạn là **senior full-stack Node.js engineer**, **security engineer**, **database engineer**, **realtime systems engineer** và **product engineer**. Hãy làm việc trực tiếp trong repo GitHub:

```txt
dinhvien04/NotKetRealtime
```

Dự án hiện tại là app chat realtime dùng:

- Node.js
- Express.js
- Socket.IO
- Neon Postgres qua `pg`
- Supabase Storage
- JWT HttpOnly cookie
- Argon2id
- HTML/CSS/JavaScript thuần
- CommonJS `require`

Không được chuyển sang React, Next.js, NestJS, TypeScript bắt buộc, hoặc rewrite toàn bộ app nếu không cần. Có thể refactor mạnh theo module/layer sạch nhưng vẫn giữ dự án dễ học, dễ chạy, dễ review.

---

## 1. Bối cảnh chức năng hiện tại

Repo hiện đã có một số phần lõi:

- Đăng ký / đăng nhập / đăng xuất / kiểm tra user hiện tại.
- Password hash bằng Argon2id.
- JWT lưu trong HttpOnly cookie.
- Neon Postgres lưu users, conversations, participants, messages.
- Socket.IO có middleware auth qua JWT cookie hoặc handshake token.
- Chat riêng 1-1 realtime.
- Lưu lịch sử chat trong DB.
- Upload ảnh/file lên Supabase Storage.
- Pending upload registry để chống fake URL file.
- Frontend login/register/chat/upload bằng HTML/CSS/JS thuần.
- Một số test auth/socket/database cơ bản.

Scope báo cáo đồ án yêu cầu thêm hoặc hoàn thiện:

- Chat công khai.
- Chat riêng tư 1-1.
- Upload file, hình ảnh, voice message.
- AI chatbot.
- Admin dashboard.
- Quản lý người dùng.
- Quản lý tin nhắn.
- Bad-word filtering.
- Audit log.
- Profile cá nhân.
- Đổi mật khẩu.
- Quên mật khẩu qua OTP email.
- Edit/delete message.
- Search message.
- Reactions.
- Tối ưu scale bằng Redis/load balancing về sau.

---

## 2. Nguyên tắc bắt buộc

1. Không hard-code secret.
2. Không commit `.env`.
3. Không expose `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, SMTP password ra frontend.
4. Không gửi binary file qua Socket.IO.
5. Không lưu file upload vào local disk lâu dài.
6. Không lưu binary file vào database.
7. Không dùng `innerHTML` với dữ liệu user.
8. Server là source of truth; không tin dữ liệu từ client.
9. Tất cả API/socket event thay đổi dữ liệu phải có authentication + authorization.
10. Mọi DB query phải parameterized, không nối SQL bằng input user.
11. Các thao tác nhiều bước phải dùng transaction.
12. Các hành động admin/destructive phải audit log.
13. Upload phải validate extension, MIME, magic bytes, size, filename và quyền user.
14. Password phải hash bằng Argon2id với params rõ ràng.
15. Cookie auth cần CSRF protection cho unsafe HTTP methods.
16. Socket cần origin validation + event rate limit.
17. Mỗi phase xong phải chạy:

```bash
npm run check
npm test
```

18. Nếu không thể làm hết trong một lượt, làm theo phase và báo rõ phần nào chưa làm.

---

## 3. Cách agent phải bắt đầu

Trước khi sửa, inspect toàn bộ repo:

```txt
package.json
server.js
src/app.js
src/config/env.js
src/db/*
migrations/*
src/repositories/*
src/models/*
src/controllers/*
src/routes/*
src/middlewares/*
src/services/*
src/utils/*
views/*
public/js/client.js
public/css/style.css
tests/*
README.md
.env.example
.gitignore
```

Sau khi inspect, tạo plan ngắn theo phase rồi bắt đầu từ **Phase 0**. Không được nhảy qua Phase 0.

---

# PHASE 0 — Critical security & logic fixes

## 0.1. Fix authorization bug trong socket `private_message`

### Vấn đề

Client có thể gửi cả `conversationId` và `receiverId`. Server hiện có nguy cơ check sender là participant của conversation nhưng lại emit message tới `receiverId` do client tự khai.

Ví dụ tấn công:

```txt
A-B có conversationId = conv_ab
A gửi payload:
{
  conversationId: conv_ab,
  receiverId: C,
  message: "..."
}
```

Nếu server không derive receiver từ DB, C có thể nhận message không thuộc conversation.

### Yêu cầu sửa

Trong `src/controllers/socket.controller.js`, event `private_message` hoặc `send_message`:

- Sender luôn lấy từ `socket.data.user`.
- Không nhận `senderId` từ client.
- Nếu payload có `conversationId`:
  1. Validate `conversationId` là UUID hợp lệ.
  2. Check current user là participant.
  3. Load conversation metadata.
  4. Nếu conversation type là `direct`, lấy người còn lại bằng `conversationRepository.getOtherParticipant(conversationId, sender.id)`.
  5. Không tin `receiverId` từ client.
  6. Nếu client có gửi `receiverId`, verify nó trùng với other participant.
  7. Nếu không trùng, reject:

```js
{ ok: false, error: "Người nhận không thuộc hội thoại này." }
```

  8. Emit message tới `user:${otherParticipant.id}`.
- Nếu payload không có `conversationId`:
  1. Require `receiverId`.
  2. Validate receiverId.
  3. Verify receiver tồn tại.
  4. Tạo hoặc reuse direct conversation.
  5. Dùng conversationId từ DB.
- Với group/public chat sau này, không dùng `receiverId`; emit theo room conversation hoặc participant list.

### Test bắt buộc

Thêm test:

- Tạo user A, B, C.
- Tạo conversation A-B.
- A gửi `private_message` với `conversationId` A-B nhưng `receiverId` là C.
- Kết quả phải reject.
- C không nhận message.
- DB không lưu message sai.

---

## 0.2. Fix `mark_read` authorization/data integrity

### Vấn đề

`mark_read` chỉ check user là participant của conversation rồi update `last_read_message_id`. Cần check message đó thuộc đúng conversation.

### Yêu cầu sửa

Trong socket event `mark_read`:

1. Validate `conversationId` và `messageId`.
2. Check user hiện tại là participant.
3. Load message bằng `messageRepository.findById(messageId)`.
4. Nếu message không tồn tại, reject.
5. Nếu `message.conversationId !== conversationId`, reject.
6. Chỉ update `last_read_message_id` khi hợp lệ.
7. Nếu message do chính user gửi, có thể bỏ qua hoặc vẫn update tùy logic, nhưng không được làm sai conversation.

### Test bắt buộc

- Tạo conversation A-B.
- Tạo conversation A-C.
- A cố `mark_read` message của A-C vào conversation A-B.
- Server phải reject.

---

## 0.3. Fix race condition khi tạo direct conversation

### Vấn đề

`findOrCreateDirectConversation(userA, userB)` có unique constraint nhưng vẫn có thể race khi hai request chạy đồng thời.

### Yêu cầu sửa

Trong `src/repositories/conversation.repository.js`:

- Chuẩn hóa cặp user:

```js
const userLow = userA < userB ? userA : userB;
const userHigh = userA < userB ? userB : userA;
```

- Dùng transaction.
- Tránh tạo conversation thừa khi insert direct_conversations bị conflict.
- Có thể dùng một trong hai hướng:

### Hướng A — catch unique violation + retry

1. Select existing direct conversation.
2. Nếu có, return.
3. Trong transaction tạo conversation + participants + direct_conversations.
4. Nếu gặp unique violation `23505`, select lại conversation existing và return.

### Hướng B — advisory lock

Dùng Postgres advisory transaction lock theo hash của userLow/userHigh trước khi tạo conversation.

### Test bắt buộc

- Gọi `Promise.all` nhiều lần `findOrCreateDirectConversation(A, B)`.
- Kết quả chỉ có 1 conversation.
- Không throw unique violation.

---

## 0.4. Upload không được phụ thuộc presence/socket online

### Vấn đề

Upload API hiện phụ thuộc `presenceModel.isOnline(sender.id)`. User đã login nhưng socket chưa join hoặc đang reconnect thì upload fail.

### Yêu cầu sửa

Trong `src/controllers/upload.controller.js`:

- Bỏ check `presenceModel.isOnline(sender.id)`.
- Upload chỉ cần `requireAuth`.
- Pending upload gắn theo `req.user.id`.
- Khi socket gửi file message mới consume pending upload.
- Pending upload hết hạn hoặc không thuộc user thì reject.

### Test bắt buộc

- Login user.
- Gọi upload endpoint không có socket connection.
- Nếu file hợp lệ và Supabase được mock/stub thì upload pass.
- Nếu chưa mock storage, ít nhất test controller không reject vì presence.

---

## 0.5. Harden file upload theo OWASP

### Vấn đề

Upload hiện chủ yếu tin `req.file.mimetype`. MIME do client gửi có thể fake.

### Dependencies

Cài thêm:

```bash
npm install file-type
```

Nếu `file-type` ESM-only gây khó với CommonJS, dùng dynamic import:

```js
const { fileTypeFromBuffer } = await import("file-type");
```

### Yêu cầu validation

Trong upload middleware/service:

- Dùng `multer.memoryStorage()`.
- Max 1 file/request.
- Size limit theo env.
- Extension allowlist:
  - `jpg`, `jpeg`, `png`, `webp`, `gif`
  - `pdf`
  - `txt`
  - `doc`, `docx`
  - `xls`, `xlsx`
  - `ppt`, `pptx`
  - `webm`, `ogg`, `mp3`, `wav` nếu làm voice
- Blocklist cứng:
  - `svg`, `html`, `htm`, `js`, `mjs`, `exe`, `sh`, `bat`, `cmd`, `php`, `zip`, `rar`, `7z`
- MIME allowlist.
- Magic bytes validation:
  - image/pdf/audio phải có detected MIME khớp allowlist.
  - `text/plain` có thể fallback kiểm buffer text không có nhiều null bytes.
  - docx/xlsx/pptx là zip-based; nếu chưa validate an toàn thì tạm reject hoặc chỉ cho image/pdf/txt ở Phase 0. Đừng giả vờ validate được.
- Sanitize filename.
- Generate UUID filename.
- Không dùng original filename làm path thật.
- Không cho path traversal.
- Không cho filename quá dài.
- Không cho zero-byte file.
- Nếu upload reject do security, audit log nếu audit service đã có; nếu chưa có thì TODO.

### Test bắt buộc

- Fake MIME image nhưng buffer không phải image phải bị reject.
- File quá size bị reject.
- Extension nguy hiểm `.svg`, `.html`, `.js` bị reject.

---

## 0.6. Harden Argon2id + JWT secret

### Yêu cầu sửa

Trong `src/services/auth.service.js`, hash password bằng:

```js
await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
});
```

Thêm `validateJwtSecret()`:

- Nếu thiếu `JWT_SECRET`, auth không hoạt động.
- Nếu production và secret yếu, fail fast hoặc trả config error rõ ràng.
- Secret nên dài ít nhất 32 bytes hoặc 64 ký tự hex.
- Không log secret.

### Test bắt buộc

- Password hash verify pass.
- JWT secret thiếu/yếu bị reject trong production mode.

---

## 0.7. Thêm CSRF protection cho cookie auth

### Vấn đề

App dùng JWT trong HttpOnly cookie. Các unsafe HTTP APIs cần CSRF protection.

### Files cần tạo

```txt
src/services/csrf.service.js
src/middlewares/csrf.middleware.js
```

### Route cần thêm

```txt
GET /api/csrf-token
```

### Cơ chế đề xuất

Dùng signed double-submit cookie:

- Server tạo random token.
- Tạo HMAC signature bằng `JWT_SECRET` hoặc `CSRF_SECRET`.
- Set cookie `notket_csrf` không HttpOnly để JS đọc được, SameSite=Lax, Secure production.
- Client gửi header `X-CSRF-Token`.
- Server verify:
  - cookie token tồn tại.
  - header token tồn tại.
  - header token trùng cookie token.
  - signature hợp lệ.

### Unsafe API cần CSRF

- `POST /api/auth/logout`
- `POST /api/uploads`
- profile update/change password/avatar upload
- message edit/delete/reaction
- admin APIs
- AI POST/DELETE APIs
- group create/update APIs

Login/register có thể tạm không cần CSRF nếu rate limit chặt, nhưng tốt hơn là áp dụng toàn bộ unsafe API sau khi client lấy token.

### Frontend yêu cầu

- `public/js/client.js` fetch wrapper phải tự lấy CSRF token và gửi `X-CSRF-Token`.
- Upload bằng FormData cũng phải gửi header CSRF.

### Test bắt buộc

- Unsafe POST không CSRF bị reject.
- Có CSRF hợp lệ thì pass.

---

## 0.8. Socket origin validation + event rate limit

### Origin validation

Trong `socket-auth.middleware.js` hoặc `server.js`:

- Read `CLIENT_ORIGIN`, hỗ trợ comma-separated.
- Development allow:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
- Production reject origin lạ.
- Không dùng `origin: "*"` với credentials.

### Event rate limit

Tạo middleware/helper in-memory:

```txt
src/services/rate-limit.service.js
```

Limit socket event theo userId:

- `private_message` / `send_message`: 30/phút.
- `typing`: 60/phút, hoặc ignore nếu vượt.
- `load_messages`: 60/phút.
- `mark_read`: 120/phút.
- `ai_message`: 10/phút.

Nếu vượt limit:

```js
{ ok: false, error: "Thao tác quá nhanh. Vui lòng thử lại sau." }
```

---

# PHASE 1 — Database & migration hardening

## 1.1. Migration runner chuẩn

### Vấn đề

Nếu chỉ chạy một file `001_init.sql`, về sau khó quản lý migration.

### Yêu cầu

Tạo bảng:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  filename text NOT NULL,
  checksum text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now()
);
```

`src/db/migrate.js`:

- Scan `migrations/*.sql`.
- Sort theo tên file.
- Tính checksum.
- Chạy file chưa có trong `schema_migrations`.
- Insert record sau khi chạy thành công.
- Nếu checksum thay đổi với migration đã chạy, báo lỗi.
- Mỗi migration chạy transaction nếu có thể.

Scripts:

```json
{
  "db:migrate": "node src/db/migrate.js",
  "db:status": "node src/db/migrate.js --status"
}
```

---

## 1.2. `MIGRATION_DATABASE_URL`

### Yêu cầu

`.env.example` thêm:

```env
DATABASE_URL=
MIGRATION_DATABASE_URL=
```

- Runtime dùng `DATABASE_URL`.
- Migration ưu tiên `MIGRATION_DATABASE_URL`, fallback `DATABASE_URL`.
- Không log connection string.
- README giải thích pooled URL cho runtime, direct URL cho migration.

---

## 1.3. Schema mở rộng

Tạo migration mới:

```txt
migrations/002_security_and_features.sql
```

### Users

Thêm nếu chưa có:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
```

### Conversations

```sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name varchar(120);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
```

Conversation type nên hỗ trợ:

```txt
direct, group, public, ai
```

### Conversation participants

```sql
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'member';
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS left_at timestamptz;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS muted_until timestamptz;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS last_read_at timestamptz;
```

### Messages

```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS was_filtered boolean NOT NULL DEFAULT false;
```

Message type nên hỗ trợ:

```txt
text, image, file, voice, system, ai
```

### Attachments

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  uploader_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_provider varchar(30) NOT NULL DEFAULT 'supabase',
  bucket text NOT NULL,
  file_key text NOT NULL UNIQUE,
  file_url text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  kind varchar(20) NOT NULL,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Message reactions

```sql
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
```

### Password reset tokens

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  otp_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  request_ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Bad words

```sql
CREATE TABLE IF NOT EXISTS bad_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE,
  severity varchar(20) NOT NULL DEFAULT 'medium',
  replacement text NOT NULL DEFAULT '***',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Audit logs

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role varchar(20),
  action varchar(80) NOT NULL,
  target_type varchar(80),
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### AI sessions/messages

```sql
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL,
  content text NOT NULL,
  provider varchar(40),
  model varchar(80),
  tokens_input integer,
  tokens_output integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 1.4. Index tối ưu

Thêm index nếu chưa có:

```sql
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_created_idx ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversation_participants_user_idx ON conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS conversations_updated_idx ON conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS attachments_file_key_idx ON attachments (file_key);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_email_expires_idx ON password_reset_tokens (email, expires_at DESC);
CREATE INDEX IF NOT EXISTS bad_words_lower_word_idx ON bad_words (lower(word));
```

Nếu thêm search:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS messages_body_trgm_idx ON messages USING gin (body gin_trgm_ops);
```

---

## 1.5. Unread count thật

### Vấn đề

Unread count hiện chỉ trả 0/1.

### Yêu cầu

Trong `conversation.repository.js`, list conversations phải trả unreadCount thật:

- Count messages trong conversation:
  - `sender_id <> currentUserId`
  - message chưa deleted
  - created_at > last_read_at hoặc > created_at của last_read_message_id.
- Không count tin do chính mình gửi.

---

# PHASE 2 — Account, profile, password reset OTP

## 2.1. Profile API

Tạo routes:

```txt
GET    /api/users/me
PATCH  /api/users/me
POST   /api/users/me/avatar
POST   /api/users/me/change-password
```

Files:

```txt
src/controllers/user.controller.js
src/routes/user.routes.js
src/repositories/user.repository.js update
```

### Rules

- Require auth.
- PATCH/POST require CSRF.
- User chỉ sửa chính mình.
- `displayName`: 1-80 ký tự.
- `bio`: max 500 ký tự.
- Avatar upload chỉ image.
- Change password require current password.
- Password mới validate giống register.
- Sau đổi password update `password_changed_at`.
- Optional: JWT `iat` trước `password_changed_at` bị invalid.

---

## 2.2. Forgot password OTP email

Routes:

```txt
POST /api/auth/forgot-password
POST /api/auth/verify-reset-otp
POST /api/auth/reset-password
```

Files:

```txt
src/services/mailer.service.js
src/services/password-reset.service.js
src/controllers/password-reset.controller.js
src/routes/password-reset.routes.js
src/repositories/password-reset.repository.js
```

Env:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
APP_BASE_URL=http://localhost:3000
PASSWORD_RESET_OTP_TTL_MINUTES=10
```

### Flow

1. User nhập email.
2. Server luôn trả message chung:

```txt
Nếu email tồn tại, mã OTP đã được gửi.
```

3. Nếu email tồn tại:
   - Generate OTP 6 số.
   - Hash OTP bằng HMAC-SHA256 hoặc Argon2id.
   - Store `otp_hash`, expires 10 phút.
   - Rate limit theo IP/email.
   - Send email qua SMTP.
4. Verify OTP:
   - Check token chưa used.
   - Check chưa expired.
   - Check attempts <= 5.
   - Nếu đúng, trả reset token ngắn hạn hoặc đánh dấu verified.
5. Reset password:
   - Require reset token verified.
   - Set new password Argon2id.
   - Mark token used.
   - Audit log.

### Tests

- Forgot password không tiết lộ email tồn tại.
- OTP sai tăng attempts.
- OTP hết hạn reject.
- Reset password success.
- Login bằng password cũ fail, password mới pass.

---

# PHASE 3 — Message features

## 3.1. Edit message

Routes/socket:

```txt
PATCH /api/messages/:id
socket event: edit_message
```

Rules:

- Require auth + CSRF for HTTP.
- Chỉ sender được edit.
- Admin/moderator có thể edit nếu cần moderation.
- Chỉ edit message type `text`.
- Giới hạn thời gian edit 15 phút cho user thường.
- Validate nội dung mới.
- Apply bad-word filter.
- Set `is_edited=true`, `edited_at=now()`.
- Broadcast `message_edited` tới participants.
- Audit log nếu admin edit hoặc nội dung bị filter.

---

## 3.2. Delete message

Routes/socket:

```txt
DELETE /api/messages/:id
socket event: delete_message
```

Rules:

- Sender được delete own message.
- Admin/moderator được delete bất kỳ message.
- Soft delete:
  - `deleted_at=now()`
  - `deleted_by=currentUserId`
- UI hiển thị:

```txt
Tin nhắn đã bị xóa
```

- Broadcast `message_deleted`.
- Không xóa file Supabase ngay trong Phase này; chỉ ẩn message.
- Audit log.

---

## 3.3. Reactions

Routes/socket:

```txt
POST   /api/messages/:id/reactions
DELETE /api/messages/:id/reactions
socket events: add_reaction, remove_reaction
```

Rules:

- User phải là participant của conversation chứa message.
- Validate emoji.
- Unique per user/message/emoji.
- Broadcast realtime.

---

## 3.4. Reply message

- Message payload có `replyToMessageId`.
- Verify reply target tồn tại và cùng conversation.
- UI hiển thị preview tin được reply.
- Nếu reply target deleted, hiển thị “Tin nhắn đã bị xóa”.

---

## 3.5. Search messages

Route:

```txt
GET /api/messages/search?q=&conversationId=&type=&limit=&cursor=
```

Rules:

- User chỉ search conversation mình tham gia.
- Admin có thể search global trong admin API.
- Search `body`, `file_name`.
- Rate limit.
- Cursor pagination.

---

# PHASE 4 — Upload image/file/voice tối ưu

## 4.1. Supabase private bucket + signed URL

Env:

```env
SUPABASE_STORAGE_PUBLIC=false
SIGNED_URL_TTL_SECONDS=3600
```

Rules:

- Demo có thể public bucket.
- Production nên private bucket.
- Nếu private:
  - DB lưu `file_key`, không lưu signed URL vĩnh viễn.
  - Khi load messages, server tạo signed URL TTL.
  - Khi URL expired, client gọi refresh nếu cần.
- Nếu public:
  - Dùng public URL cho demo.

---

## 4.2. Attachments table integration

Upload thành công:

- Tạo pending upload record in-memory hoặc DB pending.
- Tạo `attachments` row với `message_id=null`.
- Khi socket gửi file message thành công:
  - consume pending upload.
  - create message.
  - update attachment `message_id`.
- Nếu pending expired:
  - optional cleanup Supabase object.

---

## 4.3. Voice message

### Frontend

- Thêm nút microphone.
- Dùng MediaRecorder API.
- Hiển thị recording timer.
- Cho cancel/send.
- Preview audio trước khi gửi.
- Max duration 120 giây.
- Upload audio qua `/api/uploads` kind `voice`.
- Sau upload emit socket message type `voice`.
- Render audio player trong bubble.

### Backend

Allow MIME:

```txt
audio/webm
audio/ogg
audio/mpeg
audio/wav
```

Rules:

- Max voice bytes theo env.
- Store `duration_ms`.
- Validate duration client gửi <= max.
- Future TODO: server-side ffprobe validation nếu deploy environment hỗ trợ.

---

## 4.4. Upload UX

- Preview image thumbnail.
- File card trước khi gửi.
- Voice preview.
- Upload loading/progress.
- Disable send while uploading.
- Retry on failure.
- Revoke object URL sau khi clear preview để tránh memory leak.
- Không cho double-submit.

---

# PHASE 5 — Public chat & group chat

## 5.1. Public chat room

Tạo conversation type `public`.

Rules:

- Có phòng public mặc định “Phòng trò chuyện”.
- Tất cả user logged-in có thể xem/gửi.
- Bad-word filter áp dụng.
- Admin/moderator có thể delete message.
- Sidebar có item “Phòng chung”.
- Có unread badge khi user không mở public room.

APIs/socket:

```txt
GET /api/conversations/public-default
socket: join_public_room
socket: public_message hoặc send_message conversation type public
```

---

## 5.2. Group chat

Routes:

```txt
POST   /api/conversations/groups
PATCH  /api/conversations/:id
POST   /api/conversations/:id/participants
DELETE /api/conversations/:id/participants/:userId
POST   /api/conversations/:id/leave
```

Rules:

- Group owner/admin được add/remove member.
- Member được rời nhóm.
- User ngoài group không load/gửi message.
- Group roles:
  - owner
  - admin
  - member
- Group name required.
- Avatar optional.
- Read receipt per participant.
- Typing indicator trong group emit tới members khác.

UI:

- Create group modal.
- Add member modal.
- Group info/members panel.
- Leave group button.

---

# PHASE 6 — Bad-word filtering & moderation

## 6.1. Bad words service

Files:

```txt
src/services/bad-word.service.js
src/repositories/bad-word.repository.js
```

Rules:

- Load bad words from DB.
- Cache in memory with TTL 60s.
- Normalize text:
  - lowercase
  - trim whitespace
  - collapse spaces
  - basic Vietnamese normalization if possible
- Severity:
  - `low`: replace with replacement.
  - `medium`: replace + audit log.
  - `high`: block message.

Message send/edit flow:

1. Validate message text.
2. Run bad-word filter.
3. If blocked, reject.
4. If replaced, save filtered body.
5. Set `was_filtered=true`.
6. Audit if needed.

---

## 6.2. Admin bad-word CRUD

Routes:

```txt
GET    /api/admin/bad-words
POST   /api/admin/bad-words
DELETE /api/admin/bad-words/:id
PATCH  /api/admin/bad-words/:id
```

Rules:

- Require admin/moderator.
- Require CSRF for mutations.
- Audit every change.

---

# PHASE 7 — Admin dashboard

## 7.1. Role middleware

Create:

```txt
src/middlewares/role.middleware.js
```

Usage:

```js
requireRole("admin")
requireRole("moderator", "admin")
```

Rules:

- `req.user.role` must be loaded from DB.
- Locked user cannot access admin.
- Non-admin gets 403.

---

## 7.2. Admin APIs

Stats:

```txt
GET /api/admin/stats
```

Return:

- total users
- active users
- locked users
- total conversations
- total messages
- messages today
- files uploaded
- storage used approximate
- public/group/direct count

Users:

```txt
GET   /api/admin/users?q=&status=&role=&page=
PATCH /api/admin/users/:id
```

Actions:

- lock/unlock user
- change role
- view user details

Rules:

- Admin cannot lock/delete self.
- Audit log.

Messages:

```txt
GET    /api/admin/messages?q=&conversationId=&userId=&type=&page=
DELETE /api/admin/messages/:id
```

Rules:

- Soft delete.
- Audit log.

Audit:

```txt
GET /api/admin/audit-logs?action=&actorId=&page=
```

---

## 7.3. Admin UI

Add admin pages with current design style:

```txt
/admin
/admin/users
/admin/messages
/admin/bad-words
/admin/audit-logs
```

Frontend:

- HTML/CSS/JS thuần.
- Reuse `api()` wrapper with CSRF.
- No React.
- Sidebar admin.
- Tables with pagination/search.
- Confirm modal for destructive actions.

---

# PHASE 8 — AI Chatbot

## 8.1. Provider abstraction

Files:

```txt
src/services/ai.service.js
src/services/ai-providers/gemini.provider.js
src/repositories/ai.repository.js
src/controllers/ai.controller.js
src/routes/ai.routes.js
```

Env:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=
AI_RATE_LIMIT_PER_MINUTE=10
AI_MAX_INPUT_CHARS=4000
```

Routes:

```txt
GET    /api/ai/sessions
POST   /api/ai/sessions
GET    /api/ai/sessions/:id/messages
POST   /api/ai/sessions/:id/messages
DELETE /api/ai/sessions/:id
```

Rules:

- Require auth.
- Require CSRF for POST/DELETE.
- Rate limit per user.
- Max input length.
- Store user message and assistant response.
- Do not send env/secrets to AI provider.
- Timeout provider call.
- Error handling graceful.
- UI tab “AI Bot”.

---

# PHASE 9 — Performance, scale, deployment

## 9.1. Redis adapter optional

Env:

```env
ENABLE_REDIS_ADAPTER=false
REDIS_URL=
```

If enabled:

- Use Socket.IO Redis adapter.
- Presence stored in Redis with TTL.
- Typing state can use Redis TTL.

If disabled:

- Presence in-memory only.
- README must state: only safe for single instance.

---

## 9.2. Health checks

Routes:

```txt
GET /health
GET /health/db
```

`/health` returns app alive.

`/health/db` checks simple DB query:

```sql
SELECT 1
```

Do not expose sensitive info.

---

## 9.3. DB performance

- Cursor pagination only for messages.
- Limit max 100 messages/load.
- Avoid loading all conversations/messages.
- Avoid N+1 queries.
- Use indexes from Phase 1.
- Pool max reasonable, e.g. 10.
- Add query timeout if possible.

---

## 9.4. Frontend performance

- Do not re-render entire message list on every message.
- Deduplicate by message id.
- Lazy load images.
- Use thumbnails if available.
- Revoke object URLs.
- Keep scroll position when loading older messages.
- Debounce search.
- Debounce typing.

---

## 9.5. Logging

Add request logging:

- method
- path
- status
- duration
- requestId

Do not log:

- passwords
- JWT
- cookies
- DB URLs
- Supabase secret
- AI key
- SMTP password

Security rejection logs should include reason but no secret.

---

## 9.6. CI

Add GitHub Actions:

```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm audit --audit-level=high
        continue-on-error: true
```

---

# PHASE 10 — Frontend UX completion

## 10.1. Main navigation

Chat page sidebar should include:

- Current user/profile.
- Search users/conversations.
- Public room.
- Direct conversations.
- Online users.
- Groups.
- AI Bot.
- Admin link if role admin/moderator.

---

## 10.2. Message bubble types

Render safely:

- text
- image
- file
- voice
- system
- AI
- deleted
- edited label
- reactions
- reply preview
- read status

No `innerHTML` with user data.

---

## 10.3. Message context menu

For own message:

- Reply
- React
- Edit text
- Delete

For admin/moderator:

- Delete any message
- View moderation info if needed

---

## 10.4. Account UI

Add:

- Profile modal/page.
- Change display name.
- Change bio.
- Change avatar.
- Change password.
- Forgot password flow on home page.

---

## 10.5. Accessibility

- All buttons have labels.
- Form labels exist.
- Error messages have `role="alert"`.
- Focus states visible.
- Keyboard navigation works.
- Color contrast acceptable.

---

# PHASE 11 — Testing checklist

## 11.1. Unit tests

Add tests for:

- username validation
- email validation
- password validation
- Argon2 hash/verify
- JWT create/verify
- JWT secret validation
- CSRF service
- filename sanitize
- extension allowlist
- MIME allowlist
- magic bytes validation
- bad-word filter
- role middleware
- message payload validation
- direct conversation pair normalization

---

## 11.2. Integration tests with DB

If `DATABASE_URL` exists:

- migration status.
- register success.
- duplicate username reject.
- login success/fail.
- locked user login reject.
- me endpoint.
- profile update.
- change password.
- forgot password OTP mocked.
- direct conversation create/reuse.
- concurrent direct conversation does not duplicate.
- text message saved.
- history persists after reconnect.
- receiver mismatch rejected.
- mark_read wrong conversation rejected.
- edit own message.
- delete own message.
- admin delete message.
- bad-word filter applies.
- reaction add/remove.
- search messages.

---

## 11.3. Upload tests

- unauthorized upload rejected.
- upload without CSRF rejected.
- valid image accepted with mocked Supabase.
- fake MIME rejected.
- dangerous extension rejected.
- oversized file rejected.
- pending upload required for file socket message.
- pending upload belongs to same user only.
- pending upload TTL works.

---

## 11.4. Socket tests

- socket without token rejected.
- socket invalid token rejected.
- socket valid token connected.
- locked user socket rejected.
- direct text delivered to sender/receiver.
- receiver mismatch rejected.
- user outside conversation cannot load messages.
- mark_read wrong message rejected.
- typing emits only to correct receiver/conversation.
- group/public tests if implemented.
- event rate limit works.

---

## 11.5. Admin tests

- non-admin cannot access admin API.
- admin can list users.
- admin can lock/unlock user.
- admin cannot lock self.
- admin can delete message.
- audit log created.
- bad-word CRUD works.

---

## 11.6. AI tests

- AI route requires auth.
- AI POST requires CSRF.
- input too long rejected.
- provider mocked response saved.
- sessions/messages list works.
- rate limit works.

---

# PHASE 12 — README and documentation

Update README with:

1. Project overview.
2. Features completed.
3. Architecture.
4. Tech stack:
   - Node.js
   - Express
   - Socket.IO
   - Neon Postgres
   - Supabase Storage
   - Argon2id
   - JWT HttpOnly cookie
   - Gemini optional
   - Redis optional
5. Setup Neon:
   - Create project.
   - Copy pooled `DATABASE_URL`.
   - Copy direct `MIGRATION_DATABASE_URL`.
   - Run migration.
6. Setup Supabase:
   - Create bucket `chat-uploads`.
   - Demo public / production private.
   - Allowed MIME.
7. Setup SMTP.
8. Setup Gemini.
9. Setup Redis optional.
10. Local run:

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run check
npm test
npm run dev
```

11. Deploy notes:
   - Render/Railway recommended for long-running Socket.IO server.
   - Use one instance if no Redis adapter.
   - Set all env vars.
   - Use HTTPS.
12. Security notes:
   - never commit `.env`.
   - private bucket recommended.
   - CSRF enabled.
   - upload validation.
   - rate limits.
13. Limitations:
   - no malware scanning unless added.
   - Redis needed for horizontal scale.
   - signed URL expiry behavior.

---

# PHASE 13 — `.env.example` target

Update `.env.example`:

```env
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
APP_BASE_URL=http://localhost:3000

DATABASE_URL=
MIGRATION_DATABASE_URL=

JWT_SECRET=
JWT_EXPIRES_IN=7d
COOKIE_NAME=notket_token
CSRF_COOKIE_NAME=notket_csrf
CSRF_SECRET=

SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=chat-uploads
SUPABASE_STORAGE_PUBLIC=false
SIGNED_URL_TTL_SECONDS=3600
MAX_UPLOAD_BYTES=6291456
MAX_IMAGE_BYTES=6291456
MAX_VOICE_BYTES=10485760
MAX_VOICE_SECONDS=120

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
PASSWORD_RESET_OTP_TTL_MINUTES=10

AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=
AI_RATE_LIMIT_PER_MINUTE=10
AI_MAX_INPUT_CHARS=4000

ENABLE_REDIS_ADAPTER=false
REDIS_URL=

LOG_LEVEL=info
```

---

# PHASE 14 — Suggested file structure

Keep CommonJS. Refactor toward:

```txt
src/
  app.js
  config/
    env.js
  db/
    index.js
    migrate.js
  repositories/
    user.repository.js
    conversation.repository.js
    message.repository.js
    attachment.repository.js
    bad-word.repository.js
    audit.repository.js
    ai.repository.js
    password-reset.repository.js
  services/
    auth.service.js
    password-reset.service.js
    mailer.service.js
    storage.service.js
    supabase.service.js
    message.service.js
    bad-word.service.js
    audit.service.js
    ai.service.js
    csrf.service.js
    rate-limit.service.js
  controllers/
    auth.controller.js
    user.controller.js
    upload.controller.js
    message.controller.js
    admin.controller.js
    ai.controller.js
    password-reset.controller.js
    page.controller.js
    socket.controller.js
  routes/
    auth.routes.js
    user.routes.js
    upload.routes.js
    message.routes.js
    admin.routes.js
    ai.routes.js
    password-reset.routes.js
    web.routes.js
  middlewares/
    auth.middleware.js
    role.middleware.js
    csrf.middleware.js
    upload.middleware.js
    socket-auth.middleware.js
  models/
    presence.model.js
    upload.model.js
  utils/
    sanitize.js
    filename.js
    mime.js
    time.js
    validation.js
    errors.js

views/
  index.html
  chat.html
  admin.html

public/
  css/style.css
  js/client.js
  js/admin.js

migrations/
  001_init.sql
  002_security_and_features.sql
  003_admin_ai_voice_groups.sql

tests/
  helpers/
  auth.service.test.js
  auth.api.test.js
  csrf.test.js
  upload.test.js
  socket.integration.test.js
  admin.test.js
  ai.test.js
```

---

# PHASE 15 — Acceptance criteria

Không được coi là xong nếu thiếu các mục sau.

## Critical pass criteria

- `private_message` không còn tin `receiverId` khi có `conversationId`.
- `mark_read` verify message thuộc conversation.
- Direct conversation không race/duplicate.
- Upload không phụ thuộc presence.
- Upload validate magic bytes hoặc reject loại chưa validate được.
- Argon2id params rõ ràng.
- JWT secret validation.
- CSRF cho unsafe HTTP APIs.
- Socket origin validation.
- `npm run check` pass.
- `npm test` pass hoặc skip rõ khi thiếu external env.

## MVP pass criteria

- Register/login/logout/me chạy.
- Direct chat realtime chạy.
- Load history sau reload chạy.
- Upload image/file chạy.
- Pending upload chống fake URL.
- Edit/delete/reaction nếu phase làm đến.
- Profile/change password nếu phase làm đến.
- README cập nhật đúng.

## Full scope pass criteria

- Public chat.
- Group chat.
- Voice message.
- Forgot password OTP.
- AI chatbot.
- Admin dashboard.
- Bad-word filtering.
- Audit logs.
- Message search.
- Redis optional scale.
- CI workflow.

---

# PHASE 16 — Final report format

Sau khi làm xong, báo lại theo format:

```md
## Tổng quan
- Đã sửa gì?
- Đã thêm gì?
- Còn thiếu gì?

## File đã tạo/sửa
### Config/DB/Migrations
...
### Auth/Security
...
### Chat/Socket
...
### Upload
...
### Frontend
...
### Tests
...

## Security fixes
- private_message authorization: done/not done
- mark_read validation: done/not done
- CSRF: done/not done
- upload magic-byte validation: done/not done
- Argon2 params: done/not done
- Socket origin validation: done/not done

## Cách chạy
npm install
npm run db:migrate
npm run check
npm test
npm run dev

## Test result
- npm run check: pass/fail
- npm test: pass/fail
- db:migrate: pass/fail

## Manual checklist
- register/login/logout
- direct chat
- reload history
- upload image/file
- edit/delete/reaction
- forgot password
- public chat
- group chat
- voice
- AI
- admin

## Hạn chế còn lại
- ...

## Commit message đề xuất
feat: harden realtime chat security and complete core messaging platform
```

---

# PHASE 17 — Nếu task quá lớn, làm theo thứ tự này

Nếu không thể làm hết trong một lượt, bắt buộc chia theo thứ tự ưu tiên:

## P0 — Security hotfix

1. Fix `private_message` receiver/conversation authorization.
2. Fix `mark_read` validation.
3. Fix direct conversation race.
4. Bỏ upload dependency on presence.
5. Upload magic-byte validation.
6. Argon2id params.
7. JWT secret validation.
8. CSRF.
9. Socket origin validation.
10. Tests.

## P1 — DB/migration quality

1. Migration runner.
2. MIGRATION_DATABASE_URL.
3. Schema extension.
4. Indexes.
5. Unread count thật.

## P2 — Account/profile

1. Profile.
2. Avatar.
3. Change password.
4. Forgot password OTP.

## P3 — Message features

1. Edit.
2. Delete.
3. Reactions.
4. Reply.
5. Search.

## P4 — Media

1. Private bucket + signed URL.
2. Attachments table.
3. Voice message.
4. Upload UX.

## P5 — Public/group chat

1. Public room.
2. Group chat.
3. Participant roles.

## P6 — Admin/moderation

1. Role middleware.
2. Admin dashboard.
3. User management.
4. Message management.
5. Bad words.
6. Audit logs.

## P7 — AI

1. Gemini provider.
2. AI sessions.
3. AI UI.
4. Rate limit.

## P8 — Scale/deploy

1. Redis adapter.
2. Redis presence.
3. Health checks.
4. Logging.
5. CI.

---

## Final instruction to agent

Bắt đầu bằng việc inspect code hiện tại. Sau đó triển khai **P0 Security hotfix** trước. Không được triển khai tính năng mới như AI/admin nếu P0 chưa xong. Sau mỗi nhóm sửa, chạy check/test. Nếu có lỗi test, sửa test hoặc code cho đúng, không được xóa test để pass. Nếu thiếu env external như Neon/Supabase/SMTP/Gemini, mock hoặc skip có thông báo rõ ràng.
