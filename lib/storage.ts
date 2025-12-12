import { createHash } from "crypto"
import { promises as fs } from "fs"
import path from "path"

export const STORAGE_ROOT = path.join(process.cwd(), "storage")
export const TRACKS_DIR = path.join(STORAGE_ROOT, "tracks")
export const MANIFESTS_FILE = path.join(STORAGE_ROOT, "manifests.json")

export interface TrackManifest {
  track_id: string
  status: "queued" | "processing" | "ready" | "error"
  artist?: string
  title?: string
  file_size: number
  file_path: string
  content_digest: string
  summary?: TrackSummary
  error_reason?: string
  created_at: string
  updated_at: string
}

export interface TrackSummary {
  tempo_bpm: number
  key: string
  energy: number
  duration: number
  phrases: number
  bars: number
}

// Initialize storage directories
export async function initStorage() {
  try {
    await fs.mkdir(STORAGE_ROOT, { recursive: true })
    await fs.mkdir(TRACKS_DIR, { recursive: true })
    
    // Initialize manifests file if it doesn't exist
    try {
      await fs.access(MANIFESTS_FILE)
    } catch {
      await fs.writeFile(MANIFESTS_FILE, JSON.stringify({}, null, 2))
    }
  } catch (error) {
    console.error("Failed to initialize storage:", error)
  }
}

// Load all manifests
export async function loadManifests(): Promise<Record<string, TrackManifest>> {
  try {
    const data = await fs.readFile(MANIFESTS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return {}
  }
}

// Save manifests
export async function saveManifests(manifests: Record<string, TrackManifest>) {
  await fs.writeFile(MANIFESTS_FILE, JSON.stringify(manifests, null, 2))
}

// Get manifest by track_id
export async function getManifest(track_id: string): Promise<TrackManifest | null> {
  const manifests = await loadManifests()
  return manifests[track_id] || null
}

// Save manifest
export async function saveManifest(manifest: TrackManifest) {
  const manifests = await loadManifests()
  manifests[manifest.track_id] = manifest
  await saveManifests(manifests)
}

// Generate track_id from metadata
export function generateTrackId(
  artist: string | undefined,
  title: string | undefined,
  fileSize: number,
  contentDigest: string
): string {
  const input = `${artist || ""}|${title || ""}|${fileSize}|${contentDigest}`
  return createHash("sha256").update(input).digest("hex").substring(0, 16)
}

// Get file path for track
export function getTrackPath(track_id: string, extension: string = "mp3"): string {
  return path.join(TRACKS_DIR, track_id, `audio.${extension}`)
}

// Get features directory for track
export function getFeaturesDir(track_id: string): string {
  return path.join(TRACKS_DIR, track_id, "features")
}

// Save file to storage
export async function saveFile(
  track_id: string,
  buffer: Buffer,
  extension: string
): Promise<string> {
  const trackDir = path.join(TRACKS_DIR, track_id)
  await fs.mkdir(trackDir, { recursive: true })
  
  const filePath = getTrackPath(track_id, extension)
  await fs.writeFile(filePath, buffer)
  
  return filePath
}

// Check if track exists
export async function trackExists(track_id: string): Promise<boolean> {
  const manifest = await getManifest(track_id)
  if (!manifest) return false
  
  try {
    await fs.access(manifest.file_path)
    return true
  } catch {
    return false
  }
}

// Calculate content digest
export function calculateDigest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

// Validate audio file
export function isValidAudio(mimeType: string, extension: string): boolean {
  const validMimeTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac",
    "audio/m4a",
    "audio/x-m4a",
  ]
  
  const validExtensions = ["mp3", "wav", "flac", "m4a", "ogg"]
  
  return validMimeTypes.includes(mimeType) || validExtensions.includes(extension.toLowerCase())
}

// Get file extension from filename or mime type
export function getExtension(filename?: string, mimeType?: string): string {
  if (filename) {
    const ext = path.extname(filename).slice(1).toLowerCase()
    if (ext) return ext
  }
  
  if (mimeType) {
    const mimeMap: Record<string, string> = {
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/wave": "wav",
      "audio/x-wav": "wav",
      "audio/flac": "flac",
      "audio/x-flac": "flac",
      "audio/m4a": "m4a",
      "audio/x-m4a": "m4a",
    }
    return mimeMap[mimeType] || "mp3"
  }
  
  return "mp3"
}

