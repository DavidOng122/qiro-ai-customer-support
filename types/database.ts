export type MessageRole = 'user' | 'ai' | 'human_agent';
export type MessageStatus = 'resolved' | 'pending_human';
export type MessageSource = 'web' | 'whatsapp';

export interface Message {
  id: number;
  created_at: string;
  session_id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  source: MessageSource;
}

export interface SessionSummary {
  session_id: string;
  latest_message: string;
  latest_timestamp: string;
  has_pending: boolean;
  source: MessageSource;
  message_count: number;
}
