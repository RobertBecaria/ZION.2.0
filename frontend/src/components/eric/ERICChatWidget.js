/**
 * ERIC Chat Widget
 * Floating chat interface for ERIC AI Assistant
 * Supports text chat and image analysis
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, X, Send, Loader2, Minimize2, Maximize2,
  Trash2, Settings, ChevronLeft, Sparkles, Image, Paperclip, FolderOpen
} from 'lucide-react';
import './ERICChatWidget.css';
import MediaPicker from './MediaPicker';
import ERICSearchCards from './ERICSearchCards';

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
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedPlatformFile, setSelectedPlatformFile] = useState(null);
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

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      setSelectedPlatformFile(null); // Clear platform file if selecting local
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlatformMediaSelect = async (file) => {
    // Fetch the actual image from platform and convert to base64
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/media/${file.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
          setSelectedPlatformFile(file);
          setSelectedImage(null); // Clear local file if selecting platform
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Error loading platform media:', error);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setSelectedPlatformFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if ((!message.trim() && !selectedImage && !selectedPlatformFile) || loading) return;
    
    const hasAttachment = selectedImage || selectedPlatformFile;
    const fileName = selectedPlatformFile?.original_filename || selectedImage?.name || '';
    const messageContent = hasAttachment 
      ? `📷 ${message.trim() || 'Проанализируй это изображение'}${fileName ? ` (${fileName})` : ''}`
      : message;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      created_at: new Date().toISOString(),
      hasImage: hasAttachment,
      imagePreview: imagePreview
    };
    
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);
    
    try {
      const token = localStorage.getItem('zion_token');
      let response;
      
      if (hasAttachment) {
        let imageBase64;
        let mimeType;
        
        if (selectedImage) {
          // Convert local image to base64
          const reader = new FileReader();
          const imageBase64Promise = new Promise((resolve) => {
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(selectedImage);
          });
          imageBase64 = await imageBase64Promise;
          mimeType = selectedImage.type;
        } else if (selectedPlatformFile && imagePreview) {
          // Platform file - already have base64 from preview
          imageBase64 = imagePreview.split(',')[1];
          mimeType = selectedPlatformFile.mime_type || 'image/jpeg';
        }
        
        // Send chat with image
        response = await fetch(`${BACKEND_URL}/api/agent/chat-with-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: message.trim() || 'Проанализируй это изображение',
            image_base64: imageBase64,
            mime_type: mimeType,
            conversation_id: currentConversation?.id || null
          })
        });
        
        clearSelectedImage();
      } else {
        // Regular text chat with search capabilities
        response = await fetch(`${BACKEND_URL}/api/agent/chat-with-search`, {
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
      }
      
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
                            {msg.hasImage && msg.imagePreview && (
                              <img 
                                src={msg.imagePreview} 
                                alt="Attached" 
                                className="eric-msg-image"
                              />
                            )}
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

                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="eric-image-preview">
                      <img src={imagePreview} alt="Preview" />
                      <span className="eric-image-source">
                        {selectedPlatformFile ? `📁 ${selectedPlatformFile.original_filename}` : '📷 С устройства'}
                      </span>
                      <button 
                        className="eric-image-remove"
                        onClick={clearSelectedImage}
                        title="Удалить изображение"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Input */}
                  <div className="eric-input-wrapper">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                    />
                    <button 
                      className="eric-attach-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      title="Загрузить с устройства"
                    >
                      <Image size={20} />
                    </button>
                    <button 
                      className="eric-attach-btn eric-platform-btn"
                      onClick={() => setShowMediaPicker(true)}
                      disabled={loading}
                      title="Выбрать из Журнала"
                    >
                      <FolderOpen size={20} />
                    </button>
                    <textarea
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={imagePreview ? "Добавьте вопрос об изображении..." : "Напишите сообщение..."}
                      rows={1}
                      disabled={loading}
                    />
                    <button 
                      className="eric-send-btn"
                      onClick={sendMessage}
                      disabled={(!message.trim() && !selectedImage && !selectedPlatformFile) || loading}
                    >
                      {loading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handlePlatformMediaSelect}
        mediaType="all"
        title="Выберите из Журнала"
      />
    </>
  );
};

export default ERICChatWidget;
