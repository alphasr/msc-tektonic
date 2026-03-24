'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Playlist } from '@/types';
import { Sparkles, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIPlaylistGeneratorProps {
  onPlaylistGenerated?: (playlist: Playlist) => void;
  onPlayPlaylist?: (playlist: Playlist) => void;
}

export default function AIPlaylistGenerator({
  onPlaylistGenerated,
  onPlayPlaylist,
}: AIPlaylistGeneratorProps) {
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedPlaylist, setGeneratedPlaylist] = useState<Playlist | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) return;

    setLoading(true);
    setError(null);
    setGeneratedPlaylist(null);

    try {
      const response = await fetch('/api/playlists/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description.trim(),
          duration: duration ? parseInt(duration, 10) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate playlist');
      }

      const data = await response.json();
      const playlist = data.playlist;
      setGeneratedPlaylist(playlist);
      onPlaylistGenerated?.(playlist);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const exampleDescriptions = [
    'Create a 2-hour progressive house set building from 120 to 128 BPM',
    'Make a chillout mix with ambient tracks in compatible keys',
    'Build a peak-time techno set with high energy',
    'Generate a 90-minute deep house journey',
  ];

  return (
    <Card className='h-full flex flex-col'>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <Sparkles className='w-4 h-4' />
          <CardTitle className='text-sm font-bold'>
            AI Playlist Generator
          </CardTitle>
        </div>
        <CardDescription className='text-xs'>
          Generate playlists from natural language descriptions
        </CardDescription>
      </CardHeader>
      <CardContent className='flex-1 flex flex-col gap-3 min-h-0'>
        <div className='space-y-2'>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Describe the playlist you want to create...'
            className='text-sm min-h-[80px]'
            disabled={loading}
          />
          <div className='flex gap-2'>
            <Input
              type='number'
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder='Duration (minutes)'
              className='flex-1 text-sm'
              disabled={loading}
            />
            <Button
              onClick={handleGenerate}
              disabled={loading || !description.trim()}
            >
              {loading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Sparkles className='w-4 h-4' />
              )}
            </Button>
          </div>
        </div>

        {exampleDescriptions.length > 0 && !generatedPlaylist && (
          <div className='space-y-1'>
            <p className='text-xs text-muted-foreground'>Examples:</p>
            <div className='space-y-1'>
              {exampleDescriptions.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setDescription(example)}
                  className='text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors w-full text-left'
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className='text-sm text-destructive bg-destructive/10 p-2 rounded'>
            {error}
          </div>
        )}

        {generatedPlaylist && (
          <div className='flex-1 overflow-y-auto space-y-2'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-sm font-semibold'>
                  {generatedPlaylist.name}
                </h3>
                {generatedPlaylist.generationMetadata && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    {generatedPlaylist.generationMetadata.reasoning}
                  </p>
                )}
              </div>
              {onPlayPlaylist && (
                <Button
                  size='sm'
                  onClick={() => onPlayPlaylist(generatedPlaylist)}
                  className='flex items-center gap-1'
                >
                  <Play className='w-3 h-3' />
                  Play
                </Button>
              )}
            </div>

            <div className='space-y-1'>
              <p className='text-xs text-muted-foreground'>
                {generatedPlaylist.segments.length} segments •{' '}
                {Math.floor(generatedPlaylist.totalDuration / 60)} minutes
              </p>
              <div className='space-y-1 max-h-[300px] overflow-y-auto'>
                {generatedPlaylist.segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className='p-2 rounded border bg-card text-sm'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex-1 min-w-0'>
                        <p className='font-medium truncate'>
                          {segment.trackTitle}
                        </p>
                        <p className='text-xs text-muted-foreground truncate'>
                          {segment.trackArtist}
                        </p>
                      </div>
                      <div className='text-xs text-muted-foreground ml-2 flex-shrink-0'>
                        {Math.floor(segment.duration)}s
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
