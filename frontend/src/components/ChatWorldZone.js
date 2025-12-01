/**
 * ChatWorldZone Component - Redesigned
 * Clean, WhatsApp-style sidebar focused on conversations
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageCircle, Users, Settings, ChevronDown, ChevronUp,
  Bell, BellOff, Volume2, VolumeX, Archive, Star
} from 'lucide-react';
import { ChatTabs, DirectChatList } from './chat';
import ChatGroupList from './ChatGroupList';

const ChatWorldZone = ({
  moduleColor = '#059669',
  chatGroups = [],
  activeGroup,
  handleGroupSelect,
  handleCreateGroup,
  user,
  activeDirectChat,
  setActiveDirectChat,
  onRefreshGroups
}) => {
  const [activeTab, setActiveTab] = useState('chats');
  const [directChats, setDirectChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    sound: true
  });

  // Calculate unread counts
  const unreadChats = directChats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
  const unreadGroups = chatGroups.reduce((sum, group) => sum + (group.unread_count || 0), 0);
  const totalUnread = unreadChats + unreadGroups;

  const fetchDirectChats = useCallback(async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/direct-chats`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setDirectChats(data.direct_chats || []);
      }
    } catch (error) {
      console.error('Error fetching direct chats:', error);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectChats();
    const interval = setInterval(fetchDirectChats, 5000);
    return () => clearInterval(interval);
  }, [fetchDirectChats]);

  const handleDirectChatSelect = (chatData) => {
    if (setActiveDirectChat) setActiveDirectChat(chatData);
    if (handleGroupSelect) handleGroupSelect(null);
  };

  const handleGroupSelectWrapper = (groupData) => {
    if (setActiveDirectChat) setActiveDirectChat(null);
    if (handleGroupSelect) handleGroupSelect(groupData);
  };

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="chat-sidebar-redesign">
      {/* Header with unread badge */}
      <div className="chat-sidebar-header" style={{ borderBottomColor: `${moduleColor}30` }}>
        <div className="header-title">
          <MessageCircle size={22} color={moduleColor} />
          <h2>Сообщения</h2>
          {totalUnread > 0 && (
            <span className="total-unread-badge" style={{ backgroundColor: moduleColor }}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </div>
        <button 
          className="settings-toggle"
          onClick={() => setShowSettings(!showSettings)}
          title="Настройки"
        >
          <Settings size={18} color={showSettings ? moduleColor : '#667781'} />
        </button>
      </div>

      {/* Collapsible Settings Panel */}
      {showSettings && (
        <div className="chat-settings-panel">
          <div 
            className="setting-row"
            onClick={() => toggleSetting('notifications')}
          >
            {settings.notifications ? (
              <Bell size={18} color={moduleColor} />
            ) : (
              <BellOff size={18} color="#9ca3af" />
            )}
            <span>Уведомления</span>
            <div className={`toggle-pill ${settings.notifications ? 'active' : ''}`} style={settings.notifications ? { backgroundColor: moduleColor } : {}}>
              <div className="toggle-circle"></div>
            </div>
          </div>
          <div 
            className="setting-row"
            onClick={() => toggleSetting('sound')}
          >
            {settings.sound ? (
              <Volume2 size={18} color={moduleColor} />
            ) : (
              <VolumeX size={18} color="#9ca3af" />
            )}
            <span>Звук</span>
            <div className={`toggle-pill ${settings.sound ? 'active' : ''}`} style={settings.sound ? { backgroundColor: moduleColor } : {}}>
              <div className="toggle-circle"></div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - Clean, integrated design */}
      <div className="chat-sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
          style={activeTab === 'chats' ? { color: moduleColor, borderBottomColor: moduleColor } : {}}
        >
          <MessageCircle size={16} />
          <span>Чаты</span>
          {unreadChats > 0 && (
            <span className="tab-badge" style={{ backgroundColor: moduleColor }}>{unreadChats}</span>
          )}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
          style={activeTab === 'groups' ? { color: moduleColor, borderBottomColor: moduleColor } : {}}
        >
          <Users size={16} />
          <span>Группы</span>
          {unreadGroups > 0 && (
            <span className="tab-badge" style={{ backgroundColor: moduleColor }}>{unreadGroups}</span>
          )}
        </button>
      </div>

      {/* Main Chat List - Full focus */}
      <div className="chat-sidebar-list">
        {activeTab === 'chats' ? (
          <DirectChatList
            directChats={directChats}
            activeChat={activeDirectChat}
            onChatSelect={handleDirectChatSelect}
            onRefresh={fetchDirectChats}
            moduleColor={moduleColor}
            user={user}
          />
        ) : (
          <ChatGroupList
            chatGroups={chatGroups}
            activeGroup={activeGroup}
            onGroupSelect={handleGroupSelectWrapper}
            onCreateGroup={handleCreateGroup}
            moduleColor={moduleColor}
            user={user}
          />
        )}
      </div>

      {/* Subtle Stats Footer */}
      <div className="chat-sidebar-footer">
        <div className="footer-stat">
          <span className="stat-value">{directChats.length}</span>
          <span className="stat-label">чатов</span>
        </div>
        <div className="footer-divider"></div>
        <div className="footer-stat">
          <span className="stat-value">{chatGroups.length}</span>
          <span className="stat-label">групп</span>
        </div>
      </div>
    </div>
  );
};

export default ChatWorldZone;
