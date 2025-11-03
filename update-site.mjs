import fs from "fs";
import fetch from "node-fetch";

const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

async function fetchData() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows.map(r => ({
    title: r.c[0]?.v || "",
    trailer: r.c[2]?.v || "",
    watch: r.c[6]?.v || "",
    thumb: r.c[17]?.v || "",
    date: r.c[19]?.v || "",
    category: r.c[20]?.v || ""
  }));
  return rows.filter(r => r.title);
}

function generateHTML(movies) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dareloom Hub - Free Movies & Trailers</title>
  <meta name="description" content="Watch latest hot, romantic, and trending full movies & trailers updated daily. Free streaming without signup.">
  <link rel="canonical" href="https://dareloom.fun/">
  <script src="//pl${Math.floor(Math.random()*999)}.popads.net/pop.js"></script>
</head>
<body>
  <h1>🔥 Dareloom Hub - Latest Full Movies</h1>
  <div class="grid">
    ${movies.map(v => `
      <div class="card">
        <img src="${v.thumb}" alt="${v.title}">
        <h2>${v.title}</h2>
        <a href="${v.watch}" target="_blank">🎬 Watch</a> |
        <a href="${v.trailer}" target="_blank">📺 Trailer</a>
        <p>${v.category}</p>
      </div>`).join("")}
  </div>
</body>
</html>`;
}

async function main() {
  const movies = await fetchData();
  fs.writeFileSync("index.html", generateHTML(movies));
  console.log(`✅ ${movies.length} movies updated.`);
}
main();
