import { NextResponse } from "next/server"
import { loadManifests } from "@/lib/storage"
import { Track } from "@/types"

export async function GET() {
  try {
    const manifests = await loadManifests()
    
    // Convert to array and format as Track objects for frontend
    const tracks: Track[] = await Promise.all(
      Object.values(manifests)
        .filter((manifest) => manifest.status === "ready" && manifest.summary)
        .map(async (manifest) => {
          // Load real waveform from features
          let waveform: number[] = []
          try {
            const { loadFeatures } = await import("@/lib/analysis")
            const features = await loadFeatures(manifest.track_id)
            if (features.waveform && features.waveform.length > 0) {
              waveform = features.waveform
            } else {
              // If waveform not available, try to generate from audio file
              // For now, return empty array - waveform will be generated during analysis
              waveform = []
            }
          } catch (error) {
            // If features not loaded, return empty - will be generated
            waveform = []
          }

          return {
            id: manifest.track_id,
            title: manifest.title || "Unknown",
            artist: manifest.artist || "Unknown",
            bpm: manifest.summary!.tempo_bpm,
            key: manifest.summary!.key,
            energy: manifest.summary!.energy,
            duration: manifest.summary!.duration,
            tags: [], // Could be extracted from metadata
            phrases: manifest.summary!.phrases,
            waveform,
          }
        })
    )
    
    return NextResponse.json(tracks)
  } catch (error) {
    console.error("Failed to load tracks:", error)
    return NextResponse.json(
      { error: "Failed to load tracks" },
      { status: 500 }
    )
  }
}
