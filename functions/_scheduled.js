export default {
  async scheduled(event, env, ctx) {
    try {
      const res = await fetch("https://dareloom.fun/api/full");
      console.log("Ping done ✅", res.status);
    } catch (err) {
      console.error("Ping failed ❌", err);
    }
  },
};
