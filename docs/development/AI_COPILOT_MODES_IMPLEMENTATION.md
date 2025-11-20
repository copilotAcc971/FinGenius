# AI Copilot Modes Implementation

## Overview

This document describes the implementation of Chat Mode and Voice Note Mode for the AI Copilot feature, along with the Mode Switcher UI.

## Architecture

### 1. Chat Mode

**Purpose:** Text-based chat interaction with the AI assistant.

**Implementation:**
- **File:** `server/ai-copilot/chat-handler.ts`
- **API:** OpenAI Chat Completions API (gpt-4o model)
- **Input:** Text messages from user
- **Output:** Text responses from AI
- **Features:**
  - Full function calling capabilities (same as Realtime API)
  - Message history management with `chatHistory` array
  - RAG (Retrieval Augmented Generation) integration
  - Permission-aware function execution
  - Confirmation dialogs for mutating operations

**Key Functions:**
```typescript
processChatMessage(message: string, context: ChatContext): Promise<ChatResponse>
executeConfirmedChatFunction(toolCallId, functionName, args, context): Promise<FunctionExecutionResult>
initializeChatHistory(authorityContext): ChatCompletionMessageParam[]
```

**WebSocket Events:**
- Client sends: `chat_message` with content
- Client sends: `chat_function_confirmed` for function execution
- Server responds: `chat_response` with AI reply
- Server responds: `function_call_confirmation_required` for approval

**UI Component:**
- `ChatInterface` component with textarea input and send button
- Displays in main content area when mode === 'chat'
- Shows loading state while AI is processing

---

### 2. Voice Note Mode

**Purpose:** User types text, AI responds with audio playback.

**Implementation:**
- **Files:** 
  - `server/ai-copilot/chat-handler.ts` (processVoiceNoteMessage)
  - `server/ai-copilot/tts-handler.ts` (TTS utilities)
- **API:** 
  - OpenAI Chat Completions API (for text understanding)
  - OpenAI TTS API (for audio generation)
- **Input:** Text messages from user
- **Output:** Base64 encoded audio (MP3 format)
- **Features:**
  - Text-to-Speech conversion using OpenAI TTS API
  - Audio queue management with play/pause/stop controls
  - Sequential audio playback
  - One-way communication (no Speech-to-Text)
  - Same function calling capabilities as Chat Mode

**Key Functions:**
```typescript
processVoiceNoteMessage(message: string, context: ChatContext): Promise<VoiceNoteResponse>
executeConfirmedVoiceNoteFunction(toolCallId, functionName, args, context): Promise<FunctionExecutionResult>
generateSpeech(text: string, options?: TTSOptions): Promise<TTSResponse>
```

**WebSocket Events:**
- Client sends: `voice_note_message` with content
- Client sends: `voice_note_function_confirmed` for function execution
- Server responds: `voice_note_response` with audio data and transcript
- Server responds: `function_call_confirmation_required` for approval

**UI Component:**
- `VoiceNoteInterface` component with:
  - Text input field
  - Audio playback controls (Play, Pause, Stop)
  - Audio queue display showing all pending/playing/completed items
  - Clear queue button
  - Status indicators
- Displays in main content area when mode === 'voice-note'

**Audio Management:**
- `TTSAudioManager` handles audio queue and playback
- Base64 audio decoded and played through Web Audio API
- Automatic progression through queue
- Visual feedback for current playing item

---

### 3. Mode Switcher UI

**Purpose:** Allow users to switch between different interaction modes.

**Implementation:**
- **File:** `client/src/shared/components/ai-copilot/ai-copilot-widget.tsx`
- **Location:** Settings panel in AI Copilot widget
- **Modes:**
  1. **Chat** - Text-based conversation
  2. **Voice** - Live voice interaction (push-to-talk or always-listening)
  3. **Note** - Voice Note mode (text input, audio output)

