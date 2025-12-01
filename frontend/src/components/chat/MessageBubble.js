/**
 * MessageBubble Component
 * WhatsApp-style message bubble with status indicators
 */
import React from 'react';
import { Check, CheckCheck, Reply, MoreVertical } from 'lucide-react';

const MessageBubble = ({
  message,
  isOwn,
  showSender = false,
  onReply,
  moduleColor = '#059669'
}) => {
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = () => {
    if (!isOwn) return null;
    switch (message.status) {
      case 'read':
        return <CheckCheck size={14} className="status-icon read" />;
      case 'delivered':
        return <CheckCheck size={14} className="status-icon delivered" />;
      default:
        return <Check size={14} className="status-icon sent" />;
    }
  };

  return (
    <div className={`message-bubble-wrapper ${isOwn ? 'own' : 'other'}`}>
      <div 
        className={`message-bubble ${isOwn ? 'own-bubble' : 'other-bubble'}`}
        style={isOwn ? { backgroundColor: `${moduleColor}20` } : {}}
      >
        {/* Reply reference */}
        {message.reply_to && message.reply_message && (
          <div className="reply-reference">
            <div className="reply-bar" style={{ backgroundColor: moduleColor }}></div>
            <div className="reply-content">
              <span className="reply-sender">
                {message.reply_message.sender?.first_name || 'Unknown'}
              </span>
              <span className="reply-text">
                {message.reply_message.content?.substring(0, 50)}...
              </span>
            </div>
          </div>
        )}
        
        {/* Sender name for group chats */}
        {showSender && !isOwn && message.sender && (
          <div className="sender-name" style={{ color: moduleColor }}>
            {message.sender.first_name} {message.sender.last_name}
          </div>
        )}
        
        {/* Message content */}
        <div className="message-content">
          <span className="message-text">{message.content}</span>
          <span className="message-meta">
            {message.is_edited && <span className="edited-label">изменено</span>}
            <span className="message-time">{formatTime(message.created_at)}</span>
            {getStatusIcon()}
          </span>
        </div>
        
        {/* Message tail */}
        <div className={`bubble-tail ${isOwn ? 'own-tail' : 'other-tail'}`}></div>
      </div>
      
      {/* Hover actions */}
      <div className="message-actions">
        <button className="action-btn" onClick={() => onReply && onReply(message)} title="Ответить">
          <Reply size={16} />
        </button>
      </div>
    </div>
  );
};

export default MessageBubble;
