# NotKet Documents

Personal documents chat for a **single user** — no login, no multi-user chat, no AI, no admin.

- **Home** `/` — simple landing + optional access key gate  
- **My Documents** `/documents` — text notes, image/file uploads, search/filter, storage usage  

**S3** stores file bytes (presigned PUT / signed GET).  
**Neon Postgres** stores metadata and history only.

## Features

- Text messages
- Image & file upload via S3 presigned URL
- Search / filter (all · text · image · file)
- Soft-delete messages
- Storage usage meter
- Optional access key (`X-App-Access-Key`) for public deploys
- REST-only (no Socket.IO) — easy on Vercel
- Rate limits on message write + upload sign (mitigate abuse in open mode)

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
| `APP_OPEN_MODE` | `true` = anyone with the link can use the app (demo only) |
| `APP_ACCESS_KEY` | Required when `APP_OPEN_MODE=false` (min 32 chars in production) |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | Private bucket recommended |
| `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` | For S3-compatible providers |
| `S3_PUBLIC_BASE_URL` | Optional CDN/public base; otherwise signed GET URLs |
| `MAX_IMAGE_BYTES` / `MAX_FILE_BYTES` / `STORAGE_LIMIT_BYTES` | Upload & quota limits |

### Security modes

**MODE A — open demo** (`APP_OPEN_MODE=true`)  
Anyone with the URL can upload. **Do not use in production.**

**MODE B — access key** (`APP_OPEN_MODE=false`)  
User enters a shared app key once on the home page; it is stored in `localStorage` as `notket_access_key` and sent as header `X-App-Access-Key`. No cookies, JWT, or user table.

Never put AWS secrets in the frontend. Never commit `.env`.

## S3 CORS

Browser PUTs go **directly to S3**. Configure bucket CORS for your app origin:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-production-domain.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Keep the bucket **private**. Reads use signed GET URLs (unless you set `S3_PUBLIC_BASE_URL`).

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

1. Open `/`
2. If protected, enter access key
3. Open `/documents`
4. Send text → reload → still there
5. Upload real PNG / PDF / TXT
6. Open image/file via signed URL
7. Search + filter image/file
8. Delete a message
9. Reject `.svg`, `.html`, `.js`, `.exe`, `.zip`
10. Reject fake `image/png` with text bytes
11. Network tab: no AWS secret on the client

## License

MIT
