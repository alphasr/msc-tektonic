import { NextRequest, NextResponse } from "next/server"
import { getManifest, getTrackPath } from "@/lib/storage"
import { promises as fs } from "fs"
import path from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const manifest = await getManifest(id)
    
    if (!manifest) {
      return NextResponse.json(
        { error: "Track not found" },
        { status: 404 }
      )
    }

    // Check if file exists
    try {
      await fs.access(manifest.file_path)
    } catch {
      return NextResponse.json(
        { error: "Audio file not found" },
        { status: 404 }
      )
    }

    // Read file and stream it
    const fileBuffer = await fs.readFile(manifest.file_path)
    const ext = path.extname(manifest.file_path).slice(1)
    
    // Determine content type
    const contentType: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      flac: "audio/flac",
      m4a: "audio/mp4",
      ogg: "audio/ogg",
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType[ext] || "audio/mpeg",
        "Content-Length": fileBuffer.length.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000",
      },
    })
  } catch (error) {
    console.error("Failed to serve audio:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
