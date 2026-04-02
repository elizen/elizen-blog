/**
 * Memo Master API Proxy — Cloudflare Worker
 *
 * 环境变量 (Secrets):
 *   MINIMAX_API_KEY  — MiniMax Coding Plan API Key
 * 环境变量 (wrangler.toml):
 *   ALLOWED_ORIGIN   — 允许跨域的前端域名
 */

// Coding Plan key 可能匹配不同的 host
const API_HOSTS = [
  "https://api.minimaxi.com",
  "https://api.minimax.io"
];

async function callMiniMax(host, apiKey, messages, maxTokens, temperature) {
  // 将 content 数组简化：纯文本转字符串，保留图片数组格式
  const processed = messages.map(m => {
    if (!Array.isArray(m.content)) return m;
    const hasImage = m.content.some(c => c.type === "image_url");
    if (!hasImage) {
      const text = m.content.filter(c => c.type === "text").map(c => c.text).join("\n");
      return { role: m.role, content: text };
    }
    return m;
  });

  const res = await fetch(`${host}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: processed,
      max_tokens: maxTokens,
      temperature
    })
  });
  return res.json();
}

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

      // 尝试所有 host，直到一个成功
      let result;
      let lastError;

      for (const host of API_HOSTS) {
        result = await callMiniMax(host, env.MINIMAX_API_KEY, messages, max_tokens, temperature);

        // 如果没有 error 或 error 不是 key 相关的，就用这个结果
        if (!result.error) break;

        const errMsg = result.error.message || JSON.stringify(result.error);
        if (errMsg.includes("invalid api key") || errMsg.includes("2049")) {
          lastError = `${host}: ${errMsg}`;
          continue; // 试下一个 host
        }

        // 其他错误直接返回
        return jsonResponse({ error: "AI 错误: " + errMsg }, 502, env);
      }

      if (result.error) {
        const errMsg = result.error.message || JSON.stringify(result.error);
        return jsonResponse({ error: "AI 错误: " + errMsg + (lastError ? " | 已尝试: " + lastError : "") }, 502, env);
      }

      if (!result.choices || !result.choices[0]) {
        return jsonResponse({ error: "AI 返回异常: " + JSON.stringify(result).slice(0, 300) }, 502, env);
      }

      return jsonResponse({
        content: result.choices[0].message?.content || ""
      }, 200, env);

    } catch (e) {
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
