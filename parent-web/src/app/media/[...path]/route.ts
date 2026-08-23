import { NextRequest, NextResponse } from "next/server";

const backend = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${backend}/media/${path.map(encodeURIComponent).join("/")}`;
  const response = await fetch(target, { headers: { "ngrok-skip-browser-warning": "true" }, cache: "no-store" });
  if (!response.ok) return NextResponse.json({ detail: "Media file not found" }, { status: response.status });
  return new NextResponse(await response.arrayBuffer(), { status: 200, headers: { "Content-Type": response.headers.get("content-type") || "application/octet-stream", "Cache-Control": "public, max-age=3600" } });
}
