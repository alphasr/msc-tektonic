// Controller Detection Engine - Matches MIDI devices to controller database
import { DetectedController, ControllerDefinition } from '@/types';
import {
  getCachedControllerDatabase,
  getControllerById,
} from './controller-database';

export interface DetectionResult {
  controller: DetectedController | null;
  confidence: 'high' | 'medium' | 'low';
  matchScore: number;
}

/**
 * Detect controller from MIDI device name and manufacturer
 */
export function detectController(
  deviceName: string,
  manufacturer?: string,
  deviceId?: string
): DetectionResult {
  const database = getCachedControllerDatabase();
  const normalizedName = deviceName.toLowerCase().trim();
  const normalizedManufacturer = manufacturer?.toLowerCase().trim() || '';

  let bestMatch: {
    controller: ControllerDefinition;
    score: number;
    confidence: 'high' | 'medium' | 'low';
  } | null = null;

  for (const controller of database) {
    // Skip generic fallback unless no other match
    if (controller.id === 'generic-fallback') continue;

    let score = 0;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Exact name match (high confidence)
    if (normalizedName === controller.name.toLowerCase()) {
      score = 100;
      confidence = 'high';
    }
    // Name pattern matching
    else {
      for (const pattern of controller.namePatterns) {
        const normalizedPattern = pattern.toLowerCase();

        // Exact pattern match
        if (normalizedName === normalizedPattern) {
          score = 95;
          confidence = 'high';
          break;
        }
        // Pattern contains in name
        else if (
          normalizedName.includes(normalizedPattern) ||
          normalizedPattern.includes(normalizedName)
        ) {
          score = Math.max(score, 80);
          confidence = 'high';
        }
        // Partial pattern match
        else if (
          normalizedName.includes(normalizedPattern.substring(0, 5)) ||
          normalizedPattern.includes(normalizedName.substring(0, 5))
        ) {
          score = Math.max(score, 60);
          confidence = 'medium';
        }
      }
    }

    // Manufacturer match bonus
    if (
      normalizedManufacturer &&
      controller.manufacturer.toLowerCase() === normalizedManufacturer
    ) {
      score += 20;
      if (confidence === 'low') confidence = 'medium';
    }
    // Partial manufacturer match
    else if (
      normalizedManufacturer &&
      controller.manufacturer.toLowerCase().includes(normalizedManufacturer)
    ) {
      score += 10;
    }

    // Update best match if this is better
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { controller, score, confidence };
    }
  }

  // If no match found, use generic fallback
  if (!bestMatch) {
    const generic = getControllerById('generic-fallback');
    if (generic) {
      return {
        controller: {
          id: generic.id,
          name: deviceName,
          manufacturer: manufacturer || 'Unknown',
          model: 'Generic',
          confidence: 'low',
          mapping: generic.mapping,
          deviceId,
        },
        confidence: 'low',
        matchScore: 0,
      };
    }
  }

  if (bestMatch) {
    return {
      controller: {
        id: bestMatch.controller.id,
        name: deviceName,
        manufacturer: manufacturer || bestMatch.controller.manufacturer,
        model: bestMatch.controller.name,
        confidence: bestMatch.confidence,
        mapping: bestMatch.controller.mapping,
        deviceId,
      },
      confidence: bestMatch.confidence,
      matchScore: bestMatch.score,
    };
  }

  return {
    controller: null,
    confidence: 'low',
    matchScore: 0,
  };
}

/**
 * Detect all connected controllers
 */
export function detectAllControllers(
  inputs: MIDIInput[]
): DetectedController[] {
  const detected: DetectedController[] = [];

  for (const input of inputs) {
    const result = detectController(
      input.name,
      (input as any).manufacturer,
      input.id
    );

    if (result.controller) {
      detected.push(result.controller);
    }
  }

  return detected;
}
