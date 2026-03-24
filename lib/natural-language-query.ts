// Natural Language Query System
// Parses natural language queries into structured search parameters

import { getLLMService, LLMMessage, extractJSONFromLLMResponse } from './llm-service';
import { recommendTracks, TrackRecommendation } from './recommendations';
import { loadManifests } from './storage';
import { Track } from '@/types';

export interface QueryIntent {
  type: 'search' | 'recommend' | 'filter' | 'playlist';
  parameters: {
    energy?: {
      min?: number;
      max?: number;
      preference?: 'low' | 'medium' | 'high' | 'building';
    };
    tempo?: { min?: number; max?: number; target?: number };
    key?: string;
    genre?: string[];
    mood?: string;
    style?: string;
    duration?: number;
    limit?: number;
  };
  explanation?: string;
}

export interface QueryResult {
  tracks: Track[];
  recommendations?: TrackRecommendation[];
  explanation: string;
  intent: QueryIntent;
}

/**
 * Parse natural language query into structured intent
 */
export async function parseQuery(query: string): Promise<QueryIntent> {
  const llmService = getLLMService();

  // If LLM is not available, try basic keyword matching
  if (!llmService.isAvailable()) {
    return parseQueryBasic(query);
  }

  try {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are a DJ assistant that parses natural language queries about music tracks.

Extract the following parameters from user queries:
- Energy level: low (1-4), medium (4-7), high (7-10), or building (increasing)
- Tempo/BPM: specific value or range
- Key: musical key (e.g., "5A", "12B")
- Genre: music genres mentioned
- Mood: emotional tone (e.g., "energetic", "chill", "dark", "uplifting")
- Style: mixing style (e.g., "progressive", "peak time", "breakdown")
- Duration: length of set or playlist

Return JSON only with this structure:
{
  "type": "search" | "recommend" | "filter" | "playlist",
  "parameters": {
    "energy": { "min": number, "max": number, "preference": "low" | "medium" | "high" | "building" },
    "tempo": { "min": number, "max": number, "target": number },
    "key": string,
    "genre": string[],
    "mood": string,
    "style": string,
    "duration": number,
    "limit": number
  },
  "explanation": "brief explanation of what the user wants"
}`,
      },
      {
        role: 'user',
        content: query,
      },
    ];

    const response = await llmService.chat(messages);
    const content = response.content;

    // Extract JSON from response (handle markdown code blocks)
    const jsonString = extractJSONFromLLMResponse(content);

    if (jsonString) {
      const parsed = JSON.parse(jsonString);
      return parsed as QueryIntent;
    }

    // Fallback to basic parsing
    return parseQueryBasic(query);
  } catch (error) {
    console.error('Error parsing query with LLM:', error);
    return parseQueryBasic(query);
  }
}

function parseQueryBasic(query: string): QueryIntent {
  const lowerQuery = query.toLowerCase();

  // Basic keyword matching
  const intent: QueryIntent = {
    type: 'search',
    parameters: {},
  };

  // Energy detection
  if (
    lowerQuery.includes('energetic') ||
    lowerQuery.includes('high energy') ||
    lowerQuery.includes('peak time')
  ) {
    intent.parameters.energy = { min: 7, preference: 'high' };
  } else if (
    lowerQuery.includes('chill') ||
    lowerQuery.includes('low energy') ||
    lowerQuery.includes('breakdown')
  ) {
    intent.parameters.energy = { max: 5, preference: 'low' };
  } else if (lowerQuery.includes('medium energy')) {
    intent.parameters.energy = { min: 4, max: 7, preference: 'medium' };
  }

  // Tempo detection
  const bpmMatch = lowerQuery.match(/(\d+)\s*bpm/);
  if (bpmMatch) {
    const bpm = parseInt(bpmMatch[1], 10);
    intent.parameters.tempo = { target: bpm, min: bpm - 5, max: bpm + 5 };
  }

  // Genre detection (basic)
  const genres = [
    'house',
    'techno',
    'trance',
    'dubstep',
    'drum and bass',
    'ambient',
    'progressive',
  ];
  for (const genre of genres) {
    if (lowerQuery.includes(genre)) {
      intent.parameters.genre = [genre];
      break;
    }
  }

  // Mood detection
  if (lowerQuery.includes('uplifting') || lowerQuery.includes('happy')) {
    intent.parameters.mood = 'uplifting';
  } else if (lowerQuery.includes('dark') || lowerQuery.includes('aggressive')) {
    intent.parameters.mood = 'dark';
  }

  intent.explanation = `Searching for tracks matching: ${query}`;
  return intent;
}

/**
 * Execute a parsed query intent
 */
export async function executeQuery(
  intent: QueryIntent,
  sourceTrackId?: string
): Promise<QueryResult> {
  const manifests = await loadManifests();
  const allTracks: Track[] = [];

  // Convert manifests to tracks
  for (const manifest of Object.values(manifests)) {
    if (manifest.status === 'ready' && manifest.summary) {
      allTracks.push({
        id: manifest.track_id,
        title: manifest.title || 'Unknown',
        artist: manifest.artist || 'Unknown',
        bpm: manifest.summary.tempo_bpm,
        key: manifest.summary.key,
        energy: manifest.summary.energy,
        duration: manifest.summary.duration,
        tags: [],
        phrases: manifest.summary.phrases,
        waveform: [],
      });
    }
  }

  // Filter tracks based on parameters
  let filteredTracks = allTracks;

  if (intent.parameters.energy) {
    const { min, max, preference } = intent.parameters.energy;
    filteredTracks = filteredTracks.filter((track) => {
      if (min !== undefined && track.energy < min) return false;
      if (max !== undefined && track.energy > max) return false;
      return true;
    });
  }

  if (intent.parameters.tempo) {
    const { min, max, target } = intent.parameters.tempo;
    filteredTracks = filteredTracks.filter((track) => {
      if (target !== undefined) {
        return Math.abs(track.bpm - target) <= 5;
      }
      if (min !== undefined && track.bpm < min) return false;
      if (max !== undefined && track.bpm > max) return false;
      return true;
    });
  }

  if (intent.parameters.key) {
    filteredTracks = filteredTracks.filter((track) => {
      // Basic key matching (can be enhanced)
      return track.key === intent.parameters.key;
    });
  }

  // Limit results
  const limit = intent.parameters.limit || 20;
  filteredTracks = filteredTracks.slice(0, limit);

  // If source track provided, get recommendations
  let recommendations: TrackRecommendation[] | undefined;
  if (sourceTrackId && intent.type === 'recommend') {
    try {
      recommendations = await recommendTracks(sourceTrackId, {
        limit: limit,
        minScore: 0.4,
      });
      // Filter recommendations by intent parameters
      if (intent.parameters.energy || intent.parameters.tempo) {
        recommendations = recommendations.filter((rec) => {
          if (intent.parameters.energy) {
            const { min, max } = intent.parameters.energy;
            if (min !== undefined && rec.track.energy < min) return false;
            if (max !== undefined && rec.track.energy > max) return false;
          }
          if (intent.parameters.tempo) {
            const { min, max, target } = intent.parameters.tempo;
            if (target !== undefined && Math.abs(rec.track.bpm - target) > 5)
              return false;
            if (min !== undefined && rec.track.bpm < min) return false;
            if (max !== undefined && rec.track.bpm > max) return false;
          }
          return true;
        });
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
    }
  }

  return {
    tracks: filteredTracks,
    recommendations,
    explanation:
      intent.explanation ||
      `Found ${filteredTracks.length} tracks matching your query`,
    intent,
  };
}

/**
 * Main function: parse and execute a natural language query
 */
export async function processNaturalLanguageQuery(
  query: string,
  sourceTrackId?: string
): Promise<QueryResult> {
  const intent = await parseQuery(query);
  return executeQuery(intent, sourceTrackId);
}
