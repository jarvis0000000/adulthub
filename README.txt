
Dareloom Hub — Release ZIP (messy-sheet tolerant)
Created: 2025-09-15T16:53:34.059022 UTC

Files included:
- index.html
- style.css
- script.js
- README.txt

Deploy steps:
1) Make Google Sheet public (Share -> Anyone with the link -> Viewer).
2) Upload files to GitHub repo root and deploy to Cloudflare Pages/Netlify (output dir = /).
3) Purge cache after deploy.
4) Open site, check DevTools Console for logs like "[Dareloom] fetching" and "[Dareloom] items".

Notes:
- Popunder ad script will inject on Watch click using your provided script.
- Banner iframe ad (300x250) placed in footer using your code.
