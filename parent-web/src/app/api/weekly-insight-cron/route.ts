// The proactive weekly "AI tahlil" push, entry point moved here (not
// Django) for the same reason as groq-relay: PythonAnywhere can't reach
// Groq, Vercel can. cron-job.org hits this route weekly instead of a
// Django endpoint directly.
//
// Flow: pull every Max/Tester child missing this week's insight from
// Django -> generate each via Groq (right here, same process) -> push each
// result back to Django, which stores it and sends the Telegram DM (that
// outbound call — to api.telegram.org — IS reachable from PA, so Django
// still owns delivery).
import { generateWeeklyInsight } from "@/lib/groq";

const API_BASE = process.env.CHAQIMCHI_PUBLIC_API_URL || "https://apiguard.spino24.uz";

export async function POST(request: Request) {
  const secret = request.headers.get("x-insights-cron-secret");
  if (!process.env.INSIGHTS_CRON_SECRET || secret !== process.env.INSIGHTS_CRON_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const pendingRes = await fetch(`${API_BASE}/api/insights/pending-batch/`, {
    headers: { "X-Insights-Cron-Secret": process.env.INSIGHTS_CRON_SECRET },
  });
  if (!pendingRes.ok) {
    return Response.json({ error: "failed to fetch pending batch" }, { status: 502 });
  }
  const pending: { child_id: string; week_data: any }[] = (await pendingRes.json()).pending;

  let generated = 0;
  let sent = 0;
  for (const item of pending) {
    const result = await generateWeeklyInsight(item.week_data);
    if (!result) continue;
    generated += 1;

    const submitRes = await fetch(`${API_BASE}/api/insights/cron-submit/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Insights-Cron-Secret": process.env.INSIGHTS_CRON_SECRET,
      },
      body: JSON.stringify({ child_id: item.child_id, result }),
    });
    if (submitRes.ok) {
      const body = await submitRes.json().catch(() => ({}));
      sent += body.notified ?? 0;
    }
  }

  return Response.json({ pending: pending.length, generated, sent });
}
