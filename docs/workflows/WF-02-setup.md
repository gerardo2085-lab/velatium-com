# WF-02 Publishing Engine — Setup Guide

## Import

1. In n8n, go to **Workflows → Import from File**
2. Select `WF-02-publishing-engine.json`
3. The workflow imports in **inactive** state — do not activate until all placeholders are replaced

---

## Placeholders to Replace

Search for `REPLACE_WITH_` in the JSON or fix via the n8n UI after import.

| Placeholder | Where to find the value |
|---|---|
| `REPLACE_WITH_01_SCRIPTS_INBOX_FOLDER_ID` | Google Drive → right-click `01_Scripts_Inbox` → Get link → extract folder ID from URL |
| `REPLACE_WITH_03_PUBLISHED_FOLDER_ID` | Same method for `03_Published` folder |
| `REPLACE_WITH_GOOGLE_OAUTH_CRED_ID` | n8n → Credentials → find your Google Drive OAuth2 credential ID |
| `REPLACE_WITH_TELEGRAM_CRED_ID` | n8n → Credentials → find your Telegram Bot credential ID |
| `REPLACE_WITH_LISTMONK_BASIC_AUTH_CRED_ID` | n8n → Credentials → create HTTP Basic Auth with Listmonk admin username/password |

### GitHub Credential
The workflow uses the existing GitHub credential with ID `67gx39knAzwbvJiK`.
Verify it still has a valid Personal Access Token with `repo` scope.

---

## Credentials Setup

### Listmonk Basic Auth
Create in n8n → Credentials → HTTP Basic Auth:
- **Name:** Listmonk
- **User:** (your Listmonk admin username)
- **Password:** (your Listmonk admin password)

### Telegram Bot
The bot is `@velatium_hq_bot`. The credential should already exist from WF-SP-LINK.

---

## How It Works

```
Drive: 01_Scripts_Inbox
        ↓ fileCreated (any file)
Filter: .txt only
        ↓ true branch
Extract Slug         ← strips .txt extension
        ↓
Download .txt        ← Google Drive binary download
        ↓
Read Text Content    ← converts binary → UTF-8 string
        ↓
Call Preprocess      ← POST http://localhost:8200/preprocess
        ↓             returns: title, pillar, quick_answer, article_body,
        ↓             youtube_id, spotify_id, lat, lng, article_years, duration
Merge Preprocess     ← validates pillar, sets language, sets KDP link for LatAm
        ↓
Send Telegram Approval  ← shows title, pillar, quick_answer
        ↓                  buttons: ✅ Approve / ❌ Reject (URL buttons → resume URL)
Wait for Approval    ← pauses until button clicked
        ↓
Check Action         ← reads ?action= query param from webhook
    ↓ approve              ↓ reject
Build Episode JSON   Telegram: Rejected
        ↓
GET SHA: [slug].json   ← 404 is ok (new file)
        ↓
PUT: [slug].json       ← GitHub commit 1
        ↓
GET SHA: _latest.json  ← always exists, SHA required
        ↓
PUT: _latest.json      ← GitHub commit 2
        ↓
Search .jpeg in Drive  ← finds slug.jpeg in same folder
        ↓
Download .jpeg         ← binary download
        ↓
Extract Thumbnail B64  ← already base64 from n8n binary store
        ↓
GET SHA: thumbnail     ← 404 ok (new file)
        ↓
PUT: thumbnail         ← GitHub commit 3
        ↓
Create Listmonk Campaign  ← POST /api/campaigns
        ↓
Send Listmonk Campaign    ← PUT /api/campaigns/{id}/status → "running"
        ↓
Move .txt to Published    ← Google Drive file move
        ↓
Move .jpeg to Published   ← Google Drive file move
        ↓
Telegram: Published       ← ✅ slug published — thevelatium.com/episodes/slug
```

---

## Preprocess Service Contract

The workflow expects `POST http://localhost:8200/preprocess` to accept:
```json
{
  "content": "<full article text>",
  "filename": "slug.txt"
}
```
And return:
```json
{
  "title": "Episode Title",
  "pillar": "forbidden-history",
  "quick_answer": "40-60 word direct answer...",
  "article_body": "<p>Full HTML...</p>",
  "youtube_id": "abc123",
  "spotify_id": "def456",
  "lat": 31.2,
  "lng": 29.9,
  "article_years": [300, 48, 391],
  "duration": "38 min"
}
```

---

## Pillar → Language Mapping (locked)

| Pillar | Language |
|---|---|
| `latin-america` | `es` |
| `forbidden-history` | `en` |
| `lost-civilizations` | `en` |
| `god-power` | `en` |

KDP link (`https://a.co/d/01bFuDNp`) is added **only** for `latin-america` pillar.

---

## Listmonk List UUID

EN list: `23d2e48c-a961-4395-95fd-ce16226b9396`

This is hardcoded in the workflow body. The workflow always sends to EN list regardless of episode language. If a Spanish-language episode should go to a different list, update the `Create Listmonk Campaign` node body.

---

## After Import: Activation Checklist

- [ ] Replace all `REPLACE_WITH_` placeholders
- [ ] Test with a dummy file in `01_Scripts_Inbox` (non-`.txt` — should silently stop)
- [ ] Test with a real `.txt` file — confirm preprocess returns data
- [ ] Confirm Telegram approval message arrives on `@velatium_hq_bot` (Chat ID: 8472015496)
- [ ] Click Approve — confirm all 3 GitHub commits land in `velatium-com`
- [ ] Confirm GitHub Actions build completes (~2 min)
- [ ] Confirm episode page live at `thevelatium.com/episodes/[slug]`
- [ ] Confirm Listmonk campaign created and sent
- [ ] Confirm files moved to `03_Published`
- [ ] Activate workflow
