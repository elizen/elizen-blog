/**
 * Memo Master API Proxy — Cloudflare Worker
 *
 * 环境变量 (Secrets，通过 wrangler secret put 设置):
 *   MINIMAX_API_KEY  — MiniMax Coding Plan API Key
 *
 * 环境变量 (wrangler.toml):
 *   ALLOWED_ORIGIN   — 允许跨域的前端域名
 */

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, env);
    }

    try {
      const body = await request.json();
      const { messages, max_tokens = 4096, temperature = 0.3 } = body;

      if (!messages || !Array.isArray(messages)) {
        return jsonResponse({ error: "缺少 messages 参数" }, 400, env);
      }

      const miniMaxRes = await fetch("https://api.minimax.io/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.MINIMAX_API_KEY}`
        },
        body: JSON.stringify({
          model: "MiniMax-M2.7",
          messages,
          max_tokens,
          temperature
        })
      });

      const result = await miniMaxRes.json();

      if (result.error) {
        console.error("MiniMax error:", JSON.stringify(result.error));
        return jsonResponse({ error: "AI 服务异常，请稍后再试" }, 502, env);
      }

      return jsonResponse({
        content: result.choices?.[0]?.message?.content || ""
      }, 200, env);

    } catch (e) {
      console.error("Worker error:", e.message);
      return jsonResponse({ error: "服务器内部错误" }, 500, env);
    }
  }
};

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonResponse(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) }
  });
}
