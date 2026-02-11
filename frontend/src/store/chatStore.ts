import { create } from 'zustand';
import type { ChatMessage, EditScope } from '@/types';

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  editScope: EditScope | null;
  isLoading: boolean;

  openChat: (scope?: EditScope) => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

const quickResponses: Record<string, string> = {
  cheaper: "I've found some more budget-friendly alternatives. Here are updated options with lower price ranges while keeping quality in mind.",
  'kid friendly': "I've adjusted the recommendations to be more family-friendly, with activities suitable for children and family-oriented accommodations.",
  'reduce walking': "I've reorganized the itinerary to minimize walking distances, grouping nearby attractions together and adding transport suggestions.",
  'rainy day': "I've added indoor alternatives for each day in case of rain, including museums, covered markets, and cozy cafés.",
  'more museums': "I've added more museum visits to your itinerary, balancing cultural exploration with your existing plans.",
};

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  editScope: null,
  isLoading: false,

  openChat: (scope) => {
    const msgs: ChatMessage[] = [];
    if (scope) {
      msgs.push({
        id: 'ctx_' + Date.now(),
        role: 'system',
        content: `Editing scope: ${scope.section}${scope.dayNumber ? ` - Day ${scope.dayNumber}` : ''}${scope.itemId ? ` - Item ${scope.itemId}` : ''}`,
        timestamp: new Date().toISOString(),
        editScope: scope,
      });
    }
    set({ isOpen: true, editScope: scope || null, messages: [...get().messages, ...msgs] });
  },

  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),

  sendMessage: async (content: string) => {
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      editScope: get().editScope || undefined,
    };
    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true }));

    await new Promise((r) => setTimeout(r, 1500));

    const lowerContent = content.toLowerCase();
    let responseText = "I've noted your request. Let me adjust the trip plan accordingly. The changes will be reflected in your dashboard shortly.";
    for (const [key, resp] of Object.entries(quickResponses)) {
      if (lowerContent.includes(key)) {
        responseText = resp;
        break;
      }
    }

    const assistantMsg: ChatMessage = {
      id: 'msg_' + (Date.now() + 1),
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, assistantMsg], isLoading: false }));
  },

  clearMessages: () => set({ messages: [] }),
}));
