'use client';

import { useState } from 'react';
import {
  Play,
  Plus,
  X,
  Music2,
  TrendingUp,
  Clock,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SegmentSuggestion } from '@/types';
import { cn, getCamelotColor } from '@/lib/utils';
import RecommendationExplanation from '@/components/RecommendationExplanation';

interface SegmentCardProps {
  segment: SegmentSuggestion;
  onAdd: (segment: SegmentSuggestion) => void;
  onPreview: (segment: SegmentSuggestion) => Promise<void> | void;
  onRemove?: (segment: SegmentSuggestion) => void;
  isInPlaylist?: boolean;
}

export default function SegmentCard({
  segment,
  onAdd,
  onPreview,
  onRemove,
  isInPlaylist = false,
}: SegmentCardProps) {
  const [isPreviewing, setIsPreviewing] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      await onPreview(segment);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPreviewing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    return 'Fair';
  };

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md relative',
        isInPlaylist && 'border-green-500 bg-green-50 dark:bg-green-900/20',
        segment.optimalTransitionTime !== undefined &&
          segment.optimalTransitionTime <= 10 &&
          'border-amber-500 shadow-amber-500/20',
      )}
    >
      {/* Optimal Timing Badge */}
      {segment.optimalTransitionTime !== undefined && (
        <div
          className={cn(
            'absolute -top-2 -right-2 z-10 px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1',
            segment.optimalTransitionTime <= 3
              ? 'bg-green-500 text-white animate-pulse'
              : segment.optimalTransitionTime <= 10
                ? 'bg-amber-500 text-white'
                : 'bg-blue-500 text-white',
          )}
        >
          <Clock className='w-3 h-3' />
          {segment.optimalTransitionTime <= 3
            ? 'MIX NOW!'
            : segment.optimalTransitionTime <= 10
              ? `In ${segment.optimalTransitionTime.toFixed(0)}s`
              : `${segment.optimalTransitionTime.toFixed(0)}s`}
        </div>
      )}

      {/* Frequency Conflict Warning */}
      {segment.frequencyConflict !== undefined &&
        segment.frequencyConflict > 0.6 && (
          <div className='absolute -top-2 -left-2 z-10 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1'>
            <AlertTriangle className='w-3 h-3' />
            Clash
          </div>
        )}
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-1'>
              <CardTitle className='text-sm font-semibold truncate flex-1'>
                {segment.trackTitle}
              </CardTitle>
              <RecommendationExplanation
                scores={segment.scores}
                className='flex-shrink-0'
              />
            </div>
            <CardDescription className='text-xs truncate'>
              {segment.trackArtist}
            </CardDescription>
          </div>
          <div className='flex flex-col items-end gap-1'>
            <div
              className={cn(
                'text-xs font-semibold px-2 py-1 rounded shadow-sm',
                getScoreColor(segment.score),
                'bg-background border',
              )}
            >
              {Math.round(segment.score * 100)}% Match
            </div>
            <div
              className='text-[10px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm'
              style={{
                backgroundColor: getCamelotColor(
                  segment.scores.key >= 0.8 ? '8A' : 'notfound',
                ) /* Use actual key if segment had it, but SegmentSuggestion doesn't expose it directly. Wait, we can color it by score instead or use standard badge */,
              }}
            >
              {getScoreLabel(segment.score)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        {/* Segment Info */}
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Music2 className='w-3 h-3' />
          <span>
            {formatTime(segment.position)} -{' '}
            {formatTime(segment.position + segment.duration)}
          </span>
          <span className='text-muted-foreground/50'>•</span>
          <span>{formatTime(segment.duration)}</span>
        </div>

        {/* Waveform Preview */}
        {segment.waveform && segment.waveform.length > 0 && (
          <div className='h-8 flex items-center gap-0.5'>
            {segment.waveform.slice(0, 40).map((value, idx) => (
              <div
                key={idx}
                className='flex-1 bg-primary/30 rounded-sm'
                style={{
                  height: `${Math.max(4, value * 100)}%`,
                }}
              />
            ))}
          </div>
        )}

        {/* Score Breakdown */}
        <div className='grid grid-cols-2 gap-2 text-xs'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Key:</span>
            <span className={getScoreColor(segment.scores.key)}>
              {Math.round(segment.scores.key * 100)}%
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Tempo:</span>
            <span className={getScoreColor(segment.scores.tempo)}>
              {Math.round(segment.scores.tempo * 100)}%
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Energy:</span>
            <span className={getScoreColor(segment.scores.energy)}>
              {Math.round(segment.scores.energy * 100)}%
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Frequency:</span>
            <span className={getScoreColor(segment.scores.frequency)}>
              {Math.round(segment.scores.frequency * 100)}%
            </span>
          </div>
        </div>

        {/* AI Explanation */}
        {segment.explanation && (
          <div className='flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-xs border border-blue-200 dark:border-blue-800'>
            <Zap className='w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5' />
            <p className='text-blue-700 dark:text-blue-300 leading-relaxed'>
              {segment.explanation}
            </p>
          </div>
        )}

        {/* ML Score Indicator */}
        {segment.mlScore !== undefined && (
          <div className='flex items-center justify-between px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded text-xs'>
            <span className='text-purple-700 dark:text-purple-300 flex items-center gap-1'>
              <Zap className='w-3 h-3' />
              AI Confidence
            </span>
            <span className='font-semibold text-purple-600 dark:text-purple-400'>
              {Math.round(segment.mlScore * 100)}%
            </span>
          </div>
        )}

        {/* Actions */}
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            className='flex-1 text-xs'
            onClick={handlePreview}
            disabled={isPreviewing}
          >
            <Play className='w-3 h-3 mr-1' />
            {isPreviewing ? 'Previewing...' : 'Preview'}
          </Button>
          {isInPlaylist && onRemove ? (
            <Button
              variant='destructive'
              size='sm'
              className='flex-1 text-xs'
              onClick={() => onRemove(segment)}
            >
              <X className='w-3 h-3 mr-1' />
              Remove
            </Button>
          ) : (
            <Button
              variant='default'
              size='sm'
              className='flex-1 text-xs'
              onClick={() => onAdd(segment)}
            >
              <Plus className='w-3 h-3 mr-1' />
              Add
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
