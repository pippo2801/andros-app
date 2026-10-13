import type { ChatMessageData } from './ollama';

export const CHAT_SESSIONS_KEY = 'andros.chat.sessions.v1';
export const LEGACY_HISTORY_KEY = 'andros.chat.history.v1';
export const MAX_PINNED_CHATS = 30;

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessageData[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export interface ChatSessionState {
  activeId: string;
  sessions: ChatSession[];
}

const WELCOME_MESSAGE: ChatMessageData = {
  role: 'assistant',
  content: 'Ciao! Sono Andros, il tuo assistente personale. Posso aiutarti a ragionare, scrivere, programmare e lavorare sui tuoi progetti. Per rispondere uso il modello Ollama configurato nelle impostazioni.',
};

function isMessage(value: unknown): value is ChatMessageData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string';
}

function validSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    Array.isArray(item.messages) && item.messages.every(isMessage) &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number' &&
    typeof item.pinned === 'boolean';
}

export function makeChatTitle(messages: ChatMessageData[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  if (!firstUserMessage) return 'Nuova conversazione';
  const normalized = firstUserMessage.content.trim().replace(/\s+/g, ' ');
  return normalized.length > 56 ? `${normalized.slice(0, 53)}…` : normalized;
}

export function createChatSession(messages: ChatMessageData[] = [WELCOME_MESSAGE]): ChatSession {
  const now = Date.now();
  return {
    id: `andros-chat-${now}-${Math.random().toString(36).slice(2, 9)}`,
    title: makeChatTitle(messages),
    messages: [...messages],
    createdAt: now,
    updatedAt: now,
    pinned: false,
  };
}

export function loadChatSessionState(): ChatSessionState {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatSessionState>;
      if (Array.isArray(parsed.sessions)) {
        const sessions = parsed.sessions.filter(validSession)
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
          .map((session, index) => ({ ...session, pinned: index < MAX_PINNED_CHATS && session.pinned }));
        if (sessions.length) {
          const activeId = sessions.some((session) => session.id === parsed.activeId)
            ? parsed.activeId as string
            : sessions[0].id;
          return { activeId, sessions };
        }
      }
    }
  } catch (error) {
    console.warn('Sessioni Andros non disponibili, provo la migrazione della cronologia:', error);
  }

  let legacyMessages: ChatMessageData[] = [WELCOME_MESSAGE];
  try {
    const legacy = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const safeMessages = parsed.filter(isMessage);
        if (safeMessages.length) legacyMessages = safeMessages;
      }
    }
  } catch (error) {
    console.warn('Cronologia precedente non leggibile:', error);
  }

  const initial = createChatSession(legacyMessages);
  return { activeId: initial.id, sessions: [initial] };
}

export function saveChatSessionState(state: ChatSessionState): void {
  const sessions = state.sessions
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify({ activeId: state.activeId, sessions }));
}

export function updateChatSession(
  sessions: ChatSession[],
  id: string,
  messages: ChatMessageData[],
): ChatSession[] {
  const now = Date.now();
  return sessions.map((session) => session.id !== id ? session : {
    ...session,
    messages: [...messages],
    title: messages.some((message) => message.role === 'user')
      ? (session.title === 'Nuova conversazione' || session.messages.every((message) => message.role !== 'user')
          ? makeChatTitle(messages)
          : session.title)
      : 'Nuova conversazione',
    updatedAt: now,
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

export function togglePinnedChat(sessions: ChatSession[], id: string): ChatSession[] {
  const target = sessions.find((session) => session.id === id);
  if (!target) return sessions;
  if (!target.pinned && sessions.filter((session) => session.pinned).length >= MAX_PINNED_CHATS) {
    throw new Error(`Puoi fissare al massimo ${MAX_PINNED_CHATS} conversazioni.`);
  }
  return sessions.map((session) => session.id === id ? { ...session, pinned: !session.pinned, updatedAt: Date.now() } : session)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

export function deleteChatSession(
  sessions: ChatSession[],
  id: string,
  activeId: string,
): ChatSessionState {
  const remaining = sessions.filter((session) => session.id !== id);
  const safeSessions = remaining.length ? remaining : [createChatSession()];
  const nextActiveId = activeId === id
    ? safeSessions[0].id
    : (safeSessions.some((session) => session.id === activeId) ? activeId : safeSessions[0].id);
  return { activeId: nextActiveId, sessions: safeSessions };
}

export function renameChatSession(sessions: ChatSession[], id: string, title: string): ChatSession[] {
  const normalized = title.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!normalized) throw new Error('Il titolo della conversazione non può essere vuoto.');
  return sessions.map((session) => session.id === id
    ? { ...session, title: normalized, updatedAt: Date.now() }
    : session)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}
