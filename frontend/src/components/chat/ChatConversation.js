/**
 * ChatConversation Component
 * WhatsApp-style chat conversation view with search, reply, and attachments
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Smile, Paperclip, ArrowLeft, MoreVertical, Search, User, X, Image, File
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const ChatConversation = ({
  chat,
  chatType = 'direct', // 'direct' or 'group'
  onBack,
  moduleColor = '#059669',
  user
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [userStatus, setUserStatus] = useState({ is_online: false, last_seen: null });
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const chatId = chatType === 'direct' ? chat?.chat?.id : chat?.group?.id;
  const otherUserId = chatType === 'direct' ? chat?.other_user?.id : null;
  const chatName = chatType === 'direct' 
    ? `${chat?.other_user?.first_name || ''} ${chat?.other_user?.last_name || ''}`.trim() || 'Unknown'
    : chat?.group?.name || 'Unknown Group';
  const chatAvatar = chatType === 'direct' 
    ? chat?.other_user?.profile_picture 
    : null;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch messages
  useEffect(() => {
    if (chatId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [chatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch typing status
  useEffect(() => {
    if (chatId) {
      const typingInterval = setInterval(fetchTypingStatus, 2000);
      return () => clearInterval(typingInterval);
    }
  }, [chatId]);

  // Fetch user online status for direct chats
  useEffect(() => {
    if (chatType === 'direct' && otherUserId) {
      fetchUserStatus();
      const statusInterval = setInterval(fetchUserStatus, 30000); // Every 30 seconds
      return () => clearInterval(statusInterval);
    }
  }, [otherUserId, chatType]);

  // Send heartbeat to update own online status
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const token = localStorage.getItem('zion_token');
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/heartbeat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    };
    
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 60000); // Every minute
    return () => clearInterval(heartbeatInterval);
  }, []);

  const fetchMessages = async () => {
    if (!chatId) return;
    try {
      const token = localStorage.getItem('zion_token');
      const endpoint = chatType === 'direct' 
        ? `/api/direct-chats/${chatId}/messages`
        : `/api/chat-groups/${chatId}/messages`;
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchTypingStatus = async () => {
    if (!chatId) return;
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chats/${chatId}/typing?chat_type=${chatType}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTypingUsers(data.typing_users || []);
      }
    } catch (error) {
      console.error('Error fetching typing status:', error);
    }
  };

  const fetchUserStatus = async () => {
    if (!otherUserId) return;
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/${otherUserId}/status`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setUserStatus(data);
      }
    } catch (error) {
      console.error('Error fetching user status:', error);
    }
  };

  const setTypingStatus = async (isTyping) => {
    if (!chatId) return;
    try {
      const token = localStorage.getItem('zion_token');
      await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chats/${chatId}/typing?chat_type=${chatType}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ is_typing: isTyping })
        }
      );
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    setTypingStatus(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, 2000);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || sending) return;

    setSending(true);
    setTypingStatus(false);
    
    try {
      const token = localStorage.getItem('zion_token');
      const endpoint = chatType === 'direct'
        ? `/api/direct-chats/${chatId}/messages`
        : `/api/chat-groups/${chatId}/messages`;
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content: newMessage,
            message_type: 'TEXT',
            reply_to: replyingTo?.id || null
          })
        }
      );

      if (response.ok) {
        setNewMessage('');
        setReplyingTo(null);
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;
    
    setUploadingFile(true);
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('content', file.name);
      if (replyingTo) {
        formData.append('reply_to', replyingTo.id);
      }
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/direct-chats/${chatId}/messages/attachment`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        }
      );
      
      if (response.ok) {
        setReplyingTo(null);
        fetchMessages();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !chatId) return;
    
    setSearching(true);
    try {
      const token = localStorage.getItem('zion_token');
      const endpoint = chatType === 'direct'
        ? `/api/direct-chats/${chatId}/messages/search`
        : `/api/chat-groups/${chatId}/messages/search`;
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}?query=${encodeURIComponent(searchQuery)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.messages || []);
      }
    } catch (error) {
      console.error('Error searching messages:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'был(а) давно';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'был(а) только что';
    if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `был(а) ${Math.floor(diff / 3600000)} ч. назад`;
    return `был(а) ${date.toLocaleDateString('ru-RU')}`;
  };

  const getStatusText = () => {
    if (typingUsers.length > 0) return 'печатает...';
    if (chatType === 'group') return `${chat?.member_count || 0} участников`;
    if (userStatus.is_online) return 'в сети';
    return formatLastSeen(userStatus.last_seen);
  };

  if (!chat) {
    return (
      <div className="chat-conversation empty">
        <div className="empty-chat-placeholder">
          <User size={64} color="#9ca3af" />
          <h3>Выберите чат</h3>
          <p>Выберите чат из списка для начала общения</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-conversation">
      {/* Chat Header */}
      <div className="conversation-header" style={{ backgroundColor: `${moduleColor}10` }}>
        <button className="back-btn mobile-only" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        
        <div className="chat-info">
          <div className="chat-avatar">
            {chatAvatar ? (
              <img src={chatAvatar} alt="" />
            ) : (
              <div className="avatar-placeholder" style={{ backgroundColor: moduleColor }}>
                {chatType === 'direct' 
                  ? (chat?.other_user?.first_name?.[0] || '?')
                  : (chat?.group?.name?.[0] || 'G')}
              </div>
            )}
            {chatType === 'direct' && userStatus.is_online && (
              <span className="online-indicator"></span>
            )}
          </div>
          <div className="chat-details">
            <h3>{chatName}</h3>
            <p className="chat-status">{getStatusText()}</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="action-btn" 
            title="Поиск"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={20} />
          </button>
          <button className="action-btn" title="Ещё">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="chat-search-panel">
          <input
            type="text"
            placeholder="Поиск сообщений..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={searching}>
            {searching ? '...' : 'Найти'}
          </button>
          <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="search-results-panel">
          <div className="search-results-header">
            <span>Найдено: {searchResults.length}</span>
            <button onClick={() => setSearchResults([])}>Закрыть</button>
          </div>
          {searchResults.map(msg => (
            <div key={msg.id} className="search-result-item">
              <strong>{msg.sender?.first_name}</strong>: {msg.content.substring(0, 50)}...
              <span className="result-time">
                {new Date(msg.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="messages-container">
        {loading && messages.length === 0 ? (
          <div className="loading-messages">
            <p>Загрузка сообщений...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>Нет сообщений</p>
            <small>Начните разговор, отправив первое сообщение</small>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwn = message.user_id === user?.id;
              const showSender = chatType === 'group' && !isOwn;
              const prevMessage = messages[index - 1];
              const showDate = !prevMessage || 
                new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString();
              
              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="date-separator">
                      <span>{new Date(message.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: new Date(message.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })}</span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    isOwn={isOwn}
                    showSender={showSender}
                    onReply={handleReply}
                    moduleColor={moduleColor}
                  />
                </React.Fragment>
              );
            })}
            <TypingIndicator typingUsers={typingUsers} moduleColor={moduleColor} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="reply-preview">
          <div className="reply-bar" style={{ backgroundColor: moduleColor }}></div>
          <div className="reply-content">
            <span className="reply-to-label">Ответ для {replyingTo.sender?.first_name || 'Unknown'}</span>
            <span className="reply-text">{replyingTo.content?.substring(0, 50)}...</span>
          </div>
          <button className="cancel-reply" onClick={cancelReply}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Message Input */}
      <form className="message-input-form" onSubmit={sendMessage}>
        <button type="button" className="input-action-btn" title="Эмодзи">
          <Smile size={24} color="#8696A0" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <button 
          type="button" 
          className="input-action-btn" 
          title="Прикрепить файл"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
        >
          <Paperclip size={24} color={uploadingFile ? moduleColor : "#8696A0"} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder={uploadingFile ? "Загрузка файла..." : "Введите сообщение"}
          className="message-input"
          disabled={sending || uploadingFile}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!newMessage.trim() || sending || uploadingFile}
          style={{ backgroundColor: moduleColor }}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatConversation;
