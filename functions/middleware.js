export async function onRequestGet() {
  const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
  const API_KEY = SHEET_API_KEY; // from Cloudflare Secret Variable

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1?alt=json&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch data from sheet");

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}