**UI Features:**
```typescript
// Mode state management
const [mode, setMode] = useState<CopilotMode>('chat');

// Three mode buttons in settings panel
<Button variant={mode === 'chat' ? 'default' : 'outline'} onClick={() => setMode('chat')}>
  <MessageSquare /> Chat
</Button>
<Button variant={mode === 'push-to-talk' || mode === 'always-listening' ? 'default' : 'outline'} onClick={() => setMode('push-to-talk')}>
  <MicIcon /> Voice
</Button>
<Button variant={mode === 'voice-note' ? 'default' : 'outline'} onClick={() => setMode('voice-note')}>
  <FileText /> Note
</Button>
```

**Mode-Specific UI Adaptations:**

| Mode | Input | Output | Controls Shown |
|------|-------|--------|----------------|
| Chat | Textarea | Text transcript | Send button, ChatInterface |
| Voice (Push-to-talk) | Microphone (on hold) | Live audio + transcript | Mic button, AudioVisualizer, TranscriptDisplay |
| Voice (Always-listening) | Microphone (continuous) | Live audio + transcript | Status indicator, AudioVisualizer, TranscriptDisplay |
| Voice Note | Text input | Audio playback | Send button, VoiceNoteInterface, Audio controls |

**State Management:**
- `mode` state controls which UI components are shown
- `transcript` state is cleared when switching modes
- Audio queue is cleared when switching modes
- Chat history persists in localStorage (Chat mode only)
- Settings panel shows mode-specific help text

**Conditional Rendering:**
```typescript
{mode === 'chat' && <ChatInterface onSendMessage={handleSendChatMessage} />}
{mode === 'voice-note' && <VoiceNoteInterface onSendMessage={handleSendVoiceNoteMessage} />}
{(mode === 'push-to-talk' || mode === 'always-listening') && <MicrophoneButton />}
```

---

## WebSocket Integration

### Client-Side (websocket-client.ts)

**Methods:**
- `sendChatMessage(content: string)` - Send text message in Chat mode
- `sendVoiceNoteMessage(content: string)` - Send text message in Voice Note mode
- `confirmChatFunctionCall(callId, name, args)` - Confirm function in Chat mode
- `confirmVoiceNoteFunctionCall(callId, name, args)` - Confirm function in Voice Note mode

**Callbacks:**
- `onChatResponse(content, timestamp)` - Receive text response
- `onVoiceNoteResponse(audioData, transcript, timestamp)` - Receive audio response
- `onFunctionCallConfirmationRequired(confirmation)` - Request user confirmation

### Server-Side (websocket-server.ts)

**Event Handlers:**
- `chat_message` → Process with `processChatMessage()`
- `voice_note_message` → Process with `processVoiceNoteMessage()`
- `chat_function_confirmed` → Execute with `executeConfirmedChatFunction()`
- `voice_note_function_confirmed` → Execute with `executeConfirmedVoiceNoteFunction()`

**Response Types:**
- `chat_response` - Text response with optional function results
- `voice_note_response` - Audio data (base64) + transcript text
- `function_call_confirmation_required` - Request approval for mutating operations
- `error` - Error messages with user-friendly text

---

## Function Calling

Both Chat Mode and Voice Note Mode support the same function calling capabilities:

**Supported Functions:**
- Account queries (balances, transactions)
- Invoice operations (draft, post, search)
- Bill operations (draft, post, search)
- Journal entry operations (draft, post, search)
- Payment recording
- Customer/vendor queries
- Document processing
- And more...

**Permission Validation:**
- All functions are validated against user's RBAC permissions
- Authority-aware system prompts restrict AI suggestions
- Permission denials are communicated professionally to user

**Confirmation Protocol:**
- READ_ONLY operations execute automatically
- MODIFY/CRITICAL operations require user confirmation
- Plan is presented before execution (impact level, steps, expected outcome)
- User can approve or cancel each operation

---

## TTS Configuration

**Model:** `tts-1` (standard quality, faster, cheaper)
**Voice:** `alloy` (neutral, clear voice)
**Format:** MP3 audio, base64 encoded
**Speed:** 1.0x (normal speaking rate)

**Future Enhancements:**
- User-selectable voice options (alloy, echo, fable, onyx, nova, shimmer)
- Quality toggle (tts-1 vs tts-1-hd)
- Speed adjustment (0.25x to 4.0x)
- Batch TTS generation for longer responses

