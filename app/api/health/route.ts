import { NextResponse } from "next/server";

// Lightweight liveness probe for Docker / Coolify health checks.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", service: "narria" });
}
