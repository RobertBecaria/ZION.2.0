/**
 * MessageBubble Component
 * WhatsApp-style message bubble with status indicators, replies, attachments, voice messages, and reactions
 */
import React, { useState } from 'react';
import { Check, CheckCheck, Reply, File, Download, MoreVertical } from 'lucide-react';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import MessageContextMenu from './MessageContextMenu';

// Quick reaction emojis for hover bar
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

const MessageBubble = ({
  message,
  isOwn,
  showSender = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onForward,
  moduleColor = '#059669'
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

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

  const renderVoiceMessage = () => {
    if (message.message_type !== 'VOICE' || !message.voice) return null;
    
    const audioUrl = `${process.env.REACT_APP_BACKEND_URL}${message.voice.file_path}`;
    
    return (
      <VoiceMessagePlayer
        audioUrl={audioUrl}
        duration={message.voice.duration}
        isOwn={isOwn}
        moduleColor={moduleColor}
      />
    );
  };

  const renderAttachment = () => {
    if (!message.attachment) return null;
    
    const { filename, file_path, mime_type } = message.attachment;
    const isImage = mime_type?.startsWith('image/');
    
    if (isImage) {
      return (
        <div className="attachment-container image-attachment">
          <img 
            src={`${process.env.REACT_APP_BACKEND_URL}${file_path}`} 
            alt={filename}
            className="attachment-image"
            onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}${file_path}`, '_blank')}
          />
        </div>
      );
    }
    
    return (
      <div className="attachment-container file-attachment">
        <File size={32} color={moduleColor} />
        <div className="file-info">
          <span className="file-name">{filename}</span>
          <a 
            href={`${process.env.REACT_APP_BACKEND_URL}${file_path}`}
            download={filename}
            target="_blank"
            rel="noopener noreferrer"
            className="download-btn"
          >
            <Download size={16} /> Скачать
          </a>
        </div>
      </div>
    );
  };

  // Render reactions on the message
  const renderReactions = () => {
    if (!message.reactions || Object.keys(message.reactions).length === 0) return null;
    
    return (
      <div className="message-reactions">
        {Object.entries(message.reactions).map(([emoji, count]) => (
          <button 
            key={emoji}
            className={`reaction-badge ${message.user_reaction === emoji ? 'own-reaction' : ''}`}
            onClick={() => onReact && onReact(message.id, emoji)}
            style={message.user_reaction === emoji ? { borderColor: moduleColor } : {}}
          >
            <span className="reaction-emoji">{emoji}</span>
            {count > 1 && <span className="reaction-count">{count}</span>}
          </button>
        ))}
      </div>
    );
  };

  // Handle context menu (right-click)
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Handle reaction from quick picker or context menu
  const handleReaction = (emoji) => {
    if (onReact) {
      onReact(message.id, emoji);
    }
  };

  const isVoiceMessage = message.message_type === 'VOICE';
  const isDeleted = message.is_deleted;

  // Render deleted message
  if (isDeleted) {
    return (
      <div className={`message-bubble-wrapper ${isOwn ? 'own' : 'other'}`}>
        <div className={`message-bubble deleted-bubble ${isOwn ? 'own-bubble' : 'other-bubble'}`}>
          <span className="deleted-message-text">
            {isOwn ? '🚫 Вы удалили это сообщение' : '🚫 Сообщение удалено'}
          </span>
          <span className="message-meta">
            <span className="message-time">{formatTime(message.created_at)}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`message-bubble-wrapper ${isOwn ? 'own' : 'other'}`}
      onContextMenu={handleContextMenu}
    >
      <div 
        className={`message-bubble ${isOwn ? 'own-bubble' : 'other-bubble'} ${isVoiceMessage ? 'voice-bubble' : ''}`}
        style={isOwn ? { backgroundColor: isVoiceMessage ? moduleColor : `${moduleColor}20` } : {}}
      >
        {/* Reply reference */}
        {message.reply_to && message.reply_message && (
          <div className="reply-reference">
            <div className="reply-bar" style={{ backgroundColor: isOwn && isVoiceMessage ? '#fff' : moduleColor }}></div>
            <div className="reply-content">
              <span className="reply-sender" style={{ color: isOwn && isVoiceMessage ? '#fff' : moduleColor }}>
                {message.reply_message.sender?.first_name || 'Unknown'}
              </span>
              <span className="reply-text" style={{ color: isOwn && isVoiceMessage ? 'rgba(255,255,255,0.8)' : undefined }}>
                {message.reply_message.content?.substring(0, 60)}{message.reply_message.content?.length > 60 ? '...' : ''}
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
        
        {/* Voice message */}
        {renderVoiceMessage()}
        
        {/* Attachment */}
        {renderAttachment()}
        
        {/* Message content */}
        <div className="message-content">
          {!isVoiceMessage && message.message_type !== 'IMAGE' && message.message_type !== 'FILE' && (
            <span className="message-text">{message.content}</span>
          )}
          {(message.message_type === 'IMAGE' || message.message_type === 'FILE') && !message.attachment && (
            <span className="message-text">{message.content}</span>
          )}
          <span className={`message-meta ${isVoiceMessage && isOwn ? 'voice-meta' : ''}`}>
            {message.is_edited && <span className="edited-label">изменено</span>}
            <span className="message-time">{formatTime(message.created_at)}</span>
            {getStatusIcon()}
          </span>
        </div>
        
        {/* Message tail */}
        <div className={`bubble-tail ${isOwn ? 'own-tail' : 'other-tail'}`}></div>
      </div>

      {/* Reactions display */}
      {renderReactions()}
      
      {/* Hover actions bar */}
      <div className="message-actions">
        {/* Quick reaction picker */}
        <div className="quick-reactions-bar">
          {QUICK_REACTIONS.slice(0, 3).map(emoji => (
            <button 
              key={emoji}
              className="quick-react-btn"
              onClick={() => handleReaction(emoji)}
              title={`Реакция ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button className="action-btn" onClick={() => onReply && onReply(message)} title="Ответить">
          <Reply size={16} />
        </button>
        <button 
          className="action-btn" 
          onClick={(e) => {
            setContextMenuPosition({ x: e.clientX, y: e.clientY });
            setShowContextMenu(true);
          }}
          title="Ещё"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <MessageContextMenu
          message={message}
          isOwn={isOwn}
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
          onReply={() => onReply && onReply(message)}
          onCopy={() => {}}
          onForward={() => onForward && onForward(message)}
          onEdit={() => onEdit && onEdit(message)}
          onDelete={() => onDelete && onDelete(message)}
          onReact={handleReaction}
          moduleColor={moduleColor}
        />
      )}
    </div>
  );
};

export default MessageBubble;
