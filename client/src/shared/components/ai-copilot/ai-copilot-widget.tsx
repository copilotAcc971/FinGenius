import { useState, useRef, useEffect } from 'react';
import { Mic, X, Settings, Minimize2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils/utils';
import { CopilotWebSocketClient, FunctionCallConfirmation } from '@/shared/lib/ai-copilot/websocket-client';
import { AudioVisualizer } from './audio-visualizer';
import { TranscriptDisplay } from './transcript-display';
import { FunctionConfirmationDialog } from './function-confirmation-dialog';
import { Message, CopilotStatus, CopilotMode } from './types';
import { useTenant } from '@/shared/hooks/useTenant';

export function AICopilotWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<CopilotStatus>('idle');
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [mode, setMode] = useState<CopilotMode>('push-to-talk');
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingFunctionCall, setPendingFunctionCall] = useState<FunctionCallConfirmation | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const copilotClient = useRef<CopilotWebSocketClient | null>(null);
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  // Initialize WebSocket connection
  useEffect(() => {
    if (!currentTenant?.id) return;

    const client = new CopilotWebSocketClient();
    copilotClient.current = client;

    client.onConnected = () => {
      setStatus('idle');
      console.log('[AICopilot] Connected to AI service');
    };

    client.onDisconnected = () => {
      setStatus('idle');
      setIsRecording(false);
    };

    client.onError = (error) => {
      setStatus('error');
      toast({
        title: 'Connection Error',
        description: error,
        variant: 'destructive'
      });
    };

    client.onFunctionCallConfirmationRequired = (confirmation) => {
      setPendingFunctionCall(confirmation);
      setStatus('idle');
    };

    return () => {
      client.disconnect();
    };
  }, [currentTenant?.id, toast]);

  // Connect when expanded
  useEffect(() => {
    if (isExpanded && copilotClient.current && !copilotClient.current.isConnected() && currentTenant?.id) {
      setStatus('connecting');
      copilotClient.current.connect(currentTenant.id).catch((error) => {
        console.error('[AICopilot] Connection failed:', error);
        setStatus('error');
      });
    }
  }, [isExpanded, currentTenant?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to minimize
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
        return;
      }

      // Spacebar for push-to-talk (only when expanded and in push-to-talk mode)
      if (e.code === 'Space' && isExpanded && mode === 'push-to-talk' && !e.repeat) {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isExpanded && mode === 'push-to-talk') {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isExpanded, mode]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (isFirstTime && !isExpanded) {
      setIsFirstTime(false);
    }
  };

  const startRecording = () => {
    if (status === 'connecting' || status === 'error') return;
    setIsRecording(true);
    setStatus('listening');
    
    // Add user message placeholder
    const userMessage: Message = {
      role: 'user',
      content: 'Listening...',
      timestamp: Date.now()
    };
    setTranscript(prev => [...prev, userMessage]);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatus('thinking');
    
    // Update last message to indicate processing
    setTranscript(prev => {
      const updated = [...prev];
      if (updated[updated.length - 1]?.role === 'user') {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Processing your request...'
        };
      }
      return updated;
    });
    
    // Simulate AI response (in production, this would come from WebSocket)
    setTimeout(() => {
      setStatus('speaking');
      const aiMessage: Message = {
        role: 'assistant',
        content: 'I can help you with your accounting tasks. What would you like to know?',
        timestamp: Date.now()
      };
      setTranscript(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.content === 'Processing your request...') {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: 'Show me the dashboard'
          };
        }
        return [...updated, aiMessage];
      });
      
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    }, 1500);
  };

  const handleFunctionConfirm = () => {
    if (pendingFunctionCall && copilotClient.current) {
      copilotClient.current.confirmFunctionCall(
        pendingFunctionCall.callId,
        pendingFunctionCall.name,
        pendingFunctionCall.args
      );
      setPendingFunctionCall(null);
    }
  };

  const handleFunctionCancel = () => {
    setPendingFunctionCall(null);
    toast({
      title: 'Action Cancelled',
      description: 'The AI action was cancelled'
    });
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting': return 'Connecting...';
      case 'listening': return 'Listening';
      case 'thinking': return 'Processing';
      case 'speaking': return 'Speaking';
      case 'error': return 'Connection Error';
      default: return 'Ready';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'listening': return 'text-black dark:text-white';
      case 'thinking': return 'text-gray-600 dark:text-gray-400';
      case 'speaking': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Minimized bubble view
  if (!isExpanded) {
    return (
      <>
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            size="icon"
            onClick={toggleExpanded}
            className={cn(
              "h-14 w-14 rounded-full shadow-lg",
              status === 'speaking' && "animate-pulse"
            )}
            aria-label="Open AI Copilot"
            data-testid="button-copilot-toggle"
          >
            <Mic className="h-6 w-6" />
          </Button>
          {isFirstTime && (
            <Badge 
              className="absolute -top-2 -right-2 bg-red-600 text-white"
              data-testid="badge-new"
            >
              NEW
            </Badge>
          )}
        </div>
      </>
    );
  }

  // Expanded view
  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <Card className={cn(
          "w-[400px] h-[600px] shadow-lg flex flex-col",
          "md:w-[400px] md:h-[600px]",
          "sm:w-[350px] sm:h-[500px]"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Copilot
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowSettings(!showSettings)}
                aria-label="Settings"
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleExpanded}
                aria-label="Minimize"
                data-testid="button-minimize"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 space-y-4 bg-gray-50 dark:bg-neutral-900">
              <div className="flex items-center justify-between">
                <Label htmlFor="mode-toggle" className="text-sm font-medium">
                  Always Listening Mode
                </Label>
                <Switch
                  id="mode-toggle"
                  checked={mode === 'always-listening'}
                  onCheckedChange={(checked) => 
                    setMode(checked ? 'always-listening' : 'push-to-talk')
                  }
                  data-testid="switch-mode"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {mode === 'push-to-talk' 
                  ? 'Hold spacebar or click the microphone button to speak'
                  : 'The microphone is always listening for your voice'
                }
              </p>
            </div>
          )}

          {/* Status Bar */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Status
              </span>
              <span className={cn("text-sm font-medium", getStatusColor())}>
                {getStatusText()}
              </span>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Audio Visualizer */}
            {(status === 'listening' || status === 'speaking') && (
              <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
                <AudioVisualizer 
                  isActive={status === 'listening' || status === 'speaking'}
                  type={status === 'listening' ? 'listening' : 'speaking'}
                />
              </div>
            )}

            {/* Transcript */}
            <TranscriptDisplay messages={transcript} />
          </div>

          {/* Footer with Controls */}
          <div className="p-4 border-t border-gray-200 dark:border-neutral-800 space-y-3">
            {/* Push-to-Talk Button */}
            <div className="flex justify-center">
              <Button
                size="lg"
                onMouseDown={mode === 'push-to-talk' ? startRecording : undefined}
                onMouseUp={mode === 'push-to-talk' ? stopRecording : undefined}
                onTouchStart={mode === 'push-to-talk' ? startRecording : undefined}
                onTouchEnd={mode === 'push-to-talk' ? stopRecording : undefined}
                disabled={status === 'connecting' || status === 'error'}
                className={cn(
                  "h-16 w-16 rounded-full",
                  isRecording && "ring-4 ring-black dark:ring-white ring-offset-2"
                )}
                aria-label={isRecording ? 'Release to stop recording' : 'Hold to speak'}
                data-testid="button-push-to-talk"
              >
                <Mic className={cn(
                  "h-6 w-6",
                  isRecording && "animate-pulse"
                )} />
              </Button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              {mode === 'push-to-talk' 
                ? 'Hold spacebar or click to speak'
                : 'Speak naturally - I\'m always listening'
              }
            </p>
          </div>
        </Card>
      </div>

      {/* Function Confirmation Dialog */}
      <FunctionConfirmationDialog
        open={!!pendingFunctionCall}
        onOpenChange={(open) => !open && setPendingFunctionCall(null)}
        functionCall={pendingFunctionCall ? {
          name: pendingFunctionCall.name,
          args: pendingFunctionCall.args,
          callId: pendingFunctionCall.callId
        } : null}
        onConfirm={handleFunctionConfirm}
        onCancel={handleFunctionCancel}
      />
    </>
  );
}
