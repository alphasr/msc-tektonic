// Playlist Persistence - Save/load playlists to localStorage
import { Playlist } from '@/types';

const STORAGE_KEY_PREFIX = 'playlist_';
const STORAGE_KEY_LIST = 'playlist_list';

export interface StoredPlaylist {
  id: string;
  name: string;
  savedAt: string;
}

// Save playlist to localStorage
export function savePlaylist(playlist: Playlist): boolean {
  try {
    if (typeof window === 'undefined') return false;

    const key = `${STORAGE_KEY_PREFIX}${playlist.id}`;
    localStorage.setItem(key, JSON.stringify(playlist));

    // Update playlist list
    const list = getPlaylistList();
    const existingIndex = list.findIndex((p) => p.id === playlist.id);
    const playlistInfo: StoredPlaylist = {
      id: playlist.id,
      name: playlist.name,
      savedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = playlistInfo;
    } else {
      list.push(playlistInfo);
    }

    localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(list));
    return true;
  } catch (error) {
    console.error('Failed to save playlist:', error);
    return false;
  }
}

// Load playlist from localStorage
export function loadPlaylist(playlistId: string): Playlist | null {
  try {
    if (typeof window === 'undefined') return null;

    const key = `${STORAGE_KEY_PREFIX}${playlistId}`;
    const data = localStorage.getItem(key);
    if (!data) return null;

    return JSON.parse(data) as Playlist;
  } catch (error) {
    console.error('Failed to load playlist:', error);
    return null;
  }
}

// Delete playlist from localStorage
export function deletePlaylist(playlistId: string): boolean {
  try {
    if (typeof window === 'undefined') return false;

    const key = `${STORAGE_KEY_PREFIX}${playlistId}`;
    localStorage.removeItem(key);

    // Update playlist list
    const list = getPlaylistList();
    const filtered = list.filter((p) => p.id !== playlistId);
    localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(filtered));

    return true;
  } catch (error) {
    console.error('Failed to delete playlist:', error);
    return false;
  }
}

// Get list of all saved playlists
export function getPlaylistList(): StoredPlaylist[] {
  try {
    if (typeof window === 'undefined') return [];

    const data = localStorage.getItem(STORAGE_KEY_LIST);
    if (!data) return [];

    return JSON.parse(data) as StoredPlaylist[];
  } catch (error) {
    console.error('Failed to get playlist list:', error);
    return [];
  }
}

// Export playlist as downloadable JSON file
export function exportPlaylistAsFile(playlist: Playlist): void {
  try {
    const json = JSON.stringify(playlist, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlist.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export playlist:', error);
  }
}

// Import playlist from file
export function importPlaylistFromFile(file: File): Promise<Playlist | null> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          const playlist = JSON.parse(json) as Playlist;
          resolve(playlist);
        } catch (error) {
          console.error('Failed to parse playlist file:', error);
          resolve(null);
        }
      };
      reader.onerror = () => {
        console.error('Failed to read playlist file');
        resolve(null);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Failed to import playlist:', error);
      resolve(null);
    }
  });
}
