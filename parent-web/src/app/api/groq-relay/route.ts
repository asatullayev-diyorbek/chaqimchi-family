// Relays a chat-completions request to Groq on the backend's behalf.
//
// Why this exists: PythonAnywhere's outbound IP range is blocked by
// Cloudflare (error code 1010 — an ASN/datacenter block) in front of
// api.groq.com, so the Django backend (apps/insights/groq.py) can't reach
// Groq directly. Vercel's IPs aren't blocked, so this route does the actual
// call and the backend talks to this instead.
//
// Auth: a shared secret header (X-Relay-Secret), NOT the caller's own
// credentials — the real Groq API key lives only in this route's server-side
// env, never sent to or stored by the Django backend.

export async function POST(request: Request) {
  const secret = request.headers.get("x-relay-secret");
  if (!process.env.GROQ_RELAY_SECRET || secret !== process.env.GROQ_RELAY_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const body = await request.text();

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const text = await groqResponse.text();
  return new Response(text, {
    status: groqResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}
