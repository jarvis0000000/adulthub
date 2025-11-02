// update-log.mjs
import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "last-run.json");

function updateLog(details = {}) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  const now = new Date().toISOString();
  const entry = {
    lastRun: now,
    ...details
  };

  fs.writeFileSync(LOG_FILE, JSON.stringify(entry, null, 2), "utf8");
  console.log(`🧾 Log updated: ${LOG_FILE}`);
}

// Example (auto-updated from workflow)
updateLog({
  sitemapGenerated: true,
  actorsUpdated: true,
  totalActors: 120,
  branch: process.env.GITHUB_REF_NAME || "local"
});
