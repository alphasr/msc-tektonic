// AI-Powered Playlist Generator
// Generates playlists from natural language descriptions

import { getLLMService, LLMMessage, extractJSONFromLLMResponse } from './llm-service';
import { recommendTracks, TrackRecommendation } from './recommendations';
import { generateCandidates } from './candidates';
import { loadManifests, getManifest } from './storage';
import { Playlist, PlaylistSegment } from '@/types';

export interface PlaylistGenerationRequest {
  description: string;
  duration?: number; // Target duration in minutes
  startTrackId?: string; // Optional starting track
  preferences?: {
    genre?: string[];
    energyCurve?: 'building' | 'peak' | 'chill' | 'varied';
    bpmRange?: { min: number; max: number };
  };
}

export interface GeneratedPlaylist extends Playlist {
  generationMetadata?: {
    description: string;
    reasoning: string;
    confidence: number;
  };
}

/**
 * Generate a playlist from natural language description
 */
export async function generatePlaylistFromDescription(
  request: PlaylistGenerationRequest
): Promise<GeneratedPlaylist> {
  const llmService = getLLMService();

  // If LLM is not available, use basic generation
  if (!llmService.isAvailable()) {
    return generatePlaylistBasic(request);
  }

  try {
    // Parse the description to extract requirements
    const requirements = await parsePlaylistDescription(
      request.description,
      request.duration,
      request.preferences
    );

    // Get available tracks
    const manifests = await loadManifests();
    const availableTracks = Object.values(manifests)
      .filter((m) => m.status === 'ready' && m.summary)
      .map((m) => ({
        id: m.track_id,
        title: m.title || 'Unknown',
        artist: m.artist || 'Unknown',
        bpm: m.summary!.tempo_bpm,
        key: m.summary!.key,
        energy: m.summary!.energy,
        duration: m.summary!.duration,
        phrases: m.summary!.phrases,
      }));

    if (availableTracks.length === 0) {
      throw new Error('No tracks available in library');
    }

    // Use LLM to select and sequence tracks
    const trackSequence = await selectTrackSequence(
      availableTracks,
      requirements,
      request.startTrackId
    );

    // Build playlist segments with transitions
    const segments = await buildPlaylistSegments(trackSequence, requirements);

    // Generate playlist name and reasoning
    const metadata = await generatePlaylistMetadata(
      request.description,
      segments
    );

    const playlist: GeneratedPlaylist = {
      id: `playlist_${Date.now()}`,
      name: metadata.name,
      segments,
      createdAt: new Date().toISOString(),
      totalDuration: segments.reduce((sum, s) => sum + s.duration, 0),
      generationMetadata: {
        description: request.description,
        reasoning: metadata.reasoning,
        confidence: metadata.confidence,
      },
    };

    return playlist;
  } catch (error) {
    console.error('Error generating playlist with LLM:', error);
    // Fallback to basic generation
    return generatePlaylistBasic(request);
  }
}

interface PlaylistRequirements {
  duration: number; // in seconds
  energyCurve: 'building' | 'peak' | 'chill' | 'varied';
  bpmRange?: { min: number; max: number };
  genre?: string[];
  mood?: string;
  style?: string;
  trackCount?: number;
}

async function parsePlaylistDescription(
  description: string,
  targetDuration?: number,
  preferences?: PlaylistGenerationRequest['preferences']
): Promise<PlaylistRequirements> {
  const llmService = getLLMService();

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `Parse a playlist description and extract requirements.

Return JSON with:
{
  "duration": number (seconds),
  "energyCurve": "building" | "peak" | "chill" | "varied",
  "bpmRange": { "min": number, "max": number } (optional),
  "genre": string[] (optional),
  "mood": string (optional),
  "style": string (optional),
  "trackCount": number (optional, estimate based on duration)
}`,
    },
    {
      role: 'user',
      content: `Description: "${description}"
${targetDuration ? `Target duration: ${targetDuration} minutes` : ''}
${preferences ? `Preferences: ${JSON.stringify(preferences)}` : ''}

Extract requirements.`,
    },
  ];

  try {
    const response = await llmService.chat(messages);
    const content = response.content;

    const jsonString = extractJSONFromLLMResponse(content);

    if (jsonString) {
      const parsed = JSON.parse(jsonString);
      return {
        duration:
          parsed.duration || (targetDuration ? targetDuration * 60 : 3600),
        energyCurve: parsed.energyCurve || 'varied',
        bpmRange: parsed.bpmRange,
        genre: parsed.genre,
        mood: parsed.mood,
        style: parsed.style,
        trackCount: parsed.trackCount,
      };
    }
  } catch (error) {
    console.error('Error parsing playlist description:', error);
  }

  // Fallback
  return {
    duration: targetDuration ? targetDuration * 60 : 3600,
    energyCurve: preferences?.energyCurve || 'varied',
    bpmRange: preferences?.bpmRange,
    genre: preferences?.genre,
  };
}

