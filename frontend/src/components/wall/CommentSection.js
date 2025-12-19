import React from 'react';
import { User, Send, MessageCircle } from 'lucide-react';
import CommentItem from './CommentItem';

function CommentSection({ 
  postId, 
  comments, 
  moduleColor, 
  user,
  newComment,
  onNewCommentChange,
  onCommentSubmit,
  onCommentLike,
  onCommentEdit,
  onCommentDelete
}) {
  const handleSubmit = () => {
    if (newComment?.trim()) {
      onCommentSubmit(postId, newComment);
    }
  };

  return (
    <div className="comments-section">
      {/* Comment Input */}
      <div className="comment-input-container">
        <div className="comment-input-wrapper">
          <div className="comment-avatar" style={{ backgroundColor: moduleColor }}>
            <User size={16} color="white" />
          </div>
          <textarea
            value={newComment || ''}
            onChange={(e) => onNewCommentChange(postId, e.target.value)}
            placeholder="Напишите комментарий..."
            className="comment-input"
            rows="1"
          />
          <button 
            className="comment-submit-btn"
            onClick={handleSubmit}
            disabled={!newComment?.trim()}
            style={{ color: moduleColor }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="comments-list">
        {comments ? (
          comments.length > 0 ? (
            comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={postId}
                moduleColor={moduleColor}
                user={user}
                onCommentLike={onCommentLike}
                onCommentEdit={onCommentEdit}
                onCommentDelete={onCommentDelete}
                onCommentSubmit={onCommentSubmit}
              />
            ))
          ) : (
            <div className="no-comments">
              <MessageCircle size={24} color="#9ca3af" />
              <p>Пока нет комментариев</p>
            </div>
          )
        ) : (
          <div className="loading-comments">
            <p>Загружаем комментарии...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommentSection;
