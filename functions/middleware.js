export default {
  async fetch(request, env, ctx) {
    return new Response("Function is active ✅", { status: 200 });
  },
};
