import { createHmac } from "crypto";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    const accessCode = process.env.ACCESS_CODE;
    const salt = process.env.ACCESS_SALT;

    if (!accessCode || !salt) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!code || code.toLowerCase().trim() !== accessCode.toLowerCase()) {
      return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
    }

    const token = createHmac("sha256", salt).update(accessCode.toLowerCase()).digest("hex");
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
