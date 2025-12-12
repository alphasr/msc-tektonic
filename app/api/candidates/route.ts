import { NextRequest, NextResponse } from "next/server"
import { generateCandidates } from "@/lib/candidates"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fromTrack, toTrack, k = 5, mode = "both", scope = "phrase" } = body

    if (!fromTrack || !toTrack) {
      return NextResponse.json(
        { error: "fromTrack and toTrack are required" },
        { status: 400 }
      )
    }

    // Generate candidates using actual analysis
    const candidates = await generateCandidates(fromTrack, toTrack, k)

    return NextResponse.json(candidates)
  } catch (error: any) {
    console.error("Failed to generate candidates:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate candidates" },
      { status: 500 }
    )
  }
}