interface TrackCandidate {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  energy: number;
  duration: number;
  phrases: number;
}

async function selectTrackSequence(
  availableTracks: TrackCandidate[],
  requirements: PlaylistRequirements,
  startTrackId?: string
): Promise<TrackCandidate[]> {
  const llmService = getLLMService();

  // Filter tracks by requirements
  let filteredTracks = availableTracks;

  if (requirements.bpmRange) {
    filteredTracks = filteredTracks.filter(
      (t) =>
        t.bpm >= requirements.bpmRange!.min &&
        t.bpm <= requirements.bpmRange!.max
    );
  }

  // Limit to reasonable number for LLM processing
  const maxTracks = 50;
  if (filteredTracks.length > maxTracks) {
    filteredTracks = filteredTracks.slice(0, maxTracks);
  }

  // Build track list for LLM
  const trackList = filteredTracks
    .map(
      (t, i) =>
        `${i + 1}. "${t.title}" by ${t.artist} - ${t.bpm} BPM, Key: ${
          t.key
        }, Energy: ${t.energy}/10, Duration: ${Math.floor(t.duration)}s`
    )
    .join('\n');

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `You are a visionary DJ creating a narrative playlist, inspired by Mark Ronson's philosophy of sampling and bringing disparate tracks together into a shared event. Select and order tracks to:
1. Match the requirements (BPM range, energy curve, genre, mood).
2. Tell a story: don't just hijack nostalgia wholesale, but bring something fresh by blending the old with the new.
3. Flow well together (harmonic mixing, energy progression) while creating unexpected, visceral connections between tracks.
4. Fit the target duration.

Return a JSON array of track numbers in order: [1, 5, 3, ...]`,
    },
    {
      role: 'user',
      content: `Requirements:
- Duration: ${Math.floor(requirements.duration / 60)} minutes
- Energy curve: ${requirements.energyCurve}
${
  requirements.bpmRange
    ? `- BPM: ${requirements.bpmRange.min}-${requirements.bpmRange.max}`
    : ''
}
${requirements.genre ? `- Genre: ${requirements.genre.join(', ')}` : ''}
${requirements.mood ? `- Mood: ${requirements.mood}` : ''}

Available tracks:
${trackList}

${startTrackId ? `Start with track: ${startTrackId}` : ''}

Select and order tracks for the playlist.`,
    },
  ];

  try {
    const response = await llmService.chat(messages);
    const content = response.content;

    const jsonString = extractJSONFromLLMResponse(content);

    if (jsonString) {
      const indices = JSON.parse(jsonString) as number[];
      const selected = indices
        .map((idx) => filteredTracks[idx - 1])
        .filter((t) => t !== undefined);

      if (selected.length > 0) {
        return selected;
      }
    }
  } catch (error) {
    console.error('Error selecting tracks with LLM:', error);
  }

  // Fallback: use recommendation algorithm
  return selectTracksWithAlgorithm(filteredTracks, requirements, startTrackId);
}

async function selectTracksWithAlgorithm(
  tracks: TrackCandidate[],
  requirements: PlaylistRequirements,
  startTrackId?: string
): Promise<TrackCandidate[]> {
  const selected: TrackCandidate[] = [];
  let currentTrackId = startTrackId;
  let totalDuration = 0;

  // Start with first track or specified track
  if (startTrackId) {
    const startTrack = tracks.find((t) => t.id === startTrackId);
    if (startTrack) {
      selected.push(startTrack);
      totalDuration += startTrack.duration;
      currentTrackId = startTrack.id;
    }
  }

  if (selected.length === 0 && tracks.length > 0) {
    // Pick first track that matches requirements
    const firstTrack = tracks[0];
    selected.push(firstTrack);
    totalDuration += firstTrack.duration;
    currentTrackId = firstTrack.id;
  }

  // Select subsequent tracks using recommendations
  while (
    totalDuration < requirements.duration &&
    selected.length < tracks.length
  ) {
    try {
      const recommendations = await recommendTracks(currentTrackId!, {
        limit: 10,
        minScore: 0.5,
        excludeTrackIds: selected.map((t) => t.id),
      });

      // Find best match from recommendations
      let nextTrack: TrackCandidate | undefined;
      for (const rec of recommendations) {
        const candidate = tracks.find((t) => t.id === rec.track.id);
        if (candidate && !selected.find((s) => s.id === candidate.id)) {
          nextTrack = candidate;
          break;
        }
      }

      if (!nextTrack) break;

      selected.push(nextTrack);
      totalDuration += nextTrack.duration;
      currentTrackId = nextTrack.id;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      break;
    }
  }

  return selected;
}

