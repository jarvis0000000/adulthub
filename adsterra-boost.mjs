// 💰 Dareloom.fun - Adsterra High CTR + SmartLink Booster v3
// GPT-5 tuned for MAX Revenue & SEO Safety

(function () {
  // 🔗 SmartLink URL (replace if needed)
  const SMART_LINK = "https://bulletinsituatedelectronics.com/b95e6swf?key=0f61d8bf1a7278d5cf9f161ab55bafbb";

  // 🧱 Ad placements
  const ADS = [
    "https://www.profitablecpmgate.com/2703276.js", // banner 728x90
    "https://www.profitablecpmgate.com/27529034.js", // popunder
    "https://www.profitablecpmgate.com/27554479.js"  // social bar
  ];

  // 🧩 Load ad script dynamically
  function loadAd(src) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.body.appendChild(s);
  }

  // 🕐 Delayed Ad Loading — better CTR
  function loadAdsGradually() {
    loadAd(ADS[0]); // Banner first
    setTimeout(() => loadAd(ADS[2]), 5000); // SocialBar after 5s
    setTimeout(() => loadAd(ADS[1]), 10000); // Popunder after 10s
  }

  // 💥 SmartLink Trigger — open only after engagement
  function triggerSmartLink() {
    if (sessionStorage.getItem("smartLinkDone")) return;
    sessionStorage.setItem("smartLinkDone", "true");

    // Small random delay (looks natural)
    setTimeout(() => {
      window.open(SMART_LINK, "_blank");
    }, Math.random() * 5000 + 3000);
  }

  // 🎯 Event-based earning boost
  document.addEventListener("click", triggerSmartLink, { once: true });
  document.addEventListener("scroll", triggerSmartLink, { once: true });
  document.addEventListener("touchstart", triggerSmartLink, { once: true });

  // 🔁 Rotate extra ads every minute (passive earnings)
  setInterval(() => {
    const randomAd = ADS[Math.floor(Math.random() * ADS.length)];
    loadAd(randomAd);
  }, 60000);

  // 🚀 Start ads after DOM ready
  window.addEventListener("DOMContentLoaded", loadAdsGradually);

  console.log("✅ Adsterra High-CTR Booster v3 Loaded");
})();
