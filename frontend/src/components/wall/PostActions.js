import React, { useState } from 'react';
import { Heart, MessageCircle, Smile } from 'lucide-react';
import { popularEmojis, allEmojis } from './utils/postUtils';

function PostActions({ 
  post, 
  moduleColor, 
  onLike, 
  onReaction, 
  onToggleComments 
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleReaction = (emoji) => {
    onReaction(post.id, emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="post-actions-bar">
      <button 
        className={`post-action-btn ${post.user_liked ? 'liked' : ''}`}
        onClick={() => onLike(post.id)}
        style={{ color: post.user_liked ? moduleColor : undefined }}
      >
        <Heart size={18} fill={post.user_liked ? moduleColor : 'none'} />
        <span>Нравится</span>
      </button>
      
      <button 
        className="post-action-btn"
        onClick={() => onToggleComments(post.id)}
      >
        <MessageCircle size={18} />
        <span>Комментировать</span>
      </button>
      
      <div className="emoji-picker-container">
        <button 
          className={`post-action-btn ${post.user_reaction ? 'reacted' : ''}`}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile size={18} />
          <span>{post.user_reaction || 'Реакция'}</span>
        </button>
        
        {showEmojiPicker && (
          <div className="emoji-picker">
            <div className="popular-emojis">
              {popularEmojis.map(emoji => (
                <button
                  key={emoji}
                  className="emoji-btn"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="all-emojis">
              <details>
                <summary>Больше эмодзи</summary>
                <div className="emoji-grid">
                  {allEmojis.filter(e => !popularEmojis.includes(e)).map(emoji => (
                    <button
                      key={emoji}
                      className="emoji-btn"
                      onClick={() => handleReaction(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PostActions;