async function buildPlaylistSegments(
  tracks: TrackCandidate[],
  requirements: PlaylistRequirements
): Promise<PlaylistSegment[]> {
  const segments: PlaylistSegment[] = [];

  let nextStartTime = 0;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const nextTrack = tracks[i + 1];

    let startTime = nextStartTime;
    let endTime = track.duration;
    let transitionPoint = Math.max(5, (endTime - startTime) * 0.1);

    // Calculate compatibility scores with next track
    let scores = {
      key: 0.5,
      tempo: 0.5,
      energy: 0.5,
      frequency: 0.5,
    };

    if (nextTrack) {
      try {
        const candidates = await generateCandidates(track.id, nextTrack.id, 1);
        if (candidates.length > 0) {
          scores = {
            key: candidates[0].scores.key,
            tempo: candidates[0].scores.tempo,
            energy: candidates[0].scores.energy,
            frequency: candidates[0].scores.frequency,
          };
          
          // Use AI recommendations to seamlessly blend segments
          endTime = candidates[0].from_position;
          nextStartTime = candidates[0].to_position;
          transitionPoint = 4; // Tighter fixed transition duration for seamless phrasing
        }
      } catch (error) {
        console.error('Error calculating transition scores:', error);
      }
    }

    const duration = endTime - startTime;

    const segment: PlaylistSegment = {
      id: `segment_${Date.now()}_${i}`,
      trackId: track.id,
      trackTitle: track.title,
      trackArtist: track.artist,
      startTime,
      endTime,
      duration,
      transitionPoint: Math.max(5, duration * 0.1),
      scores,
      order: i,
    };

    segments.push(segment);
  }

  return segments;
}

async function generatePlaylistMetadata(
  description: string,
  segments: PlaylistSegment[]
): Promise<{ name: string; reasoning: string; confidence: number }> {
  const llmService = getLLMService();

  if (!llmService.isAvailable()) {
    return {
      name: `Generated Playlist (${segments.length} tracks)`,
      reasoning: 'Generated using basic algorithm',
      confidence: 0.5,
    };
  }

  try {
    const trackList = segments
      .map((s) => `- "${s.trackTitle}" by ${s.trackArtist}`)
      .join('\n');

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `Generate a playlist name and storytelling reasoning for why these tracks were selected.
Embrace Mark Ronson's philosophy: explain how these tracks build a narrative, co-opt familiar sounds to bring something fresh, and blend seamlessly into a shared event. Avoid purely technical descriptions and inject visceral passion.

Return JSON:
{
  "name": "creative playlist name",
  "reasoning": "story-driven explanation of track selection, highlighting unexpected connections and the overall narrative journey",
  "confidence": 0.0-1.0
}`,
      },
      {
        role: 'user',
        content: `Description: "${description}"

Tracks:
${trackList}

Generate name and reasoning.`,
      },
    ];

    const response = await llmService.chat(messages);
    const content = response.content;

    const jsonString = extractJSONFromLLMResponse(content);

    if (jsonString) {
      const parsed = JSON.parse(jsonString);
      return {
        name: parsed.name || `Generated Playlist (${segments.length} tracks)`,
        reasoning: parsed.reasoning || 'Generated playlist',
        confidence: parsed.confidence || 0.7,
      };
    }
  } catch (error) {
    console.error('Error generating playlist metadata:', error);
  }

  return {
    name: `Generated Playlist (${segments.length} tracks)`,
    reasoning: 'Generated playlist based on description',
    confidence: 0.6,
  };
}

async function generatePlaylistBasic(
  request: PlaylistGenerationRequest
): Promise<GeneratedPlaylist> {
  // Basic fallback generation
  const manifests = await loadManifests();
  const tracks = Object.values(manifests)
    .filter((m) => m.status === 'ready' && m.summary)
    .slice(0, 10); // Limit to 10 tracks for basic generation

  const segments: PlaylistSegment[] = tracks.map((manifest, i) => {
    const summary = manifest.summary!;
    return {
      id: `segment_${Date.now()}_${i}`,
      trackId: manifest.track_id,
      trackTitle: manifest.title || 'Unknown',
      trackArtist: manifest.artist || 'Unknown',
      startTime: 0,
      endTime: summary.duration,
      duration: summary.duration,
      transitionPoint: Math.max(5, summary.duration * 0.1),
      scores: {
        key: 0.5,
        tempo: 0.5,
        energy: 0.5,
        frequency: 0.5,
      },
      order: i,
    };
  });

  return {
    id: `playlist_${Date.now()}`,
    name: 'Basic Generated Playlist',
    segments,
    createdAt: new Date().toISOString(),
    totalDuration: segments.reduce((sum, s) => sum + s.duration, 0),
    generationMetadata: {
      description: request.description,
      reasoning: 'Generated using basic algorithm (LLM unavailable)',
      confidence: 0.4,
    },
  };
}
