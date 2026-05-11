import { createHmac } from "crypto";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    const accessCode = process.env.ACCESS_CODE;
    const salt = process.env.ACCESS_SALT;

    if (!accessCode || !salt || !token) {
      return NextResponse.json({ valid: false });
    }

    const expected = createHmac("sha256", salt).update(accessCode.toLowerCase()).digest("hex");
    return NextResponse.json({ valid: token === expected });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
