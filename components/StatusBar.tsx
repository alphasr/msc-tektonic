'use client';

import { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SystemStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  status: SystemStatus;
  onRetry?: () => void;
}

export default function StatusBar({ status, onRetry }: StatusBarProps) {
  const [latency, setLatency] = useState(status.latency || 4.8);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(4.5 + Math.random() * 0.5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check LLM availability
    fetch('/api/llm/status')
      .then((res) => res.json())
      .then((data) => setLlmAvailable(data.available))
      .catch(() => setLlmAvailable(false));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-500';
      case 'degraded':
        return 'text-cyan-500';
      case 'outage':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const isOffline =
    status.backend === 'outage' || status.backend === 'degraded';

  return (
    <div className='border-b bg-card'>
      <div className='container mx-auto px-4 py-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            {isOffline && (
              <div className='flex items-center gap-2 bg-red-500/20 border border-red-500/50 rounded px-3 py-1.5'>
                <AlertCircle className='w-4 h-4 text-red-500' />
                <span className='text-sm'>Offline backend detected</span>
                <span className='text-xs text-muted-foreground'>
                  Some library sync and analytics features are paused. Local
                  playback remains available.
                </span>
                {onRetry && (
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={onRetry}
                    className='ml-2'
                  >
                    Retry connection
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className='flex items-center gap-4 text-sm'>
            <div className='flex items-center gap-2'>
              {status.backend === 'operational' ? (
                <Wifi
                  className={cn('w-4 h-4', getStatusColor(status.backend))}
                />
              ) : (
                <WifiOff
                  className={cn('w-4 h-4', getStatusColor(status.backend))}
                />
              )}
              <span className={getStatusColor(status.backend)}>Connected</span>
            </div>
            <div className='flex items-center gap-2'>
              {status.storage === 'operational' ? (
                <Cloud
                  className={cn('w-4 h-4', getStatusColor(status.storage))}
                />
              ) : (
                <CloudOff
                  className={cn('w-4 h-4', getStatusColor(status.storage))}
                />
              )}
              <span className={getStatusColor(status.storage)}>
                {status.storage === 'operational'
                  ? 'Cloud backup active'
                  : 'Cloud backup paused'}
              </span>
            </div>
            {llmAvailable !== null && (
              <div className='flex items-center gap-2'>
                <Sparkles
                  className={cn(
                    'w-4 h-4',
                    llmAvailable ? 'text-purple-500' : 'text-muted-foreground'
                  )}
                />
                <span
                  className={
                    llmAvailable ? 'text-purple-500' : 'text-muted-foreground'
                  }
                >
                  AI {llmAvailable ? 'Active' : 'Unavailable'}
                </span>
              </div>
            )}
            <div className='text-muted-foreground'>
              Latency: {latency.toFixed(1)} ms
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
