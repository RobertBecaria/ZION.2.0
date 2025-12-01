/**
 * ChatConversation Component
 * WhatsApp-style chat conversation view
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Smile, Paperclip, ArrowLeft, Phone, Video,
  MoreVertical, Search, User, Reply, X
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const chatId = chatType === 'direct' ? chat?.chat?.id : chat?.group?.id;
  const chatName = chatType === 'direct' 
    ? `${chat?.other_user?.first_name || ''} ${chat?.other_user?.last_name || ''}`.trim() || 'Unknown'
    : chat?.group?.name || 'Unknown Group';
  const chatAvatar = chatType === 'direct' 
    ? chat?.other_user?.profile_picture 
    : null;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (chatId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (chatId) {
      const typingInterval = setInterval(fetchTypingStatus, 2000);
      return () => clearInterval(typingInterval);
    }
  }, [chatId]);

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
    
    // Set typing status
    setTypingStatus(true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to clear typing status
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

  const handleReply = (message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
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
        
        <div className="chat-info" onClick={() => {/* Open chat info */}}>
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
          </div>
          <div className="chat-details">
            <h3>{chatName}</h3>
            <p className="chat-status">
              {typingUsers.length > 0 
                ? 'печатает...' 
                : chatType === 'group' 
                  ? `${chat?.member_count || 0} участников`
                  : 'в сети'}
            </p>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="action-btn" title="Поиск">
            <Search size={20} />
          </button>
          <button className="action-btn" title="Ещё">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

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
        <button type="button" className="input-action-btn" title="Прикрепить файл">
          <Paperclip size={24} color="#8696A0" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder="Введите сообщение"
          className="message-input"
          disabled={sending}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!newMessage.trim() || sending}
          style={{ backgroundColor: moduleColor }}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatConversation;
