import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://tredie-production.up.railway.app";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: Context) {
  const { path } = await ctx.params;
  const url = new URL(`/api/v1/${path.join("/")}`, BACKEND);

  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers: HeadersInit = { "Content-Type": "application/json" };

  const body =
    req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

  const upstream = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
