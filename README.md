# NotKet Documents

Personal documents chat for a **single user** — no login, no multi-user chat, no AI, no admin.

- **Home** `/` — simple landing + optional access key gate  
- **My Documents** `/documents` — text notes, image/file uploads, search/filter, storage usage  

### Where data lives

| Store | What it holds |
|--------|----------------|
| **AWS S3** (private bucket) | **Real file bytes** (images, PDF, Office, txt). Browser uploads via **presigned PUT**; opens via **signed GET**. |
| **Neon Postgres** | **Metadata + history only** — message text, `file_key`, display name, mime, size, timestamps. **Never** stores binary. |

Do not put AWS secrets in the frontend. Do not commit `.env`.

## Features

- Text messages
- Image & file upload via S3 presigned URL
- Search / filter (all · text · image · file)
- Soft-delete messages
- Storage usage meter
- Optional access key (`X-App-Access-Key`) for public deploys
- REST-only (no Socket.IO) — easy on Vercel
- Rate limits: light on GET messages, stricter on writes + upload sign
- Links panel: extracts `http(s)` / `www.` from text notes (sanitized; no `javascript:`)
- S3 content check: full body for text/Office; first 8KB **magic-byte** check for image/PDF (Vercel-friendly) — **not antivirus**
- In-memory signed GET URL cache (TTL = signed TTL − 60s); pending-upload cleanup on sign

## Setup

```bash
npm install
cp .env.example .env
# fill DATABASE_URL, S3_*, APP_ACCESS_KEY (if protected)
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

## Environment

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `MIGRATION_DATABASE_URL` | Optional; defaults to `DATABASE_URL` |
| `APP_OPEN_MODE` | **`true` = demo only.** Anyone with the link can upload to **your** S3. **Do not use for real production data.** |
| `ALLOW_PUBLIC_DEMO_UPLOADS` | Required **in addition** to open mode when `NODE_ENV=production`. Default fail-fast blocks public open mode in production. |
| `APP_ACCESS_KEY` | Shared app gate when `APP_OPEN_MODE=false` (min 32 chars in production). **Not** multi-user login: **anyone who knows the key can use the whole app** (read/upload/delete). Treat it like a password and rotate if leaked. |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | Private bucket recommended |
| `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` | For S3-compatible providers |
| `S3_PUBLIC_BASE_URL` | Optional CDN/public base; otherwise signed GET URLs |
| `MAX_IMAGE_BYTES` | Default ~6MB — image uploads |
| `MAX_FILE_BYTES` | Default ~10MB — non-image files. If Vercel times out on large text/Office verify, set to `6291456` (6MB) and you can full-read all types more safely. Image/PDF verify only reads first 8KB magic bytes. |
| `STORAGE_LIMIT_BYTES` | Total quota for committed + pending uploads |
| `NODE_ENV` | Set **`production`** on deploy so static assets get `maxAge` 1h; API responses always `Cache-Control: no-store`. |

### Security modes

**MODE A — open demo** (`APP_OPEN_MODE=true`) — **local / demo only**  
**Anyone who has the URL can list, send text, and upload files to your S3 bucket.**  
Never use for personal/production data. In production the process **exits on startup** unless you also set `ALLOW_PUBLIC_DEMO_UPLOADS=true` (explicit opt-in, still strongly discouraged).

**MODE B — access key** (`APP_OPEN_MODE=false`) — **recommended for any public deploy**  
User enters a shared app key once on the home page; it is stored in `localStorage` as `notket_access_key` and sent as header `X-App-Access-Key`. No cookies, JWT, or user table.

**`APP_ACCESS_KEY` is not strong multi-user auth.** It is a single shared secret for the whole app. There are no per-user accounts, roles, or audit of “who” used the key. Anyone with the key has full access (send text, upload to your S3, delete messages). Do not share the key publicly; change it if exposed.

Never put AWS secrets in the frontend. Never commit `.env`.

## S3 CORS (production checklist)

Browser **PUT** goes **directly to S3** (not through Vercel). The bucket **must** allow your app origin.

### Checklist

1. [ ] Bucket is **private** (no public-read ACL / public policy for objects).
2. [ ] CORS `AllowedOrigins` includes **exact** production URL(s), e.g. `https://not-ket-realtime.vercel.app`.
3. [ ] **Custom domain:** if the app is served from e.g. `https://docs.example.com`, add **that exact origin** to S3 CORS `AllowedOrigins` **and** to app env `CLIENT_ORIGIN` / `APP_BASE_URL` (comma-separated if multiple). Mismatch → browser PUT fails with CORS.
4. [ ] CORS includes local origin when developing: `http://localhost:3000`.
5. [ ] `AllowedMethods` includes **`PUT`**, **`GET`**, **`HEAD`**.
6. [ ] `AllowedHeaders` is `*` (or at least `Content-Type` and any headers the browser sends on PUT).
7. [ ] `ExposeHeaders` includes **`ETag`**.
8. [ ] After changing CORS, hard-refresh the browser and retry upload (failed OPTIONS / toast “Kiểm tra S3 CORS AllowedOrigins” = CORS misconfig).
9. [ ] CSP: set `S3_BUCKET` + `S3_REGION` (or `S3_ENDPOINT`) so `connect-src` allows the S3 host.

