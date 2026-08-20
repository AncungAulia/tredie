import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:4000";

// Operasi ini nembak on-chain lewat backend dan bisa jalan puluhan detik
// (update-oracles menyentuh seluruh market). Default timeout function Vercel
// jauh lebih pendek dari itu dan bikin 500 dengan body kosong.
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${BACKEND}/api/v1/admin/candidates/${id}/approve`, {
    method: "POST",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
