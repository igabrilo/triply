import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Pencil, Crown } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import UpgradeModal from '@components/ui/UpgradeModal';

const quickPrompts = ['Cheaper', 'Kid friendly', 'Reduce walking', 'Rainy day', 'More museums'];

export default function ChatPanel() {
  const { isOpen, messages, isLoading, editScope, editLimitReached, toggleChat, closeChat, sendMessage } = useChatStore();
  const [input, setInput] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const isPremium = useAuthStore((s) => s.user?.plan === 'premium');
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

            {/* Context Banner */}
            {editScope?.contextSummary && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--primary-50)',
                borderBottom: '1px solid var(--primary-100)',
                fontSize: 12,
                color: 'var(--navy-700)',
                lineHeight: 1.5,
                maxHeight: 120,
                overflowY: 'auto',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontWeight: 600, color: 'var(--primary-700)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <Pencil size={11} />
                  Editing context
                </div>
                <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {editScope.contextSummary}
                </pre>
              </div>
            )}

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
            {editLimitReached && !isPremium ? (
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--navy-100)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--navy-500)', marginBottom: 8 }}>
                  You've used all 5 free edits for today.
                </p>
                <button
                  onClick={() => setShowUpgrade(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-500)',
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Crown size={14} /> Upgrade to Premium
                </button>
              </div>
            ) : (
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
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} feature="chat_edits" />
    </>
  );
}
