import { useState, useRef, useEffect } from 'react';
import { Mic, X, Settings, MessageSquare, Mic as MicIcon, FileText } from 'lucide-react';
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
import { ChatInterface } from './chat-interface';
import { VoiceNoteInterface } from './voice-note-interface';
import { AttachmentDisplay } from './attachment-display';
import { Message, CopilotStatus, CopilotMode, CopilotAttachment } from './types';
import { useTenant } from '@/shared/hooks/useTenant';
import { TTSAudioManager, AudioQueueItem } from '@/shared/lib/ai-copilot/tts-audio-manager';
import { apiRequest } from '@/shared/lib/api/queryClient';

export function AICopilotWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<CopilotStatus>('idle');
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [mode, setMode] = useState<CopilotMode>('chat');
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingFunctionCall, setPendingFunctionCall] = useState<FunctionCallConfirmation | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [audioQueue, setAudioQueue] = useState<AudioQueueItem[]>([]);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(-1);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [attachments, setAttachments] = useState<CopilotAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const copilotClient = useRef<CopilotWebSocketClient | null>(null);
  const ttsAudioManager = useRef<TTSAudioManager | null>(null);
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  // Load chat history from localStorage on mount (chat mode only)
  useEffect(() => {
    if (mode === 'chat' && currentTenant?.id) {
      const storageKey = `ai-copilot-chat-history-${currentTenant.id}`;
      const savedHistory = localStorage.getItem(storageKey);
      
      if (savedHistory) {
        try {
          const parsedHistory = JSON.parse(savedHistory);
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            setTranscript(parsedHistory);
            console.log('[AICopilot] Loaded chat history from localStorage:', parsedHistory.length, 'messages');
          }
        } catch (error) {
          console.error('[AICopilot] Failed to parse chat history from localStorage:', error);
        }
      }
    }
  }, [mode, currentTenant?.id]);

  // Save chat history to localStorage whenever transcript changes (chat mode only)
  useEffect(() => {
    if (mode === 'chat' && currentTenant?.id && transcript.length > 0) {
      const storageKey = `ai-copilot-chat-history-${currentTenant.id}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(transcript));
        console.log('[AICopilot] Saved chat history to localStorage:', transcript.length, 'messages');
      } catch (error) {
        console.error('[AICopilot] Failed to save chat history to localStorage:', error);
      }
    }
  }, [mode, currentTenant?.id, transcript]);

  // Clear transcript when switching modes
  useEffect(() => {
    setTranscript([]);
    // Also clear audio queue when switching modes
    if (ttsAudioManager.current) {
      ttsAudioManager.current.clearQueue();
    }
  }, [mode]);

  // Initialize TTS Audio Manager
  useEffect(() => {
    const manager = new TTSAudioManager();
    ttsAudioManager.current = manager;

    manager.onPlaybackStateChange = (state) => {
      setIsAudioPlaying(state.isPlaying);
      setIsAudioPaused(state.isPaused);
      setCurrentAudioIndex(state.currentIndex);
    };

    manager.onQueueUpdate = (queue) => {
      setAudioQueue(queue);
    };

    manager.initialize().catch((error) => {
      console.error('[AICopilot] TTS Audio Manager initialization failed:', error);
    });

    return () => {
      manager.cleanup();
    };
  }, []);

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
      setIsChatLoading(false);
    };

    client.onError = (error) => {
      setStatus('error');
      setIsChatLoading(false);
      toast({
        title: 'Connection Error',
        description: error,
        variant: 'destructive'
      });
    };

    client.onFunctionCallConfirmationRequired = (confirmation) => {
      setPendingFunctionCall(confirmation);
      setStatus('idle');
      setIsChatLoading(false);
    };

    client.onChatResponse = (content, timestamp) => {
      console.log('[AICopilot] Chat response received:', content);
      setIsChatLoading(false);
      setStatus('idle');
      
      const aiMessage: Message = {
        role: 'assistant',
        content,
        timestamp
      };
      setTranscript(prev => [...prev, aiMessage]);
    };

    client.onVoiceNoteResponse = (audioData, transcriptText, timestamp) => {
      console.log('[AICopilot] Voice note response received');
      setIsChatLoading(false);
      setStatus('idle');
      
      if (ttsAudioManager.current) {
        const id = `audio-${Date.now()}-${Math.random()}`;
        ttsAudioManager.current.addToQueue(id, audioData, transcriptText);
      }
    };

    client.onFunctionCallResult = (result) => {
      console.log('[AICopilot] Function result received:', result.functionName, result.success);
      
      // Handle document processing results
      if (result.functionName === 'process_document') {
        const attachmentId = result.args?.attachmentId;
        
        if (attachmentId) {
          setAttachments(prev => prev.map(attachment => {
            if (attachment.id === attachmentId) {
              if (result.success && result.result) {
                return {
                  ...attachment,
                  extractionStatus: 'completed' as const,
                  extractionResult: {
                    documentType: result.result.documentType,
                    confidence: result.result.confidence,
                    data: result.result.extractedData
                  }
                };
              } else {
                return {
                  ...attachment,
                  extractionStatus: 'error' as const,
                  extractionError: result.error || 'Extraction failed'
                };
              }
            }
            return attachment;
          }));

          // Show toast notification
          if (result.success) {
            toast({
              title: 'Document Processed',
              description: `Successfully extracted ${result.result?.documentType || 'document'} data`,
            });
          } else {
            toast({
              title: 'Processing Failed',
              description: result.error || 'Failed to process document',
              variant: 'destructive'
            });
          }
        }
      }
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

  const handleSendChatMessage = (message: string) => {
    if (copilotClient.current && message.trim()) {
      setIsChatLoading(true);
      setStatus('thinking');
      
      // Add user message to transcript
      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      setTranscript(prev => [...prev, userMessage]);
      
      // Send to AI
      copilotClient.current.sendChatMessage(message);
    }
  };

  const handleSendVoiceNoteMessage = (message: string) => {
    if (copilotClient.current && message.trim()) {
      setIsChatLoading(true);
      setStatus('thinking');
      
      // Send to AI
      copilotClient.current.sendVoiceNoteMessage(message);
    }
  };

  const handlePlayAudio = () => {
    if (ttsAudioManager.current) {
      if (isAudioPaused) {
        ttsAudioManager.current.resume();
      } else {
        ttsAudioManager.current.playNext();
      }
    }
  };

  const handlePauseAudio = () => {
    if (ttsAudioManager.current) {
      ttsAudioManager.current.pause();
    }
  };

  const handleStopAudio = () => {
    if (ttsAudioManager.current) {
      ttsAudioManager.current.stop();
    }
  };

  const handleClearQueue = () => {
    if (ttsAudioManager.current) {
      ttsAudioManager.current.clearQueue();
    }
  };

  const handleFunctionConfirm = () => {
    if (pendingFunctionCall && copilotClient.current) {
      if (mode === 'chat') {
        copilotClient.current.confirmChatFunctionCall(
          pendingFunctionCall.callId,
          pendingFunctionCall.name,
          pendingFunctionCall.args
        );
      } else if (mode === 'voice-note') {
        copilotClient.current.confirmVoiceNoteFunctionCall(
          pendingFunctionCall.callId,
          pendingFunctionCall.name,
          pendingFunctionCall.args
        );
      } else {
        copilotClient.current.confirmFunctionCall(
          pendingFunctionCall.callId,
          pendingFunctionCall.name,
          pendingFunctionCall.args
        );
      }
      setPendingFunctionCall(null);
      setIsChatLoading(true);
      setStatus('thinking');
    }
  };

  const handleFunctionCancel = () => {
    setPendingFunctionCall(null);
    setIsChatLoading(false);
    setStatus('idle');
    toast({
      title: 'Action Cancelled',
      description: 'The AI action was cancelled'
    });
  };

  const handleUploadAttachment = async (file: File) => {
    if (!currentTenant?.id) return;

    setIsUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      await new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            
            // Upload to server
            const response = await apiRequest('POST', '/api/attachments', {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileData: base64Data,
              entityType: 'ai_copilot',
              entityId: currentTenant.id,
            });

            // Create thumbnail for display
            const thumbnail = base64Data; // Use full image as thumbnail for now

            // Add to attachments list
            const newAttachment: CopilotAttachment = {
              id: response.id,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              uploadedAt: new Date().toISOString(),
              thumbnail
            };

            setAttachments(prev => [...prev, newAttachment]);

            toast({
              title: 'Document Uploaded',
              description: `${file.name} uploaded successfully. Ask me to process it!`
            });

            resolve(response);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
      });
    } catch (error: any) {
      console.error('[AICopilot] Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload document',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    toast({
      title: 'Document Removed',
      description: 'Document removed from AI Copilot'
    });
  };

  const handleProcessAttachment = async (id: string) => {
    const attachment = attachments.find(a => a.id === id);
    if (!attachment) return;

    // Update status to processing
    setAttachments(prev => prev.map(a => 
      a.id === id ? { ...a, extractionStatus: 'processing' as const } : a
    ));

    // Ask the AI to process it
    const message = `Process the document "${attachment.fileName}" with ID ${id} and extract the financial data from it.`;
    handleSendChatMessage(message);
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
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-900 dark:text-white">
                  Interaction Mode
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={mode === 'chat' ? 'default' : 'outline'}
                    onClick={() => setMode('chat')}
                    data-testid="button-mode-chat"
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Chat
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === 'push-to-talk' || mode === 'always-listening' ? 'default' : 'outline'}
                    onClick={() => setMode('push-to-talk')}
                    data-testid="button-mode-voice"
                  >
                    <MicIcon className="h-4 w-4 mr-1" />
                    Voice
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === 'voice-note' ? 'default' : 'outline'}
                    onClick={() => setMode('voice-note')}
                    data-testid="button-mode-voice-note"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Note
                  </Button>
                </div>
              </div>
              
              {(mode === 'push-to-talk' || mode === 'always-listening') && (
                <>
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
                      data-testid="switch-voice-mode"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {mode === 'push-to-talk' 
                      ? 'Hold spacebar or click the microphone button to speak'
                      : 'The microphone is always listening for your voice'
                    }
                  </p>
                </>
              )}
              
              {mode === 'chat' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Type your messages to chat with the AI assistant
                </p>
              )}

              {mode === 'voice-note' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Type text and get audio responses with playback controls
                </p>
              )}
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
            {/* Attachments */}
            {(mode === 'chat' || mode === 'voice-note') && (
              <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
                <AttachmentDisplay
                  attachments={attachments}
                  onUpload={handleUploadAttachment}
                  onRemove={handleRemoveAttachment}
                  onProcess={handleProcessAttachment}
                  isUploading={isUploading}
                  maxFiles={5}
                  maxFileSize={10 * 1024 * 1024}
                />
              </div>
            )}

            {/* Audio Visualizer - Only show for voice modes */}
            {(mode === 'push-to-talk' || mode === 'always-listening') && (status === 'listening' || status === 'speaking') && (
              <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
                <AudioVisualizer 
                  isActive={status === 'listening' || status === 'speaking'}
                  type={status === 'listening' ? 'listening' : 'speaking'}
                />
              </div>
            )}

            {/* Transcript - Only show for non voice-note modes */}
            {mode !== 'voice-note' && <TranscriptDisplay messages={transcript} />}

            {/* Voice Note Interface */}
            {mode === 'voice-note' && (
              <VoiceNoteInterface
                onSendMessage={handleSendVoiceNoteMessage}
                audioQueue={audioQueue}
                currentIndex={currentAudioIndex}
                isPlaying={isAudioPlaying}
                isPaused={isAudioPaused}
                onPlay={handlePlayAudio}
                onPause={handlePauseAudio}
                onStop={handleStopAudio}
                onClearQueue={handleClearQueue}
                disabled={status === 'connecting' || status === 'error'}
                isLoading={isChatLoading}
              />
            )}
          </div>

          {/* Footer with Controls */}
          {mode === 'chat' ? (
            <ChatInterface 
              onSendMessage={handleSendChatMessage}
              disabled={status === 'connecting' || status === 'error'}
              isLoading={isChatLoading}
            />
          ) : mode === 'voice-note' ? null : (
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
          )}
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
