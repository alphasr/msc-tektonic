import { NextResponse } from "next/server"
import { loadManifests } from "@/lib/storage"
import { Stats } from "@/types"

export async function GET() {
  try {
    const manifests = await loadManifests()
    const tracks = Object.values(manifests).filter((m) => m.status === "ready")

    if (tracks.length === 0) {
      return NextResponse.json({
        totalTracks: 0,
        storageUsed: 0,
        averageDuration: 0,
        totalDuration: 0,
        averageTempo: 0,
        averagePhrases: 0,
        shortestTrack: null,
        longestTrack: null,
        tracksWithTitles: 0,
        averageFileSize: 0,
        directoryBreakdown: {},
        recentTracks: [],
      })
    }

    const summaries = tracks
      .map((t) => t.summary)
      .filter((s): s is NonNullable<typeof s> => s !== undefined)

    const totalTracks = tracks.length
    const storageUsed = tracks.reduce((sum, t) => sum + t.file_size, 0)
    const averageDuration =
      summaries.reduce((sum, s) => sum + s.duration, 0) / summaries.length
    const totalDuration = summaries.reduce((sum, s) => sum + s.duration, 0)
    const averageTempo =
      summaries.reduce((sum, s) => sum + s.tempo_bpm, 0) / summaries.length
    const averagePhrases =
      summaries.reduce((sum, s) => sum + s.phrases, 0) / summaries.length

    // Find shortest and longest tracks
    const sortedByDuration = [...summaries].sort((a, b) => a.duration - b.duration)
    const shortest = sortedByDuration[0]
    const longest = sortedByDuration[sortedByDuration.length - 1]

    const shortestTrack = shortest
      ? tracks.find((t) => t.summary?.duration === shortest.duration)
      : null
    const longestTrack = longest
      ? tracks.find((t) => t.summary?.duration === longest.duration)
      : null

    const tracksWithTitles = tracks.filter((t) => t.title).length
    const averageFileSize = storageUsed / totalTracks

    // Directory breakdown
    const directoryBreakdown: Record<string, number> = {}
    directoryBreakdown["/tracks"] = totalTracks

    // Recent tracks (last 6)
    const recentTracks = await Promise.all(
      tracks
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
        .map(async (t) => {
          // Load waveform for recent tracks
          let waveform: number[] = []
          try {
            const { loadFeatures } = await import("@/lib/analysis")
            const features = await loadFeatures(t.track_id)
            waveform = features.waveform || []
          } catch {
            waveform = []
          }

          return {
            id: t.track_id,
            title: t.title || "Unknown",
            artist: t.artist || "Unknown",
            bpm: t.summary?.tempo_bpm || 0,
            key: t.summary?.key || "",
            energy: t.summary?.energy || 0,
            duration: t.summary?.duration || 0,
            tags: [],
            phrases: t.summary?.phrases || 0,
            waveform,
          }
        })
    )

    const stats: Stats = {
      totalTracks,
      storageUsed,
      averageDuration,
      totalDuration,
      averageTempo,
      averagePhrases,
      shortestTrack: shortestTrack
        ? await (async () => {
            let waveform: number[] = []
            try {
              const { loadFeatures } = await import("@/lib/analysis")
              const features = await loadFeatures(shortestTrack.track_id)
              waveform = features.waveform || []
            } catch {
              waveform = []
            }
            return {
              id: shortestTrack.track_id,
              title: shortestTrack.title || "Unknown",
              artist: shortestTrack.artist || "Unknown",
              bpm: shortestTrack.summary?.tempo_bpm || 0,
              key: shortestTrack.summary?.key || "",
              energy: shortestTrack.summary?.energy || 0,
              duration: shortestTrack.summary?.duration || 0,
              tags: [],
              phrases: shortestTrack.summary?.phrases || 0,
              waveform,
            }
          })()
        : null,
      longestTrack: longestTrack
        ? await (async () => {
            let waveform: number[] = []
            try {
              const { loadFeatures } = await import("@/lib/analysis")
              const features = await loadFeatures(longestTrack.track_id)
              waveform = features.waveform || []
            } catch {
              waveform = []
            }
            return {
              id: longestTrack.track_id,
              title: longestTrack.title || "Unknown",
              artist: longestTrack.artist || "Unknown",
              bpm: longestTrack.summary?.tempo_bpm || 0,
              key: longestTrack.summary?.key || "",
              energy: longestTrack.summary?.energy || 0,
              duration: longestTrack.summary?.duration || 0,
              tags: [],
              phrases: longestTrack.summary?.phrases || 0,
              waveform,
            }
          })()
        : null,
      tracksWithTitles,
      averageFileSize,
      directoryBreakdown,
      recentTracks,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Failed to get stats:", error)
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    )
  }
}

