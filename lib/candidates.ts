import { loadFeatures, keyScore, energyScore, cosineSimilarity } from "./analysis"
import { getManifest } from "./storage"

export interface TransitionCandidate {
  from_position: number // phrase end in track A
  to_position: number // phrase start in track B
  score: number
  scores: {
    key: number
    energy: number
    timing: number
    contour: number
    tempo: number
  }
}

// Enhanced BPM compatibility scoring
function tempoScore(bpmA: number, bpmB: number): number {
  const diff = Math.abs(bpmA - bpmB)
  if (diff === 0) return 1.0
  if (diff <= 2) return 0.95
  if (diff <= 5) return 0.85
  if (diff <= 10) return 0.70
  if (diff <= 15) return 0.50
  if (diff <= 20) return 0.30
  return 0.10
}

// Enhanced energy transition scoring
function energyTransitionScore(energyA: number, energyB: number): number {
  const diff = energyB - energyA
  if (Math.abs(diff) <= 0.5) return 1.0
  if (diff > 0 && diff <= 2) return 0.90
  if (diff > 2 && diff <= 4) return 0.75
  if (diff < 0 && diff >= -2) return 0.85
  if (diff < -2 && diff >= -4) return 0.70
  if (Math.abs(diff) <= 6) return 0.50
  return 0.20
}

// Enhanced harmonic compatibility
function harmonicScore(keyA: string, keyB: string): number {
  const baseScore = keyScore(keyA, keyB)
  if (baseScore >= 0.95) return 1.0
  if (baseScore >= 0.85) return 0.95
  if (baseScore >= 0.70) return 0.85
  if (baseScore >= 0.50) return 0.65
  return baseScore * 0.5
}

// Generate transition candidates between two tracks with optimized algorithm
export async function generateCandidates(
  trackA_id: string,
  trackB_id: string,
  k: number = 5
): Promise<TransitionCandidate[]> {
  // Load features for both tracks
  const featuresA = await loadFeatures(trackA_id)
  const featuresB = await loadFeatures(trackB_id)
  
  const manifestA = await getManifest(trackA_id)
  const manifestB = await getManifest(trackB_id)
  
  if (!manifestA?.summary || !manifestB?.summary) {
    throw new Error("Track summaries not available")
  }
  
  const summaryA = manifestA.summary
  const summaryB = manifestB.summary
  
  const candidates: TransitionCandidate[] = []
  
  // For each phrase end in track A, find compatible phrase starts in track B
  const phrasesA = featuresA.phraseVecs
  const phrasesB = featuresB.phraseVecs
  
  // Optimize: Only check last 30% of track A phrases with first 30% of track B phrases
  // This focuses on natural transition points (outro -> intro)
  const startA = Math.max(0, Math.floor(phrasesA.length * 0.7))
  const endB = Math.min(phrasesB.length, Math.floor(phrasesB.length * 0.3))
  
  for (let i = startA; i < phrasesA.length; i++) {
    for (let j = 0; j < endB; j++) {
      // Calculate enhanced scores
      const kScore = harmonicScore(summaryA.key, summaryB.key)
      const eScore = energyTransitionScore(summaryA.energy, summaryB.energy)
      const tScore = tempoScore(summaryA.tempo_bpm, summaryB.tempo_bpm)
      
      // Timing score (prefer phrase boundaries at natural points)
      // Give higher score to transitions near track ends/beginnings
      const positionA = i / phrasesA.length
      const positionB = j / phrasesB.length
      const timingScore = 
        0.5 + // Base score
        0.3 * (1 - positionA) + // Prefer later in track A
        0.2 * positionB // Prefer earlier in track B
      
      // Contour similarity (waveform continuity)
      const contourScore = cosineSimilarity(phrasesA[i], phrasesB[j])
      
      // Combined score with optimized weights (research-based)
      // Harmonic: 30%, Tempo: 25%, Energy: 20%, Timing: 15%, Contour: 10%
      const totalScore =
        0.30 * kScore +
        0.25 * tScore +
        0.20 * eScore +
        0.15 * timingScore +
        0.10 * contourScore
      
      // Only include if above threshold
      if (totalScore > 0.4) {
        candidates.push({
          from_position: (i / phrasesA.length) * summaryA.duration,
          to_position: (j / phrasesB.length) * summaryB.duration,
          score: totalScore,
          scores: {
            key: kScore,
            energy: eScore,
            timing: timingScore,
            contour: contourScore,
            tempo: tScore,
          },
        })
      }
    }
  }
  
  // Sort by score and return top K
  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, k)
}

// Search for similar segments across all tracks
export async function searchSimilar(
  track_id: string,
  position: number,
  scope: "bar" | "phrase",
  k: number = 10
): Promise<Array<{ track_id: string; position: number; score: number }>> {
  const { loadManifests } = await import("./storage")
  const features = await loadFeatures(track_id)
  
  // Get reference vector
  let refVec: number[]
  if (scope === "bar") {
    const barIndex = Math.floor((position / features.summary.duration) * features.barVecs.length)
    refVec = features.barVecs[Math.min(barIndex, features.barVecs.length - 1)]
  } else {
    const phraseIndex = Math.floor(
      (position / features.summary.duration) * features.phraseVecs.length
    )
    refVec = features.phraseVecs[Math.min(phraseIndex, features.phraseVecs.length - 1)]
  }
  
  // Search across all tracks in library
  const results: Array<{ track_id: string; position: number; score: number }> = []
  const manifests = await loadManifests()
  
  // Search in all ready tracks
  for (const manifest of Object.values(manifests)) {
    if (manifest.status !== "ready" || !manifest.summary) continue
    
    try {
      const trackFeatures = await loadFeatures(manifest.track_id)
      const vectors = scope === "bar" ? trackFeatures.barVecs : trackFeatures.phraseVecs
      
      for (let i = 0; i < vectors.length; i++) {
        const similarity = cosineSimilarity(refVec, vectors[i])
        const pos = (i / vectors.length) * trackFeatures.summary.duration
        
        results.push({
          track_id: manifest.track_id,
          position: pos,
          score: similarity,
        })
      }
    } catch (error) {
      // Skip tracks without features
      continue
    }
  }
  
  // Sort and return top K
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, k)
}

