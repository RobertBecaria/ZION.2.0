import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Image, Smile, Heart, MessageCircle, Share2, 
  MoreHorizontal, User, Calendar, Clock, MapPin, Paperclip, X,
  FileText, Upload, Edit3, Trash2, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Download, ZoomIn
} from 'lucide-react';
import { useLightbox } from '../hooks/useLightbox';
import LightboxModal from './LightboxModal';
import { triggerConfetti, toast } from '../utils/animations';

function UniversalWall({ 
  activeGroup, 
  moduleColor = "#059669",
  moduleName = "Family",
  user,
  activeModule = 'family'  // New prop for current module
}) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedMediaIds, setUploadedMediaIds] = useState([]);
  const [showComments, setShowComments] = useState({});
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [editingComment, setEditingComment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const fileInputRef = useRef(null);
  
  // Family Filter State (only for family module)
  const [familyFilter, setFamilyFilter] = useState('all'); // 'my-family' | 'subscribed' | 'all'
  
  // Use the shared lightbox hook
  const {
    lightboxImage,
    lightboxImages,
    lightboxIndex,
    openLightbox,
    closeLightbox,
    nextImage,
    prevImage
  } = useLightbox();
  
  // Get backend URL properly
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  // Popular emojis for quick reaction
  const popularEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];
  const allEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "🔥", "👏", "🤔", "💯"];

  useEffect(() => {
    fetchPosts();
    fetchNotifications();
    
    // Add keyboard event listeners for modal
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const modal = document.querySelector('.modal-overlay');
        if (modal && modal.style.display === 'flex') {
          modal.style.display = 'none';
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeGroup, activeModule]); // Re-fetch posts when activeModule changes

  const fetchPosts = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/posts?module=${activeModule}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const postsData = await response.json();
        setPosts(postsData);
      } else {
        console.error('Failed to fetch posts');
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/notifications?unread_only=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const notificationsData = await response.json();
        setNotifications(notificationsData);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchComments = async (postId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/posts/${postId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const commentsData = await response.json();
        setComments(prev => ({
          ...prev,
          [postId]: commentsData
        }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if ((!newPost.trim() && selectedFiles.length === 0) || loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      
      // Create FormData for post creation
      const formData = new FormData();
      formData.append('content', newPost.trim() || ' '); // Ensure there's some content
      
      // Add source module based on current active module
      formData.append('source_module', activeModule);
      formData.append('target_audience', 'module'); // Module-specific audience
      
      // Add uploaded media file IDs
      uploadedMediaIds.forEach(id => {
        formData.append('media_file_ids', id);
      });

      const response = await fetch(`${backendUrl}/api/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const newPostData = await response.json();
        
        // Reset form state
        setNewPost('');
        setSelectedFiles([]);
        setUploadedMediaIds([]);
        
        // Always refetch posts to ensure module consistency
        fetchPosts();
        
        // Close modal with animation
        const modal = document.querySelector('.modal-overlay');
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        setTimeout(() => {
          modal.style.display = 'none';
          modal.style.opacity = '1';
          modal.style.transform = 'scale(1)';
        }, 200);
        
        // 🎉 Show success feedback with confetti!
        triggerConfetti(document.body, {
          particleCount: 40,
          colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6']
        });
        
        toast.success(
          'Ваш пост успешно опубликован!',
          'Успех!',
          { duration: 3500 }
        );
        
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Failed to create post: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert(`Failed to create post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        // Update post in local state
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              user_liked: result.liked,
              likes_count: result.liked ? post.likes_count + 1 : post.likes_count - 1
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleReaction = async (postId, emoji) => {
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('emoji', emoji);

      const response = await fetch(`${backendUrl}/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        // Refresh posts to get updated reactions
        fetchPosts();
        setShowEmojiPicker(prev => ({
          ...prev,
          [postId]: false
        }));
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleCommentSubmit = async (postId, content, parentCommentId = null) => {
    if (!content.trim()) return;

    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('content', content);
      if (parentCommentId) {
        formData.append('parent_comment_id', parentCommentId);
      }

      const response = await fetch(`${backendUrl}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        // Refresh comments and post to get updated counts
        await fetchComments(postId);
        fetchPosts();
        
        // Clear comment input
        setNewComment(prev => ({
          ...prev,
          [parentCommentId || postId]: ''
        }));
        setReplyingTo(null);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  const handleCommentLike = async (commentId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Refresh all comments to get updated like status
        Object.keys(comments).forEach(postId => {
          fetchComments(postId);
        });
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleCommentEdit = async (commentId, newContent) => {
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('content', newContent);

      const response = await fetch(`${backendUrl}/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        // Refresh comments
        Object.keys(comments).forEach(postId => {
          fetchComments(postId);
        });
        setEditingComment(null);
      }
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!window.confirm('Удалить комментарий?')) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Refresh comments and posts
        Object.keys(comments).forEach(postId => {
          fetchComments(postId);
        });
        fetchPosts();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const toggleComments = (postId) => {
    setShowComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
    
    // Load comments if not already loaded
    if (!comments[postId]) {
      fetchComments(postId);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60 * 1000) return 'только что';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} мин назад`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} ч назад`;
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Add files to preview
    setSelectedFiles(prev => [...prev, ...files]);
    setUploadingFiles(files.map(f => f.name));

    // Upload files immediately with proper module tagging
    try {
      const token = localStorage.getItem('zion_token');
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // Map module names to backend format
        const moduleMapping = {
          'Family': 'family',
          'Organizations': 'work',
          'Services': 'business',
          'News': 'community',
          'Journal': 'personal',
          'Marketplace': 'business',
          'Finance': 'business',
          'Events': 'community'
        };
        
        const backendModule = moduleMapping[moduleName] || 'personal';
        formData.append('source_module', backendModule);
        formData.append('privacy_level', 'module');

        const response = await fetch(`${backendUrl}/api/media/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          return result.id;
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      });

      const uploadedIds = await Promise.all(uploadPromises);
      setUploadedMediaIds(prev => [...prev, ...uploadedIds]);
      setUploadingFiles([]);
      
      // 🎉 Trigger confetti celebration!
      triggerConfetti(document.body, {
        particleCount: files.length * 20, // More files = more confetti!
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4']
      });
      
      // Show success feedback
      toast.success(
        `Загружено ${files.length} файлов в пост!`,
        'Успех!',
        { duration: 3000 }
      );
      
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error(`Ошибка загрузки: ${error.message}`, 'Ошибка');
      alert(`Upload failed: ${error.message}`);
      setUploadingFiles([]);
      
      // Remove failed files from preview
      setSelectedFiles(prev => prev.slice(0, -files.length));
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <Image size={32} />;
    } else if (file.type.startsWith('video/')) {
      return <Image size={32} />; // You could add a Video icon from lucide-react
    } else if (file.type.includes('pdf')) {
      return <FileText size={32} color="#DC2626" />;
    } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      return <FileText size={32} color="#1D4ED8" />;
    } else if (file.type.includes('powerpoint') || file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) {
      return <FileText size={32} color="#DC2626" />;
    } else if (file.type.includes('excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      return <FileText size={32} color="#059669" />;
    } else {
      return <FileText size={32} />;
    }
  };

  const getFileGradient = (file) => {
    if (file.type.includes('pdf')) {
      return 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)';
    } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      return 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)';
    } else if (file.type.includes('powerpoint') || file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) {
      return 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)';
    } else if (file.type.includes('excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      return 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    } else {
      return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMediaIds(prev => prev.filter((_, i) => i !== index));
  };

  const extractYouTubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const showPostForm = () => {
    document.querySelector('.modal-overlay').style.display = 'flex';
    // Focus on textarea after modal animation
    setTimeout(() => {
      const textarea = document.querySelector('.post-textarea');
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  };

  const renderComment = (comment, postId, level = 0) => (
    <div key={comment.id} className={`comment-item ${level > 0 ? 'comment-reply' : ''}`} style={{marginLeft: `${level * 20}px`}}>
      <div className="comment-header">
        <div className="comment-author">
          <div className="author-avatar" style={{ backgroundColor: moduleColor }}>
            <User size={16} color="white" />
          </div>
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
            <button 
              className="comment-action-btn"
              onClick={() => setEditingComment(comment.id)}
            >
              <Edit3 size={14} />
            </button>
            <button 
              className="comment-action-btn"
              onClick={() => handleCommentDelete(comment.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="comment-content">
        {editingComment === comment.id ? (
          <div className="comment-edit-form">
            <textarea
              value={newComment[comment.id] || comment.content}
              onChange={(e) => setNewComment(prev => ({
                ...prev,
                [comment.id]: e.target.value
              }))}
              className="comment-edit-input"
            />
            <div className="comment-edit-actions">
              <button 
                className="btn-save"
                onClick={() => handleCommentEdit(comment.id, newComment[comment.id] || comment.content)}
              >
                Сохранить
              </button>
              <button 
                className="btn-cancel"
                onClick={() => setEditingComment(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <p>{comment.content}</p>
        )}
      </div>

      <div className="comment-stats">
        <button 
          className={`comment-stat-btn ${comment.user_liked ? 'liked' : ''}`}
          onClick={() => handleCommentLike(comment.id)}
        >
          <Heart size={14} fill={comment.user_liked ? moduleColor : 'none'} />
          {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
        </button>
        <button 
          className="comment-stat-btn"
          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
        >
          <MessageCircle size={14} />
          Ответить
        </button>
      </div>

      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="reply-form">
          <textarea
            value={newComment[comment.id] || ''}
            onChange={(e) => setNewComment(prev => ({
              ...prev,
              [comment.id]: e.target.value
            }))}
            placeholder="Напишите ответ..."
            className="reply-input"
          />
          <div className="reply-actions">
            <button 
              className="btn-reply"
              onClick={() => handleCommentSubmit(postId, newComment[comment.id], comment.id)}
            >
              Ответить
            </button>
            <button 
              className="btn-cancel"
              onClick={() => setReplyingTo(null)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map(reply => renderComment(reply, postId, level + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="universal-wall">
      {/* Post Creation Form */}
      <div className="wall-header">
        <div className="post-composer">
          <div className="post-input-placeholder" onClick={showPostForm}>
            <div className="composer-avatar" style={{ backgroundColor: moduleColor }}>
              <User size={20} color="white" />
            </div>
            <div className="composer-placeholder">
              Что у Вас нового?
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Post Creation Modal */}
      <div 
        className="modal-overlay" 
        style={{ display: 'none' }}
        onClick={(e) => {
          if (e.target.classList.contains('modal-overlay')) {
            document.querySelector('.modal-overlay').style.display = 'none';
          }
        }}
      >
        <div className="post-form">
          <form onSubmit={handlePostSubmit}>
            <div className="form-header">
              <h4>Создать запись</h4>
              <button 
                type="button" 
                className="close-btn"
                onClick={() => document.querySelector('.modal-overlay').style.display = 'none'}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="form-body">
              {/* Author Section */}
              <div className="form-author-section">
                <div className="form-author-avatar" style={{ backgroundColor: moduleColor }}>
                  <User size={20} color="white" />
                </div>
                <div className="form-author-info">
                  <h5>{user?.first_name} {user?.last_name}</h5>
                  <p>Публикуется в модуле "{moduleName}"</p>
                </div>
              </div>

              {/* Enhanced Textarea */}
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Что у Вас нового?"
                className="post-textarea"
                rows="3"
                autoFocus
              />
              
              {/* File Previews */}
              {selectedFiles.length > 0 && (
                <div className="file-previews">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="file-preview">
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Preview" 
                          className="preview-image"
                        />
                      ) : (
                        <div 
                          className="preview-document"
                          style={{ background: getFileGradient(file) }}
                        >
                          {getFileIcon(file)}
                          <div className="document-name">{file.name}</div>
                          <div className="document-size">
                            {(file.size / (1024 * 1024)).toFixed(1)}MB
                          </div>
                        </div>
                      )}
                      <button 
                        type="button"
                        className="remove-file-btn"
                        onClick={() => removeSelectedFile(index)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Upload Progress */}
              {uploadingFiles.length > 0 && (
                <div className="upload-progress">
                  <p>Загружаем файлы...</p>
                  {uploadingFiles.map((filename, index) => (
                    <div key={index} className="uploading-file">
                      <div className="upload-spinner"></div>
                      {filename}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="form-actions">
              <div className="media-actions">
                <span className="media-actions-label">Добавить:</span>
                <button 
                  type="button" 
                  className={`media-btn ${selectedFiles.some(f => f.type.startsWith('image/')) ? 'has-files' : ''}`}
                  onClick={() => {
                    fileInputRef.current.accept = "image/jpeg,image/png,image/gif,video/mp4,video/webm,video/ogg";
                    fileInputRef.current?.click();
                  }}
                  title="Добавить фото/видео"
                >
                  <Image size={24} />
                  {selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length > 0 && (
                    <span className="file-count-badge">
                      {selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length}
                    </span>
                  )}
                </button>
                
                <button 
                  type="button" 
                  className={`media-btn ${selectedFiles.some(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')) ? 'has-files' : ''}`}
                  onClick={() => {
                    fileInputRef.current.accept = "application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
                    fileInputRef.current?.click();
                  }}
                  title="Добавить документы"
                >
                  <Paperclip size={24} />
                  {selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')).length > 0 && (
                    <span className="file-count-badge">
                      {selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')).length}
                    </span>
                  )}
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,video/mp4,video/webm,video/ogg,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>
              
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading || (!newPost.trim() && selectedFiles.length === 0)}
                style={{ backgroundColor: loading ? undefined : moduleColor }}
              >
                {loading ? 'Публикуем...' : 'Опубликовать'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="posts-feed">
        {posts.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-content">
              <MessageCircle size={48} color="#9ca3af" />
              <h4>Пока нет записей</h4>
              <p>Станьте первым, кто поделится новостями!</p>
            </div>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="post-item">
              <div className="post-header">
                <div className="post-author">
                  <div className="author-avatar" style={{ backgroundColor: moduleColor }}>
                    <User size={20} color="white" />
                  </div>
                  <div className="author-info">
                    <h5>{post.author.first_name} {post.author.last_name}</h5>
                    <span className="post-time">{formatTime(post.created_at)}</span>
                  </div>
                </div>
                <button className="post-menu-btn">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="post-content">
                <p>{post.content}</p>
                
                {/* Display Media Files */}
                {post.media_files && post.media_files.length > 0 && (
                  <div className="post-media">
                    {post.media_files.map((media, index) => (
                      <div key={index} className="media-item">
                        {media.file_type === 'image' ? (
                          <div 
                            className="image-container"
                            onClick={() => {
                              const postImages = post.media_files
                                .filter(m => m.file_type === 'image')
                                .map(m => `${backendUrl}${m.file_url}`);
                              const imageIndex = postImages.indexOf(`${backendUrl}${media.file_url}`);
                              openLightbox(`${backendUrl}${media.file_url}`, postImages, imageIndex);
                            }}
                          >
                            <img 
                              src={`${backendUrl}${media.file_url}`}
                              alt={media.original_filename}
                              className="media-image clickable-image"
                            />
                            <div className="image-overlay">
                              <ZoomIn size={20} color="white" />
                            </div>
                          </div>
                        ) : (
                          <div className="media-document">
                            <FileText size={24} />
                            <div className="doc-info">
                              <span className="doc-name">{media.original_filename}</span>
                              <span className="doc-size">
                                {(media.file_size / (1024 * 1024)).toFixed(1)}MB
                              </span>
                            </div>
                            <a 
                              href={`${backendUrl}${media.file_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="doc-download-btn"
                            >
                              <Download size={16} />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Display YouTube Videos */}
                {post.youtube_urls && post.youtube_urls.length > 0 && (
                  <div className="post-youtube">
                    {post.youtube_urls.map((url, index) => {
                      const videoId = extractYouTubeId(url);
                      return videoId ? (
                        <div key={index} className="youtube-embed">
                          <iframe
                            width="100%"
                            height="315"
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title={`YouTube video ${index + 1}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          ></iframe>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {/* Post Stats */}
              <div className="post-stats">
                <div className="stats-left">
                  {post.likes_count > 0 && (
                    <span className="stat-item">
                      <Heart size={16} />
                      {post.likes_count}
                    </span>
                  )}
                  {post.top_reactions && post.top_reactions.length > 0 && (
                    <div className="reactions-summary">
                      {post.top_reactions.map((reaction, index) => (
                        <span key={index} className="reaction-item">
                          {reaction.emoji} {reaction.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="stats-right">
                  {post.comments_count > 0 && (
                    <span 
                      className="stat-item clickable"
                      onClick={() => toggleComments(post.id)}
                    >
                      {post.comments_count} комментариев
                    </span>
                  )}
                </div>
              </div>

              {/* Post Actions Bar */}
              <div className="post-actions-bar">
                <button 
                  className={`post-action-btn ${post.user_liked ? 'liked' : ''}`}
                  onClick={() => handleLike(post.id)}
                  style={{ color: post.user_liked ? moduleColor : undefined }}
                >
                  <Heart size={18} fill={post.user_liked ? moduleColor : 'none'} />
                  <span>Нравится</span>
                </button>
                
                <button 
                  className="post-action-btn"
                  onClick={() => toggleComments(post.id)}
                >
                  <MessageCircle size={18} />
                  <span>Комментировать</span>
                </button>
                
                <div className="emoji-picker-container">
                  <button 
                    className={`post-action-btn ${post.user_reaction ? 'reacted' : ''}`}
                    onClick={() => setShowEmojiPicker(prev => ({
                      ...prev,
                      [post.id]: !prev[post.id]
                    }))}
                  >
                    <Smile size={18} />
                    <span>{post.user_reaction || 'Реакция'}</span>
                  </button>
                  
                  {showEmojiPicker[post.id] && (
                    <div className="emoji-picker">
                      <div className="popular-emojis">
                        {popularEmojis.map(emoji => (
                          <button
                            key={emoji}
                            className="emoji-btn"
                            onClick={() => handleReaction(post.id, emoji)}
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
                                onClick={() => handleReaction(post.id, emoji)}
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

              {/* Comments Section */}
              {showComments[post.id] && (
                <div className="comments-section">
                  {/* Comment Input */}
                  <div className="comment-input-container">
                    <div className="comment-input-wrapper">
                      <div className="comment-avatar" style={{ backgroundColor: moduleColor }}>
                        <User size={16} color="white" />
                      </div>
                      <textarea
                        value={newComment[post.id] || ''}
                        onChange={(e) => setNewComment(prev => ({
                          ...prev,
                          [post.id]: e.target.value
                        }))}
                        placeholder="Напишите комментарий..."
                        className="comment-input"
                        rows="1"
                      />
                      <button 
                        className="comment-submit-btn"
                        onClick={() => handleCommentSubmit(post.id, newComment[post.id])}
                        disabled={!newComment[post.id]?.trim()}
                        style={{ color: moduleColor }}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="comments-list">
                    {comments[post.id] ? (
                      comments[post.id].length > 0 ? (
                        comments[post.id].map(comment => renderComment(comment, post.id))
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
              )}
            </div>
          ))
        )}
      </div>

      {/* Lightbox Modal */}
      <LightboxModal
        lightboxImage={lightboxImage}
        lightboxImages={lightboxImages}
        lightboxIndex={lightboxIndex}
        closeLightbox={closeLightbox}
        nextImage={nextImage}
        prevImage={prevImage}
      />
    </div>
  );
}

export default UniversalWall;