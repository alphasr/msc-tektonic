'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Stats, Track } from '@/types';

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchTracks();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTracks = async () => {
    try {
      const response = await fetch('/api/tracks');
      if (response.ok) {
        const data = await response.json();
        setTracks(data);
      }
    } catch (error) {
      console.error('Failed to fetch tracks:', error);
    } finally {
      setLoadingTracks(false);
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const formatTrackDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-background'>
        <Navigation />
        <div className='container mx-auto p-8'>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className='min-h-screen bg-background'>
        <Navigation />
        <div className='container mx-auto p-8'>
          <div>Failed to load statistics</div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background'>
      <Navigation />
      <div className='container mx-auto p-8'>
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
            <CardDescription>
              Overview of your library and system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div>
                <div className='text-2xl font-bold'>{stats.totalTracks}</div>
                <div className='text-sm text-muted-foreground'>
                  Total Tracks
                </div>
              </div>
              <div>
                <div className='text-2xl font-bold'>
                  {formatBytes(stats.storageUsed)}
                </div>
                <div className='text-sm text-muted-foreground'>
                  Storage Used
                </div>
              </div>
              <div>
                <div className='text-2xl font-bold'>
                  {Math.round(stats.averageDuration)}s
                </div>
                <div className='text-sm text-muted-foreground'>
                  Avg Duration
                </div>
              </div>
              <div>
                <div className='text-2xl font-bold'>
                  {formatDuration(stats.totalDuration)}
                </div>
                <div className='text-sm text-muted-foreground'>
                  Total Duration
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Detailed Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <div className='text-lg font-semibold'>
                  {stats.averageTempo.toFixed(1)} BPM
                </div>
                <div className='text-sm text-muted-foreground'>
                  Average Tempo
                </div>
              </div>
              <div>
                <div className='text-lg font-semibold'>
                  {stats.averagePhrases}
                </div>
                <div className='text-sm text-muted-foreground'>
                  Average Phrases
                </div>
              </div>
              <div>
                <div className='text-lg font-semibold'>
                  {stats.shortestTrack?.title || 'N/A'}
                </div>
                <div className='text-sm text-muted-foreground'>
                  Shortest Track (
                  {stats.shortestTrack
                    ? Math.round(stats.shortestTrack.duration)
                    : 0}
                  s)
                </div>
              </div>
              <div>
                <div className='text-lg font-semibold'>
                  {stats.longestTrack?.title || 'N/A'}
                </div>
                <div className='text-sm text-muted-foreground'>
                  Longest Track (
                  {stats.longestTrack
                    ? Math.round(stats.longestTrack.duration)
                    : 0}
                  s)
                </div>
              </div>
              <div>
                <div className='text-lg font-semibold'>
                  {stats.tracksWithTitles}
                </div>
                <div className='text-sm text-muted-foreground'>
                  Tracks with Titles
                </div>
              </div>
              <div>
                <div className='text-lg font-semibold'>
                  {formatBytes(stats.averageFileSize)}
                </div>
                <div className='text-sm text-muted-foreground'>
                  Average File Size
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Directory Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {Object.entries(stats.directoryBreakdown).map(([path, count]) => (
                <div key={path} className='flex justify-between'>
                  <span className='font-mono text-sm'>{path}</span>
                  <span className='font-semibold'>{count} tracks</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Songs in Library</CardTitle>
            <CardDescription>
              Complete list of all tracks with their metrics ({tracks.length}{' '}
              tracks)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTracks ? (
              <div className='text-center py-8 text-muted-foreground'>
                Loading tracks...
              </div>
            ) : tracks.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                No tracks available
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full border-collapse'>
                  <thead>
                    <tr className='border-b'>
                      <th className='text-left p-3 font-semibold text-sm'>
                        Title
                      </th>
                      <th className='text-left p-3 font-semibold text-sm'>
                        Artist
                      </th>
                      <th className='text-center p-3 font-semibold text-sm'>
                        BPM
                      </th>
                      <th className='text-center p-3 font-semibold text-sm'>
                        Key
                      </th>
                      <th className='text-center p-3 font-semibold text-sm'>
                        Energy
                      </th>
                      <th className='text-center p-3 font-semibold text-sm'>
                        Duration
                      </th>
                      <th className='text-center p-3 font-semibold text-sm'>
                        Phrases
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((track) => (
                      <tr
                        key={track.id}
                        className='border-b hover:bg-muted/50 transition-colors'
                      >
                        <td className='p-3'>
                          <div className='font-medium'>{track.title}</div>
                        </td>
                        <td className='p-3 text-muted-foreground'>
                          {track.artist}
                        </td>
                        <td className='p-3 text-center font-mono text-sm'>
                          {track.bpm.toFixed(1)}
                        </td>
                        <td className='p-3 text-center font-mono text-sm'>
                          {track.key}
                        </td>
                        <td className='p-3 text-center'>
                          <div className='flex items-center justify-center gap-2'>
                            <span className='text-sm font-mono'>
                              {track.energy.toFixed(2)}
                            </span>
                            <div className='w-16 h-2 bg-muted rounded-full overflow-hidden'>
                              <div
                                className='h-full bg-primary transition-all'
                                style={{ width: `${track.energy * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className='p-3 text-center font-mono text-sm'>
                          {formatTrackDuration(track.duration)}
                        </td>
                        <td className='p-3 text-center text-sm'>
                          {track.phrases}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
