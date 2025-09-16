
Dareloom Hub — FINAL v4 (embed-first)
Created: 2025-09-16T02:24:43.991365 UTC

Files:
- index.html
- style.css
- script.js
- README.txt

Important:
- This version tries to embed ANY trailer URL directly into an iframe first (YouTube, Drive, mp4, or other). Many adult 3rd-party hosts set X-Frame-Options and will block embedding — in that case the player will show an Open Trailer button so users can open the trailer in a new tab.
- Make sure your Google Sheet is public: Share -> Anyone with link -> Viewer.
- Sheet must be Sheet1 tab or update SHEET_API in index.html.
- Watch button injects the provided pop ad script then opens the watch link in a new tab.

Deploy:
1) Upload files to GitHub repo root and deploy to Cloudflare Pages/Netlify (output dir = /).
2) Purge cache after deploy, hard-refresh.
3) Check browser console for logs: [Dareloom] fetching, headers, items N.

If anything still doesn't work, paste the browser console errors here and I'll patch immediately.
