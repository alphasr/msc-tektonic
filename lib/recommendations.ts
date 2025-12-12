// Enhanced recommendation system with optimized matching algorithm
// Based on research: harmonic mixing, energy matching, and audio similarity

import { loadFeatures, keyScore, energyScore, cosineSimilarity } from "./analysis"
import { loadManifests, getManifest } from "./storage"
import { Track } from "@/types"

export interface TrackRecommendation {
  track: Track
  score: number
  scores: {
    harmonic: number      // Key compatibility (0-1)
    tempo: number         // BPM compatibility (0-1)
    energy: number        // Energy level match (0-1)
    texture: number       // Audio texture similarity (0-1)
    phrase: number        // Phrase structure similarity (0-1)
    overall: number       // Combined score (0-1)
  }
  bestTransition?: {
    fromPosition: number
    toPosition: number
    score: number
  }
  similarSegments?: Array<{
    position: number
    score: number
    type: "bar" | "phrase"
  }>
}

// Enhanced BPM compatibility scoring
// Research shows: ±5 BPM is ideal, ±10 BPM acceptable, beyond that requires pitch shifting
function tempoScore(bpmA: number, bpmB: number): number {
  const diff = Math.abs(bpmA - bpmB)
  
  if (diff === 0) return 1.0
  if (diff <= 2) return 0.95  // Perfect match
  if (diff <= 5) return 0.85   // Excellent
  if (diff <= 10) return 0.70  // Good
  if (diff <= 15) return 0.50  // Acceptable
  if (diff <= 20) return 0.30  // Challenging
  return 0.10  // Very difficult
}

// Enhanced energy transition scoring
// Research: Energy should either match or gradually increase/decrease
function energyTransitionScore(energyA: number, energyB: number): number {
  const diff = energyB - energyA
  
  // Perfect match
  if (Math.abs(diff) <= 0.5) return 1.0
  
  // Gradual increase (preferred for building energy)
  if (diff > 0 && diff <= 2) return 0.90
  if (diff > 2 && diff <= 4) return 0.75
  
  // Gradual decrease (good for breakdowns)
  if (diff < 0 && diff >= -2) return 0.85
  if (diff < -2 && diff >= -4) return 0.70
  
  // Sudden changes (risky but sometimes desired)
  if (Math.abs(diff) <= 6) return 0.50
  
  return 0.20  // Too extreme
}

// Harmonic compatibility with Camelot Wheel
// Enhanced key matching based on DJ mixing theory
function harmonicScore(keyA: string, keyB: string): number {
  // Use existing keyScore but enhance with better weights
  const baseScore = keyScore(keyA, keyB)
  
  // Perfect match
  if (baseScore >= 0.95) return 1.0
  
  // Relative minor/major (very compatible)
  if (baseScore >= 0.85) return 0.95
  
  // Compatible keys (Camelot wheel adjacent)
  if (baseScore >= 0.70) return 0.85
  
  // Somewhat compatible
  if (baseScore >= 0.50) return 0.65
  
  return baseScore * 0.5  // Penalize incompatible keys
}

// Audio texture similarity using phrase vectors
function textureSimilarity(vecA: number[], vecB: number[]): number {
  return cosineSimilarity(vecA, vecB)
}

// Find best transition points between two tracks
function findBestTransition(
  phrasesA: number[][],
  phrasesB: number[][],
  durationA: number,
  durationB: number
): { fromPosition: number; toPosition: number; score: number } | undefined {
  let bestScore = 0
  let bestFrom = 0
  let bestTo = 0
  
  // Check last 3 phrases of track A with first 3 phrases of track B
  const endPhrasesA = phrasesA.slice(-3)
  const startPhrasesB = phrasesB.slice(0, 3)
  
  for (let i = 0; i < endPhrasesA.length; i++) {
    for (let j = 0; j < startPhrasesB.length; j++) {
      const similarity = cosineSimilarity(endPhrasesA[i], startPhrasesB[j])
      if (similarity > bestScore) {
        bestScore = similarity
        const phraseIndexA = phrasesA.length - endPhrasesA.length + i
        const phraseIndexB = j
        bestFrom = (phraseIndexA / phrasesA.length) * durationA
        bestTo = (phraseIndexB / phrasesB.length) * durationB
      }
    }
  }
  
  if (bestScore > 0.5) {
    return {
      fromPosition: bestFrom,
      toPosition: bestTo,
      score: bestScore,
    }
  }
  
  return undefined
}

