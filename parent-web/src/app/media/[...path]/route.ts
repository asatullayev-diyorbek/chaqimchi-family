import { NextRequest, NextResponse } from "next/server";

const backend = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${backend}/media/${path.map(encodeURIComponent).join("/")}`;
  const response = await fetch(target, { headers: { "ngrok-skip-browser-warning": "true" }, cache: "no-store" });
  if (!response.ok) return NextResponse.json({ detail: "Media file not found" }, { status: response.status });

  // Stream the body straight through. arrayBuffer() buffered the whole file
  // in the function's memory first, which scales badly with photo size and
  // concurrent requests, and delays the first byte for no benefit.
  const headers = new Headers({
    "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
    // no-store on the upstream fetch is deliberate: this proxy shouldn't hold
    // its own copy, but the browser may cache the image it receives.
    "Cache-Control": "public, max-age=3600",
  });
  const length = response.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new NextResponse(response.body, { status: 200, headers });
}
