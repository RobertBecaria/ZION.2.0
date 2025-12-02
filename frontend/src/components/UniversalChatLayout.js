/**
 * UniversalChatLayout Component
 * Main chat view that handles both direct messages and group chats
 */
import React, { useState, useEffect } from 'react';
import { MessageCircle, Users, Plus, ArrowRight } from 'lucide-react';
import { ChatConversation } from './chat';

function UniversalChatLayout({ 
  activeGroup, 
  activeDirectChat,
  chatGroups, 
  onGroupSelect, 
  moduleColor = "#059669",
  onCreateGroup,
  user 
}) {
  // Determine which chat to show
  const hasActiveChat = activeGroup || activeDirectChat;
  const chatType = activeDirectChat ? 'direct' : 'group';
  const activeChat = activeDirectChat || activeGroup;

  const handleBack = () => {
    if (activeDirectChat) {
      // Handle clearing direct chat selection
    } else if (onGroupSelect) {
      onGroupSelect(null);
    }
  };

  if (!hasActiveChat) {
    return (
      <div className="universal-chat-layout">
        <div className="chat-welcome">
          <div className="welcome-content">
            <div className="welcome-icon" style={{ backgroundColor: `${moduleColor}15` }}>
              <MessageCircle size={64} color={moduleColor} />
            </div>
            <h3>Добро пожаловать в чат!</h3>
            <p>Выберите чат из списка справа, чтобы начать общение</p>
            <div className="welcome-hint">
              <ArrowRight size={20} color={moduleColor} />
              <span>Ваши чаты находятся в панели "Сообщения" справа</span>
            </div>
            <div className="welcome-actions">
              <button 
                className="btn-secondary"
                onClick={onCreateGroup}
                style={{ borderColor: moduleColor, color: moduleColor }}
              >
                <Users size={18} />
                Создать группу
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="universal-chat-layout-full">
      <ChatConversation
        chat={activeChat}
        chatType={chatType}
        onBack={handleBack}
        moduleColor={moduleColor}
        user={user}
      />
    </div>
  );
}

export default UniversalChatLayout;
