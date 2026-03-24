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
import { Track } from '@/types';
import { Search, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NaturalLanguageQueryProps {
  onLoadTrack?: (track: Track, deck: 'A' | 'B') => void;
  currentTrackId?: string;
}

export default function NaturalLanguageQuery({
  onLoadTrack,
  currentTrackId,
}: NaturalLanguageQueryProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    tracks: Track[];
    explanation: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          sourceTrackId: currentTrackId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process query');
      }

      const data = await response.json();
      setResults({
        tracks: data.tracks || [],
        explanation: data.explanation || 'Query processed successfully',
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const exampleQueries = [
    'Find energetic tracks for peak time',
    'Suggest a breakdown track',
    'Show me high energy techno tracks',
    'Find tracks around 128 BPM',
  ];

  return (
    <Card className='h-full flex flex-col'>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <Sparkles className='w-4 h-4' />
          <CardTitle className='text-sm font-bold'>
            Natural Language Search
          </CardTitle>
        </div>
        <CardDescription className='text-xs'>
          Ask for tracks in plain English
        </CardDescription>
      </CardHeader>
      <CardContent className='flex-1 flex flex-col gap-3 min-h-0'>
        <form onSubmit={handleSubmit} className='flex gap-2'>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g., Find energetic tracks for peak time'
            className='flex-1 text-sm'
            disabled={loading}
          />
          <Button type='submit' size='sm' disabled={loading || !query.trim()}>
            {loading ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Search className='w-4 h-4' />
            )}
          </Button>
        </form>

        {exampleQueries.length > 0 && !results && (
          <div className='space-y-1'>
            <p className='text-xs text-muted-foreground'>Try:</p>
            <div className='flex flex-wrap gap-1'>
              {exampleQueries.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(example)}
                  className='text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors'
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

        {results && (
          <div className='flex-1 overflow-y-auto space-y-2'>
            <p className='text-xs text-muted-foreground'>
              {results.explanation}
            </p>
            {results.tracks.length === 0 ? (
              <p className='text-sm text-muted-foreground text-center py-4'>
                No tracks found
              </p>
            ) : (
              <div className='space-y-1'>
                {results.tracks.map((track) => (
                  <div
                    key={track.id}
                    className='p-2 rounded border bg-card hover:bg-accent/50 transition-colors cursor-pointer'
                    onClick={() => onLoadTrack?.(track, 'A')}
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium truncate'>
                          {track.title}
                        </p>
                        <p className='text-xs text-muted-foreground truncate'>
                          {track.artist}
                        </p>
                      </div>
                      <div className='text-xs text-muted-foreground ml-2 flex-shrink-0'>
                        <div>{track.bpm} BPM</div>
                        <div>{track.key}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
