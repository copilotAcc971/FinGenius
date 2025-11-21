import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Loader2, Send, Plus, MessageCircle, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { apiRequest, queryClient } from '@/shared/lib/api/queryClient';
import type { CopilotConversation, CopilotMessage } from '@shared/schema';

// WebSocket connection handler for real-time chat
const useWebSocketChat = (conversationId: string | null) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    if (!conversationId) return;

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/ai-copilot`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', conversationId }));
      };

      ws.onclose = () => {
        setWsConnected(false);
      };

      wsRef.current = ws;

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setWsConnected(false);
    }
  }, [conversationId]);

  return { wsRef, wsConnected };
};

export default function CopilotPage() {
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { wsRef, wsConnected } = useWebSocketChat(selectedConversation);

  // List conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ['/api/copilot/conversations'],
    queryFn: async () => {
      const response = await fetch('/api/copilot/conversations');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json() as Promise<CopilotConversation[]>;
    },
  });

  // Get messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: [`/api/copilot/conversations/${selectedConversation}/messages`],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const response = await fetch(`/api/copilot/conversations/${selectedConversation}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json() as Promise<CopilotMessage[]>;
    },
    enabled: !!selectedConversation,
  });

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest('POST', '/api/copilot/conversations', { title });
    },
    onSuccess: (data) => {
      setSelectedConversation(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/copilot/conversations'] });
      toast({
        title: 'Conversation Created',
        description: 'New conversation started',
      });
    },
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversation) throw new Error('No conversation selected');
      return apiRequest('POST', `/api/copilot/conversations/${selectedConversation}/messages`, {
        content,
      });
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({
        queryKey: [`/api/copilot/conversations/${selectedConversation}/messages`],
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput);
  };

  const handleNewConversation = () => {
    const title = prompt('Enter conversation title:');
    if (title) {
      createConversationMutation.mutate(title);
    }
  };

  return (
    <div className="flex h-screen gap-4 p-4">
      {/* Sidebar */}
      <div className="w-64 flex flex-col gap-2 bg-sidebar border-r">
        <div className="flex gap-2">
          <Button onClick={handleNewConversation} className="flex-1" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          <div className="flex items-center justify-center px-2 py-1 rounded text-xs" data-testid="websocket-status">
            {wsConnected ? (
              <Wifi className="w-4 h-4 text-green-600" title="Connected" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" title="Disconnected" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm truncate ${
                selectedConversation === conv.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50'
              }`}
              data-testid={`button-conversation-${conv.id}`}
            >
              <MessageCircle className="w-3 h-3 inline mr-2" />
              {conv.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Messages */}
            <Card className="flex-1 overflow-hidden flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle>
                  {conversations.find((c) => c.id === selectedConversation)?.title || 'Chat'}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto space-y-4 pb-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Start a conversation
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Input Area */}
            <div className="flex gap-2 mt-4">
              <Input
                placeholder="Type your message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                disabled={sendMessageMutation.isPending}
                data-testid="input-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select or create a conversation to start
          </div>
        )}
      </div>
    </div>
  );
}
