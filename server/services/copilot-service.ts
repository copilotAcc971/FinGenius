import { db } from '../db';
import { copilotConversations, copilotMessages, copilotToolCalls, insertCopilotConversationSchema, insertCopilotMessageSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { ProviderService } from '../mcp/provider-service';

export class CopilotService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async createConversation(
    tenantId: string,
    userId: string,
    title: string,
    model: string = 'openai',
    userPermissions: string[] = []
  ) {
    const result = await db
      .insert(copilotConversations)
      .values({
        tenantId,
        userId,
        title,
        model,
        systemPrompt: this.buildSystemPrompt(userPermissions),
        metadata: { userPermissions },
      })
      .returning();
    return result[0];
  }

  async addMessage(
    tenantId: string,
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokenCount?: number,
    cost?: string
  ) {
    const result = await db
      .insert(copilotMessages)
      .values({
        tenantId,
        conversationId,
        role,
        content,
        tokenCount,
        cost: cost ? parseFloat(cost) : undefined,
      })
      .returning();
    return result[0];
  }

  async getConversation(tenantId: string, conversationId: string) {
    const conv = await db
      .select()
      .from(copilotConversations)
      .where(
        and(
          eq(copilotConversations.tenantId, tenantId),
          eq(copilotConversations.id, conversationId)
        )
      )
      .limit(1);
    return conv[0];
  }

  async getMessages(tenantId: string, conversationId: string, limit: number = 50) {
    const messages = await db
      .select()
      .from(copilotMessages)
      .where(
        and(
          eq(copilotMessages.tenantId, tenantId),
          eq(copilotMessages.conversationId, conversationId)
        )
      )
      .orderBy(copilotMessages.createdAt)
      .limit(limit);
    return messages;
  }

  async chat(
    tenantId: string,
    userId: string,
    conversationId: string,
    userMessage: string,
    userPermissions: string[] = []
  ) {
    try {
      // Get conversation and messages
      const conversation = await this.getConversation(tenantId, conversationId);
      if (!conversation) throw new Error('Conversation not found');

      const messages = await this.getMessages(tenantId, conversationId);

      // Add user message
      const userMsg = await this.addMessage(tenantId, conversationId, 'user', userMessage);

      // Build messages for API
      const apiMessages = messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
      apiMessages.push({ role: 'user', content: userMessage });

      // Call OpenAI with authority-aware system prompt
      const systemPrompt = this.buildSystemPrompt(userPermissions);
      const response = await this.openai.chat.completions.create({
        model: conversation.model === 'openai' ? 'gpt-4o' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...apiMessages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const assistantContent = response.choices[0].message.content || '';
      const tokenCount = response.usage?.total_tokens || 0;

      // Add assistant response
      const assistantMsg = await this.addMessage(
        tenantId,
        conversationId,
        'assistant',
        assistantContent,
        tokenCount
      );

      return {
        conversationId,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        tokensUsed: tokenCount,
      };
    } catch (error) {
      console.error('[Copilot] Chat error:', error);
      throw error;
    }
  }

  private buildSystemPrompt(userPermissions: string[]): string {
    const permissionList = userPermissions.join(', ') || 'no permissions';
    return `You are an AI Copilot for an advanced accounting application. 
    
    You have authority to perform actions based on the following permissions: ${permissionList}
    
    IMPORTANT - Authority-Aware Response Protocol:
    1. Before suggesting ANY mutating action (create, update, delete), verify the user has the required permission
    2. If permission is missing, respond: "You don't have permission to perform this action"
    3. For sensitive operations, always confirm: "Do you want to [action]? This will [consequence]"
    4. For financial calculations, always show your reasoning step-by-step
    5. For ambiguous requests, ask for clarification
    
    Available abilities:
    - Financial analysis and reporting
    - Document understanding and extraction
    - Invoice/bill creation and management
    - Account reconciliation guidance
    - Compliance checking
    - Tax computation assistance
    
    Be helpful, precise, and always consider the user's permission level.`;
  }

  async listConversations(tenantId: string, userId: string) {
    const convs = await db
      .select()
      .from(copilotConversations)
      .where(
        and(
          eq(copilotConversations.tenantId, tenantId),
          eq(copilotConversations.userId, userId)
        )
      )
      .orderBy(copilotConversations.updatedAt);
    return convs;
  }
}

export const copilotService = new CopilotService();
