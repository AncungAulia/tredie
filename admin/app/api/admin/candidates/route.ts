import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Upstream tidak selalu membalas JSON: kalau tunnel putus, yang datang adalah
 *  halaman error HTML dari Cloudflare. res.json() melempar di situ dan Next.js
 *  membalas 500 tanpa body — terlihat seperti masalah konektivitas padahal
 *  status aslinya jauh lebih informatif. Teruskan apa adanya. */
async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: "Upstream tidak membalas JSON", status: res.status, body: text.slice(0, 200) };
  }
}


export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const res = await fetch(`${BACKEND}/api/v1/admin/candidates${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  return NextResponse.json(await safeJson(res), { status: res.status });
}
