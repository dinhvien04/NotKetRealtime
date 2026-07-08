# NotKetRealtime — Prompt thêm Iconify Icon Picker, Icon Reactions và Group Icons

File này dùng để copy vào Kiro / Cline / Cursor / Codex để thêm hệ thống icon cho repo `dinhvien04/NotKetRealtime`.

Mục tiêu chính:

- Thêm Iconify icon picker cho frontend HTML/CSS/JS thuần.
- Message reactions hỗ trợ cả emoji và Iconify icons.
- Group chat có thể chọn icon + màu.
- Không lưu SVG raw vào database.
- Chỉ lưu `iconName` dạng `prefix:name`, ví dụ `lucide:heart`, `mdi:account-group`.
- Backend phải validate icon name, prefix, color.
- Không cho user inject raw SVG / HTML / URL / script.
- Giữ CommonJS, không chuyển sang React/Next.js.

---

## Bối cảnh kỹ thuật

Iconify có public API và icon components để load icon on-demand. Iconify API có thể dùng để search icons cho icon picker và public API hiện host hơn 275k icons từ hơn 200 open-source icon sets. Web component `<iconify-icon>` có thể render icon bằng attribute `icon="prefix:name"`.

Với app này, hướng khuyên dùng:

```txt
Frontend:
  Iconify Web Component để render icon.
  Icon picker gọi API nội bộ /api/icons/search.
  Không tự tin input user.

Backend:
  Validate iconName format + allowed prefix.
  Không lưu SVG.
  Lưu iconName + color vào Neon Postgres.

Database:
  message_reactions hỗ trợ reaction_type emoji|icon.
  conversations hỗ trợ icon_name + icon_color cho group/public.
  user_recent_icons để lưu icon gần đây.
```

---

# PROMPT COPY CHO AI CODING AGENT

