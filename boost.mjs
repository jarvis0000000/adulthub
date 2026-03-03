// 💰 Dareloom.fun - Adsterra Booster v3 (Clean + Optimized)

(function () {

  console.log("🚀 Dareloom Ad Booster v3 Loaded");

  // ====== 🔑 REPLACE WITH YOUR REAL CODES ======
  const POPUNDER    = "https://rockyappliance.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  const SOCIAL_BAR  = "//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js";
  const INPAGE_PUSH = "https://rockyappliance.com/b95e6swf?key=0f61d8bf1a7278d5cf9f161ab55bafbb";

  // ====== ⚙️ SETTINGS ======
  const MAX_POP_PER_DAY = 1;   // Adult site ke liye 1 best
  const INITIAL_DELAY   = 4000;
  const RETRY_DELAY     = 3000;

  // ====== 🍪 COOKIE HELPERS ======
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + "=" + value + ";path=/;expires=" + d.toUTCString();
  }

  // ====== 📜 LOAD SCRIPT SAFE ======
  function loadAd(src, retries = 2, callback) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;

    s.onload = () => {
      console.log("✅ Loaded:", src);
      if (callback) callback();
    };

    s.onerror = () => {
      console.warn("⚠️ Failed:", src, "Retries left:", retries);
      if (retries > 0) {
        setTimeout(() => loadAd(src, retries - 1, callback), RETRY_DELAY);
      }
    };

    document.head.appendChild(s);
  }

  // ====== 🚦 POP CONTROL ======
  function canShowPop() {

    const today = new Date().toDateString();
    const lastDate = getCookie("pop_date");
    const popCount = parseInt(getCookie("pop_count") || 0);

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

  // ====== 🎯 START ADS ======
  function startAds() {

    // 1️⃣ Social Bar (always load)
    loadAd(SOCIAL_BAR);

    // 2️⃣ In-Page Push (only once per session)
    if (!sessionStorage.getItem("push_loaded")) {
      setTimeout(() => {
        loadAd(INPAGE_PUSH);
        sessionStorage.setItem("push_loaded", "1");
      }, 3000);
    }

    // 3️⃣ Popunder (on first user interaction for better CPM)
    function triggerPop() {
      if (canShowPop()) {
        loadAd(POPUNDER);
      }
      document.removeEventListener("click", triggerPop);
      document.removeEventListener("touchstart", triggerPop);
    }

    document.addEventListener("click", triggerPop, { once: true });
    document.addEventListener("touchstart", triggerPop, { once: true });
  }

  // ====== 🚀 INIT AFTER PAGE LOAD ======
  window.addEventListener("load", () => {
    setTimeout(startAds, INITIAL_DELAY);
  });

})();
