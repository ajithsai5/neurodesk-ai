export interface ChatRequest {
  conversationId: string;
  message: string;
}

export interface StreamChatParams {
  providerName: string;
  modelId: string;
  systemPrompt: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
