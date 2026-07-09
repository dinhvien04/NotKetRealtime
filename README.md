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
- S3 content check: full body for text/Office; first 8KB magic-byte check for image/PDF (Vercel-friendly)

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
| `APP_ACCESS_KEY` | Required when `APP_OPEN_MODE=false` (min 32 chars in production) |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | Private bucket recommended |
| `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` | For S3-compatible providers |
| `S3_PUBLIC_BASE_URL` | Optional CDN/public base; otherwise signed GET URLs |
| `MAX_IMAGE_BYTES` | Default ~6MB — image uploads |
| `MAX_FILE_BYTES` | Default ~10MB — non-image files. If Vercel times out on large text/Office verify, set to `6291456` (6MB). Image/PDF verify only reads first 8KB. |
| `STORAGE_LIMIT_BYTES` | Total quota for committed + pending uploads |

### Security modes

**MODE A — open demo** (`APP_OPEN_MODE=true`) — **local / demo only**  
**Anyone who has the URL can list, send text, and upload files to your S3 bucket.**  
Never use for personal/production data. In production the process **exits on startup** unless you also set `ALLOW_PUBLIC_DEMO_UPLOADS=true` (explicit opt-in, still strongly discouraged).

**MODE B — access key** (`APP_OPEN_MODE=false`) — **recommended for any public deploy**  
User enters a shared app key once on the home page; it is stored in `localStorage` as `notket_access_key` and sent as header `X-App-Access-Key`. No cookies, JWT, or user table.

Never put AWS secrets in the frontend. Never commit `.env`.

## S3 CORS (production checklist)

Browser **PUT** goes **directly to S3** (not through Vercel). The bucket **must** allow your app origin.

### Checklist

1. [ ] Bucket is **private** (no public-read ACL / public policy for objects).
2. [ ] CORS `AllowedOrigins` includes **exact** production URL(s), e.g. `https://not-ket-realtime.vercel.app` (and custom domain if any).
3. [ ] CORS includes local origin when developing: `http://localhost:3000`.
4. [ ] `AllowedMethods` includes **`PUT`**, **`GET`**, **`HEAD`**.
5. [ ] `AllowedHeaders` is `*` (or at least `Content-Type` and any headers the browser sends on PUT).
6. [ ] `ExposeHeaders` includes **`ETag`**.
7. [ ] After changing CORS, hard-refresh the browser and retry upload (failed OPTIONS = CORS misconfig).
8. [ ] App env `APP_BASE_URL` / `CLIENT_ORIGIN` match the origins you listed (CSP `connect-src` needs the S3 host too — set `S3_BUCKET` + `S3_REGION` or `S3_ENDPOINT`).

### Example CORS JSON

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://not-ket-realtime.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Replace the Vercel hostname with **your** production domain.  
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
2. Add your Vercel domain to **S3 CORS**.
3. Run migrations against Neon (`npm run db:migrate` locally or CI).
4. `vercel.json` routes all traffic to `server.js`.

Pending uploads are stored in Postgres table `document_uploads` (not in-memory) so multi-instance / serverless is safe.

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
1. Upload real **PNG/JPG ~5–6MB** (near `MAX_IMAGE_BYTES`)
2. Upload real **PDF** and **TXT** near `MAX_FILE_BYTES` (default 10MB; use 6MB if Vercel times out)
3. Fake `image/png` with text body → **reject**
4. Extensions **`.svg` / `.html` / `.zip` / `.js` / `.exe`** → **reject**
5. If confirm step times out on large files: set `MAX_FILE_BYTES=6291456` or keep image/PDF prefix validation (already default)

### S3 + Vercel
1. CORS production origin (see checklist above)
2. Presigned PUT succeeds from browser (Network → S3 host, status 200)
3. Refresh page → history still loads from Neon; files still open via signed GET

## License

MIT
