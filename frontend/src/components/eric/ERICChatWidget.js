/**
 * ERIC Chat Widget
 * Floating chat interface for ERIC AI Assistant
 * Supports text chat and image analysis
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, X, Send, Loader2, Minimize2, Maximize2,
  Trash2, Settings, ChevronLeft, Sparkles, Image, Paperclip
} from 'lucide-react';
import './ERICChatWidget.css';

const ERICChatWidget = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations when widget opens
  useEffect(() => {
    if (isOpen && user) {
      loadConversations();
    }
  }, [isOpen, user]);

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/agent/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/agent/conversations/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentConversation(data);
        setMessages(data.messages || []);
        setShowConversationList(false);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const startNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    setShowConversationList(false);
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (!window.confirm('Удалить этот разговор?')) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/agent/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversation?.id === conversationId) {
          startNewConversation();
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || loading) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: currentConversation?.id || null
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentConversation({ id: data.conversation_id });
        setMessages(prev => [...prev, data.message]);
        loadConversations(); // Refresh conversation list
      } else {
        const errorData = await response.json();
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Ошибка: ${errorData.detail || 'Не удалось получить ответ'}`,
          created_at: new Date().toISOString()
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Извините, произошла ошибка соединения. Попробуйте позже.',
        created_at: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button - Always rendered, visibility controlled via CSS */}
      <button 
        className={`eric-widget-button ${isOpen ? 'hidden' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title="Поговорить с ERIC"
        type="button"
        data-testid="eric-widget-button"
      >
        <img 
          src="/eric-avatar.jpg" 
          alt="ERIC" 
          className="eric-button-avatar" 
          style={{ pointerEvents: 'none' }}
        />
        <span className="eric-button-badge" style={{ pointerEvents: 'none' }}>AI</span>
      </button>

      {/* Chat Window */}
      <div 
        className={`eric-chat-window ${isMinimized ? 'minimized' : ''} ${isOpen ? 'open' : 'closed'}`}
        data-testid="eric-chat-window"
      >
          {/* Header */}
          <div className="eric-chat-header">
            <div className="eric-header-left">
              {showConversationList ? (
                <button 
                  className="eric-back-btn"
                  onClick={() => setShowConversationList(false)}
                >
                  <ChevronLeft size={20} />
                </button>
              ) : (
                <img src="/eric-avatar.jpg" alt="ERIC" className="eric-header-avatar" />
              )}
              <div className="eric-header-info">
                <h4>{showConversationList ? 'История' : 'ERIC'}</h4>
                <span className="eric-status">
                  {showConversationList ? `${conversations.length} разговоров` : 'Онлайн'}
                </span>
              </div>
            </div>
            <div className="eric-header-actions">
              {!showConversationList && (
                <>
                  <button 
                    className="eric-action-btn"
                    onClick={() => setShowConversationList(true)}
                    title="История"
                  >
                    <MessageCircle size={18} />
                  </button>
                  <button 
                    className="eric-action-btn"
                    onClick={startNewConversation}
                    title="Новый разговор"
                  >
                    <Sparkles size={18} />
                  </button>
                </>
              )}
              <button 
                className="eric-action-btn"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Развернуть' : 'Свернуть'}
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              <button 
                className="eric-action-btn close"
                onClick={() => setIsOpen(false)}
                title="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <>
              {showConversationList ? (
                /* Conversation List */
                <div className="eric-conversation-list">
                  <button 
                    className="eric-new-chat-btn"
                    onClick={startNewConversation}
                  >
                    <Sparkles size={18} />
                    Новый разговор
                  </button>
                  
                  {conversations.length === 0 ? (
                    <div className="eric-empty-conversations">
                      <MessageCircle size={32} />
                      <p>Нет сохранённых разговоров</p>
                    </div>
                  ) : (
                    conversations.map(conv => (
                      <div 
                        key={conv.id}
                        className={`eric-conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                        onClick={() => loadConversation(conv.id)}
                      >
                        <div className="eric-conv-info">
                          <h5>{conv.title}</h5>
                          <span>{formatDate(conv.updated_at)}</span>
                        </div>
                        <button 
                          className="eric-conv-delete"
                          onClick={(e) => deleteConversation(conv.id, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Chat Messages */
                <>
                  <div className="eric-messages">
                    {messages.length === 0 ? (
                      <div className="eric-welcome">
                        <img src="/eric-avatar.jpg" alt="ERIC" className="eric-welcome-avatar" />
                        <h3>Привет! Я ERIC 👋</h3>
                        <p>Я твой персональный ИИ-помощник. Могу помочь с:</p>
                        <div className="eric-welcome-capabilities">
                          <span>👨‍👩‍👧‍👦 Семейными делами</span>
                          <span>💰 Финансами</span>
                          <span>🛒 Поиском услуг</span>
                          <span>🤝 Сообществом</span>
                        </div>
                        <p className="eric-welcome-hint">Просто напиши, чем могу помочь!</p>
                      </div>
                    ) : (
                      messages.map(msg => (
                        <div 
                          key={msg.id}
                          className={`eric-message ${msg.role}`}
                        >
                          {msg.role === 'assistant' && (
                            <img src="/eric-avatar.jpg" alt="ERIC" className="eric-msg-avatar" />
                          )}
                          <div className="eric-msg-content">
                            <p>{msg.content}</p>
                            <span className="eric-msg-time">{formatTime(msg.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {loading && (
                      <div className="eric-message assistant">
                        <img src="/eric-avatar.jpg" alt="ERIC" className="eric-msg-avatar" />
                        <div className="eric-msg-content typing">
                          <div className="eric-typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="eric-input-wrapper">
                    <textarea
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Напишите сообщение..."
                      rows={1}
                      disabled={loading}
                    />
                    <button 
                      className="eric-send-btn"
                      onClick={sendMessage}
                      disabled={!message.trim() || loading}
                    >
                      {loading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
    </>
  );
};

export default ERICChatWidget;