```txt
Bạn là senior full-stack Node.js engineer. Hãy thêm tính năng Iconify icon picker vào repo `dinhvien04/NotKetRealtime`.

Mục tiêu:
1. Thêm Iconify icon picker.
2. Message reactions hỗ trợ emoji và Iconify icons.
3. Group chat có icon/avatar bằng Iconify icon + màu.
4. User có recent icons.
5. Backend validate icon input, không tin client.
6. Không lưu SVG raw vào DB.
7. Không render user input bằng innerHTML.
8. Giữ frontend HTML/CSS/JS thuần.
9. Giữ CommonJS.
10. Không phá chat/reaction/group hiện có.

Không được:
- Không chuyển sang React/Next.js.
- Không lưu SVG raw.
- Không cho raw HTML/SVG/URL làm icon.
- Không cho arbitrary prefix ngoài allowlist.
- Không expose secret ra frontend.
- Không dùng innerHTML với dữ liệu user.
- Không làm vỡ emoji reaction cũ.

============================================================
PHASE 0 — Inspect trước khi sửa
============================================================

Đọc kỹ các file sau trước khi sửa:

- `package.json`
- `server.js`
- `src/app.js`
- `src/config/env.js`
- `src/controllers/socket.controller.js`
- `src/controllers/conversation.controller.js`
- `src/controllers/message.controller.js`
- `src/routes/message.routes.js`
- `src/routes/conversation.routes.js`
- `src/repositories/reaction.repository.js`
- `src/repositories/conversation.repository.js`
- `src/repositories/message.repository.js`
- `src/services/message.service.js`
- `src/services/admin.service.js`
- `src/utils/emoji.js`
- `src/utils/sanitize.js`
- `migrations/*.sql`
- `views/chat.html`
- `views/admin.html`
- `public/js/client.js`
- `public/js/admin.js`
- `public/css/style.css`
- `tests/*`
- `README.md`
- `.env.example`

Sau khi inspect, lập kế hoạch ngắn rồi code theo các phase dưới.

============================================================
PHASE 1 — Thêm Iconify Web Component cho frontend
============================================================

Cách nhanh nhất:
- Thêm script vào `views/chat.html`.
- Nếu admin cần hiển thị icon group/user, thêm vào `views/admin.html`.

Script:

```html
<script src="https://code.iconify.design/iconify-icon/3.0.0/iconify-icon.min.js"></script>
```

Yêu cầu:
- Render icon bằng Web Component:
  ```html
  <iconify-icon icon="lucide:heart"></iconify-icon>
  ```
- Trong JS, luôn tạo element an toàn:
  ```js
  const icon = document.createElement("iconify-icon");
  icon.setAttribute("icon", iconName);
  if (color) icon.style.color = color;
  ```
- Không render bằng `innerHTML`.
- Không đưa raw SVG từ user vào DOM.
- Nếu muốn production self-host sau này, thêm ghi chú trong README.

Nếu CSP đang chặn CDN:
- Update Helmet CSP:
  - `scriptSrc` thêm `https://code.iconify.design`
  - `connectSrc` thêm `https://api.iconify.design` nếu dùng Iconify API search/load.
- Nếu project đã self-host iconify package, không cần CDN.

============================================================
PHASE 2 — Config env cho icon
============================================================

Cập nhật `.env.example`:

```env
ICON_ALLOWED_PREFIXES=lucide,mdi,material-symbols
ICON_DEFAULT_PREFIX=lucide
ICON_MAX_RECENT=30
ICON_MAX_SEARCH_RESULTS=60
ICON_USE_ICONIFY_API=true
```

Cập nhật `src/config/env.js`:

Thêm getters:
- `iconAllowedPrefixes`
- `iconDefaultPrefix`
- `iconMaxRecent`
- `iconMaxSearchResults`
- `iconUseIconifyApi`

Rules:
- `ICON_ALLOWED_PREFIXES` split bằng comma, trim, lowercase.
- Default: `["lucide", "mdi", "material-symbols"]`.
- `ICON_DEFAULT_PREFIX` phải nằm trong allowed prefixes; nếu không thì fallback `lucide`.
- `ICON_MAX_RECENT` default 30.
- `ICON_MAX_SEARCH_RESULTS` default 60.
- `ICON_USE_ICONIFY_API` default true.

============================================================
PHASE 3 — Backend icon validation utility
============================================================

Tạo file:

- `src/utils/icon.js`

Implement:

```js
function parseIconName(iconName) {}
function isValidIconName(iconName) {}
function isAllowedIconPrefix(prefix) {}
function validateIconName(iconName) {}
function validateIconColor(color) {}
function normalizeIconColor(color) {}
function isEmojiReaction(value) {}
function isIconReaction(value) {}
function normalizeReactionPayload(payload) {}
```

Rules iconName:
- Must be string.
- Max length: 120.
- Format: `prefix:name`
- Regex:
  ```js
  /^([a-z0-9-]+):([a-z0-9][a-z0-9-]*[a-z0-9])$/
  ```
- Prefix must be in `config.iconAllowedPrefixes`.
- Name lowercase only.
- Reject:
  - raw SVG
  - HTML
  - URLs
  - data URLs
  - JavaScript URLs
  - quotes
  - spaces
  - `<`, `>`, `/`, `\`

Rules color:
- Optional.
- Null/empty allowed.
- Only hex:
  - `#RGB`
  - `#RRGGBB`
- Normalize to lowercase.
- Reject arbitrary CSS:
  - `red`
  - `url(...)`
  - `var(...)`
  - `expression(...)`
  - `rgba(...)`
  - `;`

Reaction payload:
- Existing emoji payload must still work:
  - `{ emoji: "❤️" }`
- New icon payload:
  - `{ reactionType: "icon", value: "lucide:heart", color: "#ef4444" }`
- Normalize output:
  ```js
  {
    reactionType: "emoji" | "icon",
    value: "...",
    color: null | "#ef4444"
  }
  ```

Nếu repo đã có `src/utils/emoji.js`, reuse nó cho emoji allowlist.

============================================================
PHASE 4 — Database migration
============================================================

Tạo migration mới:

- `migrations/007_iconify_icons.sql`

Yêu cầu:

1. Update `message_reactions`.

Nếu bảng hiện có `emoji`, giữ backward compatibility.

Add columns if not exists:
```sql
ALTER TABLE message_reactions
ADD COLUMN IF NOT EXISTS reaction_type varchar(20) NOT NULL DEFAULT 'emoji';

ALTER TABLE message_reactions
ADD COLUMN IF NOT EXISTS value varchar(120);

ALTER TABLE message_reactions
ADD COLUMN IF NOT EXISTS color varchar(20);
```

Backfill:
```sql
UPDATE message_reactions
SET value = emoji
WHERE value IS NULL AND emoji IS NOT NULL;
```

Add constraints:
```sql
ALTER TABLE message_reactions
ADD CONSTRAINT message_reactions_type_check
CHECK (reaction_type IN ('emoji', 'icon'));
```

Nếu unique cũ chỉ theo `(message_id, user_id, emoji)`, migrate sang:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_unique_idx
ON message_reactions (message_id, user_id, reaction_type, value);
```

Nếu constraint/index cũ conflict, drop cẩn thận bằng tên thật sau khi inspect schema.

2. Add group/public icon columns:
```sql
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS icon_name varchar(120);

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS icon_color varchar(20);
```

3. Recent icons:
```sql
CREATE TABLE IF NOT EXISTS user_recent_icons (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icon_name varchar(120) NOT NULL,
  icon_color varchar(20),
  used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, icon_name)
);

CREATE INDEX IF NOT EXISTS user_recent_icons_user_used_idx
ON user_recent_icons (user_id, used_at DESC);
```

Không lưu SVG raw.

============================================================
PHASE 5 — Repository updates
============================================================

Cập nhật `src/repositories/reaction.repository.js`.

Support:

```js
async function addReaction({ messageId, userId, reactionType, value, color }) {}
async function removeReaction({ messageId, userId, reactionType, value }) {}
async function listByMessageIds(messageIds) {}
```

Return reaction format:

```js
{
  type: "emoji" | "icon",
  value: "❤️" | "lucide:heart",
  color: "#ef4444" | null,
  count: 3,
  users: [...]
}
```

Backward compatibility:
- Nếu row cũ có `emoji`, map:
  - `type = "emoji"`
  - `value = emoji`
  - `color = null`

Cập nhật `src/repositories/conversation.repository.js`:
- `mapConversationRow()` include:
  - `iconName`
  - `iconColor`
- `createGroup()` accept:
  - `iconName`
  - `iconColor`
- `updateGroup()` accept:
  - `iconName`
  - `iconColor`
- Public room có thể default:
  - `iconName = "lucide:globe-2"`
  - `iconColor = "#22c55e"`

Tạo `src/repositories/icon.repository.js`:
```js
async function listRecentIcons(userId, limit) {}
async function upsertRecentIcon(userId, iconName, iconColor) {}
async function deleteRecentIcon(userId, iconName) {}
async function trimRecentIcons(userId, maxRecent) {}
```

`trimRecentIcons` xóa icon cũ nếu vượt `ICON_MAX_RECENT`.

============================================================
PHASE 6 — Icon service
============================================================

Tạo `src/services/icon.service.js`.

Functions:
```js
function validateIconSelection({ iconName, color }) {}
async function listRecentIcons(userId) {}
async function rememberIcon(userId, iconName, color) {}
async function searchIconSuggestions({ query, prefix, limit }) {}
```

Popular fallback:
```js
const POPULAR_ICONS = [
  "lucide:heart",
  "lucide:thumbs-up",
  "lucide:smile",
  "lucide:star",
  "lucide:flame",
  "lucide:party-popper",
  "lucide:zap",
  "lucide:check",
  "lucide:x",
  "lucide:globe-2",
  "lucide:users",
  "mdi:account-group",
  "mdi:robot",
  "mdi:chat",
  "mdi:image",
  "material-symbols:favorite",
  "material-symbols:thumb-up"
];
```

Search logic:
- If `ICON_USE_ICONIFY_API=true`:
  - Call Iconify API search endpoint.
  - Add timeout 2–3 seconds.
  - Cache results in-memory for 5–10 minutes.
  - Rate limit route.
  - If API fails, return fallback popular icons filtered by query/prefix.
- If false:
  - Only search fallback curated list.

Do not proxy arbitrary URL.
Do not fetch icon SVG from backend for each render.
Do not store API results as trusted without validation.

============================================================
PHASE 7 — Icon API routes
============================================================

Tạo:
- `src/controllers/icon.controller.js`
- `src/routes/icon.routes.js`

Mount in `src/app.js`:
```js
app.use("/api/icons", iconRoutes);
```

Routes:

1. `GET /api/icons/config`
- requireAuth
- returns:
```json
{
  "ok": true,
  "allowedPrefixes": ["lucide", "mdi", "material-symbols"],
  "defaultPrefix": "lucide",
  "maxRecent": 30,
  "maxSearchResults": 60
}
```

2. `GET /api/icons/recent`
- requireAuth
- returns recent icons.

3. `POST /api/icons/recent`
- requireAuth
- requireCsrf
- body:
```json
{
  "iconName": "lucide:heart",
  "color": "#ef4444"
}
```
- validate and save.

4. `GET /api/icons/search?q=&prefix=&limit=`
- requireAuth
- rate limit 60/minute.
- validate prefix in allowlist.
- return:
```json
{
  "ok": true,
  "icons": [
    {
      "iconName": "lucide:heart",
      "label": "heart",
      "prefix": "lucide"
    }
  ]
}
```

Rate limit:
- Use `express-rate-limit`.
- Search route: 60/min/IP.
- Save recent: normal CSRF + auth.

============================================================
PHASE 8 — Message reactions support icon
============================================================

Update:
- `src/services/message.service.js`
- `src/controllers/socket.controller.js`
- `src/routes/message.routes.js`
- `src/repositories/reaction.repository.js`
- `public/js/client.js`

New socket payload:

```js
{
  messageId,
  reactionType: "emoji" | "icon",
  value: "❤️" | "lucide:heart",
  color: "#ef4444"
}
```

Backward compatibility:
```js
{
  messageId,
  emoji: "❤️"
}
```

Backend:
- Normalize reaction payload.
- Verify message exists.
- Verify actor can access message conversation.
- If emoji:
  - use emoji allowlist.
- If icon:
  - `validateIconName(value)`
  - `validateIconColor(color)`
  - prefix allowlist.
- Add reaction.
- Remember recent icon if icon reaction.
- Broadcast:
```js
{
  conversationId,
  messageId,
  reactionType,
  value,
  color,
  userId,
  reactions
}
```

Remove reaction:
- Same normalization.
- Remove exact `(messageId, userId, reactionType, value)`.

Frontend:
- Existing emoji reactions still render.
- Icon reactions render with `<iconify-icon>`.
- Show count.
- Own reaction click toggles remove.
- Add button opens reaction picker:
  - emoji quick row.
  - icon picker tab.
- Do not use innerHTML for iconName/value.

============================================================
PHASE 9 — Group icon picker
============================================================

Backend:
- Group create accepts:
```json
{
  "name": "Team",
  "memberIds": [],
  "iconName": "lucide:users",
  "iconColor": "#22c55e"
}
```
- Group update accepts:
```json
{
  "name": "Team 2",
  "iconName": "mdi:account-group",
  "iconColor": "#3b82f6"
}
```
- Validate via `icon.service`.
- Only owner/admin can update group icon.
- Direct conversation cannot update icon through group endpoint.
- Public room icon may be fixed or admin-only.

Frontend:
- In group create modal:
  - Add icon picker button.
  - Add color picker.
  - Show selected icon preview.
- In group settings:
  - Owner/admin can change icon.
- Sidebar:
  - If `conversation.iconName` exists, render group icon.
  - Else fallback initials/avatar.
- Chat header:
  - render group icon if exists.
- Public room:
  - show `lucide:globe-2` or configured icon.

============================================================
PHASE 10 — Frontend reusable icon picker
============================================================

Create optional file:
- `public/js/icon-picker.js`

Or implement inside `public/js/client.js` if project is simpler.

Features:
- Open/close popover/modal.
- Search input.
- Prefix filter:
  - all
  - lucide
  - mdi
  - material-symbols
- Recent icons section.
- Popular icons section.
- Search results grid.
- Color presets:
  - `#ef4444`
  - `#f97316`
  - `#eab308`
  - `#22c55e`
  - `#06b6d4`
  - `#3b82f6`
  - `#8b5cf6`
  - `#ec4899`
  - `#64748b`
- Custom hex input.
- Keyboard:
  - Escape closes.
  - Enter selects highlighted icon.
- Loading state.
- Empty state.
- API failure fallback to popular icons.
- Debounce search 250ms.

JS safety:
- Create DOM nodes manually.
- Use textContent for labels.
- Use `setAttribute("icon", iconName)` only after validation.
- No innerHTML with user/API data.

============================================================
PHASE 11 — CSS
============================================================

Update `public/css/style.css`.

Add classes:
- `.icon-picker`
- `.icon-picker-backdrop`
- `.icon-picker-panel`
- `.icon-picker-search`
- `.icon-picker-prefix-tabs`
- `.icon-picker-grid`
- `.icon-picker-item`
- `.icon-picker-item.is-selected`
- `.icon-picker-color-row`
- `.icon-picker-color`
- `.icon-reaction`
- `.reaction-icon`
- `.group-icon`
- `.group-icon-preview`
- `.conversation-icon`

Style:
- mobile responsive.
- dark theme compatible.
- reaction icons 16–18px.
- picker icons 24–28px.
- group/sidebar icons 32–40px.
- focus visible.
- hover states.

============================================================
PHASE 12 — Security hardening
============================================================

Bắt buộc:
- No raw SVG in DB.
- No raw SVG from user.
- No arbitrary icon provider URL.
- No unvalidated prefix.
- No unvalidated color CSS.
- No innerHTML.
- Prefix allowlist.
- Max icon length.
- Rate limit icon search.
- Timeout Iconify API fetch.
- Cache Iconify API results.
- Fallback if API down.
- CSP updated only for required domains.
- If using CDN, README notes production can self-host.
- Do not trust frontend icon picker; backend validates again.

CSP:
- If using CDN:
  - script-src include `https://code.iconify.design`
- If icon component loads icons from API:
  - connect-src include `https://api.iconify.design`
  - maybe backup hosts if component needs:
    - `https://api.simplesvg.com`
    - `https://api.unisvg.com`
- Do not use wildcard `*` in production.

============================================================
PHASE 13 — README update
============================================================

Add section: `Iconify icons`

Explain:
- App supports icon reactions and group icons.
- DB stores:
  - `iconName`
  - `iconColor`
- DB does not store raw SVG.
- Supported prefixes configured by:
```env
ICON_ALLOWED_PREFIXES=lucide,mdi,material-symbols
ICON_DEFAULT_PREFIX=lucide
ICON_MAX_RECENT=30
ICON_MAX_SEARCH_RESULTS=60
ICON_USE_ICONIFY_API=true
```
- If using CDN:
  - app loads Iconify Web Component from `code.iconify.design`.
- If using API:
  - search uses Iconify API.
  - fallback list works if API unavailable.
- Production option:
  - self-host Iconify Web Component/API or install selected `@iconify-json/*` packages.
- Licenses:
  - Iconify aggregates icon sets; each icon set has its own license.
  - Check license before commercial use.

============================================================
PHASE 14 — Tests
============================================================

Add/update tests:

1. `tests/icon.utils.test.js`
- valid `lucide:heart` pass.
- valid `mdi:account-group` pass.
- invalid raw SVG reject.
- invalid HTML reject.
- invalid URL reject.
- disallowed prefix reject.
- uppercase icon reject or normalize consistently.
- bad color reject.
- good hex colors pass.

2. `tests/icon.api.test.js`
- config route returns prefixes.
- recent icons require auth.
- save recent icon requires CSRF.
- save invalid icon rejects.
- search returns fallback icons.
- search prefix outside allowlist rejects.

3. `tests/reaction.service.test.js`
- old emoji payload still works.
- icon reaction works.
- invalid icon rejected.
- disallowed prefix rejected.
- reaction list maps icon and emoji.

4. `tests/group.icon.test.js`
- create group with icon.
- update group icon as owner/admin.
- member cannot update group icon.
- invalid icon rejected.
- direct conversation cannot update group icon.

5. Socket integration:
- `add_reaction` with icon broadcasts proper payload.
- `remove_reaction` with icon works.
- old emoji reaction still works.

Run:
```bash
npm run check
npm test
```

If DB tests require `DATABASE_URL`, skip clearly when missing, do not fail mysteriously.

============================================================
PHASE 15 — Acceptance criteria
============================================================

Done khi:

- User có thể mở icon picker.
- User search/select icon.
- User chọn màu icon.
- User react message bằng Iconify icon.
- Emoji reaction cũ vẫn hoạt động.
- Group có thể chọn icon khi tạo/sửa.
- Sidebar/chat header render group icon.
- Recent icons hoạt động.
- Backend reject invalid icon.
- Backend reject disallowed prefix.
- Backend reject invalid color.
- Không lưu SVG raw trong DB.
- Không dùng innerHTML cho icon user data.
- Tests pass.

============================================================
PHASE 16 — Final report format
============================================================

Sau khi code xong, báo lại:

1. Tổng quan thay đổi.
2. File đã tạo/sửa.
3. Migration mới.
4. API mới.
5. Env mới.
6. Frontend UI mới.
7. Cách test thủ công.
8. Test result:
   - `npm run check`
   - `npm test`
9. Hạn chế còn lại.
10. Commit message đề xuất:

```txt
feat: add Iconify icon picker, icon reactions and group icons
```
```

---

## Checklist test thủ công sau khi agent làm xong

1. Đăng nhập user A/B.
2. A gửi message cho B.
3. A react message bằng emoji cũ.
4. A react message bằng `lucide:heart`.
5. B nhìn thấy icon reaction realtime.
6. A remove icon reaction.
7. Tạo group với `lucide:users`, màu xanh.
8. Sidebar hiển thị group icon.
9. Update group icon sang `mdi:account-group`.
10. Thử icon invalid:
    - `<svg>`
    - `https://example.com/icon.svg`
    - `badprefix:heart`
    - `lucide:heart" onclick="alert(1)`
    - color `url(javascript:alert(1))`
11. Tất cả invalid phải reject.
12. Tắt mạng/API Iconify, fallback popular icons vẫn có.
13. Run:
    ```bash
    npm run check
    npm test
    ```

---

## Gợi ý icon sets nên cho phép ban đầu

```env
ICON_ALLOWED_PREFIXES=lucide,mdi,material-symbols
ICON_DEFAULT_PREFIX=lucide
```

- `lucide`: đẹp, nhẹ, hợp UI chat.
- `mdi`: nhiều icon, hợp group/avatar/admin.
- `material-symbols`: quen mắt, nhiều lựa chọn.

Không nên mở tất cả prefix ngay từ đầu. Mở ít để dễ validate, dễ kiểm soát UI và license.
