import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

const quickPrompts = ['Cheaper', 'Kid friendly', 'Reduce walking', 'Rainy day', 'More museums'];

export default function ChatPanel() {
  const { isOpen, messages, isLoading, toggleChat, closeChat, sendMessage } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleChat}
            className="chat-fab"
            aria-label="Open chat"
          >
            <MessageCircle size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="chat-panel"
          >
            {/* Header */}
            <div className="chat-header">
              <div className="chat-header-title">
                <Sparkles size={16} style={{ color: 'var(--primary-500)' }} />
                Chat
              </div>
              <button onClick={closeChat} className="icon-btn"><X size={16} /></button>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-empty">
                  <Sparkles size={24} style={{ color: 'var(--primary-300)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--navy-700)' }}>How can I help?</p>
                  <p style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 4 }}>Ask me to tweak your trip, or use quick prompts below.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    {quickPrompts.map((p) => (
                      <button key={p} onClick={() => sendMessage(p)} className="quick-chip">{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.filter((m) => m.role !== 'system').map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div className="chat-typing">
                    <span className="chat-typing-dot" />
                    <span className="chat-typing-dot" />
                    <span className="chat-typing-dot" />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-bar">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="chat-input"
              />
              <button onClick={handleSend} disabled={!input.trim() || isLoading} className="chat-send-btn">
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
