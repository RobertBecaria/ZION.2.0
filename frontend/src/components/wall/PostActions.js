import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, ThumbsUp } from 'lucide-react';

// Quick emoji reactions - always visible
const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// All available emojis for the full picker
const allEmojis = [
  '👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👏', '💯',
  '✨', '🙏', '💪', '🤔', '😍', '🥰', '😎', '🤩', '😇', '🥳',
  '😋', '🤗', '😘', '💕', '💖', '💗', '💝', '🌟', '⭐', '🏆'
];

function PostActions({ 
  post, 
  moduleColor, 
  onLike, 
  onReaction, 
  onToggleComments 
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState(null);
  const pickerRef = useRef(null);
  const timeoutRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowReactionPicker(false);
        setShowFullPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReaction = (emoji) => {
    onReaction(post.id, emoji);
    setShowReactionPicker(false);
    setShowFullPicker(false);
  };

  const handleLikeHover = () => {
    timeoutRef.current = setTimeout(() => {
      setShowReactionPicker(true);
    }, 500);
  };

  const handleLikeLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleLikeClick = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onLike(post.id);
  };

  // Get reaction summary for display
  const getReactionSummary = () => {
    if (!post.top_reactions || post.top_reactions.length === 0) return null;
    const totalReactions = post.top_reactions.reduce((sum, r) => sum + r.count, 0);
    const emojis = post.top_reactions.slice(0, 3).map(r => r.emoji).join('');
    return { emojis, count: totalReactions };
  };

  const reactionSummary = getReactionSummary();

  return (
    <div className="enhanced-post-actions">
      {/* Reaction Summary Bar */}
      {(post.likes_count > 0 || reactionSummary) && (
        <div className="reaction-summary-bar">
          <div className="reaction-summary-left">
            {post.likes_count > 0 && (
              <div className="like-indicator">
                <span className="like-icon-circle" style={{ background: moduleColor }}>
                  <ThumbsUp size={10} color="white" />
                </span>
              </div>
            )}
            {reactionSummary && (
              <span className="reaction-emojis">{reactionSummary.emojis}</span>
            )}
            <span className="reaction-count">
              {(post.likes_count || 0) + (reactionSummary?.count || 0)} 
              {' '}
              {((post.likes_count || 0) + (reactionSummary?.count || 0)) === 1 ? 'реакция' : 'реакций'}
            </span>
          </div>
          {post.comments_count > 0 && (
            <span 
              className="comments-count-link"
              onClick={() => onToggleComments(post.id)}
            >
              {post.comments_count} комментариев
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons-row">
        {/* Like Button with Reaction Picker */}
        <div 
          className="action-button-container"
          ref={pickerRef}
          onMouseEnter={handleLikeHover}
          onMouseLeave={handleLikeLeave}
        >
          <button 
            className={`action-button ${post.user_liked ? 'active' : ''}`}
            onClick={handleLikeClick}
            style={{ 
              color: post.user_liked ? moduleColor : undefined,
              background: post.user_liked ? `${moduleColor}15` : undefined
            }}
          >
            {post.user_reaction ? (
              <span className="user-reaction-emoji">{post.user_reaction}</span>
            ) : (
              <ThumbsUp size={20} fill={post.user_liked ? moduleColor : 'none'} />
            )}
            <span>{post.user_reaction || (post.user_liked ? 'Нравится' : 'Нравится')}</span>
          </button>

          {/* Quick Reaction Picker */}
          {showReactionPicker && (
            <div className="quick-reaction-picker">
              {quickReactions.map((emoji, index) => (
                <button
                  key={emoji}
                  className={`quick-reaction-btn ${hoveredReaction === emoji ? 'hovered' : ''}`}
                  onClick={() => handleReaction(emoji)}
                  onMouseEnter={() => setHoveredReaction(emoji)}
                  onMouseLeave={() => setHoveredReaction(null)}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    transform: hoveredReaction === emoji ? 'scale(1.4) translateY(-8px)' : 'scale(1)'
                  }}
                >
                  {emoji}
                </button>
              ))}
              <button
                className="more-reactions-btn"
                onClick={() => setShowFullPicker(!showFullPicker)}
              >
                +
              </button>
            </div>
          )}

          {/* Full Emoji Picker */}
          {showFullPicker && (
            <div className="full-emoji-picker">
              <div className="emoji-picker-header">Выберите реакцию</div>
              <div className="emoji-grid">
                {allEmojis.map(emoji => (
                  <button
                    key={emoji}
                    className="emoji-grid-btn"
                    onClick={() => handleReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comment Button */}
        <button 
          className="action-button"
          onClick={() => onToggleComments(post.id)}
        >
          <MessageCircle size={20} />
          <span>Комментарий</span>
        </button>

        {/* Share Button */}
        <button className="action-button">
          <Share2 size={20} />
          <span>Поделиться</span>
        </button>
      </div>

      <style jsx="true">{`
        .enhanced-post-actions {
          border-top: 1px solid #e5e7eb;
          padding-top: 8px;
          margin-top: 12px;
        }

        .reaction-summary-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 4px;
          font-size: 14px;
          color: #65676b;
        }

        .reaction-summary-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .like-indicator {
          display: flex;
          align-items: center;
        }

        .like-icon-circle {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .reaction-emojis {
          font-size: 16px;
          margin-left: -4px;
        }

        .reaction-count {
          color: #65676b;
          cursor: pointer;
        }

        .reaction-count:hover {
          text-decoration: underline;
        }

        .comments-count-link {
          color: #65676b;
          cursor: pointer;
        }

        .comments-count-link:hover {
          text-decoration: underline;
        }

        .action-buttons-row {
          display: flex;
          border-top: 1px solid #e5e7eb;
          padding-top: 4px;
          margin-top: 4px;
        }

        .action-button-container {
          flex: 1;
          position: relative;
        }

        .action-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 8px;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          color: #65676b;
          transition: all 0.2s ease;
          width: 100%;
        }

        .action-button:hover {
          background: #f0f2f5;
        }

        .action-button.active {
          font-weight: 600;
        }

        .user-reaction-emoji {
          font-size: 20px;
        }

        .quick-reaction-picker {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 40px;
          padding: 8px 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
          display: flex;
          gap: 4px;
          margin-bottom: 8px;
          z-index: 100;
          animation: popIn 0.2s ease-out;
        }

        @keyframes popIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) scale(0.8) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) scale(1) translateY(0);
          }
        }

        .quick-reaction-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: transparent;
          border-radius: 50%;
          font-size: 24px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: bounceIn 0.3s ease-out backwards;
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .quick-reaction-btn:hover {
          background: #f0f2f5;
        }

        .quick-reaction-btn.hovered {
          transform: scale(1.4) translateY(-8px) !important;
        }

        .more-reactions-btn {
          width: 36px;
          height: 36px;
          border: none;
          background: #f0f2f5;
          border-radius: 50%;
          font-size: 18px;
          font-weight: 600;
          color: #65676b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 4px;
        }

        .more-reactions-btn:hover {
          background: #e4e6e9;
        }

        .full-emoji-picker {
          position: absolute;
          bottom: 100%;
          left: 0;
          background: white;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          margin-bottom: 8px;
          z-index: 101;
          min-width: 280px;
        }

        .emoji-picker-header {
          font-size: 13px;
          font-weight: 600;
          color: #65676b;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 4px;
        }

        .emoji-grid-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-size: 22px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .emoji-grid-btn:hover {
          background: #f0f2f5;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}

export default PostActions;
