/**
 * EmojiPicker Component
 * WhatsApp-style emoji picker with categories
 */
import React, { useState, useRef, useEffect } from 'react';
import { Smile, Clock, Heart, Coffee, Plane, Flag, Hash, X } from 'lucide-react';

const EMOJI_CATEGORIES = {
  recent: {
    icon: Clock,
    label: 'Недавние',
    emojis: ['😀', '😂', '❤️', '👍', '🔥', '😍', '🎉', '👏']
  },
  smileys: {
    icon: Smile,
    label: 'Смайлики',
    emojis: [
      '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
      '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
      '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝',
      '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
      '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
      '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠',
      '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
      '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
      '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
      '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬'
    ]
  },
  hearts: {
    icon: Heart,
    label: 'Сердечки',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '♥️', '😍', '🥰', '😘', '😻'
    ]
  },
  gestures: {
    icon: Coffee,
    label: 'Жесты',
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲',
      '🙏', '✍️', '💪', '🦵', '🦶', '👂', '👃', '🧠',
      '🦷', '👀', '👁️', '👅', '👄', '💋', '🤝', '🫶'
    ]
  },
  objects: {
    icon: Flag,
    label: 'Объекты',
    emojis: [
      '🎉', '🎊', '🎁', '🎈', '🎂', '🍰', '🧁', '🎄',
      '🔥', '✨', '🌟', '💫', '⭐', '🌈', '☀️', '🌙',
      '💰', '💎', '🏆', '🎯', '🎮', '🎸', '🎹', '🎤',
      '📱', '💻', '⌚', '📷', '🎬', '🔔', '📚', '✏️',
      '💡', '🔑', '🛒', '💼', '📌', '📎', '✂️', '🗑️'
    ]
  },
  symbols: {
    icon: Hash,
    label: 'Символы',
    emojis: [
      '✅', '❌', '❓', '❗', '💯', '🔴', '🟠', '🟡',
      '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '▶️', '⏸️',
      '⏹️', '⏺️', '⏭️', '⏮️', '🔀', '🔁', '🔂', '🔃',
      '➕', '➖', '➗', '✖️', '♾️', '💲', '🔗', '📧'
    ]
  }
};

// Quick reaction emojis
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

const EmojiPicker = ({ 
  onSelect, 
  onClose, 
  position = 'bottom',
  showQuickReactions = false,
  moduleColor = '#059669'
}) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose && onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleEmojiClick = (emoji) => {
    onSelect && onSelect(emoji);
  };

  // Quick reactions bar
  if (showQuickReactions) {
    return (
      <div 
        ref={pickerRef}
        className="emoji-quick-reactions"
        style={{ '--module-color': moduleColor }}
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            className="quick-reaction-btn"
            onClick={() => handleEmojiClick(emoji)}
          >
            {emoji}
          </button>
        ))}
        <button
          className="quick-reaction-btn more-btn"
          onClick={() => {}}
          title="Больше реакций"
        >
          <span>+</span>
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={pickerRef}
      className={`emoji-picker ${position}`}
      style={{ '--module-color': moduleColor }}
    >
      {/* Header */}
      <div className="emoji-picker-header">
        <input
          type="text"
          placeholder="Поиск эмодзи..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="emoji-search"
        />
        <button className="emoji-close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Category tabs */}
      <div className="emoji-categories">
        {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => {
          const IconComponent = category.icon;
          return (
            <button
              key={key}
              className={`emoji-category-btn ${activeCategory === key ? 'active' : ''}`}
              onClick={() => setActiveCategory(key)}
              title={category.label}
            >
              <IconComponent size={18} />
            </button>
          );
        })}
      </div>

      {/* Emoji grid */}
      <div className="emoji-grid">
        {EMOJI_CATEGORIES[activeCategory].emojis
          .filter(emoji => !searchQuery || emoji.includes(searchQuery))
          .map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              className="emoji-btn"
              onClick={() => handleEmojiClick(emoji)}
            >
              {emoji}
            </button>
          ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
