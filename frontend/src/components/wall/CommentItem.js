import React, { useState } from 'react';
import { User, Heart, MessageCircle, Edit3, Trash2 } from 'lucide-react';
import { formatTime } from './utils/postUtils';

function CommentItem({ 
  comment, 
  postId, 
  level = 0, 
  moduleColor, 
  user,
  onCommentLike,
  onCommentEdit,
  onCommentDelete,
  onCommentSubmit
}) {
  const [editingComment, setEditingComment] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyingTo, setReplyingTo] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const handleSaveEdit = () => {
    onCommentEdit(comment.id, editContent);
    setEditingComment(false);
  };

  const handleSubmitReply = () => {
    onCommentSubmit(postId, replyContent, comment.id);
    setReplyContent('');
    setReplyingTo(false);
  };

  return (
    <div className={`comment-item ${level > 0 ? 'comment-reply' : ''}`} style={{ marginLeft: `${level * 20}px` }}>
      <div className="comment-header">
        <div className="comment-author">
          {comment.author.profile_picture ? (
            <img 
              src={comment.author.profile_picture} 
              alt={`${comment.author.first_name} ${comment.author.last_name}`}
              className="author-avatar"
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div className="author-avatar" style={{ backgroundColor: moduleColor }}>
              <User size={16} color="white" />
            </div>
          )}
          <div className="comment-author-info">
            <span className="comment-author-name">
              {comment.author.first_name} {comment.author.last_name}
            </span>
            <span className="comment-time">{formatTime(comment.created_at)}</span>
            {comment.is_edited && <span className="edited-label">(изменено)</span>}
          </div>
        </div>
        
        {comment.author.id === user?.id && (
          <div className="comment-actions">
            <button className="comment-action-btn" onClick={() => setEditingComment(true)}>
              <Edit3 size={14} />
            </button>
            <button className="comment-action-btn" onClick={() => onCommentDelete(comment.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="comment-content">
        {editingComment ? (
          <div className="comment-edit-form">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="comment-edit-input"
            />
            <div className="comment-edit-actions">
              <button className="btn-save" onClick={handleSaveEdit}>Сохранить</button>
              <button className="btn-cancel" onClick={() => setEditingComment(false)}>Отмена</button>
            </div>
          </div>
        ) : (
          <p>{comment.content}</p>
        )}
      </div>

      <div className="comment-stats">
        <button 
          className={`comment-stat-btn ${comment.user_liked ? 'liked' : ''}`}
          onClick={() => onCommentLike(comment.id)}
        >
          <Heart size={14} fill={comment.user_liked ? moduleColor : 'none'} />
          {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
        </button>
        <button 
          className="comment-stat-btn"
          onClick={() => setReplyingTo(!replyingTo)}
        >
          <MessageCircle size={14} />
          Ответить
        </button>
      </div>

      {/* Reply form */}
      {replyingTo && (
        <div className="reply-form">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Напишите ответ..."
            className="reply-input"
          />
          <div className="reply-actions">
            <button className="btn-reply" onClick={handleSubmitReply}>Ответить</button>
            <button className="btn-cancel" onClick={() => setReplyingTo(false)}>Отмена</button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              level={level + 1}
              moduleColor={moduleColor}
              user={user}
              onCommentLike={onCommentLike}
              onCommentEdit={onCommentEdit}
              onCommentDelete={onCommentDelete}
              onCommentSubmit={onCommentSubmit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentItem;