---

## Chat History Management

**Chat Mode:**
- History persisted in localStorage per tenant
- Loaded on widget mount
- Cleared when switching away from Chat mode
- Includes system prompt with authority context

**Voice Note Mode:**
- History maintained in WebSocket connection state
- Not persisted (ephemeral session)
- Used for context in multi-turn conversations
- Cleared when WebSocket disconnects

---

## Error Handling

**Chat Mode:**
- Network errors: User-friendly message with retry suggestion
- Permission errors: Professional denial with escalation path
- Function errors: AI explains what went wrong

**Voice Note Mode:**
- TTS errors: Fallback to error message as audio
- Audio playback errors: Visual notification
- Network errors: Queue preserved for retry

---

## Testing Checklist

- [x] Chat Mode sends text messages
- [x] Chat Mode receives text responses
- [x] Chat Mode function calling works
- [x] Chat Mode confirmation dialogs appear
- [x] Chat Mode history persists
- [x] Voice Note Mode sends text messages
- [x] Voice Note Mode receives audio responses
- [x] Voice Note Mode audio playback works
- [x] Voice Note Mode queue management works
- [x] Voice Note Mode function calling works
- [x] Mode Switcher shows all three modes
- [x] Mode Switcher adapts UI correctly
- [x] Mode Switcher clears state on switch
- [x] WebSocket reconnection works
- [x] Permission validation works in both modes
- [x] Error messages are user-friendly

---

## Files Modified/Created

**Created:**
- `server/ai-copilot/chat-handler.ts` - Chat and Voice Note message processing
- `server/ai-copilot/tts-handler.ts` - TTS utility functions
- `client/src/shared/components/ai-copilot/chat-interface.tsx` - Chat UI component
- `client/src/shared/components/ai-copilot/voice-note-interface.tsx` - Voice Note UI component
- `client/src/shared/lib/ai-copilot/tts-audio-manager.ts` - Audio queue manager

**Modified:**
- `client/src/shared/components/ai-copilot/ai-copilot-widget.tsx` - Added mode switcher
- `client/src/shared/components/ai-copilot/types.ts` - Added mode types
- `client/src/shared/lib/ai-copilot/websocket-client.ts` - Added chat/voice-note methods
- `server/ai-copilot/websocket-server.ts` - Added chat/voice-note handlers

---

## Performance Considerations

**Chat Mode:**
- Instant text responses (no audio generation delay)
- Efficient message streaming
- Minimal memory footprint

**Voice Note Mode:**
- TTS generation: ~1-2 seconds per response
- Audio files cached in queue for replay
- Base64 encoding overhead acceptable for user experience

**Mode Switching:**
- State is cleared to prevent memory leaks
- Audio manager is properly cleaned up
- No performance impact from mode changes

---

## Accessibility

**Chat Mode:**
- Keyboard navigation (Enter to send, Shift+Enter for newline)
- Screen reader friendly
- Focus management

**Voice Note Mode:**
- Play/Pause/Stop controls keyboard accessible
- Audio status announced to screen readers
- Visual indicators for playing state

**Mode Switcher:**
- Clear button labels with icons
- Active mode highlighted
- Settings panel keyboard accessible

---

## Future Enhancements

1. **Multi-language Support:** TTS in different languages
2. **Voice Selection:** User preference for TTS voice
3. **Audio Export:** Download audio responses
4. **Transcript Export:** Save chat history as file
5. **Smart Suggestions:** AI suggests optimal mode based on query
6. **Background Audio:** Play audio while browsing other pages
7. **Offline Queue:** Cache audio responses for offline playback

---

## Conclusion

The Chat Mode and Voice Note Mode implementation provides users with flexible ways to interact with the AI Copilot:

- **Chat Mode** for quick text-based queries and detailed responses
- **Voice Note Mode** for audio-based consumption while working
- **Live Voice Mode** for hands-free, real-time interaction

All modes share the same powerful function calling capabilities and permission-aware execution, ensuring a secure and consistent user experience across all interaction methods.
