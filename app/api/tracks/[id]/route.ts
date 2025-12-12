import { NextRequest, NextResponse } from "next/server"
import { getManifest } from "@/lib/storage"
import { loadFeatures } from "@/lib/analysis"

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
    
    return NextResponse.json(manifest)
  } catch (error) {
    console.error("Failed to get track:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

