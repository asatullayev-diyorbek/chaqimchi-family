// Called by the parent-mobile client (app or the Telegram Mini App web
// build) for ON-DEMAND "AI tahlil" generation. There is no static secret
// gating this route — a public client bundle can't keep one — instead the
// client's own Django access token is forwarded to Django's
// /api/insights/<child_id>/data/ endpoint, which already does the real
// auth (ownership + ai_analysis plan gate) for that token. This route only
// ever gets to call Groq if Django itself said the token may see that
// child's data.
//
// The client fetches the token-gated data through here (rather than
// calling Django directly and forwarding the bundle) because it never
// needs to hold the raw week-data bundle or know the prompt shape — this
// stays the only place that builds the Groq prompt (src/lib/groq.ts). The
// client still POSTs the returned result to Django's own
// /api/insights/<child_id>/submit/ endpoint directly, using its own token.
//
// CORS: this route lives on guard.chaqimchi-ai.uz but is called from the
// Mini App's own origin (spino24.chaqimchi-ai.uz, or its Vercel preview
// URLs) — a different origin, so the browser needs an explicit allow
// response or the fetch fails with no error detail ("Load failed"). Django
// already allowlists these same origins for its own API (see
// CORS_ALLOWED_ORIGINS in config/settings.py); mirrored here since Next.js
// route handlers don't get CORS handling for free.
import { generateWeeklyInsight } from "@/lib/groq";

const API_BASE = process.env.CHAQIMCHI_PUBLIC_API_URL || "https://apiguard.spino24.uz";

const ALLOWED_ORIGINS = new Set([
  "https://spino24.chaqimchi-ai.uz",
  "https://spino24.spino24.uz",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
]);
const ALLOWED_ORIGIN_REGEX = /^https:\/\/spino24[a-z0-9-]*\.vercel\.app$/;

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin || (!ALLOWED_ORIGINS.has(origin) && !ALLOWED_ORIGIN_REGEX.test(origin))) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));

  const auth = request.headers.get("authorization");
  if (!auth) {
    return Response.json({ error: "missing authorization" }, { status: 401, headers: cors });
  }

  let childId: string;
  let period: string;
  try {
    ({ child_id: childId, period = "last_week" } = await request.json());
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400, headers: cors });
  }
  if (!childId) {
    return Response.json({ error: "child_id required" }, { status: 400, headers: cors });
  }

  const dataRes = await fetch(
    `${API_BASE}/api/insights/${childId}/data/?period=${encodeURIComponent(period)}`,
    { headers: { Authorization: auth } },
  );
  if (!dataRes.ok) {
    const body = await dataRes.json().catch(() => ({}));
    return Response.json(body, { status: dataRes.status, headers: cors });
  }
  const week = await dataRes.json();

  const result = await generateWeeklyInsight(week);
  if (result === null) {
    return Response.json({ error: "generation failed" }, { status: 502, headers: cors });
  }
  return Response.json({ result }, { headers: cors });
}