// Main recommendation function
export async function recommendTracks(
  sourceTrackId: string,
  options: {
    limit?: number
    minScore?: number
    excludeTrackIds?: string[]
  } = {}
): Promise<TrackRecommendation[]> {
  const { limit = 10, minScore = 0.4, excludeTrackIds = [] } = options
  
  // Load source track features
  const sourceFeatures = await loadFeatures(sourceTrackId)
  const sourceManifest = await getManifest(sourceTrackId)
  
  if (!sourceManifest?.summary) {
    throw new Error("Source track summary not available")
  }
  
  const sourceSummary = sourceManifest.summary
  const sourcePhrases = sourceFeatures.phraseVecs
  const sourceBars = sourceFeatures.barVecs
  
  // Get average phrase vector for texture comparison
  const avgSourcePhrase = sourcePhrases.length > 0
    ? sourcePhrases.reduce((acc, vec) => {
        return acc.map((val, i) => val + (vec[i] || 0))
      }, new Array(sourcePhrases[0]?.length || 0).fill(0))
        .map(sum => sum / sourcePhrases.length)
    : []
  
  // Load all tracks
  const manifests = await loadManifests()
  const recommendations: TrackRecommendation[] = []
  
  // Evaluate each track
  for (const manifest of Object.values(manifests)) {
    // Skip if not ready or excluded
    if (
      manifest.status !== "ready" ||
      !manifest.summary ||
      manifest.track_id === sourceTrackId ||
      excludeTrackIds.includes(manifest.track_id)
    ) {
      continue
    }
    
    try {
      const trackFeatures = await loadFeatures(manifest.track_id)
      const trackSummary = manifest.summary
      
      // Calculate individual scores
      const harmonic = harmonicScore(sourceSummary.key, trackSummary.key)
      const tempo = tempoScore(sourceSummary.tempo_bpm, trackSummary.tempo_bpm)
      const energy = energyTransitionScore(sourceSummary.energy, trackSummary.energy)
      
      // Texture similarity (average phrase vector)
      const avgTrackPhrase = trackFeatures.phraseVecs.length > 0
        ? trackFeatures.phraseVecs.reduce((acc, vec) => {
            return acc.map((val, i) => val + (vec[i] || 0))
          }, new Array(trackFeatures.phraseVecs[0]?.length || 0).fill(0))
            .map(sum => sum / trackFeatures.phraseVecs.length)
        : []
      
      const texture = avgSourcePhrase.length > 0 && avgTrackPhrase.length > 0
        ? textureSimilarity(avgSourcePhrase, avgTrackPhrase)
        : 0.5
      
      // Phrase structure similarity
      const phrase = cosineSimilarity(
        sourcePhrases[Math.floor(sourcePhrases.length / 2)] || [],
        trackFeatures.phraseVecs[Math.floor(trackFeatures.phraseVecs.length / 2)] || []
      )
      
      // Weighted overall score (research-based weights)
      // Harmonic: 30%, Tempo: 25%, Energy: 20%, Texture: 15%, Phrase: 10%
      const overall =
        0.30 * harmonic +
        0.25 * tempo +
        0.20 * energy +
        0.15 * texture +
        0.10 * phrase
      
      // Only include if above minimum score
      if (overall >= minScore) {
        // Find best transition point
        const bestTransition = findBestTransition(
          sourcePhrases,
          trackFeatures.phraseVecs,
          sourceSummary.duration,
          trackSummary.duration
        )
        
        // Find similar segments
        const similarSegments: Array<{ position: number; score: number; type: "bar" | "phrase" }> = []
        
        // Check phrase-level similarities
        for (let i = 0; i < Math.min(5, trackFeatures.phraseVecs.length); i++) {
          const phraseVec = trackFeatures.phraseVecs[i]
          const similarity = cosineSimilarity(
            sourcePhrases[Math.floor(sourcePhrases.length / 2)] || [],
            phraseVec
          )
          if (similarity > 0.6) {
            similarSegments.push({
              position: (i / trackFeatures.phraseVecs.length) * trackSummary.duration,
              score: similarity,
              type: "phrase",
            })
          }
        }
        
        // Build Track object
        const track: Track = {
          id: manifest.track_id,
          title: manifest.title || "Unknown",
          artist: manifest.artist || "Unknown",
          bpm: trackSummary.tempo_bpm,
          key: trackSummary.key,
          energy: trackSummary.energy,
          duration: trackSummary.duration,
          tags: [],
          phrases: trackSummary.phrases,
          waveform: trackFeatures.waveform || [],
        }
        
        recommendations.push({
          track,
          score: overall,
          scores: {
            harmonic,
            tempo,
            energy,
            texture,
            phrase,
            overall,
          },
          bestTransition,
          similarSegments: similarSegments.slice(0, 5), // Top 5 segments
        })
      }
    } catch (error) {
      // Skip tracks with errors
      console.warn(`Failed to process track ${manifest.track_id}:`, error)
      continue
    }
  }
  
  // Sort by overall score and return top results
  recommendations.sort((a, b) => b.score - a.score)
  return recommendations.slice(0, limit)
}

