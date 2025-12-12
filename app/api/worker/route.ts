// Analysis worker endpoint
// In production, this would be a separate worker process
// For now, we'll process jobs on-demand

import { NextRequest, NextResponse } from "next/server"
import { analyzeTrack } from "@/lib/analysis"
import { getManifest, saveManifest } from "@/lib/storage"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { track_id, path } = body

    if (!track_id || !path) {
      return NextResponse.json(
        { error: "track_id and path are required" },
        { status: 400 }
      )
    }

    // Get manifest
    const manifest = await getManifest(track_id)
    if (!manifest) {
      return NextResponse.json(
        { error: "Track not found" },
        { status: 404 }
      )
    }

    // Check if already processed
    if (manifest.status === "ready" && manifest.summary) {
      return NextResponse.json({
        track_id,
        status: "ready",
        message: "Already processed",
      })
    }

    // Update status to processing
    manifest.status = "processing"
    manifest.updated_at = new Date().toISOString()
    await saveManifest(manifest)

    try {
      // Analyze track
      const summary = await analyzeTrack(track_id, path)

      // Update manifest with results
      manifest.status = "ready"
      manifest.summary = summary
      manifest.updated_at = new Date().toISOString()
      await saveManifest(manifest)

      return NextResponse.json({
        track_id,
        status: "ready",
        summary,
      })
    } catch (error: any) {
      // Update manifest with error
      manifest.status = "error"
      manifest.error_reason = error.message || "analysis_failed"
      manifest.updated_at = new Date().toISOString()
      await saveManifest(manifest)

      return NextResponse.json(
        {
          track_id,
          status: "error",
          error: error.message,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Worker error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

