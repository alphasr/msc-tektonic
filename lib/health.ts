// System health monitoring

import { promises as fs } from "fs"
import { STORAGE_ROOT, TRACKS_DIR, MANIFESTS_FILE } from "./storage"
import { analyzeQueue } from "./queue"
import path from "path"

export interface HealthCheck {
  status: "operational" | "degraded" | "outage"
  message?: string
  latency?: number
}

// Check storage health
export async function checkStorageHealth(): Promise<HealthCheck> {
  try {
    // Check if storage directory exists and is writable
    await fs.access(STORAGE_ROOT)
    await fs.access(TRACKS_DIR)
    await fs.access(MANIFESTS_FILE)
    
    // Try to read manifests
    const manifests = await fs.readFile(MANIFESTS_FILE, "utf-8")
    JSON.parse(manifests) // Validate JSON
    
    return { status: "operational" }
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // Directory doesn't exist, try to create it
      try {
        await fs.mkdir(STORAGE_ROOT, { recursive: true })
        await fs.mkdir(TRACKS_DIR, { recursive: true })
        await fs.writeFile(MANIFESTS_FILE, JSON.stringify({}, null, 2))
        return { status: "operational", message: "Storage initialized" }
      } catch {
        return { status: "outage", message: "Storage not accessible" }
      }
    }
    return { status: "degraded", message: error.message }
  }
}

// Check database (manifest file) health
export async function checkDatabaseHealth(): Promise<HealthCheck> {
  try {
    await fs.access(MANIFESTS_FILE)
    const data = await fs.readFile(MANIFESTS_FILE, "utf-8")
    JSON.parse(data)
    return { status: "operational" }
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // File doesn't exist, create it
      try {
        await fs.writeFile(MANIFESTS_FILE, JSON.stringify({}, null, 2))
        return { status: "operational", message: "Database initialized" }
      } catch {
        return { status: "outage", message: "Database not accessible" }
      }
    }
    return { status: "degraded", message: error.message }
  }
}

// Check analysis engine health
export async function checkAnalysisHealth(): Promise<HealthCheck> {
  try {
    // Check if we can import analysis functions
    const { analyzeAudioFile } = await import("./audio-analysis")
    if (typeof analyzeAudioFile === "function") {
      return { status: "operational" }
    }
    return { status: "degraded", message: "Analysis functions not available" }
  } catch (error: any) {
    return { status: "degraded", message: error.message }
  }
}

// Check backend API health
export async function checkBackendHealth(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    // Check if storage is accessible
    await fs.access(STORAGE_ROOT)
    const latency = Date.now() - startTime
    return { status: "operational", latency }
  } catch (error: any) {
    const latency = Date.now() - startTime
    return { status: "degraded", message: error.message, latency }
  }
}

// Get overall system status
export async function getSystemStatus() {
  const [backend, database, storage, analysis] = await Promise.all([
    checkBackendHealth(),
    checkDatabaseHealth(),
    checkStorageHealth(),
    checkAnalysisHealth(),
  ])

  // Calculate average latency
  const latencies = [backend.latency].filter((l): l is number => l !== undefined)
  const avgLatency = latencies.length > 0
    ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
    : undefined

  return {
    backend: backend.status,
    database: database.status,
    storage: storage.status,
    analysis: analysis.status,
    latency: avgLatency,
  }
}

// Check queue health
export function checkQueueHealth() {
  const stats = analyzeQueue.getStats()
  return {
    status: stats.processing ? "operational" : "operational",
    pending: stats.pending,
    processing: stats.processing,
  }
}

