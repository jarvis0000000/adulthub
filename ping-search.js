// ping-search.mjs
// ✅ Purpose: Notify Google, Bing & IndexNow instantly

import fetch from "node-fetch";

const SITE_URL = "https://dareloom.fun"; // apna domain
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const INDEXNOW_KEY = "c5b6124b5f8744fbb1a44a96266b9aa7"; // same key as generate script

async function pingSearchEngines() {
  console.log("📢 Sending PINGs to Google, Bing, and IndexNow...");

  const endpoints = [
    {
      name: "Google",
      url: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`
    },
    {
      name: "Bing",
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
      if (res.ok) console.log(`✅ ${e.name} ping success`);
      else console.log(`⚠️ ${e.name} failed (${res.status})`);
    } catch (err) {
      console.error(`❌ Error pinging ${e.name}:`, err.message);
    }
  }
}

pingSearchEngines();
