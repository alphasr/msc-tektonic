'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Filter, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SegmentSuggestion } from '@/types';
import SegmentCard from './SegmentCard';
import { cn } from '@/lib/utils';

interface SegmentSuggestionsProps {
  currentTrackId: string | null;
  currentPosition: number;
  isPlaying: boolean;
  onAddSegment: (segment: SegmentSuggestion) => void;
  onPreviewSegment: (segment: SegmentSuggestion) => void;
  playlistSegmentIds?: string[];
}

export default function SegmentSuggestions({
  currentTrackId,
  currentPosition,
  isPlaying,
  onAddSegment,
  onPreviewSegment,
  playlistSegmentIds = [],
}: SegmentSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SegmentSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'tempo' | 'key' | 'energy'>(
    'score'
  );
  const [minScore, setMinScore] = useState(0.5);
  const lastPositionRef = useRef<number>(-1);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = async () => {
    if (!currentTrackId || currentPosition < 0) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        trackId: currentTrackId,
        position: currentPosition.toString(),
        scope: 'phrase',
        limit: '15',
        minScore: minScore.toString(),
        excludeTrackId: currentTrackId, // Exclude the currently playing track
      });

      const response = await fetch(`/api/segments/suggest?${params}`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();
      let fetchedSuggestions = data.suggestions || [];

      // Sort suggestions
      fetchedSuggestions = [...fetchedSuggestions].sort(
        (a: SegmentSuggestion, b: SegmentSuggestion) => {
          switch (sortBy) {
            case 'tempo':
              return b.scores.tempo - a.scores.tempo;
            case 'key':
              return b.scores.key - a.scores.key;
            case 'energy':
              return b.scores.energy - a.scores.energy;
            default:
              return b.score - a.score;
          }
        }
      );

      setSuggestions(fetchedSuggestions);
    } catch (error) {
      console.error('Error fetching segment suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-update when position changes significantly
  useEffect(() => {
    if (!isPlaying || !currentTrackId) {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      return;
    }

    // Check if position changed significantly (more than 5 seconds)
    const positionDiff = Math.abs(currentPosition - lastPositionRef.current);
    if (positionDiff > 5) {
      lastPositionRef.current = currentPosition;
      fetchSuggestions();
    }

    // Set up interval to check every 3 seconds
    if (!updateIntervalRef.current) {
      updateIntervalRef.current = setInterval(() => {
        if (isPlaying && currentTrackId) {
          const currentDiff = Math.abs(
            currentPosition - lastPositionRef.current
          );
          if (currentDiff > 5) {
            lastPositionRef.current = currentPosition;
            fetchSuggestions();
          }
        }
      }, 3000);
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [currentPosition, isPlaying, currentTrackId, minScore, sortBy]);

  // Initial fetch
  useEffect(() => {
    if (currentTrackId) {
      fetchSuggestions();
    }
  }, [currentTrackId, minScore, sortBy]);

  const isSegmentInPlaylist = (segment: SegmentSuggestion) => {
    // Check if this segment is already in playlist by comparing trackId and position
    // This is a simplified check
    return playlistSegmentIds.includes(
      `${segment.trackId}_${segment.position}`
    );
  };

  return (
    <Card className='h-full flex flex-col'>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between mb-2'>
          <CardTitle className='text-sm font-bold'>
            Segment Suggestions
          </CardTitle>
          <Button
            variant='ghost'
            size='sm'
            onClick={fetchSuggestions}
            disabled={loading || !currentTrackId}
            className='h-6 w-6 p-0'
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </Button>
        </div>
        <CardDescription className='text-xs'>
          Compatible segments for live mixing
        </CardDescription>
        <div className='flex gap-2 mt-2'>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className='h-7 text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='score'>Best Match</SelectItem>
              <SelectItem value='tempo'>Tempo</SelectItem>
              <SelectItem value='key'>Key</SelectItem>
              <SelectItem value='energy'>Energy</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={minScore.toString()}
            onValueChange={(v) => setMinScore(parseFloat(v))}
          >
            <SelectTrigger className='h-7 text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='0.3'>Min: 30%</SelectItem>
              <SelectItem value='0.5'>Min: 50%</SelectItem>
              <SelectItem value='0.7'>Min: 70%</SelectItem>
              <SelectItem value='0.8'>Min: 80%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className='flex-1 overflow-y-auto space-y-2'>
        {loading && suggestions.length === 0 ? (
          <div className='text-center py-8 text-sm text-muted-foreground'>
            <RefreshCw className='w-4 h-4 animate-spin mx-auto mb-2' />
            Loading suggestions...
          </div>
        ) : suggestions.length === 0 ? (
          <div className='text-center py-8 text-sm text-muted-foreground'>
            {!currentTrackId
              ? 'Load a track to see suggestions'
              : 'No compatible segments found'}
          </div>
        ) : (
          suggestions.map((segment) => (
            <SegmentCard
              key={`${segment.trackId}_${segment.position}`}
              segment={segment}
              onAdd={onAddSegment}
              onPreview={onPreviewSegment}
              isInPlaylist={isSegmentInPlaylist(segment)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
