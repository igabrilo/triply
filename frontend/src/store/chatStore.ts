import { create } from 'zustand';
import { chatAPI } from '@/services/api';
import { useTripStore } from '@/store/tripStore';
import type { ChatMessage, EditScope } from '@/types';

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  editScope: EditScope | null;
  isLoading: boolean;
  editLimitReached: boolean;

  openChat: (scope?: EditScope) => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  loadHistory: (tripId: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  editScope: null,
  isLoading: false,
  editLimitReached: false,

  openChat: (scope) => {
    const msgs: ChatMessage[] = [];
    if (scope) {
      const label = scope.section.charAt(0).toUpperCase() + scope.section.slice(1);
      const heading = `Editing: ${label}${scope.dayNumber ? ` — Day ${scope.dayNumber}` : ''}${scope.itemId ? ' (activity)' : ''}`;
      const content = scope.contextSummary
        ? `${heading}\n\n${scope.contextSummary}`
        : heading;
      msgs.push({
        id: 'ctx_' + Date.now(),
        role: 'system',
        content,
        timestamp: new Date().toISOString(),
        editScope: scope,
      });
    }
    set({ isOpen: true, editScope: scope || null, messages: [...get().messages, ...msgs] });
  },

  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),

  // -----------------------------------------------------------------
  // Load chat history from backend
  // -----------------------------------------------------------------
  loadHistory: async (tripId: string) => {
    try {
      const result = await chatAPI.getHistory(tripId);
      if (result.success && result.messages) {
        const messages: ChatMessage[] = result.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp || m.createdAt,
          editScope: m.scope
            ? { section: m.scope as EditScope['section'] }
            : undefined,
        }));
        set({ messages });
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  },

  // -----------------------------------------------------------------
  // Send message → real AI backend
  // -----------------------------------------------------------------
  sendMessage: async (content: string) => {
    const { editScope, editLimitReached } = get();
    const tripStore = useTripStore.getState();
    const tripId = tripStore.currentTrip?.id;

    if (!tripId || editLimitReached) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      editScope: editScope || undefined,
    };
    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true }));

    try {
      // Prepend context summary so the AI knows which specific item is being edited
      const enrichedContent = editScope?.contextSummary
        ? `[User is editing the following item]\n${editScope.contextSummary}\n\n[User's instruction]\n${content}`
        : content;
      const result = await chatAPI.sendMessage(tripId, enrichedContent, editScope || undefined);

      if (!result.success) {
        if (result.error === 'edit_limit_reached') {
          set({ editLimitReached: true });
          const limitMsg: ChatMessage = {
            id: 'msg_limit_' + Date.now(),
            role: 'assistant',
            content: 'You\'ve reached the free edit limit for this trip. Upgrade to continue editing.',
            timestamp: new Date().toISOString(),
          };
          set((s) => ({ messages: [...s.messages, limitMsg], isLoading: false }));
          return;
        }
        throw new Error(result.message || 'Chat request failed');
      }

      const assistantMsg: ChatMessage = {
        id: result.assistantMessage?.id || 'msg_' + (Date.now() + 1),
        role: 'assistant',
        content: result.assistantMessage?.content || 'Done.',
        timestamp: result.assistantMessage?.timestamp || new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, assistantMsg], isLoading: false }));

      // Apply the section update to the trip store so the dashboard refreshes
      if (result.updatedSection && result.sectionData) {
        tripStore.applySectionData(result.updatedSection, result.sectionData);
      }
    } catch (err: any) {
      console.error('Chat message failed:', err);
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, errorMsg], isLoading: false }));
    }
  },

  clearMessages: () => set({ messages: [], editLimitReached: false }),
}));
