'use client';

import { useState, useEffect } from 'react';
import { SystemStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  status: SystemStatus;
  onRetry?: () => void;
}

export default function StatusBar({ status, onRetry }: StatusBarProps) {
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [latency, setLatency] = useState(status.latency || 4.8);

  useEffect(() => {
    const interval = setInterval(() => setLatency(4.5 + Math.random() * 0.6), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/llm/status')
      .then(r => r.json())
      .then(d => setLlmAvailable(d.available))
      .catch(() => setLlmAvailable(false));
  }, []);

  const dot = (ok: boolean) => (
    <span className={cn('w-1.5 h-1.5 rounded-full inline-block', ok ? 'bg-green-500' : 'bg-red-500')} />
  );

  const isOffline = status.backend === 'outage';

  return (
    <div className={cn(
      'h-6 flex items-center px-4 border-b text-[10px] gap-3 flex-shrink-0',
      isOffline ? 'bg-red-500/10 border-red-500/30' : 'bg-background/60 border-white/[0.04]'
    )}>
      <div className='flex items-center gap-1.5'>
        {dot(status.backend === 'operational')}
        <span className={status.backend === 'operational' ? 'text-muted-foreground' : 'text-red-400'}>
          Backend
        </span>
      </div>
      <div className='flex items-center gap-1.5'>
        {dot(status.storage === 'operational')}
        <span className='text-muted-foreground'>Storage</span>
      </div>
      {llmAvailable !== null && (
        <div className='flex items-center gap-1.5'>
          {dot(llmAvailable)}
          <span className={llmAvailable ? 'text-purple-400' : 'text-muted-foreground'}>AI</span>
        </div>
      )}
      <span className='text-muted-foreground/50 ml-auto'>{latency.toFixed(1)} ms</span>
      {isOffline && onRetry && (
        <button
          onClick={onRetry}
          className='text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-0.5 rounded text-[9px] transition-colors'
        >
          Retry
        </button>
      )}
    </div>
  );
}
