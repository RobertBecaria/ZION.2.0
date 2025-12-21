/**
 * NewsFeed Component
 * News feed with post creation and visibility options
 * Enhanced with: Image Upload, YouTube Embedding, Link Preview, Comments, Edit/Delete
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, Globe, Lock, UserCheck, Image, Video, Link2, 
  Heart, MessageCircle, Share2, MoreHorizontal, Send,
  Trash2, ChevronDown, X, Play, ExternalLink, Loader2,
  Upload, Plus, Smile, CornerDownRight, ChevronUp, Edit2, Check
} from 'lucide-react';

const VISIBILITY_OPTIONS = [
  { 
    id: 'PUBLIC', 
    label: 'Публичный', 
    icon: Globe, 
    description: 'Все могут видеть'
  },
  { 
    id: 'FRIENDS_AND_FOLLOWERS', 
    label: 'Друзья и подписчики', 
    icon: UserCheck, 
    description: 'Друзья и те, кто подписан на вас'
  },
  { 
    id: 'FRIENDS_ONLY', 
    label: 'Только друзья', 
    icon: Users, 
    description: 'Только ваши друзья'
  }
];

// Common emojis for quick access
const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '✨', '🙌', '💪', '🤔', '👏', '💯'];

const NewsFeed = ({ 
  user, 
  moduleColor = '#1D4ED8',
  channelId = null,
  channelName = null
}) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [postVisibility, setPostVisibility] = useState('PUBLIC');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [posting, setPosting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  // Media and link states
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [youtubeLinks, setYoutubeLinks] = useState([]);
  const [linkPreviews, setLinkPreviews] = useState([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const LIMIT = 20;

  const loadPosts = useCallback(async (reset = false) => {
    try {
      const token = localStorage.getItem('zion_token');
      const currentOffset = reset ? 0 : offset;
      
      const endpoint = channelId 
        ? `${BACKEND_URL}/api/news/posts/channel/${channelId}?limit=${LIMIT}&offset=${currentOffset}`
        : `${BACKEND_URL}/api/news/posts/feed?limit=${LIMIT}&offset=${currentOffset}`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (reset) {
          setPosts(data.posts || []);
          setOffset(LIMIT);
        } else {
          setPosts(prev => [...prev, ...(data.posts || [])]);
          setOffset(prev => prev + LIMIT);
        }
        setHasMore(data.has_more || false);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  }, [BACKEND_URL, channelId, offset]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadPosts(true);
  }, [channelId]);


  // Handle image selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const remainingSlots = 10 - selectedImages.length;
    const newFiles = files.slice(0, remainingSlots);
    
    const newImages = newFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substr(2, 9)
    }));
    
    setSelectedImages(prev => [...prev, ...newImages]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (imageId) => {
    setSelectedImages(prev => {
      const updated = prev.filter(img => img.id !== imageId);
      const removed = prev.find(img => img.id === imageId);
      if (removed) URL.revokeObjectURL(removed.preview);
      return updated;
    });
  };

  const uploadImages = async () => {
    if (selectedImages.length === 0) return [];
    
    setUploadingImages(true);
    const uploadedIds = [];
    
    try {
      const token = localStorage.getItem('zion_token');
      
      for (const img of selectedImages) {
        const formData = new FormData();
        formData.append('file', img.file);
        formData.append('source_module', 'community');
        
        const response = await fetch(`${BACKEND_URL}/api/media/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          uploadedIds.push(data.id || data.file_id);
        }
      }
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setUploadingImages(false);
    }
    
    return uploadedIds;
  };

  const handleAddLink = async () => {
    if (!linkInputValue.trim()) return;
    
    setFetchingPreview(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/utils/link-preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: linkInputValue.trim() })
      });
      
      if (response.ok) {
        const preview = await response.json();
        
        if (preview.is_youtube && preview.youtube_id) {
          setYoutubeLinks(prev => [...prev, {
            id: preview.youtube_id,
            url: linkInputValue.trim(),
            thumbnail: preview.image
          }]);
        } else if (preview.title || preview.image) {
          setLinkPreviews(prev => [...prev, {
            ...preview,
            localId: Math.random().toString(36).substr(2, 9)
          }]);
        }
        
        setLinkInputValue('');
        setShowLinkInput(false);
      }
    } catch (error) {
      console.error('Error fetching link preview:', error);
    } finally {
      setFetchingPreview(false);
    }
  };

  const removeYoutubeLink = (youtubeId) => {
    setYoutubeLinks(prev => prev.filter(link => link.id !== youtubeId));
  };

  const removeLinkPreview = (localId) => {
    setLinkPreviews(prev => prev.filter(link => link.localId !== localId));
  };

  const addEmoji = (emoji) => {
    setNewPostContent(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && selectedImages.length === 0 && youtubeLinks.length === 0) return;
    
    setPosting(true);
    try {
      const mediaIds = await uploadImages();
      
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/posts`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newPostContent,
          visibility: postVisibility,
          channel_id: channelId,
          media_files: mediaIds,
          youtube_urls: youtubeLinks.map(l => l.url),
          link_previews: linkPreviews.map(l => ({ url: l.url, title: l.title, image: l.image }))
        })
      });

      if (response.ok) {
        setNewPostContent('');
        setSelectedImages([]);
        setYoutubeLinks([]);
        setLinkPreviews([]);
        loadPosts(true);
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId, isLiked) => {
    try {
      const token = localStorage.getItem('zion_token');
      const method = isLiked ? 'DELETE' : 'POST';
      
      await fetch(`${BACKEND_URL}/api/news/posts/${postId}/like`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: !isLiked,
            likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Удалить этот пост?')) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
      } else {
        const data = await response.json();
        alert(data.detail || 'Не удалось удалить пост');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Ошибка при удалении поста');
    }
  };

  // Handle post edit
  const handleEdit = async (postId, newContent, newVisibility) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/posts/${postId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newContent,
          visibility: newVisibility
        })
      });

      if (response.ok) {
        const updatedPost = await response.json();
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return { ...post, content: updatedPost.content, visibility: updatedPost.visibility };
          }
          return post;
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error editing post:', error);
      return false;
    }
  };

  // Update comments count after adding a comment
  const handleCommentAdded = (postId) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return { ...post, comments_count: (post.comments_count || 0) + 1 };
      }
      return post;
    }));
  };

  const getVisibilityOption = (id) => {
    return VISIBILITY_OPTIONS.find(v => v.id === id) || VISIBILITY_OPTIONS[0];
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    return date.toLocaleDateString('ru-RU');
  };

  const selectedVisibility = getVisibilityOption(postVisibility);
  const hasContent = newPostContent.trim() || selectedImages.length > 0 || youtubeLinks.length > 0;

  return (
    <div className="news-feed">
      {/* Post Composer */}
      <div className="post-composer enhanced">
        <div className="composer-header">
          <div className="composer-avatar">
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt="" />
            ) : (
              <div 
                className="avatar-placeholder"
                style={{ backgroundColor: moduleColor }}
              >
                {user?.first_name?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="composer-input-wrapper">
            <textarea
              ref={textareaRef}
              placeholder={channelId ? `Написать в ${channelName || 'канал'}...` : "Что нового?"}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <div className="composer-images-preview">
            {selectedImages.map(img => (
              <div key={img.id} className="image-preview-item">
                <img src={img.preview} alt="Preview" />
                <button 
                  className="remove-image-btn"
                  onClick={() => removeImage(img.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {selectedImages.length < 10 && (
              <button 
                className="add-more-images-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={20} />
              </button>
            )}
          </div>
        )}

        {/* YouTube Previews */}
        {youtubeLinks.length > 0 && (
          <div className="composer-youtube-preview">
            {youtubeLinks.map(link => (
              <div key={link.id} className="youtube-preview-item">
                <div className="youtube-thumbnail">
                  <img src={link.thumbnail} alt="YouTube" />
                  <div className="play-overlay">
                    <Play size={24} fill="white" />
                  </div>
                </div>
                <button 
                  className="remove-youtube-btn"
                  onClick={() => removeYoutubeLink(link.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Link Previews */}
        {linkPreviews.length > 0 && (
          <div className="composer-link-previews">
            {linkPreviews.map(link => (
              <div key={link.localId} className="link-preview-item">
                {link.image && (
                  <div className="link-preview-image">
                    <img src={link.image} alt="" />
                  </div>
                )}
                <div className="link-preview-content">
                  <div className="link-preview-site">{link.site_name || new URL(link.url).hostname}</div>
                  <div className="link-preview-title">{link.title || link.url}</div>
                  {link.description && (
                    <div className="link-preview-desc">{link.description}</div>
                  )}
                </div>
                <button 
                  className="remove-link-btn"
                  onClick={() => removeLinkPreview(link.localId)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Link Input Field */}
        {showLinkInput && (
          <div className="link-input-wrapper">
            <input
              type="url"
              placeholder="Вставьте ссылку (YouTube, веб-сайт)..."
              value={linkInputValue}
              onChange={(e) => setLinkInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
              autoFocus
            />
            <button 
              className="add-link-btn"
              onClick={handleAddLink}
              disabled={fetchingPreview || !linkInputValue.trim()}
            >
              {fetchingPreview ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            </button>
            <button 
              className="cancel-link-btn"
              onClick={() => {
                setShowLinkInput(false);
                setLinkInputValue('');
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="emoji-picker">
            {QUICK_EMOJIS.map(emoji => (
              <button 
                key={emoji}
                className="emoji-btn"
                onClick={() => addEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="composer-footer">
          <div className="composer-attachments">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button 
              className={`attachment-btn ${selectedImages.length > 0 ? 'active' : ''}`}
              title="Добавить фото"
              onClick={() => fileInputRef.current?.click()}
              style={selectedImages.length > 0 ? { color: moduleColor } : {}}
            >
              <Image size={20} />
              {selectedImages.length > 0 && (
                <span className="attachment-count">{selectedImages.length}</span>
              )}
            </button>
            <button 
              className={`attachment-btn ${youtubeLinks.length > 0 || linkPreviews.length > 0 ? 'active' : ''}`}
              title="Добавить ссылку"
              onClick={() => setShowLinkInput(!showLinkInput)}
              style={youtubeLinks.length > 0 || linkPreviews.length > 0 ? { color: moduleColor } : {}}
            >
              <Link2 size={20} />
            </button>
            <button 
              className="attachment-btn"
              title="Добавить эмодзи"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile size={20} />
            </button>
          </div>

          <div className="composer-actions">
            {!channelId && (
              <div className="visibility-selector">
                <button 
                  className="visibility-btn"
                  onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                >
                  <selectedVisibility.icon size={16} />
                  <span>{selectedVisibility.label}</span>
                  <ChevronDown size={14} />
                </button>
                
                {showVisibilityMenu && (
                  <div className="visibility-menu">
                    {VISIBILITY_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        className={`visibility-option ${postVisibility === option.id ? 'selected' : ''}`}
                        onClick={() => {
                          setPostVisibility(option.id);
                          setShowVisibilityMenu(false);
                        }}
                      >
                        <option.icon size={18} />
                        <div className="option-text">
                          <span className="option-label">{option.label}</span>
                          <span className="option-desc">{option.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button 
              className="post-btn"
              onClick={handleCreatePost}
              disabled={!hasContent || posting || uploadingImages}
              style={{ backgroundColor: moduleColor }}
            >
              {posting || uploadingImages ? (
                <>
                  <Loader2 size={16} className="spin" />
                  {uploadingImages ? 'Загрузка...' : 'Публикация...'}
                </>
              ) : (
                'Опубликовать'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="posts-list">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Загрузка ленты...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={48} color="#9CA3AF" />
            <h3>Пока нет публикаций</h3>
            <p>{channelId ? 'В этом канале пока нет записей' : 'Будьте первым, кто что-то напишет!'}</p>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={user}
                moduleColor={moduleColor}
                onLike={handleLike}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onCommentAdded={handleCommentAdded}
                formatDate={formatDate}
                getVisibilityOption={getVisibilityOption}
                backendUrl={BACKEND_URL}
              />
            ))}
            
            {hasMore && (
              <button 
                className="load-more-btn"
                onClick={() => loadPosts()}
              >
                Загрузить ещё
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Post Card Component with Comments and Edit
const PostCard = ({ 
  post, 
  currentUser, 
  moduleColor, 
  onLike, 
  onDelete,
  onEdit,
  onCommentAdded,
  formatDate,
  getVisibilityOption,
  backendUrl
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [showReactions, setShowReactions] = useState(false);
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editVisibility, setEditVisibility] = useState(post.visibility);
  const [saving, setSaving] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const commentInputRef = useRef(null);
  
  const isAuthor = post.user_id === currentUser?.id;
  const visibility = getVisibilityOption(post.visibility);

  // Load comments
  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/news/posts/${post.id}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    const success = await onEdit(post.id, editContent, editVisibility);
    if (success) {
      setIsEditing(false);
    }
    setSaving(false);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditContent(post.content);
    setEditVisibility(post.visibility);
    setIsEditing(false);
  };

  // Toggle comments visibility
  const toggleComments = () => {
    if (!showComments) {
      loadComments();
    }
    setShowComments(!showComments);
  };

  // Submit comment
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    setSubmittingComment(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/news/posts/${post.id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newComment,
          parent_comment_id: replyingTo?.id || null
        })
      });
      
      if (response.ok) {
        const newCommentData = await response.json();
        
        if (replyingTo) {
          // Add reply to parent comment
          setComments(prev => prev.map(c => {
            if (c.id === replyingTo.id) {
              return { ...c, replies: [...(c.replies || []), newCommentData] };
            }
            return c;
          }));
        } else {
          // Add as top-level comment
          setComments(prev => [...prev, newCommentData]);
          onCommentAdded(post.id);
        }
        
        setNewComment('');
        setReplyingTo(null);
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId, isReply = false, parentId = null) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/news/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        if (isReply && parentId) {
          setComments(prev => prev.map(c => {
            if (c.id === parentId) {
              return { ...c, replies: c.replies.filter(r => r.id !== commentId) };
            }
            return c;
          }));
        } else {
          setComments(prev => prev.filter(c => c.id !== commentId));
        }
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Like comment
  const handleLikeComment = async (commentId, isReply = false, parentId = null) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/news/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        const updateComment = (comment) => {
          if (comment.id === commentId) {
            return { ...comment, user_liked: data.liked, likes_count: data.likes_count };
          }
          return comment;
        };
        
        if (isReply && parentId) {
          setComments(prev => prev.map(c => {
            if (c.id === parentId) {
              return { ...c, replies: c.replies.map(updateComment) };
            }
            return c;
          }));
        } else {
          setComments(prev => prev.map(updateComment));
        }
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  // Edit comment
  const handleEditComment = async (commentId, newContent, isReply = false, parentId = null) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/news/comments/${commentId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newContent })
      });
      
      if (response.ok) {
        const updatedComment = await response.json();
        
        const updateComment = (comment) => {
          if (comment.id === commentId) {
            return { ...comment, content: newContent, is_edited: true };
          }
          return comment;
        };
        
        if (isReply && parentId) {
          setComments(prev => prev.map(c => {
            if (c.id === parentId) {
              return { ...c, replies: c.replies.map(updateComment) };
            }
            return c;
          }));
        } else {
          setComments(prev => prev.map(updateComment));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error editing comment:', error);
      return false;
    }
  };

  // Set reply mode
  const handleReply = (comment) => {
    setReplyingTo(comment);
    commentInputRef.current?.focus();
  };

  // Extract YouTube ID from URL
  const getYoutubeId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="post-author">
          <div className="author-avatar">
            {post.author?.profile_picture ? (
              <img src={post.author.profile_picture} alt="" />
            ) : (
              <div 
                className="avatar-placeholder"
                style={{ backgroundColor: moduleColor }}
              >
                {post.author?.first_name?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="author-info">
            <div className="author-name-row">
              <span className="author-name">
                {post.author?.first_name} {post.author?.last_name}
              </span>
              {post.channel && (
                <span className="channel-badge">
                  → {post.channel.name}
                </span>
              )}
            </div>
            <div className="post-meta">
              <span className="post-date">{formatDate(post.created_at)}</span>
              <span className="visibility-badge" title={visibility.description}>
                <visibility.icon size={12} />
              </span>
            </div>
          </div>
        </div>

        {isAuthor && !isEditing && (
          <div className="post-menu-wrapper">
            <button 
              className="menu-btn"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreHorizontal size={20} />
            </button>
            {showMenu && (
              <div className="post-menu">
                <button 
                  className="menu-item edit"
                  onClick={() => {
                    setShowMenu(false);
                    setIsEditing(true);
                  }}
                >
                  <Edit2 size={16} />
                  Редактировать
                </button>
                <button 
                  className="menu-item delete"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(post.id);
                  }}
                >
                  <Trash2 size={16} />
                  Удалить
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Content - Edit Mode or View Mode */}
      {isEditing ? (
        <div className="post-edit-mode">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Введите текст поста..."
            rows={4}
            autoFocus
          />
          <div className="edit-actions">
            <button 
              className="cancel-edit-btn"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              <X size={16} />
              Отмена
            </button>
            <button 
              className="save-edit-btn"
              onClick={handleSaveEdit}
              disabled={saving || !editContent.trim()}
              style={{ backgroundColor: moduleColor }}
            >
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        <div className="post-content">
          <p>{post.content}</p>
        </div>
      )}

      {/* Media Gallery */}
      {post.media_files && post.media_files.length > 0 && (
        <div className={`post-media-gallery gallery-${Math.min(post.media_files.length, 4)}`}>
          {post.media_files.slice(0, 4).map((mediaId, index) => (
            <div key={mediaId} className="media-item">
              <img 
                src={`${backendUrl}/api/media/${mediaId}`} 
                alt=""
                loading="lazy"
              />
              {index === 3 && post.media_files.length > 4 && (
                <div className="more-overlay">
                  +{post.media_files.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* YouTube Embeds */}
      {post.youtube_urls && post.youtube_urls.length > 0 && (
        <div className="post-youtube-embeds">
          {post.youtube_urls.map((url, index) => {
            const youtubeId = getYoutubeId(url);
            if (!youtubeId) return null;
            
            return (
              <div key={index} className="youtube-embed">
                {playingVideo === youtubeId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                    title="YouTube video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div 
                    className="youtube-thumbnail-wrapper"
                    onClick={() => setPlayingVideo(youtubeId)}
                  >
                    <img 
                      src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                      alt="YouTube thumbnail"
                    />
                    <div className="play-button">
                      <Play size={48} fill="white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Post Actions - Enhanced with Emoji Reactions */}
      <div className="enhanced-post-actions-news">
        {/* Reaction Summary */}
        {(post.likes_count > 0 || post.reactions_count > 0) && (
          <div className="reaction-summary-bar-news">
            <div className="reaction-summary-left-news">
              {post.likes_count > 0 && (
                <span className="like-indicator-news" style={{ background: '#ef4444' }}>
                  <Heart size={10} color="white" fill="white" />
                </span>
              )}
              {post.top_reactions && post.top_reactions.map((r, i) => (
                <span key={i} className="reaction-emoji-news">{r.emoji}</span>
              ))}
              <span className="reaction-count-news">
                {(post.likes_count || 0) + (post.reactions_count || 0)} реакций
              </span>
            </div>
            {post.comments_count > 0 && (
              <span className="comments-count-link-news" onClick={toggleComments}>
                {post.comments_count} комментариев
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons-row-news">
          <div 
            className="action-button-container-news"
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setTimeout(() => setShowReactions(false), 300)}
          >
            <button 
              className={`action-button-news ${post.is_liked || post.user_reaction ? 'active' : ''}`}
              onClick={() => onLike(post.id, post.is_liked)}
              style={{ 
                color: (post.is_liked || post.user_reaction) ? '#ef4444' : undefined,
                background: (post.is_liked || post.user_reaction) ? '#fef2f2' : undefined
              }}
            >
              {post.user_reaction ? (
                <span className="user-reaction-emoji-news">{post.user_reaction}</span>
              ) : (
                <Heart size={20} fill={post.is_liked ? '#ef4444' : 'none'} />
              )}
              <span>{post.user_reaction ? 'Реакция' : (post.is_liked ? 'Нравится' : 'Нравится')}</span>
            </button>

            {/* Quick Reaction Picker */}
            {showReactions && (
              <div className="quick-reaction-picker-news">
                {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji, index) => (
                  <button
                    key={emoji}
                    className="quick-reaction-btn-news"
                    onClick={() => {
                      onReaction && onReaction(post.id, emoji);
                      setShowReactions(false);
                    }}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button 
            className={`action-button-news ${showComments ? 'active' : ''}`}
            onClick={toggleComments}
            style={showComments ? { color: moduleColor, background: `${moduleColor}10` } : {}}
          >
            <MessageCircle size={20} />
            <span>Комментарий</span>
          </button>
          
          <button className="action-button-news">
            <Share2 size={20} />
            <span>Поделиться</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="comments-section">
          {/* Comment Input */}
          <form className="comment-input-form" onSubmit={handleSubmitComment}>
            {replyingTo && (
              <div className="replying-to">
                <CornerDownRight size={14} />
                <span>Ответ для {replyingTo.author?.first_name}</span>
                <button type="button" onClick={() => setReplyingTo(null)}>
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="comment-input-row">
              <div className="comment-input-avatar">
                {currentUser?.profile_picture ? (
                  <img src={currentUser.profile_picture} alt="" />
                ) : (
                  <div className="avatar-placeholder small" style={{ backgroundColor: moduleColor }}>
                    {currentUser?.first_name?.[0] || '?'}
                  </div>
                )}
              </div>
              <input
                ref={commentInputRef}
                type="text"
                placeholder={replyingTo ? "Написать ответ..." : "Написать комментарий..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button 
                type="submit"
                disabled={!newComment.trim() || submittingComment}
                style={{ color: moduleColor }}
              >
                {submittingComment ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              </button>
            </div>
          </form>

          {/* Comments List */}
          {loadingComments ? (
            <div className="comments-loading">
              <Loader2 size={20} className="spin" />
              <span>Загрузка комментариев...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="no-comments">
              <MessageCircle size={24} />
              <span>Пока нет комментариев</span>
            </div>
          ) : (
            <div className="comments-list">
              {comments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUser?.id}
                  moduleColor={moduleColor}
                  onReply={handleReply}
                  onDelete={handleDeleteComment}
                  onLike={handleLikeComment}
                  onEdit={handleEditComment}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Comment Item Component with Edit functionality
const CommentItem = ({ 
  comment, 
  currentUserId, 
  moduleColor, 
  onReply, 
  onDelete, 
  onLike,
  onEdit,
  formatDate,
  isReply = false,
  parentId = null
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  
  const isAuthor = comment.user_id === currentUserId;
  const hasReplies = comment.replies && comment.replies.length > 0;

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText === comment.content) {
      setIsEditing(false);
      setEditText(comment.content);
      return;
    }
    
    setSaving(true);
    const success = await onEdit(comment.id, editText, isReply, parentId);
    if (success) {
      setIsEditing(false);
    } else {
      setEditText(comment.content);
    }
    setSaving(false);
  };

  const handleCancelEdit = () => {
    setEditText(comment.content);
    setIsEditing(false);
  };

  return (
    <div className={`comment-item ${isReply ? 'reply' : ''}`}>
      <div className="comment-avatar">
        {comment.author?.profile_picture ? (
          <img src={comment.author.profile_picture} alt="" />
        ) : (
          <div className="avatar-placeholder small" style={{ backgroundColor: moduleColor }}>
            {comment.author?.first_name?.[0] || '?'}
          </div>
        )}
      </div>
      
      <div className="comment-body">
        <div className="comment-bubble">
          <span className="comment-author-name">
            {comment.author?.first_name} {comment.author?.last_name}
          </span>
          
          {isEditing ? (
            <div className="comment-edit-inline">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="comment-edit-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <div className="comment-edit-buttons">
                <button 
                  onClick={handleSaveEdit} 
                  disabled={saving}
                  className="save-btn"
                  style={{ color: moduleColor }}
                >
                  {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                </button>
                <button onClick={handleCancelEdit} className="cancel-btn">
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <p className="comment-text">{comment.content}</p>
          )}
          
          {comment.is_edited && !isEditing && (
            <span className="comment-edited-badge">изменено</span>
          )}
        </div>
        
        <div className="comment-actions">
          <span className="comment-time">{formatDate(comment.created_at)}</span>
          
          <button 
            className={`comment-action-btn like-btn ${comment.user_liked ? 'liked' : ''}`}
            onClick={() => onLike(comment.id, isReply, parentId)}
          >
            <Heart 
              size={14} 
              fill={comment.user_liked ? '#ef4444' : 'none'} 
              color={comment.user_liked ? '#ef4444' : 'currentColor'}
            />
            {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
          </button>
          
          {!isReply && (
            <button 
              className="comment-action-btn reply-btn"
              onClick={() => onReply(comment)}
            >
              <CornerDownRight size={14} />
              Ответить
            </button>
          )}
          
          {isAuthor && !isEditing && (
            <>
              <button 
                className="comment-action-btn edit-btn"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 size={14} />
              </button>
              <button 
                className="comment-action-btn delete-btn"
                onClick={() => onDelete(comment.id, isReply, parentId)}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>

        {/* Replies */}
        {hasReplies && !isReply && (
          <div className="comment-replies">
            <button 
              className="show-replies-btn"
              onClick={() => setShowReplies(!showReplies)}
              style={{ color: moduleColor }}
            >
              {showReplies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showReplies ? 'Скрыть ответы' : `Показать ответы (${comment.replies.length})`}
            </button>
            
            {showReplies && (
              <div className="replies-list">
                {comment.replies.map(reply => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    currentUserId={currentUserId}
                    moduleColor={moduleColor}
                    onReply={onReply}
                    onDelete={onDelete}
                    onLike={onLike}
                    onEdit={onEdit}
                    formatDate={formatDate}
                    isReply={true}
                    parentId={comment.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsFeed;
