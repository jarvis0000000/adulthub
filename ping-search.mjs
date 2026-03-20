// ping-search.mjs
// ✅ Purpose: Notify Google, Bing & IndexNow instantly
// 🛠️ FIX: Unified Master Index + Direct URL Pinging

import fetch from "node-fetch";

const SITE_URL = "https://dareloom.fun"; 
const SITEMAP_URL = `${SITE_URL}/sitemap-index.xml`; 
const INDEXNOW_KEY = "c5b6124b5f8744fbb1a44a96266b9aa7"; 

async function pingSearchEngines(newUrls = []) {
  console.log("📢 Sending PINGs to Google, Bing, and IndexNow...");

  // 1. Google & Bing standard sitemap pings
  const standardPings = [
    { name: "Google", url: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}` },
    { name: "Bing", url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}` }
  ];

  for (const e of standardPings) {
    try {
      const res = await fetch(e.url);
      if (res.status < 400) console.log(`✅ ${e.name} sitemap ping success.`);
      else console.log(`⚠️ ${e.name} failed (${res.status}).`);
    } catch (err) {
      console.error(`❌ ${e.name} Error:`, err.message);
    }
  }

  // 2. IndexNow (Direct URL Submission)
  // Agar newUrls list di gayi hai toh wo bhejega, warna sirf sitemap index
  const urlList = newUrls.length > 0 ? newUrls : [SITEMAP_URL, `${SITE_URL}/` ];

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "dareloom.fun",
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, // Updated to match your key name
        urlList: urlList
      })
    });
    if (res.ok) console.log(`✅ IndexNow success: Submitted ${urlList.length} URLs.`);
    else console.log(`⚠️ IndexNow failed (${res.status})`);
  } catch (err) {
    console.error(`❌ IndexNow Error:`, err.message);
  }
}

// Ise auto-run karne ke liye ya module export ke liye:
pingSearchEngines();
