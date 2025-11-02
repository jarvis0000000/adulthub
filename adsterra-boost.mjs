// 💰 Dareloom.fun - Adsterra High CTR + SmartLink Booster v3.4
// Optimized for earnings + user navigation safety

export function initAdsterraBoost(config = {}) {
  const SMART_LINK = "https://bulletinsituatedelectronics.com/b95e6swf?key=0f61d8bf1a7278d5cf9f161ab55bafbb";

  // 🔧 optional settings
  const delay = config.delay || 3;
  const placementId = config.placementId || "default-placement";

  // 🎯 Adsterra placements
  const ADS = [
    "https://www.profitablecpmgate.com/2703276.js",  // banner
    "https://www.profitablecpmgate.com/27529034.js", // pop
    "https://www.profitablecpmgate.com/27554479.js"  // social bar
  ];

  function loadAd(src) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.body.appendChild(s);
  }

  // Delay ads slightly for better UX
  function loadAdsGradually() {
    loadAd(ADS[0]);
    setTimeout(() => loadAd(ADS[2]), 4000);
    setTimeout(() => loadAd(ADS[1]), 9000);
  }

  // 🧠 SmartLink trigger — only if click is NOT on a link/button/video
  function smartTrigger(e) {
    const tag = e.target.tagName.toLowerCase();
    if (["a", "button", "video", "img", "input"].includes(tag)) return;

    if (sessionStorage.getItem("smartLinkDone")) return;
    sessionStorage.setItem("smartLinkDone", "true");

    setTimeout(() => {
      window.open(SMART_LINK, "_blank");
    }, Math.random() * 4000 + delay * 1000);
  }

  // 🧩 attach listener only on body-level clicks
  document.body.addEventListener("click", smartTrigger, { once: true });
  document.addEventListener("scroll", () => {
    if (!sessionStorage.getItem("smartLinkDone")) smartTrigger({ target: {} });
  }, { once: true });

  // Rotate passive ads
  setInterval(() => {
    const randomAd = ADS[Math.floor(Math.random() * ADS.length)];
    loadAd(randomAd);
  }, 60000);

  window.addEventListener("DOMContentLoaded", loadAdsGradually);

  console.log("✅ Adsterra Boost v3.4 running | Placement:", placementId);
}
