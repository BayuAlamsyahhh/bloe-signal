export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }
    const url = new URL(request.url);
    if (url.pathname !== "/api/chat") {
      return new Response("Not Found", { status: 404, headers: cors() });
    }
    try {
      const { messages, extra } = await request.json();
      const sys = { role: "system", content: "You are an expert trading analyst. Be concise, structured, and actionable. When user provides TA context (SL/TP/levels) or chart screenshots, extract key info, validate, and propose improved entries, risk %, partial TPs, and reversal scenarios." };
      // Support multimodal (text + images) by forwarding content arrays as-is
      const body = {
        model: extra?.mode === "vision" ? "gpt-4o" : "gpt-4o-mini",
        messages: [sys, ...(messages||[])],
        temperature: extra?.mode === "freechat" ? 0.7 : 0.3
      };
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type":"application/json", "authorization": `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify(body)
      });
      if (!upstream.ok) {
        const t = await upstream.text();
        return new Response("Upstream error: "+t, { status: 500, headers: { ...cors(), "content-type":"text/plain" } });
      }
      const j = await upstream.json();
      const reply = j?.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ reply }), { status: 200, headers: { ...cors(), "content-type":"application/json" } });
    } catch (e) {
      return new Response("Bad Request: "+e.message, { status: 400, headers: cors() });
    }
  }
}
function cors(){ return { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"content-type" } }
