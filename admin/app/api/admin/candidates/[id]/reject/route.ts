import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:4000";

// Operasi ini nembak on-chain lewat backend dan bisa jalan puluhan detik
// (update-oracles menyentuh seluruh market). Default timeout function Vercel
// jauh lebih pendek dari itu dan bikin 500 dengan body kosong.
export const maxDuration = 60;

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


export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${BACKEND}/api/v1/admin/candidates/${id}/reject`, {
    method: "POST",
  });
  return NextResponse.json(await safeJson(res), { status: res.status });
}
