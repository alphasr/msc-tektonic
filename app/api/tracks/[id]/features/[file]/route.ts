import { NextRequest, NextResponse } from "next/server"
import { getFeaturesDir } from "@/lib/storage"
import { promises as fs } from "fs"
import path from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; file: string }> }
) {
  try {
    const { id, file } = await params
    const featuresDir = getFeaturesDir(id)
    
    // Validate file name to prevent path traversal
    const allowedFiles = ["bar_vecs.json", "phrase_vecs.json", "summary.json", "waveform.json"]
    if (!allowedFiles.includes(file)) {
      return NextResponse.json(
        { error: "Invalid file name" },
        { status: 400 }
      )
    }
    
    const filePath = path.join(featuresDir, file)
    
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json(
        { error: "Feature file not found" },
        { status: 404 }
      )
    }
    
    const content = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(content)
    
    return NextResponse.json(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Failed to get feature file:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

