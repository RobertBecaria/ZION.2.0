/**
 * DirectChatList Component
 * List of 1:1 direct message conversations (WhatsApp style)
 */
import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Check, CheckCheck } from 'lucide-react';
import NewChatModal from './NewChatModal';

const DirectChatList = ({
  directChats = [],
  activeChat,
  onChatSelect,
  onRefresh,
  moduleColor = '#059669',
  user
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const filteredChats = directChats.filter(chat => {
    if (!searchQuery) return true;
    const otherUser = chat.other_user;
    if (!otherUser) return false;
    const fullName = `${otherUser.first_name} ${otherUser.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const formatLastMessage = (message, isOwn) => {
    if (!message) return 'Нет сообщений';
    const prefix = isOwn ? 'Вы: ' : '';
    const content = message.content.length > 25 
      ? message.content.substring(0, 25) + '...' 
      : message.content;
    return prefix + content;
  };

  const getMessageStatus = (message) => {
    if (!message || message.user_id !== user?.id) return null;
    switch (message.status) {
      case 'read':
        return <CheckCheck size={16} className="status-read" style={{ color: '#34B7F1' }} />;
      case 'delivered':
        return <CheckCheck size={16} className="status-delivered" style={{ color: '#8696A0' }} />;
      default:
        return <Check size={16} className="status-sent" style={{ color: '#8696A0' }} />;
    }
  };

  const handleNewChatCreated = (chatId) => {
    setShowNewChatModal(false);
    onRefresh && onRefresh();
  };

  return (
    <div className="direct-chat-list">
      {/* Search Bar */}
      <div className="chat-search-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          className="new-chat-btn"
          onClick={() => setShowNewChatModal(true)}
          style={{ backgroundColor: moduleColor }}
          title="Новый чат"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Chat List */}
      <div className="chats-list">
        {filteredChats.length === 0 ? (
          <div className="empty-chats">
            <User size={48} color="#9ca3af" />
            <p>Нет чатов</p>
            <small>Начните новый разговор</small>
            <button 
              className="start-chat-btn"
              onClick={() => setShowNewChatModal(true)}
              style={{ backgroundColor: moduleColor }}
            >
              <Plus size={16} /> Новый чат
            </button>
          </div>
        ) : (
          filteredChats.map((chatData) => {
            const otherUser = chatData.other_user;
            const isActive = activeChat?.chat?.id === chatData.chat?.id;
            const lastMessage = chatData.latest_message;
            const isOwnMessage = lastMessage?.user_id === user?.id;
            
            return (
              <div
                key={chatData.chat.id}
                className={`chat-item ${isActive ? 'active' : ''}`}
                onClick={() => onChatSelect(chatData)}
              >
                <div className="chat-avatar">
                  {otherUser?.profile_picture ? (
                    <img src={otherUser.profile_picture} alt="" />
                  ) : (
                    <div className="avatar-placeholder" style={{ backgroundColor: moduleColor }}>
                      {otherUser?.first_name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-header-row">
                    <h4 className="chat-name">
                      {otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'Unknown User'}
                    </h4>
                    <span className="chat-time">
                      {formatTime(lastMessage?.created_at)}
                    </span>
                  </div>
                  <div className="chat-preview-row">
                    <div className="message-preview">
                      {getMessageStatus(lastMessage)}
                      <span className="preview-text">
                        {formatLastMessage(lastMessage, isOwnMessage)}
                      </span>
                    </div>
                    {chatData.unread_count > 0 && (
                      <span className="unread-badge" style={{ backgroundColor: moduleColor }}>
                        {chatData.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={handleNewChatCreated}
          moduleColor={moduleColor}
        />
      )}
    </div>
  );
};

export default DirectChatList;
