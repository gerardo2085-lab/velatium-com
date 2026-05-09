# Velatium Infrastructure & Workflow Documentation

> Generated from the live system on 2026-05-09. All values read directly from running services, SQLite database, and source files.

---

## Table of Contents

1. [Host Environment](#1-host-environment)
2. [Docker Stack](#2-docker-stack)
3. [Cloudflare Tunnel](#3-cloudflare-tunnel)
4. [Systemd Services](#4-systemd-services)
5. [Flask Service — Preprocess (port 8200)](#5-flask-service--preprocess-port-8200)
6. [Flask Service — Ingest (port 8100)](#6-flask-service--ingest-port-8100)
7. [ChromaDB](#7-chromadb)
8. [Google Drive Structure](#8-google-drive-structure)
9. [GitHub Repositories](#9-github-repositories)
10. [n8n Workflows](#10-n8n-workflows)
11. [Full Publish Pipeline — End-to-End](#11-full-publish-pipeline--end-to-end)
12. [n8n Credentials](#12-n8n-credentials)
13. [Known Issues & Workarounds](#13-known-issues--workarounds)

---

## 1. Host Environment

- **OS:** Ubuntu Linux 6.8.0-111-generic
- **Shell user:** `velatiumadmin`
- **Host IP (Docker bridge):** `172.17.0.1` — used by containers to reach host-side Flask services
- **Internal server IP:** `192.168.1.204`
- **Primary working directory:** `/home/velatiumadmin/velatium/`
- **WF-02 service directory:** `/home/velatiumadmin/wf02/`

---

## 2. Docker Stack

Composed from `/home/velatiumadmin/velatium/docker-compose.yml`.

| Container | Image | Host Port | Container Port | Notes |
|---|---|---|---|---|
| `portainer` | `portainer/portainer-ce:latest` | 9443, 9100 | 9443, 9000 | Docker management UI |
| `velatium-n8n-1` | `n8nio/n8n` | 5678 | 5678 | Workflow automation engine |
| `cloudflared` | `cloudflare/cloudflared:latest` | — | — | `network_mode: host`; tunnel process |
| `open-webui` | `ghcr.io/open-webui/open-webui:main` | 3000 | 8080 | Local LLM chat UI |
| `velatium-listmonk-1` | `listmonk/listmonk:latest` | 9000 | 9000 | Newsletter / email campaigns |
| `velatium-listmonk_db-1` | `postgres:13` | — | 5432 | Listmonk Postgres database |
| `velatium-chromadb-1` | `chromadb/chroma` | 8000 | 8000 | Vector DB for research memory |

**n8n environment variables (from docker-compose):**
```
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=velatium
WEBHOOK_URL=https://webhooks.thevelatium.com/
N8N_SECURE_COOKIE=false
```

**n8n data volume:** `velatium_n8n_data` → mounted at `/home/node/.n8n` inside container.
Database: `/home/node/.n8n/database.sqlite` (SQLite).

---

## 3. Cloudflare Tunnel

**Config file:** `/home/velatiumadmin/velatium/cloudflared/config.yml`
**Tunnel ID:** `ac567ca0-de78-4e4d-b58c-90cbdd467190`

| Public Hostname | Internal Target | Service |
|---|---|---|
| `webhooks.thevelatium.com` | `http://localhost:5678` | n8n (all webhooks) |
| `newsletter.thevelatium.com` | `http://localhost:9000` | Listmonk |
| *(catch-all)* | `http_status:404` | — |

All n8n webhook URLs use `https://webhooks.thevelatium.com/webhook/<path>`.

---

## 4. Systemd Services

### 4.1 velatium-preprocess

| Field | Value |
|---|---|
| Unit file | `/etc/systemd/system/velatium-preprocess.service` |
| Script | `/home/velatiumadmin/wf02/preprocess_service.py` |
| Port | **8200** |
| Enabled | yes (starts on boot) |
| Status | active/running |

### 4.2 velatium-ingest

| Field | Value |
|---|---|
| Unit file | `/etc/systemd/system/velatium-ingest.service` |
| Script | `/home/velatiumadmin/velatium/ingest_service/ingest.py` |
| Port | **8100** |
| Enabled | yes (starts on boot) |
| Status | active/running |

Both services are reached from n8n containers via `http://172.17.0.1:<port>`.

---

## 5. Flask Service — Preprocess (port 8200)

**File:** `/home/velatiumadmin/wf02/preprocess_service.py`
**Logger name:** `wf02-preprocess`

### Constants

| Name | Value |
|---|---|
| `STAGING_DIR` | `/home/velatiumadmin/wf02/staging` |
| `QUEUE_FILE` | `/home/velatiumadmin/wf02/publish_queue.json` |
| `PENDING_DIR` | `/home/velatiumadmin/wf02/pending` |
| `TEMPLATES_DIR` | `/home/velatiumadmin/wf02/templates` |
| `SPOTIFY_RSS_EN` | `https://anchor.fm/s/2ZP7NO4FkbGMlZhNcMGelv/podcast/rss` |
| `SPOTIFY_RSS_ES` | `https://anchor.fm/s/1f2lW2ErtmnpmTfEmdylgw/podcast/rss` |
| `SPOTIFY_SHOW_EN` | `2ZP7NO4FkbGMlZhNcMGelv` |
| `SPOTIFY_SHOW_ES` | `1f2lW2ErtmnpmTfEmdylgw` |
| `YT_CHANNEL_EN` | `UCju5x8KVadm8EE8qH5qeWDg` (.com English) |
| `YT_CHANNEL_ES` | `UCrSVMD0OgnY1lLtzSgJ44Sg` (.net Spanish) |
| `CUBA_BOOK_LINK` | `https://a.co/d/01bFuDNp` |

### Endpoints

---

#### `GET /health`
Returns service status.
```json
{"status": "ok", "service": "wf02-preprocess"}
```

---

#### `POST /preprocess`
Legacy endpoint. Cleans a raw script, detects series/language, injects CTAs.

**Request:**
```json
{"text": "<raw script>", "filename": "cuba-ep1.txt"}
```

**Response:**
```json
{"metadata": {"filename": "...", "series": "...", "episode": 1, "language": "es", "is_cuba_content": true}, "cleaned_script": "...", "char_count": 4200}
```

**Logic:**
- Strips `[B-ROLL]`, `[AVATAR]`, `[MUSIC]`, `[TEXT]`, `[CUE]`, timestamp markers, `BLOQUE` headers
- Detects language by counting Spanish function words (>20 → `"es"`)
- Detects series from filename keywords
- Appends Cuba KDP link if Cuba content; appends newsletter link by language

---

#### `POST /save`
Wraps EN and ES HTML bodies in full issue templates and saves to staging.

**Request:**
```json
{"en_html": "<html body>", "es_html": "<html body>", "metadata": {...}, "file_id": "drive_file_id"}
```

**Response:**
```json
{"status": "saved", "base": "/home/velatiumadmin/wf02/staging/cuba-ep1_20260509_151400", "slug": "cuba-ep1", "timestamp": "20260509_151400"}
```

Writes 3 files: `<base>_EN.html`, `<base>_ES.html`, `<base>_meta.json`.

---

#### `POST /generate-episode`
Fills `templates/episode-template-{lang}.html` with episode data.

**Request:**
```json
{"title_en": "...", "title_es": "...", "teaser_en": "...", "teaser_es": "...", "spotify": "https://open.spotify.com/episode/..."}
```

**Response:**
```json
{"episode_en_b64": "<base64>", "episode_es_b64": "<base64>"}
```

---

#### `POST /generate-video`
Fills `templates/video-template-{lang}.html` with video data.

**Request:**
```json
{"title_en": "...", "title_es": "...", "teaser_en": "...", "teaser_es": "...", "youtube": "https://youtu.be/..."}
```

**Response:**
```json
{"video_en_b64": "<base64>", "video_es_b64": "<base64>"}
```

---

#### `GET /staging/latest`
Returns the most recently staged article.

**Response:**
```json
{"meta": {...}, "en_html": "...", "es_html": "...", "base": "...", "staged_filename": "..._meta.json"}
```

---

#### `DELETE /staging/latest`
Deletes all `*_EN.html`, `*_ES.html`, `*_meta.json` files from staging.

**Response:**
```json
{"status": "deleted", "files": ["cuba-ep1_..._EN.html", "..."]}
```

---

#### `POST /queue`
Adds an episode to the publish queue (`publish_queue.json`). Deduplicates by slug.

**Request:**
```json
{
  "slug": "cuba-ep1",
  "title": "Cuba Antes de Castro",
  "pillar": "latin-america",
  "pillarLabel": "Latinoamérica Sin Censura",
  "language": "es",
  "duration": "42 min",
  "youtube_id": "pending",
  "spotify_id": "pending"
}
```

**Response:**
```json
{"status": "queued", "episode": {"slug": "cuba-ep1", "status": "waiting", "created_at": "...", ...}}
```
If already queued: `{"status": "already_queued", "slug": "cuba-ep1"}`

---

#### `GET /queue`
Returns the full queue.
```json
{"episodes": [{"slug": "...", "status": "waiting|ready", ...}]}
```

---

#### `PATCH /queue/<slug>`
Updates `youtube_id`, `spotify_id`, or `status` for a queued episode.

**Request:**
```json
{"youtube_id": "dQw4w9WgXcQ", "spotify_id": "pending", "status": "ready"}
```

---

#### `DELETE /queue/<slug>`
Removes episode from queue. Special case: `slug=none` removes all episodes with `status=ready`.

---

#### `POST /queue/check-rss`
Polls both Spotify RSS feeds. Fuzzy-matches episode titles (threshold: ≥0.45 similarity ratio). Sets `status=ready` when all 4 links confirmed (youtube_en, youtube_es, spotify_en, spotify_es).

---

#### `POST /post-tweet`
Posts a tweet via X API v2 with OAuth1a (Tweepy). Optionally posts a threaded reply.

**Request:**
```json
{"text": "Main tweet text", "reply_text": "Optional reply text"}
```

**Response:**
```json
{"status": "posted", "tweet_id": "...", "reply_id": "..."}
```

Credentials read from env vars: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.

---

#### `POST /generate-pages`
Generates all 4 static pages (video EN, video ES, episode EN, episode ES) and commits them directly to GitHub.

**Request:**
```json
{
  "title_en": "...", "title_es": "...",
  "teaser_en": "...", "teaser_es": "...",
  "youtube_en": "https://youtu.be/...", "youtube_es": "https://youtu.be/...",
  "spotify_en": "https://open.spotify.com/episode/...", "spotify_es": "...",
  "slug_en": "cuba-ep1-en", "slug_es": "cuba-ep1-es"
}
```

Commits to:
- `gerardo2085-lab/velatium-com`: `{slug_en}.html`, `{slug_en→episode-en}.html`
- `gerardo2085-lab/velatium-net`: `{slug_es}.html`, `{slug_es→episode-es}.html`

---

#### `POST /extract`
**Primary WF-02 entry point.** Extracts episode metadata from article `.txt` content.

Supports two modes:
1. **Structured** — text begins with frontmatter keys (`title:`, `pillar:`, `language:`, etc.)
2. **Unstructured** — regex extracts YouTube/Spotify IDs, duration, GEO coordinates, years

**Request:**
```json
{"text": "<full article text>", "filename": "cuba-ep1.txt"}
```

**Response:**
```json
{
  "slug": "cuba-ep1",
  "title": "Cuba Antes de Castro — El País Que Nadie Te Mostró",
  "pillar": "latin-america",
  "pillarLabel": "Latinoamérica Sin Censura",
  "language": "es",
  "date": "May 09, 2026",
  "duration": "42 min",
  "youtube_id": "",
  "spotify_id": "",
  "thumbnail": "/images/episodes/cuba-ep1.jpeg",
  "lat": 22.0,
  "lng": -79.5,
  "article_years": [1492, 1776, 1898, 1933, 1958, 1959],
  "quick_answer": "Before 1959, Cuba ranked among Latin America's most prosperous nations.",
  "article_body": "<p>...</p>",
  "kdp_link": "https://a.co/d/01bFuDNp"
}
```

**Structured frontmatter keys** (parsed in order, multi-line values supported):
`title`, `pillar`, `language`, `youtube_id`, `spotify_id`, `duration`, `lat`, `lng`, `years`, `kdp_link`, `quick_answer`, `article_body`

**Pillar detection keywords (filename-first, then text):**

| Pillar | Filename keywords |
|---|---|
| `latin-america` | lsc, cuba, cochinos, racion, balser, latin, latam, censura, castro, batista |
| `lost-civilizations` | lost, civiliz, machu, pompeii, atlantis, babylon, sunken |
| `god-power` | god, dios, power, pope, church, crusade, religion, faith, templar |
| `forbidden-history` | forbidden, prohib, history, secret, hidden, suppressed, conspiracy |

---

#### `POST /github-commits`
**Core publish action.** Makes 3 GitHub commits: episode JSON, `_latest.json`, and JPEG thumbnail.

**Request:**
```json
{
  "slug": "cuba-ep1",
  "metadata": {
    "slug": "cuba-ep1",
    "title": "...",
    "pillar": "latin-america",
    "pillarLabel": "Latinoamérica Sin Censura",
    "language": "es",
    "date": "May 09, 2026",
    "duration": "42 min",
    "youtube_id": "pending",
    "spotify_id": "pending",
    "thumbnail": "/images/episodes/cuba-ep1.jpeg",
    "lat": 22.0,
    "lng": -79.5,
    "article_years": [1492, 1776, 1898, 1933, 1958, 1959],
    "quick_answer": "...",
    "article_body": "<p>...</p>",
    "kdp_link": "https://a.co/d/01bFuDNp"
  },
  "jpeg_b64": "<base64-encoded JPEG bytes>"
}
```

**Commits made to `gerardo2085-lab/velatium-com`:**
1. `content/episodes/{slug}.json` — episode data
2. `content/episodes/_latest.json` — same data (overwritten every publish)
3. `public/images/episodes/{slug}.jpeg` — thumbnail image

Uses `GET` before `PUT` to fetch existing file SHA (GitHub requires SHA for updates).

**Response:**
```json
{"status": "ok", "slug": "cuba-ep1", "commits": {"episode_json": true, "latest_json": true, "thumbnail": true}}
```

---

#### `POST /pending/set`
Stores pending episode data to `/home/velatiumadmin/wf02/pending/{slug}.json`.

**Request:** Any JSON object with a `slug` field. The full object is stored as-is.

---

#### `GET /pending/get?slug=<slug>`
Retrieves stored pending data for a slug.

---

#### `DELETE /pending/clear?slug=<slug>`
Deletes the pending JSON file for a slug.

---

## 6. Flask Service — Ingest (port 8100)

**File:** `/home/velatiumadmin/velatium/ingest_service/ingest.py`

Connects to ChromaDB at `localhost:8000`, collection `velatium_research` (cosine similarity).

**Chunking:** 800-char chunks, 100-char overlap, sentence-boundary splits.
**Chunk ID:** SHA-256 of `source_url + date_ingested + text[:80]`, truncated to 16 chars.
**Upsert:** duplicate chunks (same ID) are silently overwritten.

### Endpoints

---

#### `GET /health`
```json
{"status": "ok", "collection": "velatium_research", "chromadb": "1.0.0"}
```

---

#### `POST /ingest`
Chunks text and upserts into ChromaDB.

**Request:**
```json
{
  "text": "<full document text (min 100 chars)>",
  "series": "Latinoamérica Sin Censura",
  "topic": "Cuba pre-1959 economy",
  "language": "es",
  "source_url": "https://example.com/article",
  "date_ingested": "2026-05-09",
  "source_type": "pdf",
  "filename": "cuba-research.pdf"
}
```

Required: `text`, `series`, `topic`, `language`, `source_url`, `date_ingested`.
Optional: `source_type` (default: `"pdf"`), `filename` (default: `""`).

**Response:**
```json
{"status": "ok", "chunks_stored": 12, "series": "Latinoamérica Sin Censura", "topic": "Cuba pre-1959 economy"}
```

---

#### `POST /query`
Semantic search against ChromaDB.

**Request:**
```json
{"query": "Cuban economy before revolution", "n": 5, "series": "Latinoamérica Sin Censura"}
```

`series` is optional — if present, applies a ChromaDB `where` filter on the metadata field.

---

#### `GET /count`
```json
{"total_chunks": 30}
```

---

## 7. ChromaDB

- **Docker container:** `velatium-chromadb-1`
- **Host port:** `8000`
- **Collection name:** `velatium_research`
- **Distance metric:** cosine similarity (`hnsw:space: cosine`)
- **Chunks (as of 2026-05-09):** 30

**Metadata schema per chunk:**

| Field | Type | Example |
|---|---|---|
| `series` | string | `"Latinoamérica Sin Censura"` |
| `topic` | string | `"Cuba pre-1959 economy"` |
| `language` | string | `"es"` |
| `source_url` | string | `"https://example.com/doc"` |
| `date_ingested` | string | `"2026-05-09"` |
| `source_type` | string | `"pdf"` |
| `filename` | string | `"cuba-research.pdf"` |

---

## 8. Google Drive Structure

All folders are within the connected Google Drive account (credential: `Google Drive account`).

| Folder | Drive ID | Purpose |
|---|---|---|
| `01_Scripts_Inbox/` | `1Zqacoo1qaPE-l3fvJKXoC1hCRqjfMX-I` | Drop zone for `.txt` + `.jpeg` pairs; WF-02 watches this |
| `02_Research/Alma_Voss/` | `1YKmpihi1Q41ca4cIyDVBB75SP7Ztj1jK` | PDFs for Alma Voss series |
| `02_Research/Latin_America_Sin_Censura/` | `1sE1TY1WvkTml1LbS5D8iY9a392IF_Ouo` | PDFs for Latin America series |
| `02_Research/Forbidden_History/` | `1zgSw--jqMw9IpUTijNgN3TOe7QPgFozX` | PDFs for Forbidden History series |
| `02_Research/God_and_Power/` | `1FirOLbGaxfdBYrG-fCdEIXoJAYoBvJhm` | PDFs for God & Power series |
| `02_Research/Lost_Civilizations/` | `1o8Cl08-T6PWe6S6WpqvX0qG0toAcWTE-` | PDFs for Lost Civilizations series |
| `03_Published/` | `1nVTB_W-ncoS3DQpYU2P1mYpGMKmhii9o` | Approved files moved here by WF-02-APPROVE |

**Naming convention for 01_Scripts_Inbox:**
- `{slug}.txt` — article script with structured frontmatter
- `{slug}.jpeg` OR `{slug}.jpg` — thumbnail image

WF-02 searches for the JPEG using a Drive Files API query:
```
(name='{slug}.jpeg' or name='{slug}.jpg') and '{folder_id}' in parents and trashed=false
```

---

## 9. GitHub Repositories

All under organization `gerardo2085-lab`. GitHub token stored in env var `GITHUB_TOKEN`.

| Repo | Purpose | Key paths |
|---|---|---|
| `velatium-com` | English site (Astro + Cloudflare Pages) | `content/episodes/`, `public/images/episodes/`, `content/episodes/_latest.json`, `social-proof.EN.json`, `content-feed.EN.json` |
| `velatium-net` | Spanish site (same stack) | `content-feed.ES.json`, `social-proof.ES.json` |
| `velatium-x-engine` | X (Twitter) post queue | `queue.csv` — Claude-generated posts appended per episode |

**`content/episodes/_latest.json` behavior:**
- Always overwritten by `/github-commits` with the most recently published episode's full metadata.
- `src/pages/index.astro` guards against stale or sentinel data by checking `slug && !slug.startsWith('_')`.
- `src/pages/archive.astro` deduplicates by slug (first occurrence wins) to prevent `_latest.json` from creating duplicate cards.

---

## 10. n8n Workflows

**Base URL:** `https://webhooks.thevelatium.com/webhook/<path>`
**Telegram Chat ID:** `8472015496`
**n8n internal port:** `5678` (container) → `5678` (host)

All workflow data read from `/home/node/.n8n/database.sqlite` → table `workflow_entity`.

---

### WF-00 — Initial Setup: Folder Architecture Builder
**ID:** `UrD1jWkT1UIJkfqK` | **Active:** No (one-shot setup)

**Trigger:** Manual

**Purpose:** Creates initial Google Drive folder structure.

**Nodes:** Manual trigger → Code (build folder list) → Create folder (Google Drive) → Telegram confirm

---

### WF-01 — Research Memory Loader
**ID:** `UpJV05nANOv2E6YI` | **Active:** Yes

**Trigger:** 5 Google Drive triggers (one per series research folder), polling every hour on `fileCreated`

| Trigger node | Folder |
|---|---|
| Alma | `02_Research/Alma_Voss/` (1YKmpihi1Q41ca4cIyDVBB75SP7Ztj1jK) |
| LatinAmerica | `02_Research/Latin_America_Sin_Censura/` (1sE1TY1WvkTml1LbS5D8iY9a392IF_Ouo) |
| Forbidden | `02_Research/Forbidden_History/` (1zgSw--jqMw9IpUTijNgN3TOe7QPgFozX) |
| God&Power | `02_Research/God_and_Power/` (1FirOLbGaxfdBYrG-fCdEIXoJAYoBvJhm) |
| Lost CiviLi | `02_Research/Lost_Civilizations/` (1o8Cl08-T6PWe6S6WpqvX0qG0toAcWTE-) |

**Step-by-step:**
1. Trigger fires when a PDF is uploaded to any research folder
2. **Extract from File** — extracts text from PDF
3. **Code in JavaScript** — builds ingest payload (series, topic, language, source_url, date_ingested)
4. **HTTP Request** — `POST http://172.17.0.1:8100/ingest` with the payload
5. **HTTP Request1** — downloads the original file bytes via Drive API (for audit/logging)

---

### WF-02 — Article Publishing Engine
**ID:** `MiZbetcvPVqwMb0n` | **Active:** Yes

**Trigger:** Google Drive, folder `01_Scripts_Inbox/` (ID: `1Zqacoo1qaPE-l3fvJKXoC1hCRqjfMX-I`), event `fileCreated`, polls every minute.

**Step-by-step:**
1. **Watch Scripts Inbox** — fires when any file is created in the inbox folder
2. **Is TXT File?** — filters to `.txt` only (if node)
3. **Set Slug** — code node: extracts `txt_file_id` and derives `slug` (filename without extension)
4. **Download TXT** — `GET https://www.googleapis.com/drive/v3/files/{txt_file_id}?alt=media` with OAuth header
5. **Decode TXT** — code node: decodes binary response to UTF-8 text, attaches `slug` and `text`
6. **Find JPEG** — `GET https://www.googleapis.com/drive/v3/files` with query:
   ```
   (name='{slug}.jpeg' or name='{slug}.jpg') and '{folder_id}' in parents and trashed=false
   ```
7. **Has JPEG?** — if node: checks if Drive returned any results
   - **No JPEG path:** → **Telegram JPEG Missing** — sends warning to chat `8472015496`
   - **Has JPEG path:** continues →
8. **Extract Metadata** — `POST http://172.17.0.1:8200/extract` with `{text, filename}`
9. **Build Pending Payload** — code node: assembles `{slug, metadata, txt_file_id, jpeg_file_id}` object
10. **Store Pending** — `POST http://172.17.0.1:8200/pending/set` — persists to `/wf02/pending/{slug}.json`
11. **Send Approval** — Telegram message with title, pillar, language + two inline keyboard buttons:
    - ✅ Approve → `https://webhooks.thevelatium.com/webhook/wf02-approve?action=approve&slug={slug}`
    - ❌ Reject → `https://webhooks.thevelatium.com/webhook/wf02-approve?action=reject&slug={slug}`

---

### WF-02-APPROVE — Publish Handler
**ID:** `Pa5QcfO7BoeXlOy8` | **Active:** Yes

**Trigger:** Webhook `GET /wf02-approve` (called when user taps Approve/Reject in Telegram)

Query params: `action` (`approve` | `reject`), `slug`

**Step-by-step (Approve path):**
1. **Webhook** — receives the GET request
2. **Respond OK** — immediately responds 200 to the webhook caller (prevents Telegram timeout)
3. **Get Pending Data** — `GET http://172.17.0.1:8200/pending/get?slug={slug}` — loads stored pending JSON
4. **Check Action** — if node: routes on `action == "approve"`
5. **Download JPEG** — `GET https://www.googleapis.com/drive/v3/files/{jpeg_file_id}?alt=media` — downloads raw JPEG bytes as binary item
6. **Prepare Payload** — Code node: reads binary data using `await this.helpers.getBinaryDataBuffer(0, 'data')`, base64-encodes it; assembles `{slug, metadata, jpeg_b64}` object
7. **GitHub Commits** — `POST http://172.17.0.1:8200/github-commits` — commits episode JSON, `_latest.json`, and JPEG thumbnail to GitHub
8. **Create Campaign** — `POST http://listmonk:9000/api/campaigns` — creates a Listmonk newsletter campaign (name = episode title + language, content = episode summary)
9. **Send Campaign** — `PUT http://listmonk:9000/api/campaigns/{id}/status` with `{"status": "running"}`
10. **Move TXT** — Google Drive: moves `.txt` file to `03_Published/` (ID: `1nVTB_W-ncoS3DQpYU2P1mYpGMKmhii9o`)
11. **Move JPEG** — Google Drive: moves `.jpeg`/`.jpg` file to `03_Published/`
12. **Add to Queue** — `POST http://172.17.0.1:8200/queue` — adds episode with `youtube_id: "pending"`, `spotify_id: "pending"` so WF-SP-LINK can update later
13. **Clear Pending** — `DELETE http://172.17.0.1:8200/pending/clear?slug={slug}` — removes staging file
14. **Telegram Confirm** — sends success message with episode URL

**Reject path:**
- **Check Action** → **Telegram Reject** — sends rejection notice; files remain in `01_Scripts_Inbox`

---

### WF-02b — Webhook Publisher (Legacy HTML Publisher)
**ID:** `gD1u8XLzWkhPkv9j` | **Active:** Yes

**Trigger:** Webhook `GET /publish-approve`

**Purpose:** Legacy path for publishing pre-built HTML articles from staging. Used before the structured frontmatter system.

**Step-by-step:**
1. `GET http://172.17.0.1:8200/staging/latest` — fetch staged HTML
2. Code node — builds commit payloads for EN and ES
3. GitHub commit EN → `gerardo2085-lab/velatium-com/{slug_en}.html` (PUT)
4. GitHub commit ES → `gerardo2085-lab/velatium-net/{slug_es}.html` (PUT)
5. Save to Queue → `POST http://172.17.0.1:8200/queue`
6. Move to 03_Published (Drive folder `1nVTB_W-ncoS3DQpYU2P1mYpGMKmhii9o`)
7. Delete Staging → `DELETE http://172.17.0.1:8200/staging/latest`
8. Telegram success message

---

### WF-FEED — Content Feed Updater
**ID:** `Kv54v6OkSr3NEQVX` | **Active:** Yes

**Trigger:** Webhook `POST /content-feed`

**Purpose:** Updates `content-feed.EN.json` and `content-feed.ES.json` in both GitHub repos after a new episode is published.

**Step-by-step:**
1. Fetch Feed EN — `GET` `velatium-com/contents/content-feed.EN.json`
2. Fetch Feed ES — `GET` `velatium-net/contents/content-feed.ES.json`
3. Build Updated Feeds — code node: prepends new episode card to both feeds
4. Commit Feed EN — `PUT` to `velatium-com`
5. Commit Feed ES — `PUT` to `velatium-net`
6. Respond to Webhook
7. Telegram success

---

### WF-PUBLISH-CHECK — Hourly Publish Monitor
**ID:** `y308S0yDYyYO39D8` | **Active:** Yes

**Triggers:**
- Schedule: every hour
- Manual webhook: `GET /publish-check-manual` (also called by WF-SP-LINK when episode becomes ready)

**Step-by-step:**
1. **Get Ready Episodes** — `GET http://172.17.0.1:8200/queue` — loads queue
2. **Any Ready?** — if node: checks for episodes with `status=ready`
3. If ready:
   - **Build Archive Cards** — code node: builds HTML cards for all ready episodes
   - **Fetch Archive EN** — `GET` `velatium-com/contents/the-velatium-archives.html` (fetches current file + SHA)
   - **Inject & Push Cards** — code node: injects new cards into the HTML file, base64-encodes
   - **Commit Archive EN** — `PUT` to `velatium-com/contents/the-velatium-archives.html`
   - **Clear Published from Queue** — code: marks episodes as published
   - **Delete Queue Item** — `DELETE http://172.17.0.1:8200/queue/{slug}` for each published episode
   - **Telegram — Card Live** — sends confirmation with slug and archive URL
4. **YouTube link resolution** (runs in parallel):
   - **Get Queue for YT** — `GET /queue`
   - **Prep YT Search** — code: builds search queries for episodes still missing `youtube_id`
   - **YT Items?** — if any unresolved
   - **YouTube Search** — `GET https://www.googleapis.com/youtube/v3/search` per episode
   - **Merge YT + Match YT** — merge/match results
   - **Patch YT** — `PATCH http://172.17.0.1:8200/queue/{slug}` with `{"youtube_id": "<url>"}`
5. **Post to X** — `POST http://172.17.0.1:8200/post-tweet` for newly-ready episodes

---

### WF-SP-LINK — Telegram Spotify & YouTube Link Receiver
**ID:** `dkwGhYnBveuS80PJ` | **Active:** Yes

**Trigger:** Telegram trigger (bot)

**Purpose:** Operator sends a Spotify or YouTube URL via Telegram to link it to a queued episode.

**Message format:**
- `en:<url>` — English Spotify or YouTube URL
- `es:<url>` — Spanish Spotify or YouTube URL

**Step-by-step:**
1. **Parse Input** — code node: splits `en:`/`es:` prefix, extracts URL, determines field (`spotify_id` or `youtube_id` from URL domain), extracts `chat_id`
2. **Valid?** — if node: validates prefix and URL format
3. **Get Queue** — `GET http://172.17.0.1:8200/queue`
4. **Find Target** — code node: finds the first episode with `status=waiting` that has `pending` for the relevant field
5. **Has Target?** — if no match → **No Episode Found** (Telegram error)
6. **Build Patch Payload** — code: assembles `{slug, patch_body: {field: url}, field_name}`
7. **Patch Queue** — `PATCH http://172.17.0.1:8200/queue/{slug}` with the updated field
8. **Confirm Saved** — Telegram reply confirming which field was saved
9. **Check Ready** — code: re-fetches queue, checks if episode now has both youtube_id and spotify_id set (not "pending")
10. **Both Ready?** — if both links are set:
    - **Set Status Ready** — `PATCH /queue/{slug}` with `{"status":"ready"}`
    - **Fire Publish** — `POST http://localhost:5678/webhook/publish-check-manual` with `{"source":"sp-link"}` — triggers WF-PUBLISH-CHECK immediately

---

### WF-SUBSCRIBE-EN — English Newsletter Subscription
**ID:** `xs8IPpTTiLBds8n5` | **Active:** Yes

**Trigger:** Webhook `POST /subscribe-en`

**Step-by-step:**
1. **Listmonk — Subscribe EN** — `POST http://listmonk:9000/api/public/subscription` with email and EN list UUID (`23d2e48c-a961-4395-95fd-ce16226b939...`)
2. **Respond — Success EN** — webhook response
3. **Welcome Email — EN** — sends via Gmail SMTP

---

### WF-SUBSCRIBE-ES — Spanish Newsletter Subscription
**ID:** `v4nTFe5MGb9lqkJc` | **Active:** Yes

**Trigger:** Webhook `POST /subscribe-es`

**Step-by-step:**
1. **Listmonk — Subscribe ES** — `POST http://listmonk:9000/api/public/subscription` with email and ES list UUID (`cfafa310-77d4-45e3-90cd-85d6e56c3c0...`)
2. **Respond — Success ES** — webhook response
3. **Welcome Email — ES** — sends via Gmail SMTP

---

### WF-PUSH — OneSignal Push Notification
**ID:** `da6KGnSw0pDDNUNc` | **Active:** Yes

**Trigger:** Webhook `POST /push-notification`

**Step-by-step:**
1. **OneSignal Push** — `POST https://onesignal.com/api/v1/notifications` with app_id `1f7652ac-5801-42c6-a596-81d3ef1a0dda`, segment `All`
2. **Respond to Webhook**
3. **Telegram Success** — confirms push was sent

---

### WF-SOCIALPROOF — Social Proof JSON Updater
**ID:** `xG0hWiFUvNImYfUH` | **Active:** Yes

**Trigger:** Schedule — every Monday at 09:00 UTC

**Purpose:** Updates subscriber/view count JSON files used by both sites' social proof widgets.

**Step-by-step:**
1. **YouTube CH1 Stats** — `GET https://www.googleapis.com/youtube/v3/channels?part=statistics&id=UCrSVMD0OgnY1lLtzSgJ44Sg` (ES channel)
2. **YouTube CH2 Stats** — `GET https://www.googleapis.com/youtube/v3/channels?part=statistics&id=UCju5x8KVadm8EE8qH5qeWDg` (EN channel)
3. **Listmonk Subscriber Count** — Postgres query: `SELECT COUNT(*) as count FROM subscribers WHERE status = 'enabled'`
4. **Build Social Proof JSON** — code node: assembles `{ch1Subs, ch2Subs, listmonkSubs, updated}`
5. **Get SHA EN / Get SHA ES** — fetch current file SHA from GitHub (required for PUT)
6. **Prep Body EN / Prep Body ES** — code: base64-encodes JSON, builds PUT body
7. **Commit SP EN** — `PUT` to `velatium-com/contents/social-proof.EN.json`
8. **Commit SP ES** — `PUT` to `velatium-net/contents/social-proof.ES.json`
9. **Telegram Success**

---

### WF-X-ENGINE — X Post Generator
**ID:** `7koeIaRPmccggZm9` | **Active:** Yes

**Trigger:** Webhook `POST /wf-x-engine`

**Purpose:** Generates 10 X (Twitter) posts for a new episode using Claude and appends them to `queue.csv`.

**Step-by-step:**
1. **GitHub — Get queue.csv** — `GET https://api.github.com/repos/gerardo2085-lab/velatium-x-engine/contents/queue.csv`
2. **Claude — Generate 10 X Posts** — `POST https://api.anthropic.com/v1/messages` with model `claude-opus-4-5-20251101`, system prompt as X content strategist, user prompt contains episode title/teaser/pillar
3. **Code — Build CSV Rows** — parses Claude response, formats 10 rows as CSV
4. **GitHub — Update queue.csv** — `PUT` appends new rows to `queue.csv` with commit message `feat: append {N} X posts from '{title}'`
5. **Respond — Success**

---

### WF-YT-LINK — Telegram YouTube Link (Deprecated)
**ID:** `O3nKrXpoqXDy51Uo` | **Active:** No

Superseded by **WF-SP-LINK**, which handles both YouTube and Spotify URLs via the `en:`/`es:` prefix convention.

---

## 11. Full Publish Pipeline — End-to-End

```
OPERATOR drops {slug}.txt + {slug}.jpeg into Google Drive / 01_Scripts_Inbox/
        │
        ▼ (WF-02 polls every minute)
WF-02: Download TXT → Extract Metadata (POST /extract) → Store Pending (POST /pending/set)
        → Send Telegram approval message with Approve/Reject buttons
        │
        ▼ (operator taps Approve in Telegram)
WF-02-APPROVE webhook fires (GET /wf02-approve?action=approve&slug={slug})
        → Get Pending Data → Download JPEG (binary) → Prepare Payload (base64 encode)
        → GitHub Commits (POST /github-commits):
              content/episodes/{slug}.json          ← episode metadata
              content/episodes/_latest.json         ← same (latest pointer)
              public/images/episodes/{slug}.jpeg    ← thumbnail
        → Create Listmonk Campaign → Send Campaign
        → Move TXT + JPEG to 03_Published/
        → Add to Queue (POST /queue, status=waiting, youtube_id=pending, spotify_id=pending)
        → Clear Pending
        → Telegram Confirm
        │
        ▼ (Cloudflare Pages auto-deploys on GitHub commit)
Site live: thevelatium.com/episodes/{slug}
        │
        ▼ (Operator sends Spotify/YouTube URLs via Telegram)
WF-SP-LINK: "en:<spotify_url>" / "es:<youtube_url>"
        → Patch Queue (PATCH /queue/{slug})
        → When both links set: Set Status Ready → Fire WF-PUBLISH-CHECK
        │
        ▼
WF-PUBLISH-CHECK (triggered immediately by WF-SP-LINK or on next hourly tick):
        → Build Archive Cards → Commit to the-velatium-archives.html
        → Post to X (POST /post-tweet)
        → YouTube Search to auto-resolve any remaining youtube_id
        → Delete from Queue
        │
        ▼
WF-SOCIALPROOF (weekly Monday 9am UTC):
        → Update social-proof.EN.json + social-proof.ES.json with live YouTube + Listmonk counts
```

---

## 12. n8n Credentials

All stored in n8n's encrypted credentials store (`credentials_entity` table).

| Name | Type | Used by |
|---|---|---|
| Google Drive account | `googleDriveOAuth2Api` | WF-01, WF-02, WF-02-APPROVE |
| Gmail account | `gmailOAuth2` | WF-SUBSCRIBE-EN, WF-SUBSCRIBE-ES (welcome email) |
| YouTube account | `youTubeOAuth2Api` | WF-SOCIALPROOF, WF-PUBLISH-CHECK |
| Telegram account | `telegramApi` | All workflows (notifications + WF-SP-LINK trigger) |
| Anthropic API | `httpHeaderAuth` | WF-X-ENGINE |
| GitHub | `httpHeaderAuth` | WF-02-APPROVE, WF-FEED, WF-SOCIALPROOF, WF-X-ENGINE, WF-PUBLISH-CHECK |
| Listmonk DB | `postgres` | WF-SOCIALPROOF (direct subscriber count query) |
| OneSignal | `httpHeaderAuth` | WF-PUSH |
| Gmail SMTP | `smtp` | WF-SUBSCRIBE-EN, WF-SUBSCRIBE-ES (welcome email) |
| X (Twitter) account | `twitterOAuth1Api` | Referenced in n8n, actual posting via `POST /post-tweet` (Tweepy/preprocess service) |

---

## 13. Known Issues & Workarounds

### n8n Binary Data — Never Use `item.binary.data.data`
**Problem:** In an n8n Code node, `item.binary.data.data` returns the storage reference string `"filesystem-v2"`, not image bytes.
**Workaround:** Always use `await this.helpers.getBinaryDataBuffer(0, 'data')` to get the actual binary buffer.
```js
// WRONG — returns "filesystem-v2"
const b64 = item.binary.data.data;

// CORRECT
const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
const b64 = buf.toString('base64');
```

---

### n8n HTTP Request — `specifyBody: "json"` + `JSON.stringify()` Breaks
**Problem:** With `specifyBody: "json"`, if you call `JSON.stringify(obj)`, n8n wraps the string as an object key: `{"<stringified json>": ""}`.
**Workaround:** Use a direct object expression — no `JSON.stringify`:
```js
// WRONG
jsonBody: '={{ JSON.stringify({ slug: $json.slug }) }}'

// CORRECT
jsonBody: '={{ { slug: $json.slug, title: $json.title } }}'
```
Also: `sendBody: true` must be set explicitly — omitting it silently sends an empty body.

---

### WF-02 Find JPEG — Extension Must Cover Both `.jpeg` and `.jpg`
**Problem:** Google Drive query matching only `name='{slug}.jpeg'` misses thumbnails saved as `.jpg`.
**Fix:** The Find JPEG node query must be:
```
(name='{slug}.jpeg' or name='{slug}.jpg') and '{folder_id}' in parents and trashed=false
```

---

### Astro `Astro.glob()` JSON Modules — `f.url` Is Always `undefined`
**Problem:** For JSON modules loaded via `Astro.glob('*.json')`, the `f.url` property is `undefined`. URL-based filters (e.g., `!f.url?.includes('_latest')`) are silently no-ops.
**Fix:** Filter on content fields (e.g., `ep.slug`), not on `f.url`.

---

### `_latest.json` Always Overwritten — Archive Deduplication Required
**Problem:** `content/episodes/_latest.json` is overwritten with real episode data on every publish, so its slug matches the real episode. Filtering by filename or sentinel slug alone is insufficient.
**Fix:** `src/pages/archive.astro` deduplicates by slug after loading all JSON files. First occurrence (the canonical episode file) wins; the duplicate from `_latest.json` is dropped:
```js
.filter((ep, i, arr) => arr.findIndex(e => e.slug === ep.slug) === i)
```

---

### Astro `[slug].astro` — Empty String Is Invalid for Static Params
**Problem:** An empty string `""` as a `slug` param in `getStaticPaths()` throws `Missing parameter: slug` at build time.
**Fix:** Any sentinel value used in `_latest.json` must be a non-empty string (e.g., `"_latest"`). Better: use the deduplication approach above instead of a sentinel.

---

### JavaScript `??` Does Not Catch `0`
**Problem:** `someValue ?? fallback` returns `0` if `someValue` is `0`, because `??` only catches `null` and `undefined`.
**Fix:** Use explicit truthiness check: `someValue || fallback` (when `0` is not a valid value) or check `someValue !== undefined && someValue !== null && someValue !== 0`.
```js
// Broken — lat=0 passes through, plots at 0,0
const epLat = latest.lat ?? 22.0;

// Fixed — guard at data ingestion point (check slug validity before using `latest`)
if (latest.slug && !latest.slug.startsWith('_')) { /* use latest */ }
```

---

### Listmonk Campaign Auth
Listmonk campaign create/send requires session cookie authentication. The API endpoint is `http://listmonk:9000/api/campaigns` (internal Docker hostname). The n8n HTTP Request nodes for Create Campaign and Send Campaign must include the Listmonk admin credentials.

---

### Telegram Bot — One Webhook Per Token
Each Telegram bot token can only have one registered webhook. WF-SP-LINK's Telegram trigger occupies the single webhook slot. WF-YT-LINK (now inactive) was previously using the same bot, causing conflicts. It has been deactivated.
