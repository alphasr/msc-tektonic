// Initialize analysis worker
// This registers the queue handler for processing analysis jobs

import { analyzeQueue } from "./queue"
import { analyzeTrack } from "./analysis"
import { getManifest, saveManifest } from "./storage"

// Register analysis job handler
analyzeQueue.on("analyze", async (data: { track_id: string; path: string }) => {
  const { track_id, path } = data

  // Get manifest
  const manifest = await getManifest(track_id)
  if (!manifest) {
    throw new Error(`Manifest not found for track ${track_id}`)
  }

  // Check if already processed (idempotent)
  if (manifest.status === "ready" && manifest.summary) {
    console.log(`Track ${track_id} already processed, skipping`)
    return
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

    console.log(`Track ${track_id} analyzed successfully`)
  } catch (error: any) {
    // Update manifest with error
    manifest.status = "error"
    manifest.error_reason = error.message || "analysis_failed"
    manifest.updated_at = new Date().toISOString()
    await saveManifest(manifest)

    console.error(`Track ${track_id} analysis failed:`, error)
    throw error // Re-throw to trigger retry
  }
})

// Initialize worker on module load
console.log("Analysis worker initialized")

