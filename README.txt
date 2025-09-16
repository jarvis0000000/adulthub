
Dareloom Hub — FINAL ZIP v4
Created: 2025-09-16T01:56:58.860489 UTC

Included:
- index.html
- style.css
- script.js
- README.txt

How to deploy:
1) Make Google Sheet public (Share -> Anyone with link -> Viewer).
2) Ensure Sheet tab is named 'Sheet1' (or update SHEET_API in index.html).
3) Upload files to GitHub repo root and deploy via Cloudflare Pages or Netlify (output dir = /).
4) Purge cache / hard refresh after deploy.
5) Open DevTools Console and confirm logs: '[Dareloom] fetching', '[Dareloom] headers:', '[Dareloom] items N ...'

Notes:
- Trailer embedding: YouTube / Drive / mp4 embed. Many adult third-party hosts block embedding -> site will show "Open Trailer" button which opens the trailer in a new tab so user can still view it.
- Watch button injects the pop ad script (as provided) then opens the Watch link in a new tab.
- If titles/trailers don't appear: open console and paste errors here; I'll patch immediately.
