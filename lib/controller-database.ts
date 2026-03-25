// Controller Database - Loads and manages controller definitions
import { ControllerDefinition } from '@/types';

let controllerDatabase: ControllerDefinition[] | null = null;

// Load controller database from API or cache
export async function loadControllerDatabase(): Promise<
  ControllerDefinition[]
> {
  if (controllerDatabase) {
    return controllerDatabase;
  }

  try {
    // Try to load from API endpoint
    const response = await fetch('/api/controllers');
    if (response.ok) {
      const data = await response.json();
      controllerDatabase = data.controllers || [];
      return controllerDatabase || [];
    }
  } catch (error) {
    console.warn(
      'Failed to load controller database from API, using fallback:',
      error
    );
  }

  // Fallback: return empty array (will be populated by API)
  return [];
}

// Synchronous version for client-side (uses cached data)
export function getCachedControllerDatabase(): ControllerDefinition[] {
  return controllerDatabase || [];
}

export function getControllerById(id: string): ControllerDefinition | null {
  const database = getCachedControllerDatabase();
  return database.find((c) => c.id === id) || null;
}

export function getAllControllers(): ControllerDefinition[] {
  return getCachedControllerDatabase();
}

export function searchControllers(query: string): ControllerDefinition[] {
  const database = getCachedControllerDatabase();
  const lowerQuery = query.toLowerCase();

  return database.filter((controller) => {
    const nameMatch = controller.name.toLowerCase().includes(lowerQuery);
    const manufacturerMatch = controller.manufacturer
      .toLowerCase()
      .includes(lowerQuery);
    const patternMatch = controller.namePatterns.some((pattern) =>
      pattern.toLowerCase().includes(lowerQuery)
    );

    return nameMatch || manufacturerMatch || patternMatch;
  });
}
