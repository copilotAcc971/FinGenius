import { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/utils/utils';
import { Message } from './types';

interface TranscriptDisplayProps {
  messages: Message[];
}

export function TranscriptDisplay({ messages }: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div 
        className="flex-1 flex items-center justify-center p-6"
        data-testid="transcript-display"
      >
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Start a conversation
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Click the microphone button to speak with your AI assistant
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto space-y-3 p-4"
      data-testid="transcript-display"
    >
      {messages.map((message, i) => (
        <div 
          key={i}
          className={cn(
            "flex gap-2",
            message.role === 'user' ? 'justify-end' : 'justify-start'
          )}
        >
          <div 
            className={cn(
              "max-w-[80%] rounded-md p-3",
              message.role === 'user' 
                ? 'bg-black text-white dark:bg-white dark:text-black' 
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white'
            )}
            data-testid={`message-${message.role}-${i}`}
          >
            <div className="text-sm leading-relaxed">{message.content}</div>
            <div 
              className={cn(
                "text-xs mt-1",
                message.role === 'user' 
                  ? 'text-white/70 dark:text-black/70' 
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