// Find similar segments within a track or across tracks
export async function findSimilarSegments(
  trackId: string,
  position: number,
  options: {
    scope?: "bar" | "phrase"
    limit?: number
    minSimilarity?: number
    withinTrack?: boolean
  } = {}
): Promise<Array<{
  trackId: string
  position: number
  score: number
  type: "bar" | "phrase"
  metadata?: {
    title: string
    artist: string
    bpm: number
    key: string
  }
}>> {
  const {
    scope = "phrase",
    limit = 10,
    minSimilarity = 0.6,
    withinTrack = false,
  } = options
  
  const features = await loadFeatures(trackId)
  const manifest = await getManifest(trackId)
  
  if (!manifest?.summary) {
    throw new Error("Track summary not available")
  }
  
  // Get reference vector
  const vectors = scope === "bar" ? features.barVecs : features.phraseVecs
  const positionIndex = Math.floor(
    (position / manifest.summary.duration) * vectors.length
  )
  const refVec = vectors[Math.min(positionIndex, vectors.length - 1)]
  
  const results: Array<{
    trackId: string
    position: number
    score: number
    type: "bar" | "phrase"
    metadata?: {
      title: string
      artist: string
      bpm: number
      key: string
    }
  }> = []
  
  if (withinTrack) {
    // Find similar segments within the same track
    for (let i = 0; i < vectors.length; i++) {
      if (i === positionIndex) continue // Skip the reference position
      
      const similarity = cosineSimilarity(refVec, vectors[i])
      if (similarity >= minSimilarity) {
        const pos = (i / vectors.length) * manifest.summary.duration
        results.push({
          trackId,
          position: pos,
          score: similarity,
          type: scope,
          metadata: {
            title: manifest.title || "Unknown",
            artist: manifest.artist || "Unknown",
            bpm: manifest.summary.tempo_bpm,
            key: manifest.summary.key,
          },
        })
      }
    }
  } else {
    // Search across all tracks
    const manifests = await loadManifests()
    
    for (const trackManifest of Object.values(manifests)) {
      if (
        trackManifest.status !== "ready" ||
        !trackManifest.summary ||
        trackManifest.track_id === trackId
      ) {
        continue
      }
      
      try {
        const trackFeatures = await loadFeatures(trackManifest.track_id)
        const trackVectors =
          scope === "bar" ? trackFeatures.barVecs : trackFeatures.phraseVecs
        
        for (let i = 0; i < trackVectors.length; i++) {
          const similarity = cosineSimilarity(refVec, trackVectors[i])
          if (similarity >= minSimilarity) {
            const pos =
              (i / trackVectors.length) * trackManifest.summary.duration
            results.push({
              trackId: trackManifest.track_id,
              position: pos,
              score: similarity,
              type: scope,
              metadata: {
                title: trackManifest.title || "Unknown",
                artist: trackManifest.artist || "Unknown",
                bpm: trackManifest.summary.tempo_bpm,
                key: trackManifest.summary.key,
              },
            })
          }
        }
      } catch (error) {
        continue
      }
    }
  }
  
  // Sort and return top results
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

