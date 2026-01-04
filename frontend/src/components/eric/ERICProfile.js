/**
 * ERIC Profile Page
 * Full-featured interface for ERIC AI Assistant in THINGS module
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, Loader2, Trash2, Sparkles, Settings,
  Shield, ChevronRight, ToggleLeft, ToggleRight, AlertCircle,
  Users, DollarSign, MapPin, Heart, ShoppingBag, Calendar
} from 'lucide-react';

const ERICProfile = ({ user }) => {
  const [activeTab, setActiveTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [profile, setProfile] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load ERIC profile
  useEffect(() => {
    loadProfile();
    loadConversations();
    loadSettings();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

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

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/agent/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
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
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const startNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (!window.confirm('Удалить этот разговор?')) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      await fetch(`${BACKEND_URL}/api/agent/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (currentConversation?.id === conversationId) {
        startNewConversation();
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
        loadConversations();
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
        content: 'Извините, произошла ошибка соединения.',
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

  const toggleSetting = async (key) => {
    if (!settings) return;
    
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    setSavingSettings(true);
    
    try {
      const token = localStorage.getItem('zion_token');
      await fetch(`${BACKEND_URL}/api/agent/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [key]: newValue })
      });
    } catch (error) {
      setSettings(prev => ({ ...prev, [key]: !newValue }));
      console.error('Error updating setting:', error);
    } finally {
      setSavingSettings(false);
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

  const settingsItems = [
    { 
      key: 'allow_family_coordination', 
      label: 'Семейная координация', 
      icon: Users, 
      description: 'Доступ к данным семьи и домохозяйства',
      category: 'data'
    },
    { 
      key: 'allow_financial_analysis', 
      label: 'Финансовый анализ', 
      icon: DollarSign, 
      description: 'Анализ расходов и бюджета',
      category: 'data'
    },
    { 
      key: 'allow_service_recommendations', 
      label: 'Рекомендации услуг', 
      icon: ShoppingBag, 
      description: 'Поиск и подбор услуг через поиск',
      category: 'data'
    },
    { 
      key: 'allow_marketplace_suggestions', 
      label: 'Маркетплейс', 
      icon: ShoppingBag, 
      description: 'Рекомендации товаров',
      category: 'data'
    },
    { 
      key: 'allow_health_data_access', 
      label: 'Данные о здоровье', 
      icon: Heart, 
      description: 'Доступ к записям о здоровье',
      category: 'data'
    },
    { 
      key: 'allow_location_tracking', 
      label: 'Геолокация', 
      icon: MapPin, 
      description: 'Использование местоположения',
      category: 'data'
    },
    { 
      key: 'allow_work_context', 
      label: 'Рабочий контекст', 
      icon: Shield, 
      description: 'Анализ документов из раздела "Работа"',
      category: 'context'
    },
    { 
      key: 'allow_calendar_context', 
      label: 'Календарный контекст', 
      icon: Calendar, 
      description: 'Анализ событий и расписания',
      category: 'context'
    },
  ];

  // Group settings by category
  const dataSettings = settingsItems.filter(s => s.category === 'data');
  const contextSettings = settingsItems.filter(s => s.category === 'context');

  return (
    <div className="eric-profile-page">
      {/* Profile Header */}
      <div className="eric-profile-header">
        <div className="eric-profile-banner">
          <img src="/eric-avatar.jpg" alt="ERIC" className="eric-profile-avatar" />
          <div className="eric-profile-info">
            <h1>{profile?.name || 'ERIC'}</h1>
            <p className="eric-full-name">{profile?.full_name || 'Enhanced Reasoning Intelligence Core'}</p>
            <p className="eric-description">{profile?.description}</p>
            <div className="eric-status-badge">
              <span className="status-dot"></span>
              Онлайн
            </div>
          </div>
        </div>
        
        {/* Capabilities */}
        <div className="eric-capabilities">
          {profile?.capabilities?.map((cap, idx) => (
            <div key={idx} className="capability-card">
              <span className="capability-icon">{cap.icon}</span>
              <div className="capability-info">
                <h4>{cap.name}</h4>
                <p>{cap.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="eric-tabs">
        <button 
          className={`eric-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageCircle size={18} />
          Чат
        </button>
        <button 
          className={`eric-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Calendar size={18} />
          История ({conversations.length})
        </button>
        <button 
          className={`eric-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Shield size={18} />
          Приватность
        </button>
      </div>

      {/* Tab Content */}
      <div className="eric-tab-content">
        {activeTab === 'chat' && (
          <div className="eric-chat-full">
            <div className="eric-chat-messages">
              {messages.length === 0 ? (
                <div className="eric-chat-welcome">
                  <img src="/eric-avatar.jpg" alt="ERIC" />
                  <h3>Начните разговор с ERIC</h3>
                  <p>Задайте вопрос или попросите помощи с любой задачей</p>
                  <div className="suggested-prompts">
                    <button onClick={() => setMessage('Покажи мои расходы за этот месяц')}>
                      💰 Мои расходы за месяц
                    </button>
                    <button onClick={() => setMessage('Какие события в нашем районе?')}>
                      🎉 События поблизости
                    </button>
                    <button onClick={() => setMessage('Найди электрика в нашем районе')}>
                      🔧 Найти услуги
                    </button>
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`eric-chat-message ${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <img src="/eric-avatar.jpg" alt="ERIC" className="msg-avatar" />
                    )}
                    <div className="msg-bubble">
                      <p>{msg.content}</p>
                      <span className="msg-time">{formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
              
              {loading && (
                <div className="eric-chat-message assistant">
                  <img src="/eric-avatar.jpg" alt="ERIC" className="msg-avatar" />
                  <div className="msg-bubble typing">
                    <div className="typing-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            <div className="eric-chat-input">
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Напишите сообщение ERIC..."
                rows={1}
                disabled={loading}
              />
              <button 
                className="send-btn"
                onClick={sendMessage}
                disabled={!message.trim() || loading}
              >
                {loading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="eric-history">
            <button className="new-chat-btn" onClick={startNewConversation}>
              <Sparkles size={18} />
              Новый разговор
            </button>
            
            {conversations.length === 0 ? (
              <div className="empty-history">
                <MessageCircle size={48} />
                <h3>Нет сохранённых разговоров</h3>
                <p>Начните общение с ERIC, и история появится здесь</p>
              </div>
            ) : (
              <div className="conversation-list">
                {conversations.map(conv => (
                  <div 
                    key={conv.id}
                    className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                    onClick={() => {
                      loadConversation(conv.id);
                      setActiveTab('chat');
                    }}
                  >
                    <div className="conv-icon">
                      <MessageCircle size={20} />
                    </div>
                    <div className="conv-details">
                      <h4>{conv.title}</h4>
                      <span>{formatDate(conv.updated_at)}</span>
                    </div>
                    <button 
                      className="conv-delete"
                      onClick={(e) => deleteConversation(conv.id, e)}
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={20} className="conv-arrow" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="eric-settings">
            <div className="settings-header">
              <Shield size={24} />
              <div>
                <h3>Настройки приватности</h3>
                <p>Контролируйте, какие данные ERIC может использовать</p>
              </div>
            </div>
            
            <div className="settings-note">
              <AlertCircle size={18} />
              <p>ERIC использует только данные внутри платформы ZION.CITY и никогда не передаёт их третьим лицам.</p>
            </div>
            
            {/* Data Access Settings */}
            <div className="settings-section">
              <h4 className="settings-section-title">Доступ к данным</h4>
              <div className="settings-list">
                {dataSettings.map(item => (
                  <div key={item.key} className="setting-item">
                    <div className="setting-icon">
                      <item.icon size={20} />
                    </div>
                    <div className="setting-info">
                      <h4>{item.label}</h4>
                      <p>{item.description}</p>
                    </div>
                    <button 
                      className={`setting-toggle ${settings?.[item.key] ? 'on' : 'off'}`}
                      onClick={() => toggleSetting(item.key)}
                      disabled={savingSettings}
                    >
                      {settings?.[item.key] ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Context Settings */}
            <div className="settings-section">
              <h4 className="settings-section-title">Контекстный анализ</h4>
              <p className="settings-section-desc">ERIC может анализировать файлы с учётом раздела, из которого они загружены</p>
              <div className="settings-list">
                {contextSettings.map(item => (
                  <div key={item.key} className="setting-item">
                    <div className="setting-icon">
                      <item.icon size={20} />
                    </div>
                    <div className="setting-info">
                      <h4>{item.label}</h4>
                      <p>{item.description}</p>
                    </div>
                    <button 
                      className={`setting-toggle ${settings?.[item.key] ? 'on' : 'off'}`}
                      onClick={() => toggleSetting(item.key)}
                      disabled={savingSettings}
                    >
                      {settings?.[item.key] ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Conversation History Management */}
            <div className="settings-section">
              <h4 className="settings-section-title">История разговоров</h4>
              <div className="history-stats">
                <div className="history-stat">
                  <span className="stat-number">{conversations.length}</span>
                  <span className="stat-label">разговоров</span>
                </div>
                <div className="history-stat">
                  <span className="stat-number">{messages.length}</span>
                  <span className="stat-label">сообщений</span>
                </div>
              </div>
              {conversations.length > 0 && (
                <button 
                  className="clear-history-btn"
                  onClick={async () => {
                    if (window.confirm('Вы уверены, что хотите удалить всю историю разговоров?')) {
                      for (const conv of conversations) {
                        await deleteConversation(conv.id);
                      }
                      setConversations([]);
                      setMessages([]);
                      setCurrentConversation(null);
                    }
                  }}
                >
                  <Trash2 size={18} />
                  Очистить историю
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx="true">{`
        .eric-profile-page {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 16px 32px;
        }

        /* Header */
        .eric-profile-header {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
          margin-bottom: 24px;
        }

        .eric-profile-banner {
          background: linear-gradient(135deg, #FFD93D 0%, #FF9500 100%);
          padding: 32px;
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .eric-profile-avatar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .eric-profile-info h1 {
          margin: 0;
          font-size: 32px;
          color: #1c1e21;
        }

        .eric-full-name {
          margin: 4px 0 8px;
          font-size: 14px;
          color: rgba(0, 0, 0, 0.7);
        }

        .eric-description {
          margin: 0;
          font-size: 16px;
          color: #1c1e21;
        }

        .eric-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .eric-capabilities {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding: 24px;
          background: #f8f9fa;
        }

        .capability-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .capability-icon {
          font-size: 28px;
        }

        .capability-info h4 {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 600;
        }

        .capability-info p {
          margin: 0;
          font-size: 12px;
          color: #65676b;
        }

        /* Tabs */
        .eric-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .eric-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #65676b;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .eric-tab:hover {
          background: #f0f2f5;
        }

        .eric-tab.active {
          background: linear-gradient(135deg, #FFD93D 0%, #FF9500 100%);
          color: #1c1e21;
        }

        /* Tab Content */
        .eric-tab-content {
          background: white;
          border-radius: 16px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        /* Chat Full */
        .eric-chat-full {
          display: flex;
          flex-direction: column;
          height: 500px;
        }

        .eric-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #f8f9fa;
        }

        .eric-chat-welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          padding: 20px;
        }

        .eric-chat-welcome img {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          margin-bottom: 16px;
          border: 3px solid #FFD93D;
        }

        .eric-chat-welcome h3 {
          margin: 0 0 8px;
          color: #1c1e21;
        }

        .eric-chat-welcome p {
          margin: 0 0 20px;
          color: #65676b;
        }

        .suggested-prompts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .suggested-prompts button {
          padding: 10px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          font-size: 13px;
          color: #1c1e21;
          cursor: pointer;
          transition: all 0.2s;
        }

        .suggested-prompts button:hover {
          background: #FFD93D;
          border-color: #FFD93D;
        }

        .eric-chat-message {
          display: flex;
          gap: 10px;
          max-width: 80%;
        }

        .eric-chat-message.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .msg-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .msg-bubble {
          background: white;
          padding: 12px 16px;
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .eric-chat-message.user .msg-bubble {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .eric-chat-message.assistant .msg-bubble {
          border-bottom-left-radius: 4px;
        }

        .msg-bubble p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .msg-time {
          display: block;
          font-size: 10px;
          opacity: 0.7;
          margin-top: 4px;
          text-align: right;
        }

        .msg-bubble.typing {
          padding: 16px 20px;
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dots span {
          width: 8px;
          height: 8px;
          background: #bbb;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }

        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typing {
          0%, 100% { opacity: 0.4; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }

        .eric-chat-input {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .eric-chat-input textarea {
          flex: 1;
          border: none;
          background: #f0f2f5;
          padding: 12px 16px;
          border-radius: 24px;
          font-size: 14px;
          resize: none;
          outline: none;
        }

        .eric-chat-input .send-btn {
          width: 48px;
          height: 48px;
          border: none;
          background: linear-gradient(135deg, #FFD93D 0%, #FF9500 100%);
          border-radius: 50%;
          color: #333;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .eric-chat-input .send-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .eric-chat-input .send-btn:disabled {
          opacity: 0.5;
        }

        /* History */
        .eric-history {
          padding: 20px;
        }

        .new-chat-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          margin-bottom: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .new-chat-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .empty-history {
          text-align: center;
          padding: 60px 20px;
          color: #9ca3af;
        }

        .empty-history h3 {
          margin: 16px 0 8px;
          color: #65676b;
        }

        .empty-history p {
          margin: 0;
        }

        .conversation-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .conversation-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .conversation-item:hover {
          background: #f0f2f5;
        }

        .conversation-item.active {
          background: #e8f0fe;
        }

        .conv-icon {
          width: 40px;
          height: 40px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #65676b;
        }

        .conv-details {
          flex: 1;
          min-width: 0;
        }

        .conv-details h4 {
          margin: 0 0 4px;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conv-details span {
          font-size: 12px;
          color: #65676b;
        }

        .conv-delete {
          background: none;
          border: none;
          padding: 8px;
          border-radius: 50%;
          color: #9ca3af;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s;
        }

        .conversation-item:hover .conv-delete {
          opacity: 1;
        }

        .conv-delete:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .conv-arrow {
          color: #9ca3af;
        }

        /* Settings */
        .eric-settings {
          padding: 24px;
        }

        .settings-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
          color: #1c1e21;
        }

        .settings-header h3 {
          margin: 0 0 4px;
          font-size: 18px;
        }

        .settings-header p {
          margin: 0;
          font-size: 14px;
          color: #65676b;
        }

        .settings-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: #fef3c7;
          border-radius: 12px;
          margin-bottom: 24px;
          color: #92400e;
        }

        .settings-note p {
          margin: 0;
          font-size: 13px;
        }

        .settings-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .setting-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
        }

        .setting-icon {
          width: 44px;
          height: 44px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #65676b;
        }

        .setting-info {
          flex: 1;
        }

        .setting-info h4 {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 500;
        }

        .setting-info p {
          margin: 0;
          font-size: 12px;
          color: #65676b;
        }

        .setting-toggle {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: color 0.2s;
        }

        .setting-toggle.off {
          color: #d1d5db;
        }

        .setting-toggle.on {
          color: #22c55e;
        }

        .setting-toggle:disabled {
          opacity: 0.5;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .eric-profile-banner {
            flex-direction: column;
            text-align: center;
          }

          .eric-tabs {
            overflow-x: auto;
          }

          .eric-chat-message {
            max-width: 90%;
          }
        }
      `}</style>
    </div>
  );
};

export default ERICProfile;
