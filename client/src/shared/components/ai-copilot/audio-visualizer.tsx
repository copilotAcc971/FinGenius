import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/utils/utils';

interface AudioVisualizerProps {
  isActive: boolean;
  type: 'listening' | 'speaking';
}

export function AudioVisualizer({ isActive, type }: AudioVisualizerProps) {
  const [barHeights, setBarHeights] = useState<number[]>(Array(10).fill(20));

  useEffect(() => {
    if (!isActive) {
      setBarHeights(Array(10).fill(20));
      return;
    }

    const interval = setInterval(() => {
      setBarHeights(Array(10).fill(0).map(() => Math.random() * 60 + 20));
    }, 150);

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div 
      className="flex items-center justify-center gap-1 h-20"
      data-testid="audio-visualizer"
      role="img"
      aria-label={isActive ? `${type} audio visualization` : 'Inactive audio visualization'}
    >
      {barHeights.map((height, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-all duration-150",
            isActive && type === 'listening' && "bg-black dark:bg-white",
            isActive && type === 'speaking' && "bg-green-600",
            !isActive && "bg-gray-200 dark:bg-neutral-800"
          )}
          style={{
            height: `${height}%`,
            transitionDelay: `${i * 20}ms`
          }}
        />
      ))}
    </div>
  );
}
