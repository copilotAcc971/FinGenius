import { useState, KeyboardEvent } from 'react';
import { Send, Play, Pause, Square, Trash2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils/utils';
import type { AudioQueueItem } from '@/shared/lib/ai-copilot/tts-audio-manager';

interface VoiceNoteInterfaceProps {
  onSendMessage: (message: string) => void;
  audioQueue: AudioQueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onClearQueue: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function VoiceNoteInterface({
  onSendMessage,
  audioQueue,
  currentIndex,
  isPlaying,
  isPaused,
  onPlay,
  onPause,
  onStop,
  onClearQueue,
  disabled = false,
  isLoading = false
}: VoiceNoteInterfaceProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getCurrentItem = () => {
    if (currentIndex >= 0 && currentIndex < audioQueue.length) {
      return audioQueue[currentIndex];
    }
    return null;
  };

  const currentItem = getCurrentItem();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Audio Playback
            </h4>
            {audioQueue.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="badge-queue-count">
                  {audioQueue.length} {audioQueue.length === 1 ? 'item' : 'items'}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClearQueue}
                  disabled={disabled || audioQueue.length === 0}
                  data-testid="button-clear-queue"
                  aria-label="Clear audio queue"
                  title="Clear queue"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isPlaying || isPaused ? (
              <Button
                size="icon"
                onClick={onPlay}
                disabled={disabled || audioQueue.length === 0}
                data-testid="button-play"
                aria-label="Play audio"
                title="Play"
              >
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={onPause}
                disabled={disabled}
                data-testid="button-pause"
                aria-label="Pause audio"
                title="Pause"
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="outline"
              onClick={onStop}
              disabled={disabled || !isPlaying}
              data-testid="button-stop"
              aria-label="Stop audio"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>

            {currentItem && (
              <div className="flex-1 ml-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    isPlaying && !isPaused ? "bg-green-600 animate-pulse" : "bg-gray-400"
                  )} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {isPlaying && !isPaused ? 'Playing' : isPaused ? 'Paused' : 'Stopped'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({currentIndex + 1} of {audioQueue.length})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {audioQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="text-gray-400 dark:text-gray-600 mb-2">
                <Play className="h-12 w-12 mx-auto mb-3" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                No audio responses yet
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Type a message below to get an audio response from the AI
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {audioQueue.map((item, index) => (
                <Card
                  key={item.id}
                  className={cn(
                    "p-3",
                    index === currentIndex && "border-black dark:border-white border-2"
                  )}
                  data-testid={`card-audio-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                      item.status === 'playing' && "bg-green-600 animate-pulse",
                      item.status === 'completed' && "bg-gray-400",
                      item.status === 'pending' && "bg-blue-600"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={item.status === 'playing' ? 'default' : 'outline'}
                          className="text-xs"
                          data-testid={`badge-status-${index}`}
                        >
                          {item.status === 'playing' ? 'Playing' : item.status === 'completed' ? 'Completed' : 'Pending'}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          #{index + 1}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                        {item.transcript}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={disabled || isLoading}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={disabled || isLoading || !inputValue.trim()}
            size="icon"
            data-testid="button-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Type your message and the AI will respond with audio
        </p>
      </div>
    </div>
  );
}
