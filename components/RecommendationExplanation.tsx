'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface RecommendationExplanationProps {
  explanation?: string;
  scores?: {
    harmonic?: number;
    tempo?: number;
    energy?: number;
    texture?: number;
    overall?: number;
  };
  className?: string;
}

export default function RecommendationExplanation({
  explanation,
  scores,
  className,
}: RecommendationExplanationProps) {
  const [open, setOpen] = useState(false);

  if (!explanation && !scores) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center justify-center rounded-full p-1 hover:bg-accent transition-colors',
            className
          )}
          aria-label='Show recommendation explanation'
        >
          <Info className='w-3 h-3 text-muted-foreground' />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-80 text-sm' align='start'>
        <div className='space-y-2'>
          {explanation && (
            <div>
              <p className='font-semibold mb-1'>Why this track?</p>
              <p className='text-muted-foreground'>{explanation}</p>
            </div>
          )}
          {scores && (
            <div className='pt-2 border-t'>
              <p className='font-semibold mb-2'>Compatibility Scores:</p>
              <div className='space-y-1 text-xs'>
                {scores.harmonic !== undefined && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Harmonic:</span>
                    <span>{Math.round(scores.harmonic * 100)}%</span>
                  </div>
                )}
                {scores.tempo !== undefined && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Tempo:</span>
                    <span>{Math.round(scores.tempo * 100)}%</span>
                  </div>
                )}
                {scores.energy !== undefined && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Energy:</span>
                    <span>{Math.round(scores.energy * 100)}%</span>
                  </div>
                )}
                {scores.texture !== undefined && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Texture:</span>
                    <span>{Math.round(scores.texture * 100)}%</span>
                  </div>
                )}
                {scores.overall !== undefined && (
                  <div className='flex justify-between pt-1 border-t font-semibold'>
                    <span>Overall:</span>
                    <span>{Math.round(scores.overall * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
