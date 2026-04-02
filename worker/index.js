/**
 * Memo Master API Proxy — Cloudflare Worker
 *
 * 环境变量 (Secrets):
 *   MINIMAX_API_KEY  — MiniMax Coding Plan API Key
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

      // 检测是否包含图片
      const hasImage = messages.some(m =>
        Array.isArray(m.content) && m.content.some(c => c.type === "image_url")
      );

      let result;

      if (hasImage) {
        // 图片走 MiniMax 原生 chatcompletion_v2 接口（支持 vision）
        // 将 OpenAI 格式转换为 MiniMax 原生格式
        const nativeMessages = messages.map(m => {
          if (!Array.isArray(m.content)) {
            return { role: m.role, content: m.content };
          }
          // 提取文本和图片
          const textParts = m.content.filter(c => c.type === "text").map(c => c.text).join("\n");
          const imageParts = m.content.filter(c => c.type === "image_url");

          // MiniMax 原生格式：content 是文本，image_url 作为额外字段
          const msg = { role: m.role, content: [] };

          for (const img of imageParts) {
            msg.content.push({
              type: "image_url",
              image_url: { url: img.image_url.url }
            });
          }
          if (textParts) {
            msg.content.push({ type: "text", text: textParts });
          }
          return msg;
        });

        const res = await fetch("https://api.minimax.io/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.MINIMAX_API_KEY}`
          },
          body: JSON.stringify({
            model: "MiniMax-M2.7",
            messages: nativeMessages,
            max_tokens,
            temperature
          })
        });
        result = await res.json();
      } else {
        // 纯文本走标准接口
        // 将 content 数组简化为字符串
        const simpleMessages = messages.map(m => {
          if (Array.isArray(m.content)) {
            const text = m.content.filter(c => c.type === "text").map(c => c.text).join("\n");
            return { role: m.role, content: text };
          }
          return m;
        });

        const res = await fetch("https://api.minimax.io/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.MINIMAX_API_KEY}`
          },
          body: JSON.stringify({
            model: "MiniMax-M2.7",
            messages: simpleMessages,
            max_tokens,
            temperature
          })
        });
        result = await res.json();
      }

      if (result.error) {
        console.error("MiniMax error:", JSON.stringify(result.error));
        const errMsg = result.error.message || JSON.stringify(result.error);
        return jsonResponse({ error: "AI 错误: " + errMsg }, 502, env);
      }

      if (!result.choices || !result.choices[0]) {
        console.error("MiniMax unexpected response:", JSON.stringify(result));
        return jsonResponse({ error: "AI 返回异常: " + JSON.stringify(result).slice(0, 200) }, 502, env);
      }

      return jsonResponse({
        content: result.choices[0].message?.content || ""
      }, 200, env);

    } catch (e) {
      console.error("Worker error:", e.message, e.stack);
      return jsonResponse({ error: "服务器错误: " + e.message }, 500, env);
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
