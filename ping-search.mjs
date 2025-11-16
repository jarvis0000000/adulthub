// ping-search.mjs
// ✅ Purpose: Notify Google, Bing & IndexNow instantly
// 🛠️ FIX: Changed SITEMAP_URL from sitemap.xml to sitemap-index.xml

import fetch from "node-fetch";

const SITE_URL = "https://dareloom.fun"; // apna domain
// 💥 CRITICAL FIX: The Master Index file is sitemap-index.xml, NOT sitemap.xml
const SITEMAP_URL = `${SITE_URL}/sitemap-index.xml`; 
const INDEXNOW_KEY = "c5b6124b5f8744fbb1a44a96266b9aa7"; // same key as generate script

async function pingSearchEngines() {
  console.log("📢 Sending PINGs to Google, Bing, and IndexNow...");

  const endpoints = [
    {
      name: "Google",
      // Sending the correct master index file to Google
      url: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`
    },
    {
      name: "Bing",
      // Sending the correct master index file to Bing
      url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`
    },
    {
      name: "IndexNow",
      url: "https://api.indexnow.org/indexnow",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "dareloom.fun",
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/indexnow-key.txt`,
        // Sending the correct master index file to IndexNow
        urlList: [SITEMAP_URL]
      })
    }
  ];

  for (const e of endpoints) {
    try {
      const res = await fetch(e.url, {
        method: e.method || "GET",
        headers: e.headers,
        body: e.body
      });
      // Ping success code is typically 200 or 202.
      if (res.status < 400) console.log(`✅ ${e.name} ping success (${res.status})`);
      else console.log(`⚠️ ${e.name} failed (${res.status})`);
    } catch (err) {
      console.error(`❌ Error pinging ${e.name}:`, err.message);
    }
  }
}

pingSearchEngines();
