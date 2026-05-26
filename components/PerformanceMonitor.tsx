/**
 * Performance Monitor Component
 * Shows real-time ML performance metrics and graceful degradation status
 */

'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { MLPerformanceMetrics } from '@/types';
import { getMLManager } from '@/lib/ml-manager';
import { cn } from '@/lib/utils';

interface PerformanceMonitorProps {
  className?: string;
  compact?: boolean;
}

export default function PerformanceMonitor({
  className,
  compact = false,
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<MLPerformanceMetrics | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mlManager = getMLManager();

    const interval = setInterval(() => {
      const currentMetrics = mlManager.getMetrics();
      setMetrics(currentMetrics);

      // Auto-hide if performance is good
      if (currentMetrics.degradationLevel === 'none') {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!metrics || (!isVisible && compact)) {
    return null;
  }

  const getDegradationColor = () => {
    switch (metrics.degradationLevel) {
      case 'none':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20 border-green-200';
      case 'minor':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200';
      case 'moderate':
        return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200';
      case 'severe':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200';
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20 border-gray-200';
    }
  };

  const getDegradationIcon = () => {
    switch (metrics.degradationLevel) {
      case 'none':
        return <CheckCircle className='w-4 h-4' />;
      case 'minor':
      case 'moderate':
        return <AlertTriangle className='w-4 h-4' />;
      case 'severe':
        return <AlertTriangle className='w-4 h-4 animate-pulse' />;
      default:
        return <Activity className='w-4 h-4' />;
    }
  };

  const getDegradationLabel = () => {
    switch (metrics.degradationLevel) {
      case 'none':
        return 'Optimal';
      case 'minor':
        return 'Good';
      case 'moderate':
        return 'Reduced';
      case 'severe':
        return 'Limited';
      default:
        return 'Unknown';
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
          getDegradationColor(),
          className,
        )}
      >
        {getDegradationIcon()}
        <span>AI: {getDegradationLabel()}</span>
        <span className='text-xs opacity-70'>
          {metrics.frameRate.toFixed(0)} fps
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 rounded-lg border',
        getDegradationColor(),
        className,
      )}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Zap className='w-4 h-4' />
          <span className='font-semibold text-sm'>AI Performance</span>
        </div>
        {getDegradationIcon()}
      </div>

      <div className='grid grid-cols-2 gap-2 text-xs'>
        <div>
          <span className='opacity-70'>Frame Rate:</span>
          <span className='ml-1 font-semibold'>
            {metrics.frameRate.toFixed(1)} fps
          </span>
        </div>
        <div>
          <span className='opacity-70'>Inference:</span>
          <span className='ml-1 font-semibold'>
            {metrics.avgInferenceTime.toFixed(1)} ms
          </span>
        </div>
        <div>
          <span className='opacity-70'>CPU:</span>
          <span className='ml-1 font-semibold'>
            {metrics.cpuUsage.toFixed(0)}%
          </span>
        </div>
        <div>
          <span className='opacity-70'>Queue:</span>
          <span className='ml-1 font-semibold'>{metrics.workerBacklog}</span>
        </div>
      </div>

      <div className='text-xs opacity-70 border-t pt-2 mt-1'>
        <p>
          {metrics.degradationLevel === 'none' && 'AI running at full capacity'}
          {metrics.degradationLevel === 'minor' &&
            'Minor performance impact detected'}
          {metrics.degradationLevel === 'moderate' &&
            'AI features running at reduced capacity'}
          {metrics.degradationLevel === 'severe' &&
            'AI features significantly limited due to performance'}
        </p>
      </div>
    </div>
  );
}
