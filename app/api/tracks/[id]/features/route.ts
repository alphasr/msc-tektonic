import { NextRequest, NextResponse } from "next/server"
import { getFeaturesDir } from "@/lib/storage"
import { promises as fs } from "fs"
import path from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const featuresDir = getFeaturesDir(id)
    
    // Check if features exist
    const barVecsPath = path.join(featuresDir, "bar_vecs.json")
    const phraseVecsPath = path.join(featuresDir, "phrase_vecs.json")
    const summaryPath = path.join(featuresDir, "summary.json")
    const waveformPath = path.join(featuresDir, "waveform.json")
    
    const features: Record<string, string> = {}
    
    try {
      await fs.access(barVecsPath)
      features.bar_vecs = `/api/tracks/${id}/features/bar_vecs.json`
    } catch {}
    
    try {
      await fs.access(phraseVecsPath)
      features.phrase_vecs = `/api/tracks/${id}/features/phrase_vecs.json`
    } catch {}
    
    try {
      await fs.access(summaryPath)
      features.summary = `/api/tracks/${id}/features/summary.json`
    } catch {}
    
    try {
      await fs.access(waveformPath)
      features.waveform = `/api/tracks/${id}/features/waveform.json`
    } catch {}
    
    if (Object.keys(features).length === 0) {
      return NextResponse.json(
        { error: "Features not found" },
        { status: 404 }
      )
    }
    
    return NextResponse.json(features)
  } catch (error) {
    console.error("Failed to get features:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

