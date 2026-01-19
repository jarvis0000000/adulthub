// 💰 Dareloom.fun - Adsterra Booster v2 (2026 Optimized)
// Higher earning • Less irritation • In-Page Push + Social Bar + Controlled Popunder

(function () {
  console.log("🚀 Dareloom Ad Booster v2 Loaded");

  // Adsterra codes - REPLACE with YOUR real codes
  const POPUNDER     = "https://rockyappliance.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  const SOCIAL_BAR   = "//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js";
  const INPAGE_PUSH  = "YOUR_INPAGE_PUSH_CODE_HERE"; // ← Add your Adsterra In-Page Push / Web Push code for 2-5× earnings

  const MAX_POP_PER_DAY = 2;       // Daily cap – adjust (1-3 recommended)
  const SESSION_POP     = true;    // true = one per session (very safe)
  const INITIAL_DELAY   = 5000;    // 5 seconds – feels natural
  const RETRY_DELAY     = 3000;

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? parseInt(match[2]) : 0;
  }

  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + "=" + value + ";path=/;expires=" + d.toUTCString();
  }

  function loadAd(src, retries = 3, callback) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      console.log("✅ Loaded:", src.split('/').pop());
      if (callback) callback();
    };
    s.onerror = () => {
      console.warn("⚠️ Failed:", src.split('/').pop(), `| Retries left: ${retries}`);
      if (retries > 0) setTimeout(() => loadAd(src, retries - 1, callback), RETRY_DELAY);
    };
    document.body.appendChild(s);
  }

  function canShowPop() {
    if (SESSION_POP && sessionStorage.getItem("pop_shown")) return false;

    const today = new Date().toDateString();
    const popCount = getCookie("pop_count") || 0;
    const lastDate = getCookie("pop_date");

    if (lastDate !== today) {
      setCookie("pop_date", today, 1);
      setCookie("pop_count", 1, 1);
      return true;
    }

    if (popCount < MAX_POP_PER_DAY) {
      setCookie("pop_count", popCount + 1, 1);
      return true;
    }

    return false;
  }

  function startAds() {
    // 1. Popunder (controlled)
    if (canShowPop()) {
      loadAd(POPUNDER, 3, () => {
        if (SESSION_POP) sessionStorage.setItem("pop_shown", "1");
      });
    }

    // 2. Social Bar (always, delayed)
    setTimeout(() => loadAd(SOCIAL_BAR), 2000);

    // 3. In-Page Push (highest earner – load once, high opt-in)
    if (INPAGE_PUSH && !sessionStorage.getItem("push_loaded")) {
      setTimeout(() => {
        loadAd(INPAGE_PUSH);
        sessionStorage.setItem("push_loaded", "1");
      }, 4000);
    }
  }

  // Optional: Exit-intent popunder (only when user tries to leave – very high conversion, low irritation)
  document.addEventListener("mouseout", e => {
    if (!e.relatedTarget && e.clientY <= 0 && canShowPop()) {
      loadAd(POPUNDER);
    }
  }, { once: true }); // Only trigger once per session

  // Start after small delay
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(startAds, INITIAL_DELAY);
  });
})();
