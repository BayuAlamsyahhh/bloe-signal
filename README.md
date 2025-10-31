# BLOE Signal — Cloudflare Worker Proxy (Multimodal-Ready)

Meneruskan chat ke OpenAI (text & screenshot) dengan aman. API key disimpan di server.

## Deploy
1. Install Wrangler: `npm i -g wrangler`
2. `wrangler login`
3. `wrangler secret put OPENAI_API_KEY`
4. `wrangler deploy`
Endpoint: `POST /api/chat`

Body contoh (vision):
```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type":"text","text":"Baca screenshot chart ini..."},
        {"type":"image_url","image_url":{"url":"data:image/png;base64,...."}}
      ]
    }
  ],
  "extra": {"mode":"vision"}
}
```
