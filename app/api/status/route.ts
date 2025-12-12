import { NextResponse } from "next/server"
import { getSystemStatus } from "@/lib/health"

export async function GET() {
  try {
    const status = await getSystemStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error("Failed to get system status:", error)
    // Return degraded status on error
    return NextResponse.json({
      backend: "degraded",
      database: "degraded",
      storage: "degraded",
      analysis: "degraded",
      latency: undefined,
    })
  }
}

