/**
 * Memo Master API Proxy — Cloudflare Worker
 *
 * Routes:
 *   POST /        — AI 文本/图片分析
 *   POST /tts     — 文字转语音
 *
 * Secrets: MINIMAX_API_KEY
 */

const API_HOST = "https://api.minimaxi.com";

// ===== AI 分析 =====
async function handleChat(body, env) {
  const { messages, max_tokens = 4096, temperature = 0.3 } = body;
  if (!messages || !Array.isArray(messages)) {
    return jsonResponse({ error: "缺少 messages 参数" }, 400, env);
  }

  const processed = messages.map(m => {
    if (!Array.isArray(m.content)) return m;
    const hasImage = m.content.some(c => c.type === "image_url");
    if (!hasImage) {
      const text = m.content.filter(c => c.type === "text").map(c => c.text).join("\n");
      return { role: m.role, content: text };
    }
    return m;
  });

  const res = await fetch(`${API_HOST}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.MINIMAX_API_KEY}`
    },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: processed,
      max_tokens,
      temperature
    })
  });

  const result = await res.json();
  if (result.error) {
    return jsonResponse({ error: "AI 错误: " + (result.error.message || JSON.stringify(result.error)) }, 502, env);
  }
  if (!result.choices?.[0]) {
    return jsonResponse({ error: "AI 返回异常" }, 502, env);
  }
  return jsonResponse({ content: result.choices[0].message?.content || "" }, 200, env);
}

// ===== TTS 语音 =====
async function handleTTS(body, env) {
  const { text } = body;
  if (!text) return jsonResponse({ error: "缺少 text 参数" }, 400, env);

  const res = await fetch(`${API_HOST}/v1/t2a_v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.MINIMAX_API_KEY}`
    },
    body: JSON.stringify({
      model: "speech-02-turbo",
      text: text,
      voice_setting: {
        voice_id: "English_expressive_narrator",
        speed: 0.9,
        vol: 1.0,
        pitch: 0
      },
      audio_setting: {
        sample_rate: 24000,
        format: "mp3"
      }
    })
  });

  const result = await res.json();

  if (result.base_resp?.status_code !== 0 && result.base_resp?.status_code !== undefined) {
    return jsonResponse({ error: "TTS 错误: " + (result.base_resp?.status_msg || JSON.stringify(result)) }, 502, env);
  }

  const audioHex = result.data?.audio;
  if (!audioHex) {
    return jsonResponse({ error: "TTS 未返回音频: " + JSON.stringify(result).slice(0, 300) }, 502, env);
  }

  // 将 hex 转为二进制返回 mp3
  const bytes = new Uint8Array(audioHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      ...corsHeaders(env)
    }
  });
}

// ===== Worker 入口 =====
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, env);
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === "/tts") {
        return handleTTS(await request.json(), env);
      }
      return handleChat(await request.json(), env);
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
