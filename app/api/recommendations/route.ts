import { NextRequest, NextResponse } from "next/server"
import { recommendTracks, findSimilarSegments } from "@/lib/recommendations"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trackId, type = "tracks", position, options = {} } = body

    if (!trackId) {
      return NextResponse.json(
        { error: "trackId is required" },
        { status: 400 }
      )
    }

    if (type === "tracks") {
      // Get track recommendations
      const recommendations = await recommendTracks(trackId, {
        limit: options.limit || 10,
        minScore: options.minScore || 0.4,
        excludeTrackIds: options.excludeTrackIds || [],
      })

      return NextResponse.json(recommendations)
    } else if (type === "segments") {
      // Find similar segments
      if (position === undefined) {
        return NextResponse.json(
          { error: "position is required for segment search" },
          { status: 400 }
        )
      }

      const segments = await findSimilarSegments(trackId, position, {
        scope: options.scope || "phrase",
        limit: options.limit || 10,
        minSimilarity: options.minSimilarity || 0.6,
        withinTrack: options.withinTrack || false,
      })

      return NextResponse.json(segments)
    } else {
      return NextResponse.json(
        { error: "Invalid type. Use 'tracks' or 'segments'" },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error("Failed to get recommendations:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get recommendations" },
      { status: 500 }
    )
  }
}

// GET endpoint for quick recommendations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const trackId = searchParams.get("trackId")
    const limit = parseInt(searchParams.get("limit") || "10")

    if (!trackId) {
      return NextResponse.json(
        { error: "trackId query parameter is required" },
        { status: 400 }
      )
    }

    const recommendations = await recommendTracks(trackId, {
      limit,
      minScore: 0.4,
    })

    return NextResponse.json(recommendations)
  } catch (error: any) {
    console.error("Failed to get recommendations:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get recommendations" },
      { status: 500 }
    )
  }
}

