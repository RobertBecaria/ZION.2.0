/**
 * MessageContextMenu Component
 * WhatsApp-style context menu for message actions
 */
import React, { useEffect, useRef } from 'react';
import { 
  Reply, Copy, Forward, Edit, Trash2, Smile, 
  Pin, Star, Info, Check, CheckCheck 
} from 'lucide-react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

const MessageContextMenu = ({
  message,
  isOwn,
  position,
  onClose,
  onReply,
  onCopy,
  onForward,
  onEdit,
  onDelete,
  onReact,
  moduleColor = '#059669'
}) => {
  const menuRef = useRef(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Calculate menu position to stay within viewport
  const getMenuStyle = () => {
    const style = {
      position: 'fixed',
      zIndex: 9999,
      '--module-color': moduleColor
    };

    if (position) {
      // Ensure menu doesn't go off screen
      const menuWidth = 200;
      const menuHeight = 320;
      const padding = 10;

      let left = position.x;
      let top = position.y;

      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }
      if (left < padding) left = padding;

      if (top + menuHeight > window.innerHeight - padding) {
        top = position.y - menuHeight;
      }
      if (top < padding) top = padding;

      style.left = `${left}px`;
      style.top = `${top}px`;
    }

    return style;
  };

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      onCopy && onCopy();
    }
    onClose();
  };

  const isTextMessage = message.message_type === 'TEXT' || !message.message_type;

  return (
    <div 
      ref={menuRef}
      className="message-context-menu"
      style={getMenuStyle()}
    >
      {/* Quick reactions */}
      <div className="context-reactions">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            className="context-reaction-btn"
            onClick={() => {
              onReact && onReact(emoji);
              onClose();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="context-divider" />

      {/* Action buttons */}
      <div className="context-actions">
        <button className="context-action" onClick={() => { onReply && onReply(); onClose(); }}>
          <Reply size={18} />
          <span>Ответить</span>
        </button>

        {isTextMessage && (
          <button className="context-action" onClick={handleCopy}>
            <Copy size={18} />
            <span>Копировать</span>
          </button>
        )}

        <button className="context-action" onClick={() => { onForward && onForward(); onClose(); }}>
          <Forward size={18} />
          <span>Переслать</span>
        </button>

        {isOwn && isTextMessage && (
          <button className="context-action" onClick={() => { onEdit && onEdit(); onClose(); }}>
            <Edit size={18} />
            <span>Редактировать</span>
          </button>
        )}

        {isOwn && (
          <>
            <div className="context-divider" />
            <button 
              className="context-action danger"
              onClick={() => { onDelete && onDelete(); onClose(); }}
            >
              <Trash2 size={18} />
              <span>Удалить</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MessageContextMenu;
