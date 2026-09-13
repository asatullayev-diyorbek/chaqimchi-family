// Called by the parent-mobile client (app or the Telegram Mini App web
// build) to generate the "Ilova haqida" explanation for one installed app.
// Unlike groq-relay (weekly insights), this doesn't need any per-child data
// from Django — the prompt only needs the app's exe name and publisher,
// which the client already has locally from the installed-apps list — so
// there's no /data/ endpoint to fetch through. The client's Django access
// token is still forwarded, but only to Django's lightweight /api/auth/me/
// (any authenticated parent may generate app info — it's shared, non-
// personal content, not gated per family) so this route can't be used as a
// free public Groq proxy by anyone who finds the URL.
//
// CORS: same allowlist as groq-relay — see that route's comment for why.
import { generateAppInfo } from "@/lib/appinfo";

const API_BASE = process.env.CHAQIMCHI_PUBLIC_API_URL || "https://api.guard.chaqimchi-ai.uz";

const ALLOWED_ORIGINS = new Set([
  "https://spino24.chaqimchi-ai.uz",
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

  let appName: string;
  let publisher: string;
  try {
    ({ app_name: appName, publisher = "" } = await request.json());
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400, headers: cors });
  }
  if (!appName) {
    return Response.json({ error: "app_name required" }, { status: 400, headers: cors });
  }

  const meRes = await fetch(`${API_BASE}/api/auth/me/`, { headers: { Authorization: auth } });
  if (!meRes.ok) {
    const body = await meRes.json().catch(() => ({}));
    return Response.json(body, { status: meRes.status, headers: cors });
  }

  const result = await generateAppInfo(appName, publisher);
  if (result === null) {
    return Response.json({ error: "generation failed" }, { status: 502, headers: cors });
  }
  return Response.json({ result }, { headers: cors });
}
