import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function POST() {
  const res = await fetch(`${BACKEND}/api/v1/admin/poll-trending`, { method: "POST" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
