import { NextRequest, NextResponse } from "next/server"
import { searchSimilar } from "@/lib/candidates"
import { getManifest } from "@/lib/storage"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trackId, scope = "phrase", k = 10 } = body

    if (!trackId) {
      return NextResponse.json(
        { error: "trackId is required" },
        { status: 400 }
      )
    }

    // Default position to 0 if not provided
    const position = body.position || 0

    // Search for similar segments
    const results = await searchSimilar(trackId, position, scope, k)

    // Enrich with metadata
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const manifest = await getManifest(result.track_id)
        return {
          track_id: result.track_id,
          position: result.position,
          score: result.score,
          metadata: manifest?.summary
            ? {
                title: manifest.title || "Unknown",
                artist: manifest.artist || "Unknown",
                bpm: manifest.summary.tempo_bpm,
                key: manifest.summary.key,
                energy: manifest.summary.energy,
              }
            : null,
        }
      })
    )

    return NextResponse.json(enrichedResults)
  } catch (error: any) {
    console.error("Failed to search:", error)
    return NextResponse.json(
      { error: error.message || "Failed to search" },
      { status: 500 }
    )
  }
}

