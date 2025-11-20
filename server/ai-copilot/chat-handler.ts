import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { accountingFunctions } from './functions';
import { functionHandlers } from './function-handlers';
import { getKnowledgeBaseService } from './knowledge-base';
import { generateAuthorityAwareSystemPrompt, type UserAuthorityContext } from './authority-context';
import { validateFunctionPermission } from './function-permissions';

export interface ChatContext {
  tenantId: string;
  userId: string;
  chatHistory: ChatCompletionMessageParam[];
  authorityContext: UserAuthorityContext;
}

export interface ChatResponse {
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    args: any;
  };
  requiresConfirmation: boolean;
  ragSources?: any[];
}

export interface VoiceNoteResponse {
  audioData: string;
  transcript: string;
  toolCall?: {
    id: string;
    name: string;
    args: any;
  };
  requiresConfirmation: boolean;
}

export interface FunctionExecutionResult {
  content?: string;
  audioData?: string;
  transcript?: string;
  error?: string;
}

/**
 * Initialize chat history with authority-aware system prompt
 */
export function initializeChatHistory(authorityContext: UserAuthorityContext): ChatCompletionMessageParam[] {
  const systemPrompt = generateAuthorityAwareSystemPrompt(authorityContext);
  return [{ role: 'system', content: systemPrompt }];
}

/**
 * Process a chat message using OpenAI Chat Completions API with function calling and RAG
 */
export async function processChatMessage(
  message: string,
  context: ChatContext
): Promise<ChatResponse> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // RAG Retrieval - Query knowledge base for relevant documents
  let ragContext = '';
  let ragSources: any[] = [];
  
  try {
    const knowledgeBase = getKnowledgeBaseService();
    const { contextString, sources } = await knowledgeBase.retrieveRelevantContext(
      context.tenantId,
      message,
      {
        limit: 5,
        similarityThreshold: 0.7,
      }
    );
    
    if (contextString) {
      ragContext = contextString;
      ragSources = sources;
      console.log(`[Chat Handler] Found ${sources.length} relevant documents for query`);
    }
  } catch (error) {
    console.error('[Chat Handler] RAG retrieval error:', error);
  }

  // Add user message to history (with RAG context if available)
  const userMessage = ragContext 
    ? `${message}\n\n${ragContext}`
    : message;

  context.chatHistory.push({
    role: 'user',
    content: userMessage
  });

  // Call OpenAI Chat Completions API
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: context.chatHistory,
    tools: accountingFunctions as ChatCompletionTool[],
    temperature: 0.8,
  });

  const assistantMessage = completion.choices[0].message;
  context.chatHistory.push(assistantMessage);

  // Check if there are function calls
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const toolCall = assistantMessage.tool_calls[0];
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    console.log('[Chat Handler] Function call:', functionName);

    // Determine which functions require user confirmation
    const requiresConfirmation = [
      'draft_invoice', 'post_invoice', 
      'draft_bill', 'post_bill', 
      'draft_journal_entry', 'post_journal_entry', 
      'record_payment'
    ].includes(functionName);

    return {
      content: assistantMessage.content || undefined,
      toolCall: {
        id: toolCall.id,
        name: functionName,
        args,
      },
      requiresConfirmation,
      ragSources: ragSources.length > 0 ? ragSources : undefined,
    };
  }

  // No function calls, return text response
  return {
    content: assistantMessage.content || 'I can help you with your accounting tasks.',
    requiresConfirmation: false,
    ragSources: ragSources.length > 0 ? ragSources : undefined,
  };
}

/**
 * Process a voice note message (text input, audio output with TTS)
 */
export async function processVoiceNoteMessage(
  message: string,
  context: ChatContext
): Promise<VoiceNoteResponse> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Add user message to history
  context.chatHistory.push({
    role: 'user',
    content: message
  });

  // Call OpenAI Chat Completions API
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: context.chatHistory,
    tools: accountingFunctions as ChatCompletionTool[],
    temperature: 0.8,
  });

  const assistantMessage = completion.choices[0].message;
  context.chatHistory.push(assistantMessage);

  // Check if there are function calls
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const toolCall = assistantMessage.tool_calls[0];
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    console.log('[Voice Note Handler] Function call:', functionName);

    // Determine which functions require user confirmation
    const requiresConfirmation = [
      'draft_invoice', 'post_invoice', 
      'draft_bill', 'post_bill', 
      'draft_journal_entry', 'post_journal_entry', 
      'record_payment'
    ].includes(functionName);

    if (requiresConfirmation) {
      // Return for confirmation (TTS will be generated after confirmation)
      return {
        audioData: '',
        transcript: assistantMessage.content || '',
        toolCall: {
          id: toolCall.id,
          name: functionName,
          args,
        },
        requiresConfirmation: true,
      };
    } else {
      // Auto-execute read-only functions
      const result = await executeFunctionCall(toolCall.id, functionName, args, context);
      return {
        audioData: result.audioData!,
        transcript: result.transcript!,
        requiresConfirmation: false,
      };
    }
  }

  // No function calls, generate TTS response
  const textToSpeak = assistantMessage.content || 'I can help you with your accounting tasks.';
  
  const ttsResponse = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'alloy',
    input: textToSpeak,
  });

  const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
  const base64Audio = audioBuffer.toString('base64');

  return {
    audioData: base64Audio,
    transcript: textToSpeak,
    requiresConfirmation: false,
  };
}

