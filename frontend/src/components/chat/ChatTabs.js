/**
 * ChatTabs Component
 * WhatsApp-style tab navigation between Chats (DMs) and Groups
 */
import React from 'react';
import { MessageCircle, Users } from 'lucide-react';

const ChatTabs = ({ activeTab, onTabChange, unreadChats = 0, unreadGroups = 0, moduleColor }) => {
  return (
    <div className="chat-tabs">
      <button
        className={`chat-tab ${activeTab === 'chats' ? 'active' : ''}`}
        onClick={() => onTabChange('chats')}
        style={activeTab === 'chats' ? { borderBottomColor: moduleColor, color: moduleColor } : {}}
      >
        <MessageCircle size={18} />
        <span>Чаты</span>
        {unreadChats > 0 && (
          <span className="unread-badge" style={{ backgroundColor: moduleColor }}>
            {unreadChats > 99 ? '99+' : unreadChats}
          </span>
        )}
      </button>
      <button
        className={`chat-tab ${activeTab === 'groups' ? 'active' : ''}`}
        onClick={() => onTabChange('groups')}
        style={activeTab === 'groups' ? { borderBottomColor: moduleColor, color: moduleColor } : {}}
      >
        <Users size={18} />
        <span>Группы</span>
        {unreadGroups > 0 && (
          <span className="unread-badge" style={{ backgroundColor: moduleColor }}>
            {unreadGroups > 99 ? '99+' : unreadGroups}
          </span>
        )}
      </button>
    </div>
  );
};

export default ChatTabs;
