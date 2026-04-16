export type ConversationStatus = 'active' | 'archived';
export type MessageRole = 'user' | 'assistant';

export interface Conversation {
  id: string;
  title: string;
  status: ConversationStatus;
  personaId: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon: string | null;
  sortOrder: number;
}

export interface PersonaListItem {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  sortOrder: number;
}

export interface ProviderConfig {
  id: string;
  providerName: string;
  modelId: string;
  displayName: string;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