/**
 * Execute a confirmed function call and get follow-up response (for chat mode)
 */
export async function executeConfirmedChatFunction(
  toolCallId: string,
  functionName: string,
  args: any,
  context: ChatContext
): Promise<FunctionExecutionResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // PERMISSION VALIDATION - Check before execution
    const permissionCheck = await validateFunctionPermission(
      functionName,
      context.userId,
      context.tenantId
    );

    if (!permissionCheck.allowed) {
      // Permission denied - return professional error message
      throw new Error(permissionCheck.message || 'You do not have permission to perform this action.');
    }

    // Execute the function
    const handler = functionHandlers[functionName];
    if (!handler) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    const result = await handler(args, {
      tenantId: context.tenantId,
      userId: context.userId,
    });

    // Add function result to chat history
    context.chatHistory.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: JSON.stringify(result)
    });

    // Get AI's follow-up response
    const followUpCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: context.chatHistory,
      tools: accountingFunctions as ChatCompletionTool[],
      temperature: 0.8,
    });

    const followUpMessage = followUpCompletion.choices[0].message;
    context.chatHistory.push(followUpMessage);

    return {
      content: followUpMessage.content || 'Done.',
    };

  } catch (error: any) {
    console.error('[Chat Handler] Function execution error:', error);
    return {
      error: error.message || 'Function execution failed',
      content: `I encountered an error: ${error.message}. Please try again.`,
    };
  }
}

/**
 * Execute a confirmed function call and get TTS response (for voice note mode)
 */
export async function executeConfirmedVoiceNoteFunction(
  toolCallId: string,
  functionName: string,
  args: any,
  context: ChatContext
): Promise<FunctionExecutionResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // PERMISSION VALIDATION - Check before execution
    const permissionCheck = await validateFunctionPermission(
      functionName,
      context.userId,
      context.tenantId
    );

    if (!permissionCheck.allowed) {
      // Permission denied - return professional error message
      throw new Error(permissionCheck.message || 'You do not have permission to perform this action.');
    }

    // Execute the function
    const handler = functionHandlers[functionName];
    if (!handler) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    const result = await handler(args, {
      tenantId: context.tenantId,
      userId: context.userId,
    });

    // Add function result to chat history
    context.chatHistory.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: JSON.stringify(result)
    });

    // Get AI's follow-up response
    const followUpCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: context.chatHistory,
      tools: accountingFunctions as ChatCompletionTool[],
      temperature: 0.8,
    });

    const followUpMessage = followUpCompletion.choices[0].message;
    context.chatHistory.push(followUpMessage);

    const textToSpeak = followUpMessage.content || 'Done.';
    
    // Generate TTS
    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: textToSpeak,
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const base64Audio = audioBuffer.toString('base64');

    return {
      audioData: base64Audio,
      transcript: textToSpeak,
    };

  } catch (error: any) {
    console.error('[Voice Note Handler] Function execution error:', error);
    
    const errorText = `I encountered an error: ${error.message}. Please try again.`;
    
    // Generate error TTS
    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: errorText,
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const base64Audio = audioBuffer.toString('base64');

    return {
      error: error.message,
      audioData: base64Audio,
      transcript: errorText,
    };
  }
}

/**
 * Execute a function call without confirmation (for auto-executable functions)
 */
async function executeFunctionCall(
  toolCallId: string,
  functionName: string,
  args: any,
  context: ChatContext
): Promise<FunctionExecutionResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // PERMISSION VALIDATION - Check before execution
    const permissionCheck = await validateFunctionPermission(
      functionName,
      context.userId,
      context.tenantId
    );

    if (!permissionCheck.allowed) {
      // Permission denied - return professional error message
      throw new Error(permissionCheck.message || 'You do not have permission to perform this action.');
    }

    const handler = functionHandlers[functionName];
    if (!handler) {
      throw new Error(`Unknown function: ${functionName}`);
    }

    const result = await handler(args, {
      tenantId: context.tenantId,
      userId: context.userId,
    });

    context.chatHistory.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: JSON.stringify(result)
    });

    const followUpCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: context.chatHistory,
      tools: accountingFunctions as ChatCompletionTool[],
      temperature: 0.8,
    });

    const followUpMessage = followUpCompletion.choices[0].message;
    context.chatHistory.push(followUpMessage);

    const textToSpeak = followUpMessage.content || 'Done.';
    
    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: textToSpeak,
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const base64Audio = audioBuffer.toString('base64');

    return {
      audioData: base64Audio,
      transcript: textToSpeak,
    };

  } catch (error: any) {
    console.error('[Chat Handler] Auto-execute error:', error);
    
    const errorText = `I encountered an error: ${error.message}. Please try again.`;
    
    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: errorText,
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const base64Audio = audioBuffer.toString('base64');

    return {
      error: error.message,
      audioData: base64Audio,
      transcript: errorText,
    };
  }
}