### Example CORS JSON

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://not-ket-realtime.vercel.app",
      "https://docs.example.com"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Replace hostnames with **your** Vercel URL and **custom domain** (if any).  
Matching Vercel env example:

```env
APP_BASE_URL=https://docs.example.com
CLIENT_ORIGIN=https://docs.example.com,https://not-ket-realtime.vercel.app
```

Reads use **signed GET** URLs (unless you set `S3_PUBLIC_BASE_URL`).

## Scripts

```bash
npm run dev          # local server with watch
npm run db:migrate   # apply SQL migrations
npm run check        # syntax check
npm test             # unit / light API tests
```

## Vercel

Socket.IO is removed; REST + serverless is supported.

1. Set env vars in the Vercel dashboard (same as `.env.example`).
2. Set **`NODE_ENV=production`** (Vercel usually sets this automatically).
3. Add your Vercel domain to **S3 CORS**.
4. Run migrations against Neon (`npm run db:migrate` locally or CI).
5. `vercel.json` routes all traffic to `server.js`.

Pending uploads are stored in Postgres table `document_uploads` (not in-memory) so multi-instance / serverless is safe. Expired pending rows are cleaned lightly on each `POST /api/uploads/sign` (≤20 items; orphan S3 objects deleted when no matching message). Optional: `POST /api/storage/cleanup`.

### File validation note

Confirm-upload validation is **magic-byte / structure checks** (e.g. PNG/JPEG/PDF headers, Office ZIP layout, text null-byte scan). It is **not antivirus** and does not guarantee a file is safe. For stronger confidence under serverless limits, lower `MAX_FILE_BYTES=6291456` so full-body checks stay small.

## API (protected when not open mode)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/app/config` | Public app config (no secrets) |
| GET | `/api/messages` | List / search messages |
| POST | `/api/messages` | Create text message |
| POST | `/api/messages/file` | Confirm uploaded file message |
| DELETE | `/api/messages/:id` | Soft delete |
| POST | `/api/uploads/sign` | Presigned PUT |
| POST | `/api/uploads/refresh-url` | New signed GET |
| GET | `/api/storage/usage` | Used / limit + recent media |
| POST | `/api/storage/cleanup` | Light cleanup expired pending uploads |
| GET | `/health` | Health |

## Manual test checklist

### App flow
1. Open `/`
2. If protected, enter access key
3. Open `/documents`
4. Send text → reload → still there
5. Open image/file via signed URL (new tab; no toast “URL file không hợp lệ”)
6. Search + filter image/file/text; Links panel shows `https://` from notes
7. Delete a message
8. Network tab: no AWS secret / access key in JS bundles

### Uploads & validation (local or Vercel)
1. Upload real **PNG/JPG ~5–6MB** (near `MAX_IMAGE_BYTES`) — progress: **“Đang tải lên S3...”** then **“Đang kiểm tra file...”**
2. Upload real **PDF** and **TXT** near `MAX_FILE_BYTES` (default 10MB)
3. After upload, **click open** → signed GET in new tab works
4. Fake `image/png` with text body → **reject** (magic-byte only, not AV)
5. Extensions **`.svg` / `.html` / `.zip` / `.js` / `.exe`** → **reject**
6. If confirm step times out on large files on Vercel: set  
   `MAX_FILE_BYTES=6291456`  
   (image/PDF already use 8KB prefix validation)

### Perceived performance
1. Send text → bubble appears immediately (optimistic); API fail → mark error / gỡ
2. Open `/documents` → message list loads before storage/info panel
3. Network: static `/css` `/js` may cache in production; `/api/*` is `no-store`

### S3 + Vercel
1. CORS includes Vercel **and** custom domain (if any); `CLIENT_ORIGIN` / `APP_BASE_URL` match
2. Presigned PUT succeeds from browser (Network → S3 host, status 200)
3. Bad CORS → toast: **“Upload thất bại. Kiểm tra S3 CORS AllowedOrigins nếu đang deploy.”**
4. Backend verify fail → toast: **“File không hợp lệ hoặc metadata không khớp.”**
5. Refresh page → history from Neon; files still open via signed GET

## License

MIT
