import { NextRequest, NextResponse } from "next/server"
import { initStorage, saveFile, saveManifest, generateTrackId, calculateDigest, isValidAudio, getExtension, trackExists, getTrackPath } from "@/lib/storage"
import { analyzeQueue } from "@/lib/queue"

// Initialize storage and worker on module load
initStorage()
// Import worker to register handlers
import "@/lib/worker"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio_file") as File | null
    const artist = (formData.get("artist") as string) || undefined
    const title = (formData.get("title") as string) || undefined

    // Validate file
    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      )
    }

    // Validate file type
    const extension = getExtension(audioFile.name, audioFile.type)
    if (!isValidAudio(audioFile.type, extension)) {
      return NextResponse.json(
        { error: "Invalid audio format" },
        { status: 415 }
      )
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: "File too large (max 100MB)" },
        { status: 413 }
      )
    }

    // Read file buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Calculate content digest
    const contentDigest = calculateDigest(buffer)

    // Generate track_id
    const track_id = generateTrackId(artist, title, audioFile.size, contentDigest)

    // Check for duplicates
    if (await trackExists(track_id)) {
      return NextResponse.json(
        { error: "Track already exists", track_id },
        { status: 409 }
      )
    }

    // Save file to storage
    let filePath: string
    try {
      filePath = await saveFile(track_id, buffer, extension)
    } catch (error) {
      console.error("Storage save failed:", error)
      return NextResponse.json(
        { error: "Storage failure" },
        { status: 500 }
      )
    }

    // Create manifest
    const manifest: any = {
      track_id,
      status: "queued" as const,
      artist,
      title,
      file_size: audioFile.size,
      file_path: filePath,
      content_digest: contentDigest,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Save manifest
    try {
      await saveManifest(manifest)
    } catch (error) {
      console.error("Manifest save failed:", error)
      // Rollback: try to delete file
      try {
        const fs = await import("fs/promises")
        await fs.unlink(filePath)
      } catch {}
      return NextResponse.json(
        { error: "Failed to save manifest" },
        { status: 500 }
      )
    }

    // Enqueue analysis job
    try {
      await analyzeQueue.publish("analyze", {
        track_id,
        path: filePath,
      })
    } catch (error) {
      console.error("Queue publish failed:", error)
      // Update manifest with error
      manifest.status = "error"
      manifest.error_reason = "queue_publish_failed"
      await saveManifest(manifest)
      return NextResponse.json(
        { error: "Failed to enqueue analysis" },
        { status: 500 }
      )
    }

    // Return 202 Accepted
    return NextResponse.json(
      {
        track_id,
        status: "queued",
      },
      { status: 202 }
    )
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

