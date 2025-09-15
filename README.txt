
Dareloom Hub — static site (Google Sheets driven)

Files:
- index.html
- style.css
- script.js

How it works:
1. Edit your Google Sheet (Sheet1) with columns: Title | Trailer | Watch | Poster (optional) | Date (optional)
2. Make the sheet public: File → Share → Anyone with the link → Viewer
3. The site uses Google Sheets API v4. The API_KEY and SHEET_ID are already embedded in index.html (replace if you want)
4. Deploy to Netlify / Cloudflare Pages / GitHub Pages. For Cloudflare Pages, connect a GitHub repo containing these files.

Notes:
- Trailer embedding supports YouTube, Vimeo, Google Drive, Pornhub (embed/viewkey), and direct .mp4 links.
- Watch button injects Adsterra script then opens the target link.
- If some trailers don't embed, that host may block embedding; Watch will still open the link.
- Remember to restrict your API key to your domain after testing.
