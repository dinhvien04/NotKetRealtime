# NotKetRealtime — Review tiếp & Prompt sửa lỗi Round 2

File này dùng để copy vào Kiro / Cline / Cursor / Codex sau lần review mới nhất của repo `dinhvien04/NotKetRealtime`.

Mục tiêu của file này là sửa các lỗi còn sót sau khi dự án đã có auth, Neon Postgres, Supabase Storage, Socket.IO realtime, CSRF, upload validation, admin, AI service, public/group chat, Redis optional, migration runner, health/logging/tests.

---

## Tóm tắt lỗi cần sửa tiếp

1. Orphan direct conversation khi race condition.
2. CSRF token chưa bind chặt với login session.
3. Supabase Storage default đang có thể public nếu thiếu env.
4. Office ZIP validation chưa đủ chặt.
5. `typing` / `stop_typing` vẫn tin `receiverId` từ client.
6. Group role hierarchy chưa chặt.
7. README mâu thuẫn về AI.
8. Gemini API key nằm trong query string.
9. Signed URL enrichment đang tuần tự, chưa tối ưu.
10. CI/check visibility chưa rõ.

---

## Prompt copy cho AI coding agent

```txt
Bạn là senior Node.js security engineer, backend engineer và database engineer. Hãy làm việc trực tiếp trong repo `dinhvien04/NotKetRealtime`.

Mục tiêu:
Review và sửa tiếp dự án NotKetRealtime sau commit mới nhất. Dự án hiện đã có auth, Neon Postgres, Supabase Storage, Socket.IO realtime, CSRF, upload validation, admin, AI service, public/group chat, Redis optional. Tuy nhiên vẫn còn một số lỗi bảo mật, lỗi logic, lỗi data-integrity và tối ưu cần sửa trước khi deploy public.

Không được:
- Không chuyển framework.
- Không đổi sang React/Next.js/NestJS.
- Không đổi sang TypeScript bắt buộc.
- Không rewrite toàn bộ app nếu không cần.
- Không hard-code secret.
- Không commit `.env`.
- Không expose `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` ra frontend.
- Không log secrets/cookies/tokens/API keys.
- Không gửi binary file qua Socket.IO.
- Không lưu file vào local disk lâu dài.
- Không lưu binary vào DB.
- Không dùng `innerHTML` với dữ liệu user.

Bắt buộc:
- Giữ CommonJS.
- Giữ kiến trúc MVC hiện tại.
- Mọi query DB phải parameterized.
- Tất cả API/socket thay đổi dữ liệu phải auth + authorization.
- Sửa xong chạy `npm run check`, `npm test`, và `npm run db:status` nếu có DATABASE_URL.
- Thêm/cập nhật test cho từng lỗi.
- Báo rõ test nào pass/fail, không được giả vờ.

============================================================
PHASE 0 — Inspect trước khi sửa
============================================================

Trước khi sửa, đọc kỹ các file sau:

- `package.json`
- `server.js`
- `src/app.js`
- `src/config/env.js`
- `src/db/index.js`
- `src/db/migrate.js`
- `migrations/*.sql`
- `src/controllers/socket.controller.js`
- `src/controllers/upload.controller.js`
- `src/controllers/auth.controller.js`
- `src/controllers/ai.controller.js`
- `src/controllers/admin.controller.js`
- `src/repositories/conversation.repository.js`
- `src/repositories/message.repository.js`
- `src/repositories/user.repository.js`
- `src/services/auth.service.js`
- `src/services/csrf.service.js`
- `src/services/storage.service.js`
- `src/services/message.service.js`
- `src/services/conversation-message.service.js`
- `src/services/ai.service.js`
- `src/services/ai-providers/gemini.provider.js`
- `src/services/realtime.service.js`
- `src/services/redis.service.js`
- `src/middlewares/csrf.middleware.js`
- `src/middlewares/socket-auth.middleware.js`
- `src/middlewares/socket-origin.middleware.js`
- `src/middlewares/upload.middleware.js`
- `src/utils/file-magic.js`
- `src/utils/logger.js`
- `public/js/client.js`
- `public/js/admin.js`
- `README.md`
- `.env.example`
- `.github/workflows/ci.yml`
- `tests/*`

Sau khi đọc, lập kế hoạch ngắn rồi sửa theo các phase dưới.

============================================================
PHASE 1 — Fix orphan direct conversation khi race condition
============================================================

Vấn đề:
Trong `src/repositories/conversation.repository.js`, hàm tạo direct conversation hiện có thể insert row vào `conversations` trước, rồi insert vào `direct_conversations` bằng `ON CONFLICT DO NOTHING`. Nếu conflict xảy ra, function return conversation winner nhưng conversation vừa tạo có thể bị orphan, tức tồn tại `conversations.type='direct'` nhưng không có mapping trong `direct_conversations` hoặc không có participants đúng.

Yêu cầu sửa:
- Refactor `findOrCreateDirectConversation(userA, userB)` và helper liên quan.
- Chuẩn hóa cặp user:
  - `userLow = min(userA, userB)`
  - `userHigh = max(userA, userB)`
- Không được tạo conversation rác khi hai request chạy cùng lúc.

Cách sửa ưu tiên:
1. Trong transaction, dùng `pg_advisory_xact_lock` theo hash của `userLow:userHigh`.
2. Sau khi lock:
   - SELECT existing direct conversation.
   - Nếu có, return existing conversationId.
   - Nếu chưa có:
     - INSERT conversations type direct.
     - INSERT direct_conversations.
     - INSERT participants cho userA/userB.
     - return conversationId.
3. Không cần retry nhiều lần nếu advisory lock đã làm đúng.

Cách thay thế nếu không dùng advisory lock:
- Nếu `ON CONFLICT DO NOTHING` trả no rows:
  - DELETE conversation vừa tạo trước khi return winner.
  - SELECT lại winner.
- Đảm bảo không còn orphan row.

Cần thêm helper/test:
```sql
SELECT c.id
FROM conversations c
LEFT JOIN direct_conversations dc ON dc.conversation_id = c.id
WHERE c.type = 'direct' AND dc.conversation_id IS NULL;
```
Kết quả phải rỗng sau test.

Tests:
- Tạo user A/B.
- Gọi `findOrCreateDirectConversation(A, B)` 10–20 lần song song.
- Tất cả trả cùng 1 conversationId.
- `direct_conversations` chỉ có 1 row cho cặp đó.
- `conversation_participants` chỉ có A/B trong conversation đó.
- Không có orphan direct conversation.

Acceptance:
- Race condition không crash.
- Không tạo duplicate.
- Không tạo orphan.

============================================================
PHASE 2 — CSRF token phải bind với login session
============================================================

Vấn đề:
CSRF hiện có HMAC, cookie/header match, nhưng token chưa bind đủ chặt với login session. Signed Double Submit Cookie an toàn nên bind với session-specific value thay đổi mỗi lần login.

Yêu cầu:
- Tạo `sid` hoặc `csrfSid` mỗi lần login/register thành công.
- JWT payload phải có:
  - `sub`
  - `username`
  - `displayName`
  - `sid`
  - `iat`
  - `exp`
- CSRF token phải ký HMAC theo:
  - random token
  - `sid`
  - `sub`
- Không dùng email/username làm session-binding chính vì chúng static.
- Khi logout, clear CSRF cookie.
- Khi login/register thành công, rotate CSRF token.

Gợi ý token format:
```txt
<randomHex>.<hmac>
```

HMAC message:
```txt
csrf:<sub>:<sid>:<randomHex>
```

Files cần sửa:
- `src/services/auth.service.js`
- `src/services/csrf.service.js`
- `src/middlewares/csrf.middleware.js`
- `src/controllers/auth.controller.js`
- `src/routes/csrf.routes.js`
- `public/js/client.js`
- tests liên quan CSRF/auth.

Yêu cầu route:
- `GET /api/csrf-token`
  - Nếu đã login, issue token bind với JWT `sub/sid`.
  - Nếu chưa login, issue anonymous token dùng cho login/register.
- `requireCsrf`
  - Với route requireAuth: token bắt buộc verify theo user session.
  - Với login/register: token anonymous hoặc pre-auth token được chấp nhận.
- Sau login/register:
  - Auth cookie mới có sid mới.
  - CSRF cookie/token cũ không còn dùng cho session mới.
  - Client cần fetch lại CSRF token hoặc server trả token mới.

Tests:
- CSRF token của session A không dùng được cho session B.
- Token cũ trước login không dùng được cho route requireAuth sau login.
- Logout clear CSRF cookie.
- POST `/api/uploads` không có CSRF bị reject.
- POST `/api/uploads` có CSRF đúng session pass.
- POST với header token khác cookie token reject.

Acceptance:
- Signed double-submit token có session binding.
- Không phá login/register.
- Client fetch wrapper vẫn hoạt động.

============================================================
PHASE 3 — Supabase Storage phải private-by-default
============================================================

Vấn đề:
`.env.example` đang set `SUPABASE_STORAGE_PUBLIC=false`, nhưng `src/config/env.js` nếu env thiếu có thể default `true`. Với production, default nên an toàn là private.

Yêu cầu:
- Trong `src/config/env.js`, đổi logic:
  - Nếu `SUPABASE_STORAGE_PUBLIC` undefined/empty → `false`
  - `"true"` hoặc `"1"` → true
  - `"false"` hoặc `"0"` → false
- README nói rõ:
  - Default private.
  - Demo muốn public thì tự set `SUPABASE_STORAGE_PUBLIC=true`.
- `storage.service.resolveFileUrl(fileKey)`:
  - Nếu private → signed URL.
  - Nếu public → public URL.
- Không lưu signed URL vĩnh viễn vào DB nếu private.
- Khi load message, tạo signed URL mới nếu cần.

Tests:
- Env unset → false.
- Env `true`/`1` → true.
- Env `false`/`0` → false.
- Private mode trả `expiresAt` nếu upload thành công/mock.

Acceptance:
- Secure-by-default.
- README và code không mâu thuẫn.

============================================================
PHASE 4 — Office ZIP validation phải chặt hơn
============================================================

Vấn đề:
Docx/xlsx/pptx là ZIP-based. Nếu chỉ thấy magic bytes `application/zip` rồi tin declared MIME là docx/xlsx/pptx thì một file ZIP bất kỳ có thể bypass.

Yêu cầu:
- Trong `src/utils/file-magic.js`, tăng cường validation cho Office Open XML:
  - docx phải có:
    - `[Content_Types].xml`
    - `word/document.xml`
  - xlsx phải có:
    - `[Content_Types].xml`
    - `xl/workbook.xml`
  - pptx phải có:
    - `[Content_Types].xml`
    - `ppt/presentation.xml`
- Không extract toàn bộ ZIP ra disk.
- Không giải nén nội dung file.
- Chỉ đọc central directory hoặc dùng package đọc ZIP metadata an toàn.
- Giới hạn số entries đọc, ví dụ max 200.
- Giới hạn filename length trong ZIP.
- Nếu không verify được thì reject.
- Nếu package cần thêm dependency, chọn package nhỏ, phổ biến, maintained.
- Nếu không muốn thêm dependency, tạm thời reject docx/xlsx/pptx trong public mode và ghi rõ trong README.

Không cho upload:
- `.zip`
- `.rar`
- `.7z`
- `.svg`
- `.html`
- `.htm`
- `.js`
- `.mjs`
- `.cjs`
- `.exe`
- `.sh`
- `.bat`
- `.cmd`
- `.php`

Tests:
- Generic ZIP declared as docx bị reject.
- Fake `.docx` không có `word/document.xml` bị reject.
- Valid docx fixture pass nếu có fixture.
- `.svg` bị reject.
- `.jpg.php` bị reject.
- `text/plain` có null bytes bị reject.

Acceptance:
- Không còn tin `application/zip` chung chung.
- Office upload hoặc validate đúng hoặc bị reject rõ.

============================================================
PHASE 5 — Sửa typing / stop_typing authorization
============================================================

Vấn đề:
`typing` và `stop_typing` đang nhận `receiverId` từ client và emit tới đó sau khi chỉ check sender là participant. Client có thể gửi typing tới user không thuộc conversation.

Yêu cầu:
- Trong `src/controllers/socket.controller.js`:
  - Với direct conversation:
    - Check user là participant.
    - Derive receiver bằng `getOtherParticipant(conversationId, user.id)`.
    - Nếu payload có `receiverId` và không khớp receiver thật → reject/ignore.
    - Emit tới receiver thật.
  - Với group:
    - Không dùng `receiverId`.
    - Emit vào `conversation:${conversationId}` hoặc dùng `realtimeService.emitToConversation`.
    - Không gửi lại cho sender nếu không cần.
  - Với public:
    - Có thể bỏ typing public hoặc emit room public nếu UI hỗ trợ.
- Rate limit typing giữ nguyên hoặc chặt hơn.
- `stop_typing` phải dùng logic giống `typing`.

Tests:
- A-B direct: A typing → B nhận.
- A-B direct: A gửi receiverId=C → C không nhận.
- A-B direct: payload receiverId sai → reject/ignore.
- Group: typing chỉ tới members.
- Non participant không gửi được typing.

Acceptance:
- Không còn tin receiverId từ client.
- Không leak typing event sang người ngoài conversation.

============================================================
PHASE 6 — Siết group role hierarchy
============================================================

Vấn đề:
Group role hiện có owner/admin/member nhưng rule remove participant chưa chặt. Admin không nên remove owner hoặc admin khác.

Yêu cầu:
- Tách service group nếu cần: `src/services/conversation.service.js`.
- Role rules:
  - Owner:
    - Có thể đổi tên/avatar group.
    - Có thể add member.
    - Có thể promote/demote admin.
    - Có thể remove admin/member.
    - Không thể tự leave nếu chưa transfer owner.
  - Admin:
    - Có thể add member.
    - Có thể remove member.
    - Không thể remove owner.
    - Không thể remove admin khác.
    - Không thể promote/demote.
  - Member:
    - Chỉ tự leave.
    - Không add/remove người khác.
- Thêm API transfer owner nếu chưa có:
  - `POST /api/conversations/:id/transfer-owner`
  - Chỉ owner hiện tại dùng.
  - Target phải là participant.
  - Owner cũ thành admin hoặc member tùy chọn.
- Không ai được remove người không thuộc nhóm.
- Không ai được tạo group member duplicate.

Tests:
- Admin remove member pass.
- Admin remove owner reject.
- Admin remove admin reject.
- Owner remove admin pass.
- Owner tự leave reject nếu chưa transfer.
- Member remove người khác reject.
- Member self leave pass.
- Transfer owner pass.

Acceptance:
- Role hierarchy rõ ràng.
- UI/admin không bị phá.

============================================================
PHASE 7 — Sửa README mâu thuẫn về AI
============================================================

Vấn đề:
README hiện có chỗ nói AI chatbot đã có, nhưng phần setup lại ghi AI chưa implement. Code thực tế đã có `ai.service.js` và `gemini.provider.js`.

Yêu cầu:
- Sửa README:
  - AI chatbot đã implement.
  - Cần `GEMINI_API_KEY` để dùng provider thật.
  - `NODE_ENV=test` có mock nếu không có key.
  - Liệt kê API thực tế:
    - GET `/api/ai/sessions`
    - POST `/api/ai/sessions`
    - GET `/api/ai/sessions/:id/messages`
    - POST `/api/ai/sessions/:id/messages`
    - DELETE `/api/ai/sessions/:id`
- Cập nhật số lượng test files cho đúng `package.json`.
- Cập nhật migration list cho đúng file thật trong `migrations/`.
- Cập nhật MIME list đúng với code.
- Cập nhật phần storage:
  - default private.
  - public chỉ demo.
- Cập nhật phần CI:
  - workflow chạy on push/pull_request.
  - cần secrets gì.

Acceptance:
- README không còn mâu thuẫn.
- Người mới clone repo setup được theo README.

============================================================
PHASE 8 — Gemini API key handling & log redaction
============================================================

Vấn đề:
`gemini.provider.js` đang truyền key qua query string. Điều này có thể chạy được, nhưng query string dễ lọt vào logs/proxy nếu logger ghi URL.

Yêu cầu:
- Kiểm tra Gemini API hỗ trợ header key hay không.
- Nếu hỗ trợ, chuyển API key sang header.
- Nếu API bắt buộc query string:
  - Tạo helper redaction để logger không bao giờ log full URL có `key=`.
  - Không log request URL Gemini.
- Cập nhật `src/utils/logger.js`:
  - Redact các key:
    - `key=`
    - `api_key=`
    - `token=`
    - `authorization`
    - `cookie`
    - `set-cookie`
    - `DATABASE_URL`
    - `JWT_SECRET`
    - `SUPABASE_SECRET_KEY`
    - `GEMINI_API_KEY`
- Đảm bảo error từ Gemini trả về client không chứa API key.
- AI audit log chỉ lưu provider/model/status, không lưu key.

Tests:
- Logger redacts URL query key.
- Logger redacts Authorization/Cookie.
- Gemini provider error không leak key.

Acceptance:
- Không có secret trong logs/errors.

============================================================
PHASE 9 — Tối ưu signed URL enrichment
============================================================

Vấn đề:
`messageRepository.enrichFileUrls()` đang resolve file URL tuần tự từng message. Nếu load 100 messages có file, private bucket sẽ tạo signed URL tuần tự, chậm và tốn request.

Yêu cầu:
- Dedupe `fileKey` trong cùng request.
- Resolve signed URL bằng concurrency limit 5 hoặc 10.
- Có thể tự implement simple concurrency helper, không cần dependency nếu không muốn.
- Nếu resolve một file lỗi, không fail toàn bộ list:
  - message đó giữ fileUrl null hoặc existing stale URL.
  - có thể set `fileUnavailable: true`.
- Không tạo signed URL cho deleted message.
- Không tạo signed URL cho message không có `fileKey`.
- Cache signed URL ngắn hạn in-memory optional:
  - key: fileKey
  - expiresAt: TTL - 60s
  - không cache quá lâu.

Tests:
- Nhiều messages trùng fileKey chỉ gọi `resolveFileUrl` một lần nếu mock được.
- Một resolve fail không làm fail `listByConversation`.
- Deleted message không resolve URL.

Acceptance:
- Load history nhanh hơn.
- Không fail toàn bộ khi một file lỗi.

============================================================
PHASE 10 — CI / test visibility
============================================================

Yêu cầu:
- Kiểm tra `.github/workflows/ci.yml`.
- Nếu chưa có, tạo file:
  - on: push, pull_request
  - Node LTS
  - npm ci
  - npm run check
  - npm test
- Nếu tests cần DB:
  - Document GitHub secret `DATABASE_URL`.
  - Các test không có DB phải skip rõ ràng, không fail mơ hồ.
- Nếu Supabase/Gemini không có trong CI:
  - Tests phải mock hoặc skip rõ ràng.
- Thêm badge README nếu muốn.

Acceptance:
- Commit/push có status check.
- Người review thấy CI pass/fail rõ.

============================================================
PHASE 11 — Hardening thêm nếu còn thời gian
============================================================

1. Fetch Metadata CSRF defense-in-depth
- Thêm middleware kiểm `Sec-Fetch-Site` cho unsafe methods:
  - reject `cross-site` ở production.
  - allow `same-origin`, `same-site`, `none`.
- Không thay thế CSRF token, chỉ defense-in-depth.

2. Cookie prefix
- Nếu deploy HTTPS production:
  - auth cookie có thể dùng `__Host-notket_token`
  - CSRF cookie `__Host-notket_csrf`
  - secure true
  - path `/`
  - no domain.

3. HSTS/CSP
- Helmet hiện có CSP.
- Kiểm tra CSP không quá lỏng:
  - giảm `'unsafe-inline'` nếu có thể.
  - connectSrc include production app URL/Supabase nếu cần.

4. Admin destructive actions
- Với admin xóa message/user/role change:
  - audit log đầy đủ.
  - optional confirm phrase ở UI.
  - không cho admin tự lock/delete/demote.

5. File cleanup
- Pending upload hết hạn:
  - optional xóa object Supabase nếu chưa được consume.
- Deleted message:
  - optional không xóa file ngay, nhưng admin có cleanup job.

6. DB integrity
- Add constraints:
  - `messages.type in ('text','image','file','voice','system','ai')`
  - `conversations.type in ('direct','group','public','ai')`
  - `users.role in ('user','moderator','admin')`
  - `users.status in ('active','inactive')`
- Add foreign keys nếu thiếu.

============================================================
PHASE 12 — Tests bắt buộc sau sửa
============================================================

Cập nhật hoặc thêm tests:

Direct conversation:
- concurrent create returns same id.
- no orphan direct conversation.

CSRF:
- token session A fails session B.
- token pre-login fails protected route after login.
- missing CSRF rejects unsafe route.
- valid CSRF passes unsafe route.

Upload:
- env default private.
- fake zip declared docx rejects.
- unsafe extension rejects.
- text with null bytes rejects.
- private storage returns signed URL metadata.

Socket:
- typing receiver spoof blocked.
- private_message receiver spoof still blocked.
- mark_read wrong conversation still blocked.
- group role unauthorized actions reject.

Docs:
- README AI section does not say unimplemented if code exists.

Logger:
- query API key redacted.
- cookies/tokens redacted.

Performance:
- signed URL dedupe test if feasible.

============================================================
PHASE 13 — Final report format
============================================================

Sau khi làm xong, trả lời đúng format này:

1. Tổng quan
- Đã sửa những lỗi nào.
- Có thay đổi behavior gì.

2. File đã sửa
- Liệt kê theo nhóm:
  - backend/security
  - DB/migrations
  - frontend
  - tests
  - docs

3. Test result
- `npm run check`: pass/fail
- `npm test`: pass/fail
- `npm run db:status`: pass/fail/không chạy vì thiếu DB

4. Chi tiết fix
- Direct conversation race/orphan
- CSRF session-binding
- Private storage default
- Office ZIP validation
- Typing authorization
- Group role hierarchy
- AI docs/key handling
- Signed URL optimization
- CI

5. Rủi ro còn lại
- Ghi rõ cái gì chưa làm.
- Không được nói “done” nếu chưa test.

6. Commit message đề xuất
Ví dụ:
`fix: harden session-bound CSRF, direct conversations and media validation`
```

---

## Checklist nhanh sau khi agent sửa

Sau khi agent chạy xong, kiểm lại bằng tay:

```bash
npm install
npm run db:migrate
npm run db:status
npm run check
npm test
npm run dev
```

Test thủ công:

- Đăng ký user A/B/C.
- A chat B.
- A cố spoof receiverId C trong direct conversation A-B → phải fail.
- A typing trong A-B, C không được nhận.
- Tạo group:
  - owner add admin/member.
  - admin remove member được.
  - admin remove owner/admin khác bị chặn.
- Upload:
  - ảnh thật pass.
  - `.svg` reject.
  - `.zip` fake docx reject.
  - private bucket trả signed URL.
- CSRF:
  - gọi POST không header `X-CSRF-Token` → 403.
  - login xong token cũ không dùng được cho session mới.
- AI:
  - không có `GEMINI_API_KEY` ở dev/test không crash UI.
  - có key thì AI trả lời.
  - log không chứa key.
- Admin:
  - user thường không vào `/admin`.
  - moderator không đổi role admin.
  - admin không tự khóa/xóa mình.
- README:
  - setup Neon/Supabase/SMTP/Gemini đúng với code.

---

## Nguồn tham khảo chính

- OWASP CSRF Prevention Cheat Sheet
- OWASP File Upload Cheat Sheet
- OWASP Password Storage Cheat Sheet
- Express Production Best Practices: Security
- Socket.IO Middlewares
- Socket.IO Redis Adapter
- Supabase Storage Standard Uploads
- Neon Connection Pooling
