
Dareloom Hub — Release v2 (auto-thumbs, new->old, pop ad on Watch)
Created: 2025-09-15T17:13:07.783711 UTC

Included files:
- index.html
- style.css
- script.js
- README.txt

Deploy instructions:
1) Make Google Sheet public (Share -> Anyone with the link -> Viewer). Use your sheet with headers 'Title', 'Trailer', 'Watch' (messy ok).
2) Upload files to GitHub repo root; deploy to Cloudflare Pages or Netlify (output dir = /).
3) Purge cache after deploy, hard-refresh (Ctrl+Shift+R).
4) Open DevTools Console and confirm "[Dareloom] fetching" and "[Dareloom] items".

Notes:
- Thumbnails are auto-generated from YouTube IDs found in Trailer or Watch columns.
- Watch button injects the pop script (your provided Adsterra-like pop script) then opens the Watch link in a new tab.
